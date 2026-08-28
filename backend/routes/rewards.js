import { Router } from "express";
import { getPool } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const [rows] = await getPool().query(
    `SELECT id,type,detail,amount,status,created_at
     FROM reward_history WHERE user_id=? ORDER BY created_at DESC LIMIT 200`,
    [req.user.id]
  );
  
  const taskRewards = rows.filter((r) => r.type === "Task" || r.type === "Check-in");
  const teamCommissions = rows.filter((r) => r.type === "Referral" || r.type === "Commission" || r.type === "Team");
  
  const total = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const taskTotal = taskRewards.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const commissionTotal = teamCommissions.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  
  res.json({
    rewards: rows,
    taskRewards,
    teamCommissions,
    total,
    taskTotal,
    commissionTotal,
    count: rows.length
  });
});

export default router;
