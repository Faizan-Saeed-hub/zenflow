import { Router } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getPool } from "../config/db.js";

const router = Router();

function isValidPhone(p) {
  if (typeof p !== "string") return false;
  const trimmed = p.trim();
  return /^03\d{9}$/.test(trimmed) || /^\d{11}$/.test(trimmed);
}

const JWT_SECRET = process.env.JWT_SECRET || "zenflow_jwt_secret_key_production_master_2026_zen";

const tokenFor = (u, sessionId) =>
  jwt.sign(
    { id: u.id, phone: u.phone, referralCode: u.referral_code, role: u.role, sessionId },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "30d" }
  );

router.post("/register", async (req, res) => {
  const { phone, password, fullName = "", email = "", invitationCode = "" } = req.body || {};
  if (!phone || !password) return res.status(400).json({ message: "Phone and password are required." });
  
  const cleanPhone = phone.trim();
  if (!isValidPhone(cleanPhone)) {
    return res.status(400).json({ message: "Phone number must be exactly 11 digits (e.g. 03001234567)." });
  }
  if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters." });

  const db = getPool(), c = await db.getConnection();
  try {
    await c.beginTransaction();
    const [exists] = await c.query("SELECT id FROM users WHERE phone=? LIMIT 1", [cleanPhone]);
    if (exists.length) {
      await c.rollback();
      return res.status(409).json({ message: "An account with this phone already exists." });
    }
    let ref = null;
    if (invitationCode) {
      const [r] = await c.query("SELECT id FROM users WHERE referral_code=? LIMIT 1", [invitationCode.trim()]);
      if (r.length) ref = r[0].id;
    }
    const hash = await bcrypt.hash(password, 12);
    const code = `ZF${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const sessionId = crypto.randomUUID();

    const [result] = await c.query(
      "INSERT INTO users(phone,password_hash,full_name,email,referral_code,referred_by,session_id) VALUES(?,?,?,?,?,?,?)",
      [cleanPhone, hash, fullName || null, email || null, code, ref, sessionId]
    );
    await c.query("INSERT INTO notifications(user_id,type,title,message) VALUES (?,'System',?,?)", [
      result.insertId,
      "Welcome to ZenFlow",
      "Your account has been created successfully."
    ]);
    await c.commit();
    const u = { id: result.insertId, phone: cleanPhone, referral_code: code, role: "user" };
    res.status(201).json({
      token: tokenFor(u, sessionId),
      user: { id: u.id, phone: cleanPhone, fullName, email, referralCode: code, role: u.role }
    });
  } catch (e) {
    await c.rollback();
    console.error(e);
    res.status(500).json({ message: "Unable to create account." });
  } finally {
    c.release();
  }
});

router.post("/login", async (req, res) => {
  const { phone, password } = req.body || {};
  if (!phone || !password) return res.status(400).json({ message: "Phone and password are required." });
  
  const cleanPhone = phone.trim();
  if (!isValidPhone(cleanPhone)) {
    return res.status(400).json({ message: "Phone number must be exactly 11 digits (e.g. 03001234567)." });
  }

  try {
    const [rows] = await getPool().query(
      "SELECT id,phone,password_hash,full_name,email,referral_code,role,must_change_password FROM users WHERE phone=? LIMIT 1",
      [cleanPhone]
    );
    if (!rows.length) return res.status(401).json({ message: "Invalid phone or password." });
    const u = rows[0];
    const match = await bcrypt.compare(password, u.password_hash);
    if (!match) {
      return res.status(401).json({ message: "Invalid phone or password." });
    }

    // Invalidate any previous session by generating a new unique sessionId
    const sessionId = crypto.randomUUID();
    getPool().query("UPDATE users SET session_id=? WHERE id=?", [sessionId, u.id]).catch(() => {});

    res.json({
      token: tokenFor(u, sessionId),
      user: {
        id: u.id,
        phone: u.phone,
        fullName: u.full_name,
        email: u.email,
        referralCode: u.referral_code,
        role: u.role,
        mustChangePassword: Boolean(u.must_change_password)
      }
    });
  } catch (e) {
    console.error("Login error:", e);
    res.status(500).json({ message: "Unable to log in." });
  }
});

router.post("/logout", async (req, res) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (payload?.id) {
        await getPool().query("UPDATE users SET session_id=NULL WHERE id=?", [payload.id]);
      }
    } catch (_) {}
  }
  res.json({ success: true, message: "Logged out successfully." });
});

export default router;
