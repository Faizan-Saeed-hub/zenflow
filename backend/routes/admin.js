import { Router } from "express";
import bcrypt from "bcryptjs";
import { getPool } from "../config/db.js";
import { requireAdmin } from "../middleware/admin.js";

const router = Router();
router.use(requireAdmin);

router.get("/dashboard", async (_req,res) => {
  const db=getPool();
  const [[users]]=await db.query("SELECT COUNT(*) total FROM users WHERE role='user'");
  const [[plans]]=await db.query("SELECT COUNT(*) total FROM plans");
  const [[tasks]]=await db.query("SELECT COUNT(*) total FROM tasks WHERE status='active'");
  const [[withdrawals]]=await db.query("SELECT COUNT(*) total FROM withdrawals WHERE status='pending'");
  const [[deposits]]=await db.query("SELECT COUNT(*) total FROM deposits WHERE status='pending'");
  const [[pendingLoans]]=await db.query("SELECT COUNT(*) total FROM loans WHERE status='pending'");
  const [[supports]]=await db.query("SELECT COUNT(*) total FROM support_requests WHERE status!='closed'");
  const [[wallet]]=await db.query("SELECT COALESCE(SUM(wallet_balance),0) total FROM users WHERE role='user'");
  res.json({stats:{users:Number(users.total),plans:Number(plans.total),tasks:Number(tasks.total),pendingWithdrawals:Number(withdrawals.total),pendingDeposits:Number(deposits.total),pendingLoans:Number(pendingLoans.total),openSupport:Number(supports.total),walletBalance:Number(wallet.total)}});
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

router.get("/deposits", async (_req,res) => {
  const [rows]=await getPool().query(`
    SELECT d.id,d.user_id,u.phone,u.full_name,d.plan_code,d.amount,d.payment_method,d.tid,
           d.wallet_number,d.proof_data,d.status,d.submitted_at,d.reviewed_at
      FROM deposits d JOIN users u ON u.id=d.user_id
     ORDER BY d.submitted_at DESC LIMIT 200`);
  res.json({deposits:rows});
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

router.get("/withdrawals", async (_req,res) => {
  const [rows]=await getPool().query(
    `SELECT w.id,w.user_id,u.phone,u.full_name,w.wallet_type,w.amount,w.fee,w.net_amount,w.status,
            w.requested_at,pa.method,pa.account_name,pa.account_number
     FROM withdrawals w JOIN users u ON u.id=w.user_id
     LEFT JOIN payout_accounts pa ON pa.id=w.payout_account_id
     ORDER BY w.requested_at DESC LIMIT 200`
  );
  res.json({withdrawals:rows});
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

// News Management
router.get("/news", async (_req,res) => {
  const [rows]=await getPool().query("SELECT id,title,summary,body,image_url,category,status,published_at FROM news ORDER BY id DESC LIMIT 200");
  res.json({news:rows});
});
router.post("/news", async (req,res) => {
  const {title,summary="",body="",imageUrl=null,category="Company",status="published"}=req.body||{};
  if(!title || !String(title).trim()) return res.status(400).json({message:"Title is required."});
  const [r]=await getPool().query(
    "INSERT INTO news(title,summary,body,image_url,category,status,published_at) VALUES(?,?,?,?,?,?,IF(?='published',NOW(),NULL))",
    [title.trim(),summary.trim(),body.trim(),imageUrl||null,category.trim(),status,status]
  );
  res.status(201).json({id:r.insertId,message:"News article created."});
});
router.patch("/news/:id", async (req,res) => {
  const {title,summary,body,imageUrl,category,status}=req.body||{};
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
      imageUrl !== undefined ? imageUrl : null,
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
  const [r] = await getPool().query(
    "INSERT INTO tasks(title, description, image_url, reward, plan_required, status) VALUES(?,?,?,?,?,?)",
    [title.trim(), description.trim(), imageUrl || null, Number(reward || 30), planRequired || null, status || "active"]
  );
  res.status(201).json({ id: r.insertId, message: "Task created successfully." });
});
router.patch("/tasks/:id", async (req, res) => {
  const { title, description, imageUrl, reward, planRequired, status } = req.body || {};
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
      imageUrl !== undefined ? imageUrl : null,
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
  try {
    const [r] = await getPool().query(
      "INSERT INTO announcements(title, message, image_url, link_url, link_label, active) VALUES(?,?,?,?,?,?)",
      [title.trim(), message.trim(), imageUrl || null, linkUrl || null, linkLabel || "Learn More", active ? 1 : 0]
    );
    res.status(201).json({ id: r.insertId, message: "Announcement published." });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Unable to save announcement." });
  }
});

router.patch("/announcements/:id", async (req, res) => {
  const { title, message, imageUrl, linkUrl, linkLabel, active } = req.body || {};
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
        imageUrl !== undefined ? imageUrl : null,
        linkUrl !== undefined ? linkUrl : null,
        linkLabel !== undefined ? linkLabel : null,
        active !== undefined ? (active ? 1 : 0) : null,
        req.params.id
      ]
    );
    res.json({ message: "Announcement updated." });
  } catch (e) {
    res.status(500).json({ message: "Unable to update announcement." });
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

export default router;
