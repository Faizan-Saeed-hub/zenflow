import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(root, ".env") });

const dbName = (process.env.DB_NAME || "zen").replace(/`/g, "");
const phone = process.env.ADMIN_PHONE || "03000000000";
const password = process.env.ADMIN_PASSWORD || "Admin@12345";
const name = process.env.ADMIN_NAME || "ZenFlow Admin";

function dbConfig(includeDatabase = true) {
  const isCloud = Boolean(
    process.env.DB_SSL === "true" ||
    process.env.DB_SSL === "1" ||
    (process.env.DB_HOST && !["localhost", "127.0.0.1"].includes(process.env.DB_HOST))
  );
  return {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    ...(includeDatabase ? { database: dbName } : {}),
    ...(isCloud ? { ssl: { rejectUnauthorized: false } } : {}),
    multipleStatements: true,
    connectTimeout: 20000
  };
}

let db;

export async function runCreateAdmin() {
  try {
    try {
      db = await mysql.createConnection(dbConfig(true));
    } catch (directErr) {
      db = await mysql.createConnection(dbConfig(false));
      await db.query(
        `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );
      await db.query(`USE \`${dbName}\``);
    }

    // Clean up old default local admin account
    await db.query("DELETE FROM users WHERE phone='03000000000'").catch(() => {});

    const schema = await fs.readFile(
      path.join(__dirname, "database", "schema.sql"),
      "utf8"
    );
    await db.query(schema);

    const [columns] = await db.query(
      `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA=? AND TABLE_NAME='users' AND COLUMN_NAME='role'`,
      [dbName]
    );

    try {
      if (!columns.length) {
        await db.query(
          "ALTER TABLE users ADD COLUMN role ENUM('user','admin') NOT NULL DEFAULT 'user'"
        );
      }
    } catch (_) {}

    const hash = await bcrypt.hash(password, 12);

    const [existing] = await db.query(
      "SELECT id FROM users WHERE phone=? LIMIT 1",
      [phone]
    );

    if (existing.length) {
      await db.query(
        "UPDATE users SET role='admin', password_hash=?, full_name=? WHERE id=?",
        [hash, name, existing[0].id]
      );
      console.log(`Admin account updated: ${phone}`);
    } else {
      const code = `ADMIN${Date.now().toString(36).toUpperCase()}`;
      await db.query(
        "INSERT INTO users(phone,password_hash,full_name,referral_code,role) VALUES(?,?,?,?,?)",
        [phone, hash, name, code, "admin"]
      );
      console.log(`Admin account created: ${phone}`);
    }

    console.log(`Database: ${dbName}`);
    console.log(`Admin phone: ${phone}`);
    console.log("Admin role: admin");
    return true;
  } catch (error) {
    console.error("ADMIN SETUP FAILED");
    console.error(`Host: ${process.env.DB_HOST || "localhost"}`);
    console.error(`Port: ${process.env.DB_PORT || "3306"}`);
    console.error(`User: ${process.env.DB_USER || "root"}`);
    console.error(`Database: ${dbName}`);
    console.error(`MySQL error: ${error.message}`);

    if (error.code === "ECONNREFUSED") {
      console.error("Start MySQL from XAMPP Control Panel.");
    } else if (error.code === "ER_ACCESS_DENIED_ERROR") {
      console.error("Check DB_USER and DB_PASSWORD in .env.");
    }
    return false;
  } finally {
    if (db) {
      await db.end().catch(() => {});
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runCreateAdmin().then((ok) => {
    if (!ok) process.exitCode = 1;
  });
}
