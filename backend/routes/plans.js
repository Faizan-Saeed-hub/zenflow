import { Router } from "express";
import { getPool } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";

const router=Router();
router.get("/", async(_req,res)=>{
  const [plans]=await getPool().query("SELECT id,code,name,price,daily_income,daily_tasks,commission_rate,status FROM plans ORDER BY id");
  res.json({plans});
});
router.use(requireAuth);
router.get("/mine", async(req,res)=>{
  const [rows]=await getPool().query("SELECT up.id,p.id plan_id,p.code,p.name,p.price,p.daily_income,p.daily_tasks,up.started_at,up.expires_at,CASE WHEN up.status='active' AND (up.expires_at IS NULL OR up.expires_at>NOW()) THEN 'active' ELSE up.status END AS status FROM user_plans up JOIN plans p ON p.id=up.plan_id WHERE up.user_id=? ORDER BY up.started_at DESC",[req.user.id]);
  res.json({plans:rows});
});
router.post("/:id/purchase", async(req,res)=>{
  const db=getPool();
  const conn=await db.getConnection();
  try{
    await conn.beginTransaction();
    const [[plan]]=await conn.query("SELECT * FROM plans WHERE id=? LIMIT 1 FOR UPDATE",[req.params.id]);
    if(!plan||plan.status!=='active'){await conn.rollback();return res.status(400).json({message:"This plan is not available."});}
    const [[u]]=await conn.query("SELECT wallet_balance FROM users WHERE id=? FOR UPDATE",[req.user.id]);
    const balance=Number(u?.wallet_balance||0); const price=Number(plan.price);
    if(balance<price){await conn.rollback();return res.status(400).json({message:`Insufficient Personal Wallet balance. You need Rs. ${price.toLocaleString()} but have Rs. ${balance.toLocaleString()}.`});}
    const after=balance-price;
    await conn.query("UPDATE users SET wallet_balance=wallet_balance-? WHERE id=?",[price,req.user.id]);
    const [purchase]=await conn.query("INSERT INTO plan_purchases(user_id,plan_id,amount,balance_before,balance_after,status) VALUES(?,?,?,?,?,'completed')",[req.user.id,plan.id,price,balance,after]);
    await conn.query("INSERT INTO user_plans(user_id,plan_id,expires_at) VALUES(?,?,DATE_ADD(NOW(),INTERVAL 1 YEAR))",[req.user.id,plan.id]);
    await conn.query("INSERT INTO wallet_transactions(user_id,type,amount,status,reference,note) VALUES(?,'plan_purchase',?,'completed',?,?)",[req.user.id,-price,`PLAN-${purchase.insertId}`,`Purchased ${plan.name}`]);

    // Reward the member's leaders when their referred member purchases/activates a plan.
    // Level A/B/C management fee: 12% / 4% / 2% of the plan purchase.
    const leaderRates=[0.12,0.04,0.02];
    let childId=req.user.id;
    for(let level=1; level<=3; level++){
      const [[child]]=await conn.query("SELECT referred_by FROM users WHERE id=? FOR UPDATE",[childId]);
      const leaderId=child?.referred_by;
      if(!leaderId) break;
      const award=Math.round(price*leaderRates[level-1]*100)/100;
      if(award>0){
        const ref=`PLAN-${purchase.insertId}-L${level}`;
        await conn.query("UPDATE users SET commission_balance=commission_balance+?,total_earned=total_earned+? WHERE id=?",[award,award,leaderId]);
        await conn.query("INSERT INTO team_earnings(user_id,member_user_id,level,source_type,amount,reference) VALUES(?,? ,?,'plan_purchase',?,?)",[leaderId,req.user.id,level,award,ref]);
        await conn.query("INSERT INTO reward_history(user_id,type,detail,amount,status) VALUES(?,'Referral',?,?, 'Completed')",[leaderId,`Level ${String.fromCharCode(64+level)} plan activation award from ${plan.name}`,award]);
        await conn.query("INSERT INTO notifications(user_id,type,title,message) VALUES(?,'Team',?,?)",[leaderId,"Plan activation award",`Rs. ${award.toLocaleString()} Level ${String.fromCharCode(64+level)} award has been credited because your team member activated ${plan.name}.`]);
      }
      childId=leaderId;
    }
    await conn.query("INSERT INTO notifications(user_id,type,title,message) VALUES(?,'System',?,?)",[req.user.id,"Plan purchased successfully",`${plan.name} has been activated. Rs. ${price.toLocaleString()} was deducted from your Personal Wallet. Remaining balance: Rs. ${after.toLocaleString()}.`]);
    await conn.commit();
    res.status(201).json({message:"Plan purchased successfully!",plan,remainingBalance:after});
  }catch(e){await conn.rollback();console.error(e);res.status(500).json({message:"Unable to purchase plan."});}finally{conn.release();}
});

export default router;
