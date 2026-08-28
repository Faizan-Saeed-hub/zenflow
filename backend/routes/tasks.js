import { Router } from "express";
import { getPool } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

function planRank(code) {
  const m = String(code || "").match(/^F(\d+)$/i);
  return m ? Number(m[1]) : 0;
}

function getUnitReward(plan) {
  if (!plan) return 30; // Intern: 5 tasks * 30 = Rs. 150/day
  const dailyIncome = Number(plan.daily_income || 150);
  const dailyTasks = Math.max(1, Number(plan.daily_tasks || 5));
  return Math.round((dailyIncome / dailyTasks) * 100) / 100;
}

async function getActivePlan(db, userId) {
  const [[p]] = await db.query(
    `SELECT p.id, p.code, p.name, p.price, p.daily_tasks, p.daily_income
     FROM user_plans up
     JOIN plans p ON p.id = up.plan_id
     WHERE up.user_id = ? AND up.status = 'active' AND (up.expires_at IS NULL OR up.expires_at > NOW())
     ORDER BY CAST(SUBSTRING(p.code, 2) AS UNSIGNED) DESC, up.started_at DESC
     LIMIT 1`,
    [userId]
  );
  return p || null;
}

async function getInternTrialStatus(db, userId, plan) {
  if (plan) {
    return { isIntern: false, trialExpired: false, trialDay: null };
  }
  const [[userRow]] = await db.query(
    "SELECT created_at, DATEDIFF(CURDATE(), DATE(created_at)) AS days_since_reg FROM users WHERE id=?",
    [userId]
  );
  const [[pastDaysRow]] = await db.query(
    "SELECT COUNT(DISTINCT task_date) AS days_count FROM task_submissions WHERE user_id=? AND status='approved' AND task_date < CURDATE()",
    [userId]
  );
  const pastTaskDays = Number(pastDaysRow?.days_count || 0);
  const daysSinceReg = Number(userRow?.days_since_reg || 0);

  if (pastTaskDays >= 3 || daysSinceReg >= 3) {
    return { isIntern: true, trialExpired: true, trialDay: 4 };
  }
  const currentDay = Math.min(3, Math.max(pastTaskDays + 1, daysSinceReg + 1));
  return { isIntern: true, trialExpired: false, trialDay: currentDay };
}

function hasTaskAccess(task, plan, isTrialActive = false) {
  const req = String(task?.plan_required || "").trim().toUpperCase();

  // If user has no active plan and trial is expired -> locked
  if (!plan && !isTrialActive) return false;

  // No requirement / All Users (Intern & F1-F9)
  if (!req || req === "ALL" || req === "NONE") {
    return true;
  }

  // Only Intern (Trial users)
  if (req === "INTERN_ONLY" || req === "ONLY_INTERN" || req === "INTERN") {
    return Boolean(!plan && isTrialActive);
  }

  // Intern and F1 only
  if (req === "INTERN_F1" || req === "INTERN_AND_F1") {
    if (!plan && isTrialActive) return true;
    return Boolean(plan && planRank(plan.code) === 1);
  }

  // Exact plan matching
  if (req === "F1_ONLY") return Boolean(plan && planRank(plan.code) === 1);
  if (req === "F2_ONLY") return Boolean(plan && planRank(plan.code) === 2);
  if (req === "F3_ONLY") return Boolean(plan && planRank(plan.code) === 3);

  // Minimum plan required (e.g. F1, F2, F3... or F1_ABOVE)
  const reqRank = planRank(req);
  if (reqRank > 0) {
    if (!plan) return false;
    return planRank(plan.code) >= reqRank;
  }

  return true;
}

router.get("/", async (req, res) => {
  const db = getPool();
  const plan = await getActivePlan(db, req.user.id);
  const trial = await getInternTrialStatus(db, req.user.id, plan);
  const isTrialActive = trial.isIntern && !trial.trialExpired;

  const dailyLimit = plan ? Number(plan.daily_tasks || 5) : 5;
  const unitReward = getUnitReward(plan);

  const [[counts]] = await db.query(
    `SELECT
       COUNT(*) total_today,
       COALESCE(SUM(CASE WHEN ts.status='approved' THEN 1 ELSE 0 END),0) completed_today,
       COALESCE(SUM(CASE WHEN ts.status='approved' THEN ts.reward ELSE 0 END),0) today_earnings
     FROM task_submissions ts
     WHERE ts.user_id=? AND ts.task_date=CURDATE()`,
    [req.user.id]
  );

  const limit = dailyLimit;
  const [rows] = await db.query(
    `SELECT t.id, t.title, t.description, t.image_url,
            t.plan_required, t.status,
            COALESCE(ts.status,'not_started') submission_status,
            ts.rating, ts.review_text, ts.task_date, ts.reward_claimed_at, ts.completed_at
     FROM tasks t
     LEFT JOIN task_submissions ts ON ts.task_id=t.id AND ts.user_id=? AND ts.task_date=CURDATE()
     WHERE t.status='active'
     ORDER BY t.id`,
    [req.user.id]
  );

  const remaining = trial.trialExpired ? 0 : Math.max(0, limit - Number(counts.completed_today || 0));

  const accessibleRows = rows.map((r) => {
    const accessible = trial.trialExpired ? false : hasTaskAccess(r, plan, isTrialActive);
    return {
      ...r,
      reward: unitReward,
      locked: !accessible,
      activePlan: plan?.code || (trial.trialExpired ? "Trial Expired" : `Intern (Day ${trial.trialDay}/3)`)
    };
  });

  const completedRows = accessibleRows.filter((r) => r.submission_status === "approved");
  const availableRows = accessibleRows.filter((r) => !r.locked && r.submission_status !== "approved").slice(0, remaining);

  res.json({
    tasks: trial.trialExpired ? [] : [...availableRows, ...completedRows],
    meta: {
      dailyLimit: limit,
      completedToday: Number(counts.completed_today || 0),
      remaining,
      todayEarnings: Number(counts.today_earnings || 0),
      trialExpired: trial.trialExpired,
      trialDay: trial.trialDay,
      plan: plan
        ? { code: plan.code, name: plan.name, dailyIncome: Number(plan.daily_income), dailyTasks: Number(plan.daily_tasks) }
        : { code: "INTERN", name: `ZF Intern (Day ${trial.trialDay || 1}/3)`, dailyIncome: 150, dailyTasks: 5 }
    }
  });
});

