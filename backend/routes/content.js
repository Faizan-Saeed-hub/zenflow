import { Router } from "express";
import { getPool } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/announcements/active", async (_req, res) => {
  try {
    const [rows] = await getPool().query(
      `SELECT id, title, message, image_url, link_url, link_label, created_at
       FROM announcements WHERE active=1 ORDER BY id DESC LIMIT 1`
    );
    res.json({ announcement: rows[0] || null });
  } catch (err) {
    console.error("Fetch announcement error:", err);
    res.json({ announcement: null });
  }
});

router.get("/news", async (_req, res) => {
  const [rows] = await getPool().query(
    `SELECT id,title,summary,body,image_url,published_at
     FROM news WHERE status='published' ORDER BY published_at DESC, id DESC LIMIT 50`
  );
  res.json({ news: rows });
});

router.get("/funds", async (req, res) => {
  const db = getPool();
  const [funds] = await db.query(
    `SELECT id,name,provider,term_days,daily_profit_rate,target_return_rate,capacity_percent,status
     FROM wealth_funds ORDER BY id`
  );
  if (!req.user) return res.json({ funds, purchases: [] });
  const [purchases] = await db.query(
    `SELECT wp.id,wp.principal,wp.expected_profit,wp.started_at,wp.expires_at,wp.status,
            wf.name FROM wealth_purchases wp JOIN wealth_funds wf ON wf.id=wp.fund_id
     WHERE wp.user_id=? ORDER BY wp.started_at DESC`, [req.user.id]
  );
  res.json({ funds, purchases });
});

router.use(requireAuth);

router.get("/loans", async (req, res) => {
  const [rows] = await getPool().query(
    `SELECT id,product_name,amount,status,requested_at FROM loans
     WHERE user_id=? OR user_id IS NULL ORDER BY id`, [req.user.id]
  );
  res.json({ loans: rows });
});

router.post("/loans", async (req, res) => {
  const { productName, amount } = req.body || {};
  const n = Number(amount);
  if (!productName || !Number.isFinite(n) || n <= 0) return res.status(400).json({message:"Enter a valid loan request."});
  const [result] = await getPool().query(
    "INSERT INTO loans(user_id,product_name,amount,status) VALUES(?,?,?,'pending')",
    [req.user.id, productName, n]
  );
  await getPool().query(
    "INSERT INTO notifications(user_id,type,title,message) VALUES(?,'System',?,?)",
    [req.user.id, "Loan request received", `Your ${productName} request is pending review.`]
  );
  res.status(201).json({ id: result.insertId, message:"Loan request submitted for review." });
});

router.post("/support", async (req, res) => {
  const { subject="Support request", message="" } = req.body || {};
  if (!message.trim()) return res.status(400).json({message:"Please describe your issue."});
  const [result] = await getPool().query(
    "INSERT INTO support_requests(user_id,subject,message) VALUES(?,?,?)",
    [req.user.id, subject, message.trim()]
  );
  res.status(201).json({id: result.insertId, message:"Support request submitted."});
});

export default router;
