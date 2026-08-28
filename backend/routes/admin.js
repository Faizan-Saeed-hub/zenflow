import { Router } from "express";
import bcrypt from "bcryptjs";
import { getPool } from "../config/db.js";
import { requireAdmin } from "../middleware/admin.js";

const router = Router();
router.use(requireAdmin);

router.get("/dashboard", async (_req, res) => {
  const db = getPool();
  // Current Day (Today's) Doings
  const [[todayUsers]] = await db.query("SELECT COUNT(*) total FROM users WHERE role='user' AND DATE(created_at) = CURDATE()");
  const [[todayDeposits]] = await db.query("SELECT COALESCE(SUM(amount),0) total, COUNT(*) count FROM deposits WHERE DATE(submitted_at) = CURDATE()");
  const [[todayApprovedDeposits]] = await db.query("SELECT COALESCE(SUM(amount),0) total, COUNT(*) count FROM deposits WHERE status='approved' AND (DATE(reviewed_at) = CURDATE() OR (reviewed_at IS NULL AND DATE(submitted_at) = CURDATE()))");
  const [[todayPendingDeposits]] = await db.query("SELECT COUNT(*) total FROM deposits WHERE status='pending' AND DATE(submitted_at) = CURDATE()");
  const [[todayWithdrawals]] = await db.query("SELECT COALESCE(SUM(amount),0) total, COUNT(*) count FROM withdrawals WHERE DATE(requested_at) = CURDATE()");
  const [[todayPendingWithdrawals]] = await db.query("SELECT COUNT(*) total FROM withdrawals WHERE status='pending' AND DATE(requested_at) = CURDATE()");
  const [[todayTasks]] = await db.query("SELECT COUNT(*) total, COALESCE(SUM(reward),0) rewards FROM task_submissions WHERE status='approved' AND task_date = CURDATE()");
  const [[todaySupport]] = await db.query("SELECT COUNT(*) total FROM support_requests WHERE DATE(created_at) = CURDATE()");

  // Platform Totals
  const [[users]] = await db.query("SELECT COUNT(*) total FROM users WHERE role='user'");
  const [[plans]] = await db.query("SELECT COUNT(*) total FROM plans");
  const [[tasks]] = await db.query("SELECT COUNT(*) total FROM tasks WHERE status='active'");
  const [[withdrawals]] = await db.query("SELECT COUNT(*) total FROM withdrawals WHERE status='pending'");
  const [[deposits]] = await db.query("SELECT COUNT(*) total FROM deposits WHERE status='pending'");
  const [[pendingLoans]] = await db.query("SELECT COUNT(*) total FROM loans WHERE status='pending'");
  const [[supports]] = await db.query("SELECT COUNT(*) total FROM support_requests WHERE status!='closed'");
  const [[depositTotal]] = await db.query("SELECT COALESCE(SUM(amount),0) total FROM deposits WHERE status='approved'");

  res.json({
    stats: {
      // Primary: Current Day Doings
      todayDeposits: Number(todayDeposits.total),
      todayDepositsCount: Number(todayDeposits.count),
      todayApprovedDeposits: Number(todayApprovedDeposits.total),
      todayApprovedCount: Number(todayApprovedDeposits.count),
      todayRegisteredUsers: Number(todayUsers.total),
      todayPendingDeposits: Number(todayPendingDeposits.total),
      todayWithdrawals: Number(todayWithdrawals.total),
      todayPendingWithdrawals: Number(todayPendingWithdrawals.total),
      todayTasksDone: Number(todayTasks.total),
      todayTasksRewards: Number(todayTasks.rewards),
      todaySupport: Number(todaySupport.total),

      // Platform Totals
      users: Number(users.total),
      plans: Number(plans.total),
      tasks: Number(tasks.total),
      pendingWithdrawals: Number(withdrawals.total),
      pendingDeposits: Number(deposits.total),
      pendingLoans: Number(pendingLoans.total),
      openSupport: Number(supports.total),
      walletBalance: Number(depositTotal.total)
    }
  });
});