router.get("/completed", async (req, res) => {
  const db = getPool();
  const [rows] = await db.query(
    `SELECT t.id, t.title, t.description, t.image_url, ts.reward, t.plan_required,
            ts.status submission_status, ts.rating, ts.task_date, ts.reward_claimed_at, ts.completed_at
     FROM task_submissions ts
     JOIN tasks t ON t.id = ts.task_id
     WHERE ts.user_id = ? AND ts.status = 'approved'
     ORDER BY ts.completed_at DESC, ts.id DESC`,
    [req.user.id]
  );
  res.json({ tasks: rows });
});

router.get("/library", async (req, res) => {
  const db = getPool();
  const plan = await getActivePlan(db, req.user.id);
  const trial = await getInternTrialStatus(db, req.user.id, plan);
  const isTrialActive = trial.isIntern && !trial.trialExpired;
  const [rows] = await db.query("SELECT id, title, description, image_url, reward, plan_required, status FROM tasks ORDER BY id");
  res.json({
    books: rows.map((r) => ({
      ...r,
      locked: trial.trialExpired ? true : !hasTaskAccess(r, plan, isTrialActive),
      activePlan: plan?.code || (trial.trialExpired ? "Trial Expired" : `Intern (Day ${trial.trialDay}/3)`)
    }))
  });
});

router.get("/:id", async (req, res) => {
  const db = getPool();
  const [rows] = await db.query(
    `SELECT t.id, t.title, t.description, t.image_url,
            t.plan_required, t.status,
            COALESCE(ts.status,'not_started') submission_status,
            ts.id submission_id, ts.rating, ts.review_text, ts.task_date, ts.reading_completed_at, ts.reward_claimed_at
     FROM tasks t
     LEFT JOIN task_submissions ts ON ts.task_id=t.id AND ts.user_id=? AND ts.task_date=CURDATE()
     WHERE t.id=? LIMIT 1`,
    [req.user.id, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ message: "Task not found." });
  const plan = await getActivePlan(db, req.user.id);
  const trial = await getInternTrialStatus(db, req.user.id, plan);
  const isTrialActive = trial.isIntern && !trial.trialExpired;
  const task = rows[0];
  const access = trial.trialExpired ? false : hasTaskAccess(task, plan, isTrialActive);
  const unitReward = getUnitReward(plan);
  res.json({
    task: {
      ...task,
      reward: unitReward,
      locked: !access,
      activePlan: plan?.code || (trial.trialExpired ? "Trial Expired" : `Intern (Day ${trial.trialDay}/3)`)
    }
  });
});

