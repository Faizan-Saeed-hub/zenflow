import { Router } from "express";
import { getPool } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const db = getPool();
  const [[me]] = await db.query("SELECT referral_code FROM users WHERE id=?", [req.user.id]);
  const [rows] = await db.query(`
    WITH RECURSIVE tree AS (
      SELECT id, phone, full_name, referred_by, 1 AS level
      FROM users WHERE referred_by = ?
      UNION ALL
      SELECT u.id, u.phone, u.full_name, u.referred_by, tree.level + 1
      FROM users u JOIN tree ON u.referred_by = tree.id
      WHERE tree.level < 3
    )
    SELECT tree.id, tree.phone, tree.full_name, tree.level,
           u.total_earned, u.commission_balance,
           p.name AS plan_name,
           COALESCE((
             SELECT SUM(ts.reward) FROM task_submissions ts
             WHERE ts.user_id=tree.id AND ts.status='approved'
           ),0) AS task_earnings
      FROM tree
      JOIN users u ON u.id=tree.id
      LEFT JOIN user_plans up ON up.user_id=u.id AND up.status='active' AND (up.expires_at IS NULL OR up.expires_at>NOW())
      LEFT JOIN plans p ON p.id=up.plan_id
     ORDER BY tree.level, tree.id
  `, [req.user.id]);

  const summary = { A: 0, B: 0, C: 0 };
  let teamEarnings = 0;
  rows.forEach(r => {
    if (r.level === 1) summary.A++;
    else if (r.level === 2) summary.B++;
    else if (r.level === 3) summary.C++;
    teamEarnings += Number(r.total_earned || 0);
  });

  res.json({
    referralCode: me?.referral_code || "",
    summary,
    total: rows.length,
    teamEarnings,
    members: rows
  });
});

export default router;