router.get("/users", async (req, res) => {
  const q = String(req.query.q || "").trim();
  const startDate = req.query.startDate ? String(req.query.startDate).trim() : null;
  const endDate = req.query.endDate ? String(req.query.endDate).trim() : null;
  const sort = String(req.query.sort || "newest").trim();
  const db = getPool();

  let orderBy = "u.id DESC";
  if (sort === "oldest") orderBy = "u.id ASC";
  else if (sort === "balance_desc") orderBy = "u.wallet_balance DESC";
  else if (sort === "earned_desc") orderBy = "u.total_earned DESC";

  const conditions = ["u.role='user'"];
  const params = [];

  if (q) {
    conditions.push("(u.phone LIKE ? OR u.full_name LIKE ? OR u.referral_code LIKE ?)");
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (startDate) {
    conditions.push("DATE(u.created_at) >= ?");
    params.push(startDate);
  }
  if (endDate) {
    conditions.push("DATE(u.created_at) <= ?");
    params.push(endDate);
  }

  const whereClause = conditions.join(" AND ");

  try {
    const [rows] = await db.query(
      `SELECT u.id, u.phone, u.full_name, u.email, u.referral_code, u.referred_by,
              u.wallet_balance, u.commission_balance, u.total_earned, u.role, u.created_at,
              ref.phone AS referrer_phone,
              (SELECT COUNT(*) FROM users m WHERE m.referred_by=u.id) AS direct_members,
              (SELECT COUNT(*) FROM user_plans up WHERE up.user_id=u.id AND up.status='active') AS active_plans
       FROM users u
       LEFT JOIN users ref ON ref.id=u.referred_by
       WHERE ${whereClause}
       ORDER BY ${orderBy} LIMIT 300`,
      params
    );
    return res.json({ users: rows });
  } catch (err) {
    console.error("[admin/users] query error:", err.message);
    try {
      const [rows] = await db.query(
        `SELECT id,phone,full_name,email,referral_code,wallet_balance,commission_balance,total_earned,role,created_at
         FROM users
         WHERE role='user' AND (?='' OR phone LIKE CONCAT('%',?,'%') OR full_name LIKE CONCAT('%',?,'%'))
         ORDER BY id DESC LIMIT 300`,
        [q, q, q]
      );
      return res.json({ users: rows.map((r) => ({ ...r, direct_members: 0, active_plans: 0 })) });
    } catch (fallbackErr) {
      return res.status(500).json({ message: "Unable to load users." });
    }
  }
});

router.post("/users/:id/reset-password", async (req,res) => {
  const db = getPool();
  const [[u]] = await db.query("SELECT id,phone FROM users WHERE id=? AND role='user' LIMIT 1", [req.params.id]);
  if (!u) return res.status(404).json({message:"User not found."});
  const temp = `ZF${Math.random().toString(36).slice(2,8).toUpperCase()}${Math.floor(10+Math.random()*90)}`;
  const hash = await bcrypt.hash(temp, 12);
  await db.query("UPDATE users SET password_hash=?,must_change_password=1 WHERE id=?", [hash, u.id]);
  await db.query("INSERT INTO notifications(user_id,type,title,message) VALUES(?,'System',?,?)",
    [u.id,"Password reset","Your password was reset by an administrator. Please change it after logging in."]);
  res.json({message:"Password reset. Give the temporary password to the user securely.", temporaryPassword:temp});
});

router.post("/users/:id/reset-fund-password", async (req,res) => {
  const db = getPool();
  const [[u]] = await db.query("SELECT id,phone FROM users WHERE id=? AND role='user' LIMIT 1", [req.params.id]);
  if (!u) return res.status(404).json({message:"User not found."});
  const customPin = req.body?.fundPassword ? String(req.body.fundPassword).trim() : null;
  const tempPin = customPin || String(Math.floor(100000 + Math.random() * 900000));
  const hash = await bcrypt.hash(tempPin, 10);
  await db.query("UPDATE users SET fund_password_hash=? WHERE id=?", [hash, u.id]);
  await db.query("INSERT INTO notifications(user_id,type,title,message) VALUES(?,'System',?,?)",
    [u.id,"Fund Password Reset",`Your fund password was reset by an administrator to: ${tempPin}.`]);
  res.json({message:"Fund password reset successfully.", temporaryFundPassword:tempPin, phone:u.phone});
});

router.delete("/users/:id", async (req,res) => {
  const userId = req.params.id;
  const db = getPool();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[target]] = await conn.query("SELECT id, phone, role FROM users WHERE id=? FOR UPDATE", [userId]);
    if (!target) {
      await conn.rollback();
      return res.status(404).json({ message: "User not found." });
    }
    if (target.role === "admin") {
      await conn.rollback();
      return res.status(403).json({ message: "Cannot delete an admin account." });
    }

    // Detach or delete all related user records cleanly
    await conn.query("UPDATE users SET referred_by=NULL WHERE referred_by=?", [userId]);
    await conn.query("DELETE FROM task_submissions WHERE user_id=?", [userId]);
    await conn.query("DELETE FROM user_plans WHERE user_id=?", [userId]);
    await conn.query("DELETE FROM wallet_transactions WHERE user_id=?", [userId]);
    await conn.query("DELETE FROM reward_history WHERE user_id=?", [userId]);
    await conn.query("DELETE FROM team_earnings WHERE user_id=? OR member_user_id=?", [userId, userId]);
    await conn.query("DELETE FROM deposits WHERE user_id=?", [userId]);
    await conn.query("DELETE FROM withdrawals WHERE user_id=?", [userId]);
    await conn.query("DELETE FROM loans WHERE user_id=?", [userId]);
    await conn.query("DELETE FROM notifications WHERE user_id=?", [userId]);
    await conn.query("DELETE FROM wealth_purchases WHERE user_id=?", [userId]);
    await conn.query("DELETE FROM support_requests WHERE user_id=?", [userId]);
    await conn.query("DELETE FROM users WHERE id=?", [userId]);

    await conn.commit();
    res.json({ message: `User ${target.phone} (ID: ${userId}) deleted successfully.` });
  } catch (err) {
    await conn.rollback();
    console.error("Delete user error:", err);
    res.status(500).json({ message: "Failed to delete user: " + err.message });
  } finally {
    conn.release();
  }
});

router.get("/team", async (_req,res) => {
  const db=getPool();
  const [[summary]]=await db.query(`
    SELECT COUNT(*) total_members,
           COALESCE(SUM(u.total_earned),0) team_earnings,
           COALESCE(SUM(CASE WHEN up.id IS NOT NULL THEN 1 ELSE 0 END),0) active_members
      FROM users u
      LEFT JOIN user_plans up ON up.user_id=u.id AND up.status='active' AND (up.expires_at IS NULL OR up.expires_at>NOW())
     WHERE u.role='user'`);
  const [rows]=await db.query(`
    SELECT u.id,u.phone,u.full_name,u.total_earned,u.commission_balance,u.created_at,
           ref.phone AS referrer_phone,
           COALESCE((SELECT SUM(ts.reward) FROM task_submissions ts WHERE ts.user_id=u.id AND ts.status='approved'),0) task_earnings,
           (SELECT COUNT(*) FROM users m WHERE m.referred_by=u.id) direct_members
      FROM users u
      LEFT JOIN users ref ON ref.id=u.referred_by
     WHERE u.role='user' ORDER BY u.id DESC LIMIT 500`);
  res.json({summary:{totalMembers:Number(summary.total_members||0),activeMembers:Number(summary.active_members||0),teamEarnings:Number(summary.team_earnings||0)},members:rows});
});

router.patch("/users/:id", async (req,res) => {
  const {walletBalance, role} = req.body || {};
  const updates=[]; const values=[];
  if (walletBalance !== undefined) { const n=Number(walletBalance); if(!Number.isFinite(n)||n<0) return res.status(400).json({message:"Invalid balance."}); updates.push("wallet_balance=?"); values.push(n); }
  if (role === "user" || role === "admin") { updates.push("role=?"); values.push(role); }
  if (!updates.length) return res.status(400).json({message:"Nothing to update."});
  values.push(req.params.id);
  await getPool().query(`UPDATE users SET ${updates.join(",")} WHERE id=?`, values);
  res.json({message:"User updated."});
});

