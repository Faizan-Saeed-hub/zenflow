import { Router } from "express";
import { getPool } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

function planRank(code) {
  const m = String(code || "").match(/^F(\d+)$/i);
  return m ? Number(m[1]) : 0;
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
  // Count distinct past days with approved completed tasks
  const [[pastDaysRow]] = await db.query(
    "SELECT COUNT(DISTINCT task_date) AS days_count FROM task_submissions WHERE user_id=? AND status='approved' AND task_date < CURDATE()",
    [userId]
  );
  const pastDays = Number(pastDaysRow?.days_count || 0);
  if (pastDays >= 3) {
    return { isIntern: true, trialExpired: true, trialDay: 4 };
  }
  return { isIntern: true, trialExpired: false, trialDay: pastDays + 1 };
}

function hasTaskAccess(task, plan, isTrialActive = false) {
  // Free 3-day Intern trial gives full access to daily review tasks
  if (isTrialActive) return true;
  if (!task?.plan_required) return true;
  return Boolean(plan && planRank(plan.code) >= planRank(task.plan_required));
}

router.get("/", async (req, res) => {
  const db = getPool();
  const plan = await getActivePlan(db, req.user.id);
  const trial = await getInternTrialStatus(db, req.user.id, plan);
  const isTrialActive = trial.isIntern && !trial.trialExpired;

  const dailyLimit = plan ? Number(plan.daily_tasks || 5) : 5;

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
            COALESCE(ts.reward, ROUND(p2.daily_income/p2.daily_tasks,2), t.reward, 30) reward,
            t.plan_required, t.status,
            COALESCE(ts.status,'not_started') submission_status,
            ts.rating, ts.review_text, ts.task_date, ts.reward_claimed_at, ts.completed_at
     FROM tasks t
     LEFT JOIN task_submissions ts ON ts.task_id=t.id AND ts.user_id=? AND ts.task_date=CURDATE()
     LEFT JOIN plans p2 ON p2.code=COALESCE((SELECT code FROM plans pp JOIN user_plans u2 ON u2.plan_id=pp.id WHERE u2.user_id=? AND u2.status='active' ORDER BY u2.started_at DESC LIMIT 1),t.plan_required)
     WHERE t.status='active'
     ORDER BY t.id`,
    [req.user.id, req.user.id]
  );

  const remaining = trial.trialExpired ? 0 : Math.max(0, limit - Number(counts.completed_today || 0));

  const accessibleRows = rows.map((r) => {
    const accessible = trial.trialExpired ? false : hasTaskAccess(r, plan, isTrialActive);
    return {
      ...r,
      reward: plan ? Number(r.reward || 30) : 30,
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
            COALESCE(ts.reward, ROUND(p2.daily_income/p2.daily_tasks,2), t.reward, 30) reward,
            t.plan_required, t.status,
            COALESCE(ts.status,'not_started') submission_status,
            ts.id submission_id, ts.rating, ts.review_text, ts.task_date, ts.reading_completed_at, ts.reward_claimed_at
     FROM tasks t
     LEFT JOIN task_submissions ts ON ts.task_id=t.id AND ts.user_id=? AND ts.task_date=CURDATE()
     LEFT JOIN plans p2 ON p2.code=COALESCE((SELECT code FROM plans pp JOIN user_plans u2 ON u2.plan_id=pp.id WHERE u2.user_id=? AND u2.status='active' ORDER BY u2.started_at DESC LIMIT 1),t.plan_required)
     WHERE t.id=? LIMIT 1`,
    [req.user.id, req.user.id, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ message: "Task not found." });
  const plan = await getActivePlan(db, req.user.id);
  const trial = await getInternTrialStatus(db, req.user.id, plan);
  const isTrialActive = trial.isIntern && !trial.trialExpired;
  const task = rows[0];
  const access = trial.trialExpired ? false : hasTaskAccess(task, plan, isTrialActive);
  res.json({
    task: {
      ...task,
      reward: plan ? Number(task.reward || 30) : 30,
      locked: !access,
      activePlan: plan?.code || (trial.trialExpired ? "Trial Expired" : `Intern (Day ${trial.trialDay}/3)`)
    }
  });
});

