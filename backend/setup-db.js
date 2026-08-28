import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(root, ".env") });

const dbName = (process.env.DB_NAME || "zen").replace(/`/g, "");
const schemaPath = path.join(__dirname, "database", "schema.sql");

function dbConfig(includeDatabase = false) {
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

const q = (sql, params = []) => db.query(sql, params);

async function hasTable(table) {
  const [rows] = await q(
    `SELECT 1 FROM information_schema.TABLES WHERE (TABLE_SCHEMA=? OR TABLE_SCHEMA=DATABASE()) AND TABLE_NAME=? LIMIT 1`,
    [dbName, table]
  );
  return rows.length > 0;
}

async function hasColumn(table, column) {
  const [rows] = await q(
    `SELECT 1 FROM information_schema.COLUMNS WHERE (TABLE_SCHEMA=? OR TABLE_SCHEMA=DATABASE()) AND TABLE_NAME=? AND COLUMN_NAME=? LIMIT 1`,
    [dbName, table, column]
  );
  return rows.length > 0;
}

async function ensureColumn(table, column, definition) {
  try {
    if (!(await hasColumn(table, column))) {
      await q(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
      console.log(`Added column ${table}.${column}`);
    }
  } catch (_) {}
}

async function hasIndex(table, indexName) {
  const [rows] = await q(
    `SELECT 1 FROM information_schema.STATISTICS WHERE (TABLE_SCHEMA=? OR TABLE_SCHEMA=DATABASE()) AND TABLE_NAME=? AND INDEX_NAME=? LIMIT 1`,
    [dbName, table, indexName]
  );
  return rows.length > 0;
}

async function ensureIndex(table, indexName, definition) {
  if (!(await hasIndex(table, indexName))) {
    await q(`ALTER TABLE \`${table}\` ADD ${definition}`);
    console.log(`Added index ${table}.${indexName}`);
  }
}