router.get("/plans", async (_req,res) => {
  const [rows]=await getPool().query("SELECT id,code,name,price,daily_income,commission_rate,status FROM plans ORDER BY id");
  res.json({plans:rows});
});
router.post("/plans", async (req,res) => {
  const {code,name,price,dailyIncome,commissionRate=0.1,status="active"}=req.body||{};
  if(!code||!name||!Number.isFinite(Number(price))) return res.status(400).json({message:"Code, name and price are required."});
  const [r]=await getPool().query("INSERT INTO plans(code,name,price,daily_income,commission_rate,status) VALUES(?,?,?,?,?,?)",[code,name,Number(price),Number(dailyIncome||0),Number(commissionRate),status]);
  res.status(201).json({id:r.insertId,message:"Plan created."});
});
router.patch("/plans/:id", async (req,res) => {
  const {status,price,dailyIncome}=req.body||{};
  await getPool().query("UPDATE plans SET status=COALESCE(?,status),price=COALESCE(?,price),daily_income=COALESCE(?,daily_income) WHERE id=?",
    [status??null,price==null?null:Number(price),dailyIncome==null?null:Number(dailyIncome),req.params.id]);
  res.json({message:"Plan updated."});
});

router.get("/tasks", async (_req,res) => {
  const [rows]=await getPool().query("SELECT id,title,description,reward,plan_required,status,created_at FROM tasks ORDER BY id DESC");
  res.json({tasks:rows});
});
router.post("/tasks", async (req,res) => {
  const {title,description="",imageUrl=null,reward,planRequired=null,status="active"}=req.body||{};
  if(!title||!Number.isFinite(Number(reward))) return res.status(400).json({message:"Title and reward are required."});
  const [r]=await getPool().query("INSERT INTO tasks(title,description,image_url,reward,plan_required,status) VALUES(?,?,?,?,?,?)",[title,description,imageUrl,Number(reward),planRequired,status]);
  res.status(201).json({id:r.insertId,message:"Task created."});
});
router.patch("/tasks/:id", async (req,res) => {
  const {status,reward,title,description,imageUrl,planRequired}=req.body||{};
  await getPool().query("UPDATE tasks SET title=COALESCE(?,title),description=COALESCE(?,description),image_url=COALESCE(?,image_url),plan_required=COALESCE(?,plan_required),status=COALESCE(?,status),reward=COALESCE(?,reward) WHERE id=?",[title??null,description??null,imageUrl??null,planRequired??null,status??null,reward==null?null:Number(reward),req.params.id]);
  res.json({message:"Task updated."});
});

