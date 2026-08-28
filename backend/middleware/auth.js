import jwt from "jsonwebtoken";
import { getPool } from "../config/db.js";

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Authentication required." });
  
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    
    // Single active session & existence verification
    const [rows] = await getPool().query(
      "SELECT id, phone, role, session_id FROM users WHERE id = ? LIMIT 1",
      [payload.id]
    );
    if (!rows.length) {
      return res.status(401).json({ message: "User account not found.", code: "USER_NOT_FOUND" });
    }
    const user = rows[0];
    
    // If a new login occurred on another device, the DB session_id won't match payload.sessionId
    if (user.session_id && payload.sessionId && user.session_id !== payload.sessionId) {
      return res.status(401).json({
        message: "Your account was logged in from another device. Please log in again.",
        code: "SESSION_TERMINATED"
      });
    }
    
    req.user = { ...payload, role: user.role, phone: user.phone };
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired session.", code: "TOKEN_INVALID" });
  }
}
