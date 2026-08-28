import { Router } from "express";
import { getPool } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
const router=Router(); router.use(requireAuth);
router.get("/",async(req,res)=>{const [rows]=await getPool().query("SELECT id,type,title,message,is_read,created_at FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100",[req.user.id]);res.json({notifications:rows});});
router.post("/read-all",async(req,res)=>{await getPool().query("UPDATE notifications SET is_read=1 WHERE user_id=?",[req.user.id]);res.json({message:"Notifications marked as read."});});
router.post("/:id/read",async(req,res)=>{await getPool().query("UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?",[req.params.id,req.user.id]);res.json({message:"Notification marked as read."});});
export default router;