router.post("/:id/read", async (req, res) => {
  const db = getPool();
  const [[task]] = await db.query("SELECT * FROM tasks WHERE id=? AND status='active' LIMIT 1", [req.params.id]);
  if (!task) return res.status(404).json({ message: "Task not found." });
  const plan = await getActivePlan(db, req.user.id);
  const trial = await getInternTrialStatus(db, req.user.id, plan);
  const isTrialActive = trial.isIntern && !trial.trialExpired;

  if (trial.trialExpired) {
    return res.status(403).json({
      message: "Your 3-day free Intern trial has completed. Please activate an F-plan to continue doing tasks and earning daily income."
    });
  }

  if (!hasTaskAccess(task, plan, isTrialActive)) {
    return res.status(403).json({ message: `Activate ${task.plan_required || "an eligible plan"} to unlock this review.` });
  }

  const [[existing]] = await db.query(
    "SELECT * FROM task_submissions WHERE task_id=? AND user_id=? AND task_date=CURDATE() LIMIT 1",
    [task.id, req.user.id]
  );
  if (existing?.status === "approved") return res.json({ message: "Task already completed.", status: "approved" });
  if (existing) {
    await db.query(
      "UPDATE task_submissions SET reading_completed_at=COALESCE(reading_completed_at,NOW()), status=CASE WHEN status='reading' THEN 'review_submitted' ELSE status END WHERE id=?",
      [existing.id]
    );
    return res.json({ message: "Reading marked complete.", status: "review_submitted" });
  }

  const [[count]] = await db.query(
    "SELECT COUNT(*) completed_today FROM task_submissions WHERE user_id=? AND task_date=CURDATE() AND status='approved'",
    [req.user.id]
  );
  const limit = plan ? Math.max(1, Number(plan.daily_tasks || 5)) : 5;
  if (Number(count.completed_today) >= limit) {
    return res.status(400).json({ message: "Today's task limit has been reached." });
  }

  const unitReward = plan ? Number(plan.daily_income || 0) / Math.max(1, Number(plan.daily_tasks || 5)) : 30;
  await db.query(
    `INSERT INTO task_submissions(task_id,user_id,status,reward,task_date,reading_completed_at) VALUES(?,?,'review_submitted',?,CURDATE(),NOW())`,
    [task.id, req.user.id, unitReward]
  );
  res.status(201).json({ message: "Reading completed. Please rate the review.", status: "review_submitted" });
});

router.post("/:id/submit", async (req, res) => {
  const { reviewText = "", rating } = req.body || {};
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) return res.status(400).json({ message: "Please select a rating from 1 to 5 stars." });
  const db = getPool();
  const [[submission]] = await db.query(
    "SELECT * FROM task_submissions WHERE task_id=? AND user_id=? AND task_date=CURDATE() LIMIT 1",
    [req.params.id, req.user.id]
  );
  if (!submission) return res.status(400).json({ message: "Finish reading before submitting your rating." });
  if (submission.status === "approved") return res.status(409).json({ message: "Task already completed." });
  await db.query(
    "UPDATE task_submissions SET review_text=?,rating=?,status='reward_claimable',reviewed_at=NOW() WHERE id=?",
    [String(reviewText).slice(0, 5000), r, submission.id]
  );
  await db.query("INSERT INTO notifications(user_id,type,title,message) VALUES(?,'Task',?,?)", [
    req.user.id,
    "Review submitted",
    `Your book review was submitted. You can claim Rs. ${Number(submission.reward).toLocaleString()}.`
  ]);
  res.json({ message: "Review submitted. You can claim your reward now.", status: "reward_claimable", reward: Number(submission.reward) });
});

