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

// Auto-initialize cloud database tables and default admin with smart retry
async function initializeDatabaseWithRetry(maxRetries = 15, delayMs = 3000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const dbHealth = await testConnection();
      if (dbHealth.status === "connected") {
        await runSetupDb();
        await runCreateAdmin();
        console.log("✓ Database auto-init & admin sync completed successfully.");
        return;
      }
    } catch (err) {
      console.warn(`[DB-Init] Waiting for cloud database to be ready (attempt ${attempt}/${maxRetries}):`, err.message);
    }
    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

initializeDatabaseWithRetry().catch(() => {});
app.use(cors({
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.get("/api/health", async (_req, res) => {
  const dbHealth = await testConnection();
  const isConnected = dbHealth.status === "connected";
  res
    .status(isConnected ? 200 : 503)
    .json({
      ok: isConnected,
      service: "zen-api",
      database: dbHealth.status,
      databaseName: dbHealth.database,
      dbDetails: dbHealth
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
app.use(express.static(publicPath, { maxAge: "1d" }));
app.use(express.static(distPath, {
  setHeaders: (res, path) => {
    if (path.endsWith("index.html")) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    }
  }
}));
app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api")) {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
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