router.get("/deposits", async (req, res) => {
  const q = String(req.query.q || "").trim();
  const status = String(req.query.status || "").trim();
  const startDate = req.query.startDate ? String(req.query.startDate).trim() : null;
  const endDate = req.query.endDate ? String(req.query.endDate).trim() : null;
  const sort = String(req.query.sort || "newest").trim();
  const db = getPool();

  let orderBy = "d.submitted_at DESC";
  if (sort === "oldest") orderBy = "d.submitted_at ASC";
  else if (sort === "amount_desc") orderBy = "d.amount DESC";
  else if (sort === "amount_asc") orderBy = "d.amount ASC";

  const conditions = ["1=1"];
  const params = [];

  if (q) {
    conditions.push("(u.phone LIKE ? OR u.full_name LIKE ? OR d.tid LIKE ? OR d.wallet_number LIKE ?)");
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (status && status !== "all") {
    conditions.push("d.status = ?");
    params.push(status);
  }
  if (startDate) {
    conditions.push("DATE(d.submitted_at) >= ?");
    params.push(startDate);
  }
  if (endDate) {
    conditions.push("DATE(d.submitted_at) <= ?");
    params.push(endDate);
  }

  const whereClause = conditions.join(" AND ");
  const [rows] = await db.query(
    `SELECT d.id, d.user_id, u.phone, u.full_name, d.plan_code, d.amount, d.payment_method, d.tid,
            d.wallet_number, d.proof_data, d.status, d.submitted_at, d.reviewed_at
     FROM deposits d
     JOIN users u ON u.id = d.user_id
     WHERE ${whereClause}
     ORDER BY ${orderBy} LIMIT 300`,
    params
  );
  res.json({ deposits: rows });
});

router.patch("/deposits/:id", async (req,res) => {
  const {status}=req.body||{};
  if(!["approved","rejected"].includes(status)) return res.status(400).json({message:"Invalid deposit status."});
  const db=getPool();
  const c=await db.getConnection();
  try {
    await c.beginTransaction();
    const [[d]]=await c.query("SELECT * FROM deposits WHERE id=? FOR UPDATE",[req.params.id]);
    if(!d) { await c.rollback(); return res.status(404).json({message:"Deposit not found."}); }
    if(d.status !== "pending") { await c.rollback(); return res.status(400).json({message:"This deposit has already been reviewed."}); }

    if(status === "approved") {
      const [[u]] = await c.query("SELECT wallet_balance FROM users WHERE id=? FOR UPDATE",[d.user_id]);
      if(!u) { await c.rollback(); return res.status(404).json({message:"User not found."}); }
      const before=Number(u.wallet_balance||0); const after=before+Number(d.amount);
      await c.query("UPDATE users SET wallet_balance=wallet_balance+? WHERE id=?",[d.amount,d.user_id]);
      await c.query("INSERT INTO wallet_transactions(user_id,type,amount,status,reference,note) VALUES(?,'deposit',?,'completed',?,?)",[d.user_id,d.amount,d.tid,`Recharge ${d.plan_code} approved; credited to Personal Wallet`]);
    }

    await c.query("UPDATE deposits SET status=?,reviewed_at=NOW() WHERE id=?",[status,d.id]);
    await c.query("INSERT INTO notifications(user_id,type,title,message) VALUES(?,'System',?,?)",[
      d.user_id,
      status === "approved" ? "Recharge approved" : "Recharge rejected",
      status === "approved" ? `Your ${d.plan_code} recharge has been approved. Rs. ${Number(d.amount).toLocaleString()} is now available in your Personal Wallet. You can use it to buy your plan.` : `Your ${d.plan_code} recharge #${d.id} was rejected.`
    ]);
    await c.commit();
    res.json({message:`Deposit ${status}.`});
  } catch(e) {
    await c.rollback();
    console.error(e);
    res.status(500).json({message:"Unable to update deposit."});
  } finally { c.release(); }
});

router.get("/withdrawals", async (req, res) => {
  const q = String(req.query.q || "").trim();
  const status = String(req.query.status || "").trim();
  const startDate = req.query.startDate ? String(req.query.startDate).trim() : null;
  const endDate = req.query.endDate ? String(req.query.endDate).trim() : null;
  const sort = String(req.query.sort || "newest").trim();
  const db = getPool();

  let orderBy = "w.requested_at DESC";
  if (sort === "oldest") orderBy = "w.requested_at ASC";
  else if (sort === "amount_desc") orderBy = "w.amount DESC";
  else if (sort === "amount_asc") orderBy = "w.amount ASC";

  const conditions = ["1=1"];
  const params = [];

  if (q) {
    conditions.push("(u.phone LIKE ? OR u.full_name LIKE ? OR pa.account_number LIKE ? OR pa.account_name LIKE ?)");
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (status && status !== "all") {
    conditions.push("w.status = ?");
    params.push(status);
  }
  if (startDate) {
    conditions.push("DATE(w.requested_at) >= ?");
    params.push(startDate);
  }
  if (endDate) {
    conditions.push("DATE(w.requested_at) <= ?");
    params.push(endDate);
  }

  const whereClause = conditions.join(" AND ");
  const [rows] = await db.query(
    `SELECT w.id, w.user_id, u.phone, u.full_name, w.wallet_type, w.amount, w.fee, w.net_amount, w.status,
            w.requested_at, w.processed_at, pa.method, pa.account_name, pa.account_number
     FROM withdrawals w
     JOIN users u ON u.id = w.user_id
     LEFT JOIN payout_accounts pa ON pa.id = w.payout_account_id
     WHERE ${whereClause}
     ORDER BY ${orderBy} LIMIT 300`,
    params
  );
  res.json({ withdrawals: rows });
});
router.patch("/withdrawals/:id", async (req,res) => {
  const {status}=req.body||{};
  if(!["approved","paid","rejected"].includes(status)) return res.status(400).json({message:"Invalid withdrawal status."});
  const db=getPool(); const c=await db.getConnection();
  try {
    await c.beginTransaction();
    const [[w]]=await c.query("SELECT * FROM withdrawals WHERE id=? FOR UPDATE",[req.params.id]);
    if(!w) { await c.rollback(); return res.status(404).json({message:"Withdrawal not found."}); }
    if(w.status==="paid" && status!=="paid") { await c.rollback(); return res.status(400).json({message:"Paid withdrawal cannot be changed."}); }
    if(status==="rejected" && w.status!=="rejected") {
      if(w.wallet_type==='commission') await c.query("UPDATE users SET commission_balance=commission_balance+? WHERE id=?",[w.amount,w.user_id]);
      else await c.query("UPDATE users SET wallet_balance=wallet_balance+? WHERE id=?",[w.amount,w.user_id]);
      await c.query("INSERT INTO wallet_transactions(user_id,type,amount,status,reference,note) VALUES(?,'refund',?,'completed',?,?)",[w.user_id,w.amount,`WITHDRAWAL-${w.id}`,`Refund for rejected ${w.wallet_type} wallet withdrawal`]);
    }
    await c.query("UPDATE withdrawals SET status=?,processed_at=NOW() WHERE id=?",[status,req.params.id]);
    await c.query("INSERT INTO notifications(user_id,type,title,message) VALUES(?,'System',?,?)",
      [w.user_id,"Withdrawal updated",`Your withdrawal #${w.id} is now ${status}.`]);
    await c.commit(); res.json({message:"Withdrawal updated."});
  } catch(e) { await c.rollback(); console.error(e); res.status(500).json({message:"Unable to update withdrawal."}); }
  finally { c.release(); }
});

router.get("/support", async (_req,res) => {
  const [rows]=await getPool().query(
    `SELECT s.id,s.user_id,u.phone,u.full_name,s.subject,s.message,s.admin_reply,s.status,s.created_at,s.replied_at
     FROM support_requests s LEFT JOIN users u ON u.id=s.user_id ORDER BY s.created_at DESC LIMIT 200`
  );
  res.json({requests:rows});
});
router.post("/support/:id/reply", async (req,res) => {
  const { reply } = req.body || {};
  if (!reply || !String(reply).trim()) return res.status(400).json({ message: "Reply message is required." });
  const db = getPool();
  const [[ticket]] = await db.query("SELECT * FROM support_requests WHERE id=? LIMIT 1", [req.params.id]);
  if (!ticket) return res.status(404).json({ message: "Inquiry not found." });
  await db.query(
    "UPDATE support_requests SET admin_reply=?, replied_at=NOW(), status='answered' WHERE id=?",
    [String(reply).trim(), req.params.id]
  );
  if (ticket.user_id) {
    await db.query(
      "INSERT INTO notifications(user_id,type,title,message) VALUES(?,'System',?,?)",
      [ticket.user_id, "Support inquiry answered", `Admin replied to your inquiry: "${String(reply).trim().slice(0, 120)}..."`]
    );
  }
  res.json({ message: "Reply sent to user successfully." });
});
router.patch("/support/:id", async (req,res) => {
  const {status}=req.body||{};
  if(!["open","in_progress","answered","closed"].includes(status)) return res.status(400).json({message:"Invalid support status."});
  await getPool().query("UPDATE support_requests SET status=? WHERE id=?",[status,req.params.id]);
  res.json({message:"Support request updated."});
});
router.delete("/support/:id", async (req,res) => {
  await getPool().query("DELETE FROM support_requests WHERE id=?",[req.params.id]);
  res.json({message:"Support inquiry deleted."});
});

router.get("/loans", async (_req,res) => {
  const [rows]=await getPool().query(
    `SELECT l.id,l.user_id,u.phone,u.full_name,l.product_name,l.amount,l.status,l.requested_at
     FROM loans l LEFT JOIN users u ON u.id=l.user_id ORDER BY l.requested_at DESC LIMIT 200`
  );
  res.json({loans:rows});
});
router.patch("/loans/:id", async (req,res) => {
  const {status}=req.body||{};
  if(!["pending","approved","rejected","paid"].includes(status)) return res.status(400).json({message:"Invalid loan status."});
  await getPool().query("UPDATE loans SET status=? WHERE id=?",[status,req.params.id]);
  res.json({message:"Loan updated."});
});


router.get("/bank", async (_req,res) => {
  const [rows] = await getPool().query("SELECT id,method,account_label,account_number,qr_data,instructions,active,updated_at FROM payment_settings ORDER BY id");
  res.json({settings:rows});
});

router.patch("/bank/:method", async (req,res) => {
  const method=decodeURIComponent(String(req.params.method));
  const {accountLabel,accountNumber,qrData,instructions,active}=req.body||{};
  if(!["JazzCash","SadaPay","EasyPaisa","Binance (BEP-20)"].includes(method))
    return res.status(400).json({message:"Unsupported payment method."});
  if(!accountNumber || String(accountNumber).trim().length<5)
    return res.status(400).json({message:"Account number/address is required."});
  if(qrData!=null && String(qrData).length>7000000)
    return res.status(400).json({message:"QR image is too large."});
  await getPool().query(
    "INSERT INTO payment_settings(method,account_label,account_number,qr_data,instructions,active) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE account_label=VALUES(account_label),account_number=VALUES(account_number),qr_data=VALUES(qr_data),instructions=VALUES(instructions),active=VALUES(active)",
    [method,String(accountLabel||method),String(accountNumber).trim(),qrData===undefined?null:qrData,String(instructions||""),active===false?0:1]
  );
  res.json({message:`${method} payment settings updated.`});
});

router.get("/bank-settings", async (_req,res) => {
  const [rows] = await getPool().query(
    "SELECT id,method,account_label,account_number,qr_data,instructions,active,updated_at FROM payment_settings ORDER BY id"
  );
  res.json({settings:rows});
});
router.patch("/bank-settings/:method", async (req,res) => {
  const method=decodeURIComponent(String(req.params.method));
  const {accountLabel,accountNumber,qrData,instructions,active}=req.body||{};
  if(!["JazzCash","SadaPay","EasyPaisa","Binance (BEP-20)"].includes(method))
    return res.status(400).json({message:"Unsupported payment method."});
  if(!accountNumber || String(accountNumber).trim().length<5)
    return res.status(400).json({message:"Account number/address is required."});
  if(qrData!=null && String(qrData).length>7000000)
    return res.status(400).json({message:"QR image is too large."});
  await getPool().query(
    "INSERT INTO payment_settings(method,account_label,account_number,qr_data,instructions,active) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE account_label=VALUES(account_label),account_number=VALUES(account_number),qr_data=VALUES(qr_data),instructions=VALUES(instructions),active=VALUES(active)",
    [method,String(accountLabel||method),String(accountNumber).trim(),qrData===undefined?null:qrData,String(instructions||""),active===false?0:1]
  );
  res.json({message:`${method} payment settings updated.`});
});

function normalizeImageUrl(url) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:image/") || trimmed.startsWith("/")) return trimmed;

  const gDriveMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
                      trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (gDriveMatch && (trimmed.includes("drive.google.com") || trimmed.includes("docs.google.com"))) {
    const fileId = gDriveMatch[1];
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;
  }

  if (trimmed.includes("dropbox.com")) {
    return trimmed.replace(/[?&]dl=0/, "?raw=1").replace(/[?&]dl=1/, "?raw=1");
  }

  return trimmed;
}

// News Management
router.get("/news", async (_req,res) => {
  const [rows]=await getPool().query("SELECT id,title,summary,body,image_url,category,status,published_at FROM news ORDER BY id DESC LIMIT 200");
  res.json({news:rows});
});
router.post("/news", async (req,res) => {
  const {title,summary="",body="",imageUrl=null,category="Company",status="published"}=req.body||{};
  if(!title || !String(title).trim()) return res.status(400).json({message:"Title is required."});
  const finalImage = normalizeImageUrl(imageUrl);
  const [r]=await getPool().query(
    "INSERT INTO news(title,summary,body,image_url,category,status,published_at) VALUES(?,?,?,?,?,?,IF(?='published',NOW(),NULL))",
    [title.trim(),summary.trim(),body.trim(),finalImage,category.trim(),status,status]
  );
  res.status(201).json({id:r.insertId,message:"News article created."});
});
router.patch("/news/:id", async (req,res) => {
  const {title,summary,body,imageUrl,category,status}=req.body||{};
  const finalImage = imageUrl !== undefined ? normalizeImageUrl(imageUrl) : undefined;
  await getPool().query(
    `UPDATE news SET
       title = COALESCE(?, title),
       summary = COALESCE(?, summary),
       body = COALESCE(?, body),
       image_url = COALESCE(?, image_url),
       category = COALESCE(?, category),
       status = COALESCE(?, status),
       published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, NOW()) ELSE published_at END
     WHERE id=?`,
    [
      title ? String(title).trim() : null,
      summary !== undefined ? String(summary).trim() : null,
      body !== undefined ? String(body).trim() : null,
      finalImage !== undefined ? finalImage : null,
      category ? String(category).trim() : null,
      status || null,
      status || null,
      req.params.id
    ]
  );
  res.json({message:"News updated."});
});
router.delete("/news/:id", async (req,res) => {
  await getPool().query("DELETE FROM news WHERE id=?",[req.params.id]);
  res.json({message:"News deleted."});
});

// Plans Management
router.get("/plans", async (_req, res) => {
  const [rows] = await getPool().query(`
    SELECT p.*,
           COUNT(DISTINCT up.user_id) AS active_subscribers
    FROM plans p
    LEFT JOIN user_plans up ON up.plan_id=p.id AND up.status='active' AND (up.expires_at IS NULL OR up.expires_at>NOW())
    GROUP BY p.id
    ORDER BY p.id
  `);
  res.json({ plans: rows });
});
router.patch("/plans/:id", async (req, res) => {
  const { name, price, dailyIncome, dailyTasks, commissionRate, status } = req.body || {};
  await getPool().query(
    `UPDATE plans SET
       name = COALESCE(?, name),
       price = COALESCE(?, price),
       daily_income = COALESCE(?, daily_income),
       daily_tasks = COALESCE(?, daily_tasks),
       commission_rate = COALESCE(?, commission_rate),
       status = COALESCE(?, status)
     WHERE id=?`,
    [
      name ? String(name).trim() : null,
      price !== undefined ? Number(price) : null,
      dailyIncome !== undefined ? Number(dailyIncome) : null,
      dailyTasks !== undefined ? Number(dailyTasks) : null,
      commissionRate !== undefined ? Number(commissionRate) : null,
      status || null,
      req.params.id
    ]
  );
  res.json({ message: "Plan settings updated." });
});

// Tasks Management
router.get("/tasks", async (_req, res) => {
  const [rows] = await getPool().query(`
    SELECT t.*,
           COUNT(ts.id) total_submissions
    FROM tasks t
    LEFT JOIN task_submissions ts ON ts.task_id=t.id
    GROUP BY t.id
    ORDER BY t.id
  `);
  res.json({ tasks: rows });
});
router.post("/tasks", async (req, res) => {
  const { title, description = "", imageUrl = null, reward = 30, planRequired = null, status = "active" } = req.body || {};
  if (!title || !String(title).trim()) return res.status(400).json({ message: "Task title is required." });
  const finalImage = normalizeImageUrl(imageUrl);
  const [r] = await getPool().query(
    "INSERT INTO tasks(title, description, image_url, reward, plan_required, status) VALUES(?,?,?,?,?,?)",
    [title.trim(), description.trim(), finalImage, Number(reward || 30), planRequired || null, status || "active"]
  );
  res.status(201).json({ id: r.insertId, message: "Task created successfully." });
});
router.patch("/tasks/:id", async (req, res) => {
  const { title, description, imageUrl, reward, planRequired, status } = req.body || {};
  const finalImage = imageUrl !== undefined ? normalizeImageUrl(imageUrl) : undefined;
  await getPool().query(
    `UPDATE tasks SET
       title = COALESCE(?, title),
       description = COALESCE(?, description),
       image_url = COALESCE(?, image_url),
       reward = COALESCE(?, reward),
       plan_required = ?,
       status = COALESCE(?, status)
     WHERE id=?`,
    [
      title ? String(title).trim() : null,
      description !== undefined ? String(description).trim() : null,
      finalImage !== undefined ? finalImage : null,
      reward !== undefined ? Number(reward) : null,
      planRequired !== undefined ? (planRequired || null) : null,
      status || null,
      req.params.id
    ]
  );
  res.json({ message: "Task updated." });
});
router.delete("/tasks/:id", async (req, res) => {
  await getPool().query("DELETE FROM tasks WHERE id=?", [req.params.id]);
  res.json({ message: "Task deleted." });
});

// Announcements Management
router.get("/announcements", async (_req, res) => {
  try {
    const [rows] = await getPool().query(
      "SELECT id, title, message, image_url, link_url, link_label, active, created_at, updated_at FROM announcements ORDER BY id DESC"
    );
    res.json({ announcements: rows });
  } catch (e) {
    res.status(500).json({ message: "Unable to load announcements." });
  }
});

router.post("/announcements", async (req, res) => {
  const { title, message, imageUrl = null, linkUrl = null, linkLabel = "Learn More", active = 1 } = req.body || {};
  if (!title || !message) return res.status(400).json({ message: "Title and message are required." });
  const finalImage = normalizeImageUrl(imageUrl);
  try {
    const [r] = await getPool().query(
      "INSERT INTO announcements(title, message, image_url, link_url, link_label, active) VALUES(?,?,?,?,?,?)",
      [title.trim(), message.trim(), finalImage, linkUrl || null, linkLabel || "Learn More", active ? 1 : 0]
    );
    res.status(201).json({ id: r.insertId, message: "Announcement published." });
  } catch (e) {
    console.error("Save announcement error:", e);
    res.status(500).json({ message: "Unable to save announcement: " + (e.sqlMessage || e.message) });
  }
});

router.patch("/announcements/:id", async (req, res) => {
  const { title, message, imageUrl, linkUrl, linkLabel, active } = req.body || {};
  const finalImage = imageUrl !== undefined ? normalizeImageUrl(imageUrl) : undefined;
  try {
    await getPool().query(
      `UPDATE announcements
       SET title = COALESCE(?, title),
           message = COALESCE(?, message),
           image_url = COALESCE(?, image_url),
           link_url = COALESCE(?, link_url),
           link_label = COALESCE(?, link_label),
           active = COALESCE(?, active)
       WHERE id = ?`,
      [
        title ? title.trim() : null,
        message ? message.trim() : null,
        finalImage !== undefined ? finalImage : null,
        linkUrl !== undefined ? linkUrl : null,
        linkLabel !== undefined ? linkLabel : null,
        active !== undefined ? (active ? 1 : 0) : null,
        req.params.id
      ]
    );
    res.json({ message: "Announcement updated." });
  } catch (e) {
    console.error("Update announcement error:", e);
    res.status(500).json({ message: "Unable to update announcement: " + (e.sqlMessage || e.message) });
  }
});

router.delete("/announcements/:id", async (req, res) => {
  try {
    await getPool().query("DELETE FROM announcements WHERE id=?", [req.params.id]);
    res.json({ message: "Announcement deleted." });
  } catch (e) {
    res.status(500).json({ message: "Unable to delete announcement." });
  }
});

// ==========================================
// EARNINGS & DEPOSIT REVENUE BREAKDOWN
// ==========================================
router.get("/earnings", async (req, res) => {
  const q = String(req.query.q || "").trim();
  const status = String(req.query.status || "").trim();
  const startDate = req.query.startDate ? String(req.query.startDate).trim() : null;
  const endDate = req.query.endDate ? String(req.query.endDate).trim() : null;
  const dayPreset = String(req.query.preset || "").trim();
  const sort = String(req.query.sort || "newest_day").trim();
  const db = getPool();

  const conditions = ["1=1"];
  const params = [];

  if (q) {
    conditions.push("(u.phone LIKE ? OR u.full_name LIKE ? OR d.tid LIKE ? OR d.wallet_number LIKE ?)");
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (status && status !== "all") {
    conditions.push("d.status = ?");
    params.push(status);
  }
  if (dayPreset === "today") {
    conditions.push("DATE(d.submitted_at) = CURDATE()");
  } else if (dayPreset === "yesterday") {
    conditions.push("DATE(d.submitted_at) = SUBDATE(CURDATE(), 1)");
  } else if (dayPreset === "7days") {
    conditions.push("DATE(d.submitted_at) >= SUBDATE(CURDATE(), 7)");
  } else if (dayPreset === "30days") {
    conditions.push("DATE(d.submitted_at) >= SUBDATE(CURDATE(), 30)");
  } else if (dayPreset === "this_month") {
    conditions.push("MONTH(d.submitted_at) = MONTH(CURDATE()) AND YEAR(d.submitted_at) = YEAR(CURDATE())");
  } else {
    if (startDate) {
      conditions.push("DATE(d.submitted_at) >= ?");
      params.push(startDate);
    }
    if (endDate) {
      conditions.push("DATE(d.submitted_at) <= ?");
      params.push(endDate);
    }
  }

  const whereClause = conditions.join(" AND ");

  let dayOrder = "date_day DESC";
  if (sort === "oldest_day") dayOrder = "date_day ASC";
  else if (sort === "highest_amount") dayOrder = "approved_amount DESC";
  else if (sort === "lowest_amount") dayOrder = "approved_amount ASC";

  try {
    // 1. Grouped by Days
    const [dailyBreakdown] = await db.query(
      `SELECT 
         DATE(d.submitted_at) AS date_day,
         COUNT(*) AS total_count,
         COALESCE(SUM(CASE WHEN d.status = 'approved' THEN d.amount ELSE 0 END), 0) AS approved_amount,
         COALESCE(SUM(CASE WHEN d.status = 'pending' THEN d.amount ELSE 0 END), 0) AS pending_amount,
         COALESCE(SUM(CASE WHEN d.status = 'rejected' THEN d.amount ELSE 0 END), 0) AS rejected_amount,
         COALESCE(SUM(d.amount), 0) AS total_amount,
         COUNT(DISTINCT d.user_id) AS unique_depositors
       FROM deposits d
       JOIN users u ON u.id = d.user_id
       WHERE ${whereClause}
       GROUP BY DATE(d.submitted_at)
       ORDER BY ${dayOrder} LIMIT 100`,
      params
    );

    // 2. Summary Totals
    const [summaryRows] = await db.query(
      `SELECT 
         COALESCE(SUM(CASE WHEN d.status = 'approved' THEN d.amount ELSE 0 END), 0) AS total_approved,
         COALESCE(SUM(CASE WHEN d.status = 'pending' THEN d.amount ELSE 0 END), 0) AS total_pending,
         COALESCE(SUM(d.amount), 0) AS total_volume,
         COUNT(*) AS total_records
       FROM deposits d
       JOIN users u ON u.id = d.user_id
       WHERE ${whereClause}`,
      params
    );

    // 3. Raw Detailed Records
    const [deposits] = await db.query(
      `SELECT d.id, d.user_id, u.phone, u.full_name, d.plan_code, d.amount, d.payment_method, d.tid,
              d.wallet_number, d.proof_data, d.status, d.submitted_at, d.reviewed_at
       FROM deposits d
       JOIN users u ON u.id = d.user_id
       WHERE ${whereClause}
       ORDER BY d.submitted_at DESC LIMIT 300`,
      params
    );

    res.json({
      summary: summaryRows[0] || {},
      dailyBreakdown,
      deposits
    });
  } catch (err) {
    console.error("Admin earnings error:", err);
    res.status(500).json({ message: "Unable to load earnings breakdown." });
  }
});

// ==========================================
// DATA EXPORT (Users, Teams, Deposits, Withdrawals)
// ==========================================
router.get("/export/users", async (_req, res) => {
  try {
    const [rows] = await getPool().query(
      `SELECT u.id, u.phone, u.full_name, u.email, u.referral_code, u.role,
              u.wallet_balance, u.commission_balance, u.total_earned, u.created_at,
              ref.phone AS referrer_phone,
              (SELECT COUNT(*) FROM users m WHERE m.referred_by=u.id) AS direct_members,
              (SELECT p.code FROM user_plans up JOIN plans p ON p.id=up.plan_id WHERE up.user_id=u.id AND up.status='active' ORDER BY up.started_at DESC LIMIT 1) AS active_plan
       FROM users u
       LEFT JOIN users ref ON ref.id=u.referred_by
       WHERE u.role='user'
       ORDER BY u.id DESC`
    );
    res.json({ users: rows });
  } catch (e) {
    res.status(500).json({ message: "Unable to export users: " + e.message });
  }
});

router.get("/export/teams", async (_req, res) => {
  try {
    const [rows] = await getPool().query(
      `SELECT u.id AS member_id, u.phone AS member_phone, u.full_name AS member_name,
              ref.phone AS referrer_phone, ref.full_name AS referrer_name,
              u.wallet_balance, u.commission_balance, u.total_earned, u.created_at AS joined_at,
              (SELECT p.code FROM user_plans up JOIN plans p ON p.id=up.plan_id WHERE up.user_id=u.id AND up.status='active' ORDER BY up.started_at DESC LIMIT 1) AS active_plan
       FROM users u
       JOIN users ref ON ref.id = u.referred_by
       WHERE u.role='user'
       ORDER BY u.referred_by ASC, u.id DESC`
    );
    res.json({ teams: rows });
  } catch (e) {
    res.status(500).json({ message: "Unable to export teams: " + e.message });
  }
});

router.get("/export/deposits", async (_req, res) => {
  try {
    const [rows] = await getPool().query(
      `SELECT d.id, u.phone AS user_phone, u.full_name AS user_name, d.plan_code, d.amount,
              d.payment_method, d.tid, d.wallet_number, d.status, d.submitted_at, d.reviewed_at
       FROM deposits d
       JOIN users u ON u.id = d.user_id
       ORDER BY d.submitted_at DESC`
    );
    res.json({ deposits: rows });
  } catch (e) {
    res.status(500).json({ message: "Unable to export deposits: " + e.message });
  }
});

router.get("/export/withdrawals", async (_req, res) => {
  try {
    const [rows] = await getPool().query(
      `SELECT w.id, u.phone AS user_phone, u.full_name AS user_name, w.wallet_type, w.amount,
              w.fee, w.net_amount, pa.method, pa.account_name, pa.account_number,
              w.status, w.requested_at, w.processed_at
       FROM withdrawals w
       JOIN users u ON u.id = w.user_id
       LEFT JOIN payout_accounts pa ON pa.id = w.payout_account_id
       ORDER BY w.requested_at DESC`
    );
    res.json({ withdrawals: rows });
  } catch (e) {
    res.status(500).json({ message: "Unable to export withdrawals: " + e.message });
  }
});

// ==========================================
// DATA IMPORT (Users, Deposits, Withdrawals)
// ==========================================
router.post("/import/users", async (req, res) => {
  const { users = [] } = req.body || {};
  if (!Array.isArray(users) || users.length === 0) {
    return res.status(400).json({ message: "Please provide a valid list of users to import." });
  }

  const db = getPool();
  let importedCount = 0;
  let updatedCount = 0;
  const errors = [];

  for (const item of users) {
    const phone = String(item.phone || "").trim().replace(/\D/g, "");
    if (!phone || phone.length < 10) {
      errors.push(`Invalid phone: ${item.phone || "empty"}`);
      continue;
    }

    try {
      const [[existing]] = await db.query("SELECT id FROM users WHERE phone = ? LIMIT 1", [phone]);
      const fullName = String(item.full_name || item.fullName || "User").slice(0, 120);
      const email = item.email ? String(item.email).slice(0, 190) : null;
      const walletBal = Number(item.wallet_balance || item.walletBalance || 0);
      const commBal = Number(item.commission_balance || item.commissionBalance || 0);
      const earned = Number(item.total_earned || item.totalEarned || 0);

      let referrerId = null;
      if (item.referrer_phone || item.referrerPhone) {
        const refPhone = String(item.referrer_phone || item.referrerPhone).replace(/\D/g, "");
        const [[refRow]] = await db.query("SELECT id FROM users WHERE phone = ? LIMIT 1", [refPhone]);
        if (refRow) referrerId = refRow.id;
      }

      if (existing) {
        await db.query(
          `UPDATE users SET
             full_name = COALESCE(?, full_name),
             email = COALESCE(?, email),
             wallet_balance = ?,
             commission_balance = ?,
             total_earned = ?,
             referred_by = COALESCE(?, referred_by)
           WHERE id = ?`,
          [fullName, email, walletBal, commBal, earned, referrerId, existing.id]
        );
        updatedCount++;
      } else {
        const refCode = `ZF${Math.random().toString(36).slice(2, 7).toUpperCase()}${Math.floor(10 + Math.random() * 90)}`;
        const defaultHash = await bcrypt.hash("ZenFlow@123", 10);
        await db.query(
          `INSERT INTO users (phone, password_hash, full_name, email, referral_code, referred_by, wallet_balance, commission_balance, total_earned, role)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'user')`,
          [phone, defaultHash, fullName, email, refCode, referrerId, walletBal, commBal, earned]
        );
        importedCount++;
      }
    } catch (err) {
      errors.push(`Error on ${phone}: ${err.message}`);
    }
  }

  res.json({
    message: `User import finished: ${importedCount} created, ${updatedCount} updated.`,
    imported: importedCount,
    updated: updatedCount,
    errors
  });
});

router.post("/import/deposits", async (req, res) => {
  const { deposits = [] } = req.body || {};
  if (!Array.isArray(deposits) || deposits.length === 0) {
    return res.status(400).json({ message: "Please provide a valid list of deposits to import." });
  }

  const db = getPool();
  let importedCount = 0;
  const errors = [];

  for (const item of deposits) {
    const phone = String(item.user_phone || item.phone || "").trim().replace(/\D/g, "");
    const amount = Number(item.amount || 0);
    if (!phone || amount <= 0) {
      errors.push(`Invalid record: Phone ${phone}, Amount ${amount}`);
      continue;
    }

    try {
      const [[user]] = await db.query("SELECT id FROM users WHERE phone = ? LIMIT 1", [phone]);
      if (!user) {
        errors.push(`User not found with phone ${phone}`);
        continue;
      }

      const planCode = String(item.plan_code || item.planCode || "F1");
      const method = String(item.payment_method || item.method || "JazzCash");
      const tid = String(item.tid || `IMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`);
      const walletNum = item.wallet_number || item.walletNumber || phone;
      const status = ["approved", "pending", "rejected"].includes(item.status) ? item.status : "approved";

      await db.query(
        `INSERT INTO deposits (user_id, plan_code, amount, payment_method, tid, wallet_number, status, submitted_at, reviewed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [user.id, planCode, amount, method, tid, walletNum, status]
      );
      importedCount++;
    } catch (err) {
      errors.push(`Error on deposit TID ${item.tid || phone}: ${err.message}`);
    }
  }

  res.json({
    message: `Deposit import finished: ${importedCount} records imported.`,
    imported: importedCount,
    errors
  });
});

router.post("/import/withdrawals", async (req, res) => {
  const { withdrawals = [] } = req.body || {};
  if (!Array.isArray(withdrawals) || withdrawals.length === 0) {
    return res.status(400).json({ message: "Please provide a valid list of withdrawals to import." });
  }

  const db = getPool();
  let importedCount = 0;
  const errors = [];

  for (const item of withdrawals) {
    const phone = String(item.user_phone || item.phone || "").trim().replace(/\D/g, "");
    const amount = Number(item.amount || 0);
    if (!phone || amount <= 0) {
      errors.push(`Invalid record: Phone ${phone}, Amount ${amount}`);
      continue;
    }

    try {
      const [[user]] = await db.query("SELECT id FROM users WHERE phone = ? LIMIT 1", [phone]);
      if (!user) {
        errors.push(`User not found with phone ${phone}`);
        continue;
      }

      const walletType = item.wallet_type || "commission";
      const fee = Number(item.fee || (amount * 0.12));
      const netAmount = Number(item.net_amount || (amount - fee));
      const status = ["approved", "paid", "pending", "rejected"].includes(item.status) ? item.status : "approved";

      await db.query(
        `INSERT INTO withdrawals (user_id, wallet_type, amount, fee, net_amount, status, requested_at, processed_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [user.id, walletType, amount, fee, netAmount, status]
      );
      importedCount++;
    } catch (err) {
      errors.push(`Error on withdrawal ${phone}: ${err.message}`);
    }
  }

  res.json({
    message: `Withdrawal import finished: ${importedCount} records imported.`,
    imported: importedCount,
    errors
  });
});

export default router;
