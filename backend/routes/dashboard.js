import { Router } from "express";
import { getPool } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
const router=Router();
router.use(requireAuth);

router.get("/", async (req,res)=>{
  const db=getPool();
  const [[u]]=await db.query("SELECT wallet_balance,commission_balance,total_earned FROM users WHERE id=?",[req.user.id]);
  const [[p]]=await db.query("SELECT p.code,p.name,p.daily_tasks,p.daily_income FROM user_plans up JOIN plans p ON p.id=up.plan_id WHERE up.user_id=? AND up.status='active' AND (up.expires_at IS NULL OR up.expires_at>NOW()) ORDER BY up.started_at DESC LIMIT 1",[req.user.id]);
  const [[t]]=await db.query(`SELECT
      COALESCE(SUM(CASE WHEN status='approved' AND task_date=CURDATE() THEN reward ELSE 0 END),0) today_task_earnings,
      COALESCE(SUM(CASE WHEN status='approved' AND task_date=DATE_SUB(CURDATE(),INTERVAL 1 DAY) THEN reward ELSE 0 END),0) yesterday_task_earnings,
      COALESCE(SUM(CASE WHEN status='approved' AND task_date>=DATE_SUB(CURDATE(),INTERVAL WEEKDAY(CURDATE()) DAY) THEN reward ELSE 0 END),0) week_task_earnings,
      COALESCE(SUM(CASE WHEN status='approved' AND YEAR(task_date)=YEAR(CURDATE()) AND MONTH(task_date)=MONTH(CURDATE()) THEN reward ELSE 0 END),0) month_task_earnings,
      COALESCE(SUM(CASE WHEN status='approved' THEN reward ELSE 0 END),0) total_task_earnings,
      COALESCE(SUM(CASE WHEN status='approved' AND task_date=CURDATE() THEN 1 ELSE 0 END),0) completed_today
    FROM task_submissions WHERE user_id=?`,[req.user.id]);
  const [[team]]=await db.query("SELECT COALESCE(SUM(amount),0) amount FROM team_earnings WHERE user_id=?",[req.user.id]);
  const [[ref]]=await db.query("SELECT COALESCE(SUM(amount),0) amount FROM reward_history WHERE user_id=? AND type='Referral' AND status='Completed'",[req.user.id]);
  const [[c]]=await db.query("SELECT COUNT(*) checkins, COALESCE(SUM(reward),0) checkin_earned FROM daily_checkins WHERE user_id=?",[req.user.id]);
  const [[w]]=await db.query("SELECT COALESCE(SUM(amount),0) pending_withdrawals FROM withdrawals WHERE user_id=? AND status='pending'",[req.user.id]);
  const dailyLimit=p ? Number(p.daily_tasks||5) : 5;
  const completedToday=Number(t.completed_today||0);
  res.json({stats:{
    personalWallet:Number(u?.wallet_balance||0), commissionWallet:Number(u?.commission_balance||0), totalEarned:Number(u?.total_earned||0),
    totalTaskEarnings:Number(t.total_task_earnings||0), todayTaskEarnings:Number(t.today_task_earnings||0), yesterdayTaskEarnings:Number(t.yesterday_task_earnings||0),
    weekTaskEarnings:Number(t.week_task_earnings||0), monthTaskEarnings:Number(t.month_task_earnings||0), completedTasks:completedToday,
    completedToday, remainingToday:Math.max(0,dailyLimit-completedToday), dailyLimit, activePlan:p?{code:p.code,name:p.name,dailyTasks:Number(p.daily_tasks),dailyIncome:Number(p.daily_income)}:null,
    teamTaskCommission:Number(team.amount||0), referralCommission:Number(ref.amount||0), checkins:Number(c.checkins||0), checkinEarned:Number(c.checkin_earned||0), pendingWithdrawals:Number(w.pending_withdrawals||0)
  }});
});
export default router;
