import { Router } from "express";
import { getPool } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
import bcrypt from "bcryptjs";

const router=Router();
router.use(requireAuth);

function pakistanWindow() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone:"Asia/Karachi", weekday:"short", hour:"2-digit", minute:"2-digit", hour12:false
  }).formatToParts(new Date());
  const get = k => parts.find(p=>p.type===k)?.value || "";
  const weekday=get("weekday");
  const hour=Number(get("hour")), minute=Number(get("minute"));
  const openDays=["Mon","Tue","Wed","Thu","Fri"].includes(weekday);
  const openMinutes=hour*60+minute >= 11*60 && hour*60+minute <= 17*60;
  return {open:openDays && openMinutes,weekday};
}

router.get("/",async(req,res)=>{
  try {
    const [rows]=await getPool().query(
      `SELECT w.id,w.wallet_type,w.amount,w.fee,w.net_amount,w.status,w.requested_at,
              pa.method,pa.account_name,pa.account_number
         FROM withdrawals w
         LEFT JOIN payout_accounts pa ON pa.id=w.payout_account_id
        WHERE w.user_id=? ORDER BY w.requested_at DESC`,
      [req.user.id]
    );
    res.json({withdrawals:rows});
  } catch(e) { console.error(e); res.status(500).json({message:"Unable to load withdrawal history."}); }
});

router.post("/",async(req,res)=>{
 const {walletType='commission',amount,payoutAccountId,fundPassword}=req.body||{};
 const n=Number(amount);
 if(!['commission','personal'].includes(walletType)||!Number.isFinite(n)||n<=0)
   return res.status(400).json({message:"Enter a valid withdrawal amount."});

 const window=pakistanWindow();
 if(!window.open)
   return res.status(400).json({message:"Withdrawals are currently closed. Available Monday to Friday, 11:00 AM–5:00 PM (PKT)."});

 const db=getPool(); const conn=await db.getConnection();
 try{
  await conn.beginTransaction();

  const [[u]]=await conn.query(
    "SELECT wallet_balance,commission_balance,fund_password_hash FROM users WHERE id=? FOR UPDATE",
    [req.user.id]
  );
  if(!u?.fund_password_hash){await conn.rollback();return res.status(400).json({message:"Create your 6-digit fund password first."});}
  if(!(await bcrypt.compare(String(fundPassword||""),u.fund_password_hash))){await conn.rollback();return res.status(400).json({message:"Incorrect fund password."});}

  const [[active]]=await conn.query(
    "SELECT id FROM user_plans WHERE user_id=? AND status='active' AND (expires_at IS NULL OR expires_at>NOW()) LIMIT 1",
    [req.user.id]
  );
  if(!active){await conn.rollback();return res.status(403).json({message:"Withdrawals unlock after you activate a plan."});}

  const [[todayRequest]]=await conn.query(
    "SELECT id FROM withdrawals WHERE user_id=? AND DATE(CONVERT_TZ(requested_at,'+00:00','+05:00'))=DATE(CONVERT_TZ(NOW(),'+00:00','+05:00')) LIMIT 1",
    [req.user.id]
  );
  if(todayRequest){await conn.rollback();return res.status(409).json({message:"Only one withdrawal request is allowed per day."});}

  const [[account]]=await conn.query(
    "SELECT id,method FROM payout_accounts WHERE id=? AND user_id=? LIMIT 1",
    [payoutAccountId||0,req.user.id]
  );
  if(!account){await conn.rollback();return res.status(400).json({message:"Select one of your saved payout accounts."});}

  const balance=walletType==='commission'?Number(u.commission_balance||0):Number(u.wallet_balance||0);
  if(n>balance){await conn.rollback();return res.status(400).json({message:`Insufficient ${walletType==='commission'?'Commission':'Personal'} Wallet balance.`});}

  const feeRate=(account.method==='JazzCash'||account.method==='EasyPaisa')?0.12:0;
  const fee=n*feeRate;
  const net=n-fee;

  if(walletType==='commission') await conn.query("UPDATE users SET commission_balance=commission_balance-? WHERE id=?",[n,req.user.id]);
  else await conn.query("UPDATE users SET wallet_balance=wallet_balance-? WHERE id=?",[n,req.user.id]);

  const [wr]=await conn.query(
    "INSERT INTO withdrawals(user_id,wallet_type,amount,fee,net_amount,payout_account_id,status) VALUES(?,?,?,?,?,?, 'pending')",
    [req.user.id,walletType,n,fee,net,account.id]
  );
  await conn.query(
    "INSERT INTO wallet_transactions(user_id,type,amount,status,reference,note) VALUES(?,'withdrawal',?,'pending',?,?)",
    [req.user.id,-n,`WITHDRAWAL-${wr.insertId}`,`${walletType} wallet withdrawal via ${account.method}; net payout Rs. ${net.toFixed(2)}`]
  );
  await conn.query(
    "INSERT INTO notifications(user_id,type,title,message) VALUES(?,'System',?,?)",
    [req.user.id,"Withdrawal request submitted",`Your Rs. ${n.toLocaleString()} withdrawal request is under review.`]
  );
  await conn.commit();
  res.status(201).json({message:"Withdrawal request submitted.",netAmount:net});
 }catch(e){
  await conn.rollback();console.error(e);
  res.status(500).json({message:"Unable to submit withdrawal."});
 }finally{conn.release();}
});
export default router;