async function ensureCoreColumns() {
  // users
  await ensureColumn("users", "role", "ENUM('user','admin') NOT NULL DEFAULT 'user'");
  await ensureColumn("users", "session_id", "VARCHAR(64) NULL");
  await ensureColumn("users", "wallet_balance", "DECIMAL(18,2) NOT NULL DEFAULT 0");
  await ensureColumn("users", "commission_balance", "DECIMAL(18,2) NOT NULL DEFAULT 0");
  await ensureColumn("users", "total_earned", "DECIMAL(18,2) NOT NULL DEFAULT 0");
  await ensureColumn("users", "fund_password_hash", "VARCHAR(255) NULL");
  await ensureColumn("users", "avatar", "VARCHAR(500) NULL");
  await ensureColumn("users", "language", "VARCHAR(20) NOT NULL DEFAULT 'English'");
  await ensureColumn("users", "push_notifications", "TINYINT(1) NOT NULL DEFAULT 1");
  await ensureColumn("users", "notification_sound", "TINYINT(1) NOT NULL DEFAULT 0");
  await ensureColumn("users", "must_change_password", "TINYINT(1) NOT NULL DEFAULT 0");

  // plans
  await ensureColumn("plans", "daily_tasks", "INT UNSIGNED NOT NULL DEFAULT 5");
  await ensureColumn("plans", "daily_income", "DECIMAL(18,2) NOT NULL DEFAULT 0");
  await ensureColumn("plans", "commission_rate", "DECIMAL(8,4) NOT NULL DEFAULT 0");
  await ensureColumn("plans", "status", "ENUM('active','coming_soon') NOT NULL DEFAULT 'active'");

  // tasks
  await ensureColumn("tasks", "description", "TEXT NULL");
  await ensureColumn("tasks", "image_url", "VARCHAR(500) NULL");
  await ensureColumn("tasks", "reward", "DECIMAL(18,2) NOT NULL DEFAULT 0");
  await ensureColumn("tasks", "plan_required", "VARCHAR(20) NULL");
  await ensureColumn("tasks", "status", "ENUM('active','inactive') NOT NULL DEFAULT 'active'");

  // task submissions / completion lifecycle
  await ensureColumn("task_submissions", "submitted_at", "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP");
  await ensureColumn("task_submissions", "review_text", "TEXT NULL");
  await ensureColumn("task_submissions", "rating", "TINYINT UNSIGNED NULL");
  await ensureColumn("task_submissions", "status", "ENUM('reading','review_submitted','reward_claimable','approved','rejected') NOT NULL DEFAULT 'reading'");
  await ensureColumn("task_submissions", "reward", "DECIMAL(18,2) NOT NULL DEFAULT 0");
  await ensureColumn("task_submissions", "task_date", "DATE NULL");
  await ensureColumn("task_submissions", "reading_completed_at", "TIMESTAMP NULL");
  await ensureColumn("task_submissions", "reviewed_at", "TIMESTAMP NULL");
  await ensureColumn("task_submissions", "reward_claimed_at", "TIMESTAMP NULL");
  await ensureColumn("task_submissions", "completed_at", "TIMESTAMP NULL");
  await q("UPDATE task_submissions SET task_date=DATE(submitted_at) WHERE task_date IS NULL");
  // Safe because all existing rows have now been populated.
  await q("ALTER TABLE task_submissions MODIFY COLUMN task_date DATE NOT NULL");

  // Finance / new feature columns
  if (await hasTable("wallet_transactions")) {
    await q("ALTER TABLE wallet_transactions MODIFY COLUMN type VARCHAR(40) NOT NULL");
  }
  if (await hasTable("payment_settings")) {
    await ensureColumn("payment_settings", "account_label", "VARCHAR(120) NOT NULL DEFAULT ''");
    await ensureColumn("payment_settings", "account_number", "VARCHAR(255) NOT NULL DEFAULT ''");
    await ensureColumn("payment_settings", "qr_data", "LONGTEXT NULL");
    await ensureColumn("payment_settings", "instructions", "TEXT NULL");
    await ensureColumn("payment_settings", "active", "TINYINT(1) NOT NULL DEFAULT 1");
  }

  if (await hasTable("deposits")) {
    await ensureColumn("deposits", "plan_id", "INT UNSIGNED NULL");
    await ensureColumn("deposits", "plan_code", "VARCHAR(20) NOT NULL DEFAULT 'F1'");
    await ensureColumn("deposits", "amount", "DECIMAL(18,2) NOT NULL DEFAULT 0");
    await ensureColumn("deposits", "payment_method", "ENUM('JazzCash','SadaPay','EasyPaisa','Binance (BEP-20)') NOT NULL DEFAULT 'JazzCash'");
    // Expand legacy JazzCash-only enum safely on existing MySQL databases.
    try { await q("ALTER TABLE deposits MODIFY COLUMN payment_method ENUM('JazzCash','SadaPay','EasyPaisa','Binance (BEP-20)') NOT NULL DEFAULT 'JazzCash'"); } catch (_) {}
    await ensureColumn("deposits", "tid", "VARCHAR(120) NULL");
    await ensureColumn("deposits", "wallet_number", "VARCHAR(40) NOT NULL DEFAULT ''");
    await ensureColumn("deposits", "proof_data", "LONGTEXT NULL");
    await ensureColumn("deposits", "status", "ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending'");
    await ensureColumn("deposits", "submitted_at", "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP");
    await ensureColumn("deposits", "reviewed_at", "TIMESTAMP NULL");
  }
}

async function migrateTaskSubmissionIndexes() {
  if (!(await hasTable("task_submissions"))) return;

  // Ensure the FK columns have their own supporting indexes before touching
  // any legacy unique index. This makes the migration safe on XAMPP/MySQL 8.
  await ensureIndex("task_submissions", "idx_submission_task", "INDEX idx_submission_task (task_id)");
  await ensureIndex("task_submissions", "idx_submission_user", "INDEX idx_submission_user (user_id)");

  // Older versions used uq_task_user (task_id,user_id). The current lifecycle
  // is per task/user/day, so add the correct unique key first.
  if (!(await hasIndex("task_submissions", "uq_task_user_date"))) {
    await q("ALTER TABLE task_submissions ADD UNIQUE KEY uq_task_user_date (task_id,user_id,task_date)");
    console.log("Added unique task/user/date constraint");
  }

  if (await hasIndex("task_submissions", "uq_task_user")) {
    // Never blindly DROP an index that MySQL may still be using for an FK.
    // Drop the known FKs, remove the legacy index, then recreate the FKs.
    for (const fk of ["fk_submission_task", "fk_submission_user"]) {
      try { await q(`ALTER TABLE task_submissions DROP FOREIGN KEY \`${fk}\``); } catch (_) {}
    }
    if (await hasIndex("task_submissions", "uq_task_user")) {
      await q("ALTER TABLE task_submissions DROP INDEX uq_task_user");
      console.log("Removed legacy uq_task_user index");
    }
    if (!(await hasIndex("task_submissions", "idx_submission_task"))) {
      await q("ALTER TABLE task_submissions ADD INDEX idx_submission_task (task_id)");
    }
    if (!(await hasIndex("task_submissions", "idx_submission_user"))) {
      await q("ALTER TABLE task_submissions ADD INDEX idx_submission_user (user_id)");
    }
    try { await q("ALTER TABLE task_submissions ADD CONSTRAINT fk_submission_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE"); } catch (_) {}
    try { await q("ALTER TABLE task_submissions ADD CONSTRAINT fk_submission_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE"); } catch (_) {}
  }
}

