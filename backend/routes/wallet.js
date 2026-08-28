import { Router } from "express";
import { getPool } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
const router=Router(); router.use(requireAuth);

router.get("/payment-settings",async(_req,res)=>{
  const [rows]=await getPool().query("SELECT method,account_label,account_number,qr_data,instructions,active FROM payment_settings WHERE active=1 ORDER BY id");
  res.json({settings:rows});
});
router.get("/transactions",async(req,res)=>{const [rows]=await getPool().query("SELECT id,type,amount,status,reference,note,created_at FROM wallet_transactions WHERE user_id=? ORDER BY created_at DESC LIMIT 100",[req.user.id]);res.json({transactions:rows});});
router.get("/accounts",async(req,res)=>{const [rows]=await getPool().query("SELECT id,method,account_name,account_number,created_at FROM payout_accounts WHERE user_id=? ORDER BY created_at DESC",[req.user.id]);res.json({accounts:rows});});
router.post("/accounts",async(req,res)=>{const {method,accountName,accountNumber}=req.body||{};if(!["JazzCash","EasyPaisa","Bank","BEP-20"].includes(method)||!accountName||!accountNumber)return res.status(400).json({message:"Valid payout account details are required."});await getPool().query("INSERT INTO payout_accounts(user_id,method,account_name,account_number) VALUES(?,?,?,?)",[req.user.id,method,accountName,accountNumber]);res.status(201).json({message:"Payout account added."});});
export default router;

router.get("/deposits",async(req,res)=>{
 const [rows]=await getPool().query("SELECT id,plan_code,amount,payment_method,tid,wallet_number,status,submitted_at FROM deposits WHERE user_id=? ORDER BY submitted_at DESC LIMIT 100",[req.user.id]);
 res.json({deposits:rows});
});
router.post("/deposits",async(req,res)=>{
 const {planCode,amount,paymentMethod,tid,walletNumber="",proofData}=req.body||{};
 const allowed=["JazzCash","SadaPay","EasyPaisa","Binance (BEP-20)"];
 if(!allowed.includes(paymentMethod)||!tid||!proofData||!Number.isFinite(Number(amount))) return res.status(400).json({message:"Complete payment details and proof are required."});
 const [r]=await getPool().query("INSERT INTO deposits(user_id,plan_code,amount,payment_method,tid,wallet_number,proof_data,status) VALUES(?,?,?,?,?,?,?,'pending')",[req.user.id,planCode,Number(amount),paymentMethod,tid,walletNumber,proofData]);
 await getPool().query("INSERT INTO notifications(user_id,type,title,message) VALUES(?,'System',?,?)",[req.user.id,"Recharge submitted",`Your ${planCode} recharge request has been submitted for verification.`]);
 res.status(201).json({id:r.insertId,message:"Recharge submitted successfully. It is pending admin verification."});
});
