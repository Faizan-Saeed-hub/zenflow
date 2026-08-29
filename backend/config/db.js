import mysql from "mysql2/promise";

let pool;
let lastDbError = null;

function parseConnectionConfig() {
  const uri = process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.DB_URI || process.env.MYSQL_URI;
  if (uri && (uri.startsWith("mysql://") || uri.startsWith("mysql2://"))) {
    try {
      const u = new URL(uri.replace("mysql2://", "mysql://"));
      return {
        host: u.hostname,
        port: Number(u.port || 3306),
        user: decodeURIComponent(u.username || "root"),
        password: decodeURIComponent(u.password || ""),
        database: (u.pathname || "/zen").replace(/^\//, "") || "zen",
        ssl: { rejectUnauthorized: false }
      };
    } catch (_) {}
  }

  const host = process.env.DB_HOST || "localhost";
  const isCloud = Boolean(
    process.env.DB_SSL === "true" ||
    process.env.DB_SSL === "1" ||
    (host && !["localhost", "127.0.0.1"].includes(host))
  );

  return {
    host,
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME || "zen",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    ...(isCloud ? { ssl: { rejectUnauthorized: false } } : {})
  };
}

function getPool() {
  if (!pool) {
    const config = parseConnectionConfig();
    pool = mysql.createPool({
      ...config,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      multipleStatements: true,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      connectTimeout: 20000
    });
  }
  return pool;
}

export async function testConnection() {
  try {
    const c = await getPool().getConnection();
    await c.ping();
    c.release();
    lastDbError = null;
    return { status: "connected", host: parseConnectionConfig().host, database: parseConnectionConfig().database };
  } catch (error) {
    lastDbError = error.message;
    console.error("Database connection error:", error.message);
    return {
      status: "not-connected",
      error: error.message,
      code: error.code || "UNKNOWN",
      host: parseConnectionConfig().host,
      database: parseConnectionConfig().database
    };
  }
}

export { getPool, lastDbError };