async function ensureNewTables() {
  // Re-run the schema after legacy migrations. CREATE TABLE IF NOT EXISTS is
  // harmless for existing tables and creates every table introduced by ZenFlow.
  const schema = await fs.readFile(schemaPath, "utf8");
  await q(schema);

  const requiredTables = [
    "users", "plans", "user_plans", "tasks", "task_submissions",
    "plan_purchases", "daily_checkins", "wallet_transactions", "deposits",
    "payout_accounts", "withdrawals", "reward_history", "team_earnings", "notifications",
    "support_requests", "wealth_funds", "wealth_purchases", "loans", "news", "payment_settings",
    "announcements"
  ];
  const missing = [];
  for (const table of requiredTables) {
    if (!(await hasTable(table))) missing.push(table);
  }
  if (missing.length) {
    throw new Error(`Required table(s) missing after schema initialization: ${missing.join(", ")}`);
  }
  console.log(`Database table verification passed: ${requiredTables.length}/${requiredTables.length} required tables present.`);
}

async function seedAndVerify() {
  if (await hasTable("announcements")) {
    const [annCount] = await q("SELECT COUNT(*) AS c FROM announcements");
    if (!annCount[0].c) {
      await q(`
        INSERT INTO announcements (title, message, image_url, link_url, link_label, active)
        VALUES (
          'Welcome to ZenFlow Official Platform',
          'Welcome to ZenFlow! Complete daily book-review tasks, explore investment funds, and build your team to earn daily income and commissions. For support, reach out to our official channel.',
          NULL,
          'https://t.me/faizdex',
          'Join Telegram Channel',
          1
        )
      `);
      console.log("Seeded initial active announcement.");
    }
  }

  await q(`
    INSERT INTO payment_settings (method,account_label,account_number,qr_data,instructions,active) VALUES
    ('JazzCash','JazzCash Business Till','980203437',NULL,'Pay to the business till and upload your payment screenshot.',1),
    ('SadaPay','SadaPay account number','03254138875',NULL,'Pay to the SadaPay account and upload your payment screenshot.',1),
    ('EasyPaisa','EasyPaisa Business Till','03001234567',NULL,'Pay to the EasyPaisa account and upload your payment screenshot.',1),
    ('Binance (BEP-20)','USDT BEP-20 address','0x7E2F000000000000000000000000000000000001',NULL,'Send USDT only on the BEP-20 network and upload proof.',1)
    ON DUPLICATE KEY UPDATE
      account_label=VALUES(account_label),
      account_number=IF(payment_settings.account_number='',VALUES(account_number),payment_settings.account_number),
      instructions=VALUES(instructions),
      active=VALUES(active)
  `);

  // Seed/update plans only after daily_tasks is guaranteed to exist.
  await q(`
    INSERT INTO plans (code,name,price,daily_income,daily_tasks,commission_rate,status) VALUES
    ('F1','F1',4500,150,5,0.10,'active'),
    ('F2','F2',16500,550,10,0.10,'active'),
    ('F3','F3',60000,2000,25,0.10,'active'),
    ('F4','F4',216000,7200,50,0.10,'coming_soon'),
    ('F5','F5',480000,16000,100,0.10,'coming_soon'),
    ('F6','F6',1455000,48500,200,0.10,'coming_soon'),
    ('F7','F7',3870000,129000,300,0.10,'coming_soon'),
    ('F8','F8',7350000,245000,400,0.10,'coming_soon'),
    ('F9','F9',15150000,505000,550,0.10,'coming_soon')
    ON DUPLICATE KEY UPDATE
      name=VALUES(name), price=VALUES(price), daily_income=VALUES(daily_income),
      daily_tasks=VALUES(daily_tasks), commission_rate=VALUES(commission_rate), status=VALUES(status)
  `);

  // Seed the initial five daily review tasks for all users (including new interns)
  await q(`
    INSERT INTO tasks (id, title, description, image_url, reward, plan_required, status) VALUES
    (1, 'Glass Orchard', 'Explore the rich themes of friendship, patience, and ordinary days in this deeply moving narrative.', '/zenflow-images/task-cards/book-letters-to-shirin.png', 30.00, NULL, 'active'),
    (2, 'Midnight Street', 'A nighttime journey uncovering forgotten memories and second chances in a bustling city bakery.', '/zenflow-images/task-cards/book-midnight-bakery.png', 30.00, NULL, 'active'),
    (3, 'Silent Harbor', 'A reflective exploration of winter swimmers and coastal lives touched by change.', '/zenflow-images/task-cards/book-winter-swimmers.png', 30.00, NULL, 'active'),
    (4, 'Winter Sparrow', 'An intricate tale of clockwork wonders and promises kept across generations.', '/zenflow-images/task-cards/book-clockwork-orchid.png', 30.00, NULL, 'active'),
    (5, 'Kite City', 'A vibrant story about soaring ambition and community resilience in the blue hour.', '/zenflow-images/task-cards/book-the-blue-hour.png', 30.00, NULL, 'active')
    ON DUPLICATE KEY UPDATE
      title=VALUES(title),
      image_url=VALUES(image_url),
      status='active';
  `);

  const [tables] = await q(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=? ORDER BY TABLE_NAME`,
    [dbName]
  );
  console.log("Tables verified:");
  console.log(tables.map((x) => `  - ${x.TABLE_NAME}`).join("\n"));

  const [planColumns] = await q(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='plans' ORDER BY ORDINAL_POSITION`,
    [dbName]
  );
  if (!planColumns.some((x) => x.COLUMN_NAME === "daily_tasks")) {
    throw new Error("Required column plans.daily_tasks is missing after migration");
  }

  const [taskIndexes] = await q(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=? AND TABLE_NAME='task_submissions' ORDER BY INDEX_NAME`,
    [dbName]
  );
  console.log("Task submission indexes:");
  console.log(taskIndexes.map((x) => `  - ${x.INDEX_NAME}`).join("\n"));

  await q("SELECT 1 FROM users LIMIT 1");
  await q("SELECT 1 FROM plans LIMIT 1");
  await q("SELECT 1 FROM tasks LIMIT 1");
  console.log(`Database ready: ${dbName}`);
}

export async function runSetupDb() {
  try {
    try {
      db = await mysql.createConnection(dbConfig(true));
    } catch (directErr) {
      db = await mysql.createConnection(dbConfig(false));
      await q(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      await q(`USE \`${dbName}\``);
    }

    console.log(`Initializing ZenFlow database: ${dbName}`);
    await ensureNewTables();
    await ensureCoreColumns();
    await migrateTaskSubmissionIndexes();
    await ensureNewTables();
    await seedAndVerify();
    return true;
  } catch (error) {
    console.error("DATABASE SETUP FAILED");
    console.error(`Host: ${process.env.DB_HOST || "localhost"}`);
    console.error(`Port: ${process.env.DB_PORT || "3306"}`);
    console.error(`User: ${process.env.DB_USER || "root"}`);
    console.error(`Database: ${dbName}`);
    console.error(`MySQL error: ${error.message}`);
    if (error.code === "ECONNREFUSED") console.error("Start MySQL from XAMPP Control Panel.");
    if (error.code === "ER_ACCESS_DENIED_ERROR") console.error("Check DB_USER and DB_PASSWORD in .env.");
    return false;
  } finally {
    if (db) await db.end().catch(() => {});
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runSetupDb().then((ok) => {
    if (!ok) process.exitCode = 1;
  });
}
