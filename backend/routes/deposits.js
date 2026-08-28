import { Router } from "express";
import { getPool } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const [rows] = await getPool().query(
      `SELECT d.id,d.plan_id,d.plan_code,d.amount,d.payment_method,d.tid,d.wallet_number,
              d.proof_data,d.status,d.submitted_at,d.reviewed_at,p.name AS plan_name
         FROM deposits d
         LEFT JOIN plans p ON p.id=d.plan_id
        WHERE d.user_id=?
        ORDER BY d.submitted_at DESC LIMIT 100`,
      [req.user.id]
    );
    res.json({ deposits: rows });
  } catch (e) {
    console.error("GET /deposits failed:", e);
    res.status(500).json({ message: "Unable to load recharge history." });
  }
});

router.post("/", async (req, res) => {
  const {
    planCode,
    amount,
    paymentMethod = "JazzCash",
    tid,
    walletNumber,
    proofData = ""
  } = req.body || {};

  const n = Number(amount);
  const normalizedPlan = String(planCode || "").trim().toUpperCase();
  const normalizedTid = String(tid || "").trim();
  const normalizedWallet = String(walletNumber || "").replace(/\s/g, "");

  const methods = ["JazzCash","SadaPay","EasyPaisa","Binance (BEP-20)"];
  if (!normalizedPlan || !Number.isFinite(n) || n <= 0 || !normalizedTid) {
    return res.status(400).json({ message: "Plan, amount and transaction ID are required." });
  }
  if (!methods.includes(paymentMethod)) return res.status(400).json({ message: "Unsupported payment method." });
  if (paymentMethod !== "Binance (BEP-20)" && !/^03\d{9}$/.test(normalizedWallet)) {
    return res.status(400).json({ message: "Enter a valid 11-digit mobile wallet number." });
  }
  if (proofData && proofData.length > 7_000_000) {
    return res.status(413).json({ message: "Payment screenshot is too large. Please use an image under 5 MB." });
  }

  const db = getPool();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[plan]] = await conn.query(
      "SELECT id,code,name,price,status FROM plans WHERE code=? LIMIT 1 FOR UPDATE",
      [normalizedPlan]
    );
    if (!plan || plan.status !== "active") {
      await conn.rollback();
      return res.status(400).json({ message: "This plan is not currently available." });
    }
    if (Math.abs(Number(plan.price) - n) > 0.009) {
      await conn.rollback();
      return res.status(400).json({ message: `The selected plan requires Rs. ${Number(plan.price).toLocaleString()}.` });
    }

    const [[duplicateTid]] = await conn.query("SELECT id,status FROM deposits WHERE tid=? LIMIT 1 FOR UPDATE", [normalizedTid]);
    if (duplicateTid) {
      await conn.rollback();
      return res.status(409).json({ message: "This transaction ID has already been submitted." });
    }

    let cdnProofUrl = proofData || null;
    if (proofData && proofData.startsWith("data:image")) {
      try {
        cdnProofUrl = await uploadToCloudinary(proofData, "zenflow/deposits");
      } catch (err) {
        console.error("Cloudinary proof upload error:", err);
      }
    }

    const [result] = await conn.query(
      `INSERT INTO deposits
        (user_id,plan_id,plan_code,amount,payment_method,tid,wallet_number,proof_data,status)
       VALUES(?,?,?,?,?,?,?,?,'pending')`,
      [req.user.id, plan.id, plan.code, n, paymentMethod, normalizedTid, normalizedWallet, cdnProofUrl]
    );

    await conn.query(
      "INSERT INTO notifications(user_id,type,title,message) VALUES(?,'System',?,?)",
      [req.user.id, "Recharge submitted", `Your ${plan.code} recharge request #${result.insertId} is pending verification.`]
    );

    await conn.commit();
    res.status(201).json({
      id: result.insertId,
      message: `Recharge submitted successfully. Your ${plan.code} payment is pending admin verification.`
    });
  } catch (e) {
    await conn.rollback();
    console.error("POST /deposits failed:", e);
    if (e.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "This transaction ID has already been submitted." });
    if (e.code === "ER_NO_REFERENCED_ROW_2") return res.status(400).json({ message: "Selected plan is no longer available. Please refresh and try again." });
    res.status(500).json({ message: "Recharge server error. Please try again after refreshing the page." });
  } finally {
    conn.release();
  }
});

export default router;
