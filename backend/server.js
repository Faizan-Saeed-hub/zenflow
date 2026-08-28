import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

import express from "express";
import cors from "cors";
import compression from "compression";
import { testConnection } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import meRoutes from "./routes/me.js";
import notificationRoutes from "./routes/notifications.js";
import walletRoutes from "./routes/wallet.js";
import dashboardRoutes from "./routes/dashboard.js";
import plansRoutes from "./routes/plans.js";
import tasksRoutes from "./routes/tasks.js";
import checkinRoutes from "./routes/checkin.js";
import withdrawalsRoutes from "./routes/withdrawals.js";
import teamRoutes from "./routes/team.js";
import rewardsRoutes from "./routes/rewards.js";
import adminRoutes from "./routes/admin.js";
import depositRoutes from "./routes/deposits.js";
import contentRoutes from "./routes/content.js";
import luckyWheelRoutes from "./routes/luckyWheel.js";
import { runSetupDb } from "./setup-db.js";
import { runCreateAdmin } from "./create-admin.js";

const app=express(), PORT=Number(process.env.PORT||5000);

// Gzip compression for all JSON and static responses
app.use(compression());

// Auto-initialize cloud database tables and default admin
runSetupDb()
  .then(() => runCreateAdmin())
  .catch((err) => console.error("Database auto-init notice:", err.message));
app.use(cors({
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.get("/api/health", async (_req, res) => {
  const database = await testConnection();
  res
    .status(database === "connected" ? 200 : 503)
    .json({
      ok: database === "connected",
      service: "zen-api",
      database,
      databaseName: process.env.DB_NAME || "zen"
    });
});
app.use("/api/auth",authRoutes); app.use("/api/me",meRoutes); app.use("/api/notifications",notificationRoutes); app.use("/api/wallet",walletRoutes);
app.use("/api/deposits",depositRoutes);
app.use("/api/dashboard",dashboardRoutes);
app.use("/api/plans",plansRoutes);
app.use("/api/tasks",tasksRoutes);
app.use("/api/checkin",checkinRoutes);
app.use("/api/withdrawals",withdrawalsRoutes);
app.use("/api/team",teamRoutes);
app.use("/api/rewards",rewardsRoutes);
app.use("/api/admin",adminRoutes);
app.use("/api/content",contentRoutes);
app.use("/api/lucky-wheel",luckyWheelRoutes);

// Serve built frontend and public static assets with caching
const distPath = path.resolve(__dirname, "..", "dist");
const publicPath = path.resolve(__dirname, "..", "public");
app.use("/assets", express.static(path.join(distPath, "assets"), { maxAge: "30d", immutable: true }));
app.use(express.static(distPath, { maxAge: "1d" }));
app.use(express.static(publicPath, { maxAge: "1d" }));
app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api")) {
    return res.sendFile(path.join(distPath, "index.html"), (err) => {
      if (err) next();
    });
  }
  next();
});

app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({message:"Internal server error."});});

if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`Zen API running on port ${PORT}`));
}

export default app;
