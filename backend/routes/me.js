import { Router } from "express";
import bcrypt from "bcryptjs";
import { getPool } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
const router=Router(); router.use(requireAuth);

router.get("/", async(req,res)=>{
  const [rows]=await getPool().query("SELECT id,phone,full_name,email,referral_code,avatar,language,push_notifications,notification_sound,wallet_balance,commission_balance,total_earned,role,created_at FROM users WHERE id=? LIMIT 1",[req.user.id]);
  if(!rows.length) return res.status(404).json({message:"User not found."});
  const u=rows[0]; res.json({user:{...u,fullName:u.full_name,referralCode:u.referral_code}});
});
router.patch("/", async(req,res)=>{
  const {fullName,email,avatar,language,pushNotifications,notificationSound}=req.body||{};
  await getPool().query("UPDATE users SET full_name=COALESCE(?,full_name),email=COALESCE(?,email),avatar=COALESCE(?,avatar),language=COALESCE(?,language),push_notifications=COALESCE(?,push_notifications),notification_sound=COALESCE(?,notification_sound) WHERE id=?",
    [fullName??null,email??null,avatar??null,language??null,pushNotifications==null?null:Number(Boolean(pushNotifications)),notificationSound==null?null:Number(Boolean(notificationSound)),req.user.id]);
  res.json({message:"Profile updated."});
});
router.post("/password",async(req,res)=>{
  const {currentPassword="",newPassword=""}=req.body||{};
  if(String(newPassword).length < 6) return res.status(400).json({message:"Password must be at least 6 characters."});
  const [[u]]=await getPool().query("SELECT password_hash FROM users WHERE id=?",[req.user.id]);
  if(!u) return res.status(404).json({message:"User not found."});
  if(!(await bcrypt.compare(String(currentPassword),u.password_hash))) return res.status(400).json({message:"Current password is incorrect."});
  await getPool().query("UPDATE users SET password_hash=?,must_change_password=0 WHERE id=?",[await bcrypt.hash(String(newPassword),12),req.user.id]);
  res.json({message:"Password updated."});
});

router.post("/fund-password",async(req,res)=>{
  const {fundPassword,confirmFundPassword}=req.body||{};
  if(!/^\d{6}$/.test(fundPassword||"")) return res.status(400).json({message:"Fund password must be exactly 6 digits."});
  if(fundPassword!==confirmFundPassword) return res.status(400).json({message:"Fund passwords do not match."});
  await getPool().query("UPDATE users SET fund_password_hash=? WHERE id=?",[await bcrypt.hash(fundPassword,12),req.user.id]);
  res.json({message:"Fund password saved."});
});
export default router;