async function executeInstantTaskComplete(db, taskId, userId) {
  try {
    const [[task]] = await db.query("SELECT * FROM tasks WHERE id=? AND status='active' LIMIT 1", [taskId]);
    if (!task) {
      return { ok: false, code: 404, message: "Task not found." };
    }

    const plan = await getActivePlan(db, userId);
    const trial = await getInternTrialStatus(db, userId, plan);
    const isTrialActive = trial.isIntern && !trial.trialExpired;

    if (trial.trialExpired) {
      return {
        ok: false,
        code: 403,
        message: "Your 3-day free Intern trial has completed. Please activate an F-plan to continue doing tasks and earning daily income."
      };
    }

    if (!hasTaskAccess(task, plan, isTrialActive)) {
      return {
        ok: false,
        code: 403,
        message: `Activate ${task.plan_required || "an eligible plan"} to unlock this review.`
      };
    }

    const [[count]] = await db.query(
      "SELECT COUNT(*) completed_today FROM task_submissions WHERE user_id=? AND task_date=CURDATE() AND status='approved'",
      [userId]
    );

    const limit = plan ? Math.max(1, Number(plan.daily_tasks || 5)) : 5;
    if (Number(count.completed_today) >= limit) {
      return {
        ok: false,
        code: 400,
        message: `Today's task limit of ${limit} has been reached. Upgrade your plan for more daily tasks!`
      };
    }

    const reward = getUnitReward(plan);

    // Upsert task_submissions directly with approved status in 1 fast query
    await db.query(
      `INSERT INTO task_submissions (task_id, user_id, status, reward, task_date, reading_completed_at, reviewed_at, reward_claimed_at, completed_at)
       VALUES (?, ?, 'approved', ?, CURDATE(), NOW(), NOW(), NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         status = 'approved',
         reward = VALUES(reward),
         reading_completed_at = COALESCE(reading_completed_at, NOW()),
         reviewed_at = COALESCE(reviewed_at, NOW()),
         reward_claimed_at = NOW(),
         completed_at = NOW()`,
      [taskId, userId, reward]
    );

    // Credit user's wallet directly
    await db.query(
      "UPDATE users SET commission_balance = commission_balance + ?, total_earned = total_earned + ? WHERE id = ?",
      [reward, reward, userId]
    );

    // Run transaction logs and multi-level team commissions asynchronously in background
    (async () => {
      try {
        await Promise.all([
          db.query(
            "INSERT INTO wallet_transactions (user_id, type, amount, status, reference, note) VALUES (?, 'task_reward', ?, 'completed', ?, ?)",
            [userId, reward, `TASK-${taskId}-${Date.now()}`, `Reward for task: ${task.title}`]
          ),
          db.query(
            "INSERT INTO reward_history (user_id, type, detail, amount, status) VALUES (?, 'Task', ?, ?, 'Completed')",
            [userId, `Completed review: ${task.title}`, reward]
          ),
          db.query(
            "INSERT INTO notifications (user_id, type, title, message) VALUES (?, 'Reward', 'Task Reward Credited', ?)",
            [userId, `Rs. ${reward.toLocaleString()} has been credited to your Commission Wallet.`]
          )
        ]);

        // Referral commission chain (Level 1: 10%, Level 2: 3%, Level 3: 1%)
        const rates = [0.10, 0.03, 0.01];
        let currentUserId = userId;
        for (let level = 1; level <= 3; level++) {
          const [[userRow]] = await db.query("SELECT referred_by FROM users WHERE id = ? LIMIT 1", [currentUserId]);
          const parentId = userRow?.referred_by;
          if (!parentId) break;

          const commission = Math.round(reward * rates[level - 1] * 100) / 100;
          if (commission > 0) {
            await Promise.all([
              db.query("UPDATE users SET commission_balance = commission_balance + ?, total_earned = total_earned + ? WHERE id = ?", [commission, commission, parentId]),
              db.query("INSERT INTO team_earnings (user_id, member_user_id, level, source_type, amount, reference) VALUES (?, ?, ?, 'task_reward', ?, ?)", [parentId, userId, level, commission, `TEAM-${taskId}-L${level}`]),
              db.query("INSERT INTO reward_history (user_id, type, detail, amount, status) VALUES (?, 'Referral', ?, ?, 'Completed')", [parentId, `Level ${String.fromCharCode(64 + level)} commission from ${task.title}`, commission]),
              db.query("INSERT INTO notifications (user_id, type, title, message) VALUES (?, 'Team', 'Team Commission Credited', ?)", [parentId, `Rs. ${commission.toLocaleString()} Level ${String.fromCharCode(64 + level)} commission credited.`])
            ]);
          }
          currentUserId = parentId;
        }
      } catch (bgErr) {
        console.error("Task background logging error:", bgErr);
      }
    })();

    return {
      ok: true,
      reward,
      status: "approved",
      message: `✓ Task completed! Rs. ${Number(reward).toLocaleString()} credited directly to your wallet.`
    };
  } catch (err) {
    console.error("Instant task execution error:", err);
    throw err;
  }
}

// 1-Step Instant Task Complete Endpoint
router.post("/:id/complete", async (req, res) => {
  try {
    const result = await executeInstantTaskComplete(getPool(), req.params.id, req.user.id);
    if (!result.ok) return res.status(result.code || 400).json({ message: result.message });
    res.json(result);
  } catch (err) {
    console.error("Instant task completion error:", err);
    res.status(500).json({ message: "Unable to complete task: " + err.message });
  }
});

// Legacy endpoints mapped to instant completion for full compatibility
router.post("/:id/read", async (req, res) => {
  try {
    const result = await executeInstantTaskComplete(getPool(), req.params.id, req.user.id);
    if (!result.ok) return res.status(result.code || 400).json({ message: result.message });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Unable to process task: " + err.message });
  }
});

router.post("/:id/submit", async (req, res) => {
  try {
    const result = await executeInstantTaskComplete(getPool(), req.params.id, req.user.id);
    if (!result.ok) return res.status(result.code || 400).json({ message: result.message });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Unable to submit task: " + err.message });
  }
});

router.post("/:id/claim", async (req, res) => {
  try {
    const result = await executeInstantTaskComplete(getPool(), req.params.id, req.user.id);
    if (!result.ok) return res.status(result.code || 400).json({ message: result.message });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Unable to claim task: " + err.message });
  }
});

export default router;