router.post("/:id/claim", async (req, res) => {
  const db = getPool();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[submission]] = await conn.query(
      `SELECT ts.*, t.title, t.plan_required FROM task_submissions ts JOIN tasks t ON t.id=ts.task_id WHERE ts.task_id=? AND ts.user_id=? AND ts.task_date=CURDATE() FOR UPDATE`,
      [req.params.id, req.user.id]
    );
    if (!submission) {
      await conn.rollback();
      return res.status(404).json({ message: "Review not found." });
    }

    const [[activePlan]] = await conn.query(
      `SELECT p.code FROM user_plans up
       JOIN plans p ON p.id=up.plan_id
       WHERE up.user_id=? AND up.status='active' AND (up.expires_at IS NULL OR up.expires_at>NOW())
       ORDER BY CAST(SUBSTRING(p.code,2) AS UNSIGNED) DESC, up.started_at DESC LIMIT 1 FOR UPDATE`,
      [req.user.id]
    );
    const trial = await getInternTrialStatus(conn, req.user.id, activePlan);
    const isTrialActive = trial.isIntern && !trial.trialExpired;

    if (!hasTaskAccess(submission, activePlan, isTrialActive)) {
      await conn.rollback();
      return res.status(403).json({ message: `Activate ${submission?.plan_required || "an eligible plan"} to unlock this reward.` });
    }
    if (submission.status === "approved") {
      await conn.rollback();
      return res.status(409).json({ message: "Reward already claimed." });
    }
    if (submission.status !== "reward_claimable") {
      await conn.rollback();
      return res.status(400).json({ message: "Submit your rating before claiming the reward." });
    }

    const [[u]] = await conn.query("SELECT commission_balance, total_earned FROM users WHERE id=? FOR UPDATE", [req.user.id]);
    const reward = Number(submission.reward || 30);
    await conn.query("UPDATE users SET commission_balance=commission_balance+?, total_earned=total_earned+? WHERE id=?", [
      reward,
      reward,
      req.user.id
    ]);
    await conn.query("UPDATE task_submissions SET status='approved', reward_claimed_at=NOW(), completed_at=NOW() WHERE id=?", [
      submission.id
    ]);
    await conn.query("INSERT INTO wallet_transactions(user_id,type,amount,status,reference,note) VALUES(?,'task_reward',?,'completed',?,?)", [
      req.user.id,
      reward,
      `TASK-${submission.id}`,
      `Reward for completed task: ${submission.title}`
    ]);
    await conn.query("INSERT INTO reward_history(user_id,type,detail,amount,status) VALUES(?,'Task',?,?, 'Completed')", [
      req.user.id,
      `Completed task: ${submission.title}`,
      reward
    ]);

    // Distribute team commissions: 10% for Level A, 3% for Level B, 1% for Level C
    const rates = [0.1, 0.03, 0.01];
    let referrerId = req.user.id;
    for (let level = 1; level <= 3; level++) {
      const [[member]] = await conn.query("SELECT referred_by FROM users WHERE id=? FOR UPDATE", [referrerId]);
      const parentId = member?.referred_by;
      if (!parentId) break;
      const commission = Math.round(reward * rates[level - 1] * 100) / 100;
      if (commission > 0) {
        const ref = `TEAM-${submission.id}-L${level}`;
        await conn.query("UPDATE users SET commission_balance=commission_balance+?, total_earned=total_earned+? WHERE id=?", [
          commission,
          commission,
          parentId
        ]);
        await conn.query("INSERT INTO team_earnings(user_id,member_user_id,level,source_type,amount,reference) VALUES(?,? ,?,'task_reward',?,?)", [
          parentId,
          req.user.id,
          level,
          commission,
          ref
        ]);
        await conn.query("INSERT INTO reward_history(user_id,type,detail,amount,status) VALUES(?,'Referral',?,?, 'Completed')", [
          parentId,
          `Level ${String.fromCharCode(64 + level)} commission from ${submission.title}`,
          commission
        ]);
        await conn.query("INSERT INTO notifications(user_id,type,title,message) VALUES(?,'Team',?,?)", [
          parentId,
          "Team commission credited",
          `Rs. ${commission.toLocaleString()} Level ${String.fromCharCode(64 + level)} commission has been credited from a team task.`
        ]);
      }
      referrerId = parentId;
    }
    await conn.query("INSERT INTO notifications(user_id,type,title,message) VALUES(?,'Reward',?,?)", [
      req.user.id,
      "Reward credited",
      `Rs. ${reward.toLocaleString()} has been credited to your Commission Wallet.`
    ]);
    await conn.commit();
    res.json({ message: `Rs. ${reward.toLocaleString()} credited to your wallet.`, reward, balance: Number(u.commission_balance) + reward });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    res.status(500).json({ message: "Unable to claim reward." });
  } finally {
    conn.release();
  }
});

export default router;
