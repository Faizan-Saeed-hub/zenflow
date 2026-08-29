import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "zenflow_jwt_secret_key_production_master_2026_zen";

export function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Authentication required." });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== "admin") return res.status(403).json({ message: "Admin access required." });
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired admin session." });
  }
}
