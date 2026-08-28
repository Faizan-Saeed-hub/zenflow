import mysql from "mysql2/promise";

let pool;

function getPool() {
  if (!pool) {
    const isCloud = Boolean(
      process.env.DB_SSL === "true" ||
      process.env.DB_SSL === "1" ||
      (process.env.DB_HOST && !["localhost", "127.0.0.1"].includes(process.env.DB_HOST))
    );

    pool = mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 3306),
      database: process.env.DB_NAME || "zen",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      multipleStatements: true,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      connectTimeout: 20000,
      ...(isCloud ? { ssl: { rejectUnauthorized: false } } : {})
    });
  }
  return pool;
}

export async function testConnection() {
  try {
    const c = await getPool().getConnection();
    await c.ping();
    c.release();
    return "connected";
  } catch (error) {
    console.error("Database connection error:", error.message);
    return "not-connected";
  }
}

export { getPool };
