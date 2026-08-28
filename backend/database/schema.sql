CREATE TABLE IF NOT EXISTS users (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 phone VARCHAR(20) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL,
 full_name VARCHAR(120),
 email VARCHAR(190),
 referral_code VARCHAR(32) NOT NULL UNIQUE,
 referred_by BIGINT UNSIGNED NULL,
 fund_password_hash VARCHAR(255) NULL,
 avatar VARCHAR(500) NULL,
 language VARCHAR(20) NOT NULL DEFAULT 'English',
 push_notifications TINYINT(1) NOT NULL DEFAULT 1,
 notification_sound TINYINT(1) NOT NULL DEFAULT 0,
 must_change_password TINYINT(1) NOT NULL DEFAULT 0,
 role ENUM('user','admin') NOT NULL DEFAULT 'user',
 session_id VARCHAR(64) NULL,
 wallet_balance DECIMAL(18,2) NOT NULL DEFAULT 0,
 commission_balance DECIMAL(18,2) NOT NULL DEFAULT 0,
 total_earned DECIMAL(18,2) NOT NULL DEFAULT 0,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (id),
 CONSTRAINT fk_users_referrer FOREIGN KEY (referred_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS announcements (
 id INT UNSIGNED NOT NULL AUTO_INCREMENT,
 title VARCHAR(180) NOT NULL,
 message TEXT NOT NULL,
 image_url VARCHAR(500) NULL,
 link_url VARCHAR(500) NULL,
 link_label VARCHAR(100) NULL DEFAULT 'Learn More',
 active TINYINT(1) NOT NULL DEFAULT 1,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS plans (
 id INT UNSIGNED NOT NULL AUTO_INCREMENT,
 code VARCHAR(20) NOT NULL UNIQUE,
 name VARCHAR(100) NOT NULL,
 price DECIMAL(18,2) NOT NULL DEFAULT 0,
 daily_income DECIMAL(18,2) NOT NULL DEFAULT 0,
 daily_tasks INT UNSIGNED NOT NULL DEFAULT 5,
 commission_rate DECIMAL(8,4) NOT NULL DEFAULT 0,
 status ENUM('active','coming_soon') NOT NULL DEFAULT 'active',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_plans (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 user_id BIGINT UNSIGNED NOT NULL,
 plan_id INT UNSIGNED NOT NULL,
 started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 expires_at TIMESTAMP NULL,
 status ENUM('active','expired','cancelled') NOT NULL DEFAULT 'active',
 PRIMARY KEY (id),
 CONSTRAINT fk_user_plans_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
 CONSTRAINT fk_user_plans_plan FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tasks (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 title VARCHAR(180) NOT NULL,
 description TEXT,
 image_url VARCHAR(500) NULL,
 reward DECIMAL(18,2) NOT NULL DEFAULT 0,
 plan_required VARCHAR(20) NULL,
 status ENUM('active','inactive') NOT NULL DEFAULT 'active',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS task_submissions (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 task_id BIGINT UNSIGNED NOT NULL,
 user_id BIGINT UNSIGNED NOT NULL,
 review_text TEXT NULL,
 rating TINYINT UNSIGNED NULL,
 status ENUM('reading','review_submitted','reward_claimable','approved','rejected') NOT NULL DEFAULT 'reading',
 reward DECIMAL(18,2) NOT NULL DEFAULT 0,
 task_date DATE NOT NULL,
 reading_completed_at TIMESTAMP NULL,
 reviewed_at TIMESTAMP NULL,
 reward_claimed_at TIMESTAMP NULL,
 completed_at TIMESTAMP NULL,
 submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (id),
 UNIQUE KEY uq_task_user_date (task_id,user_id,task_date),
 CONSTRAINT fk_submission_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
 CONSTRAINT fk_submission_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS plan_purchases (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 user_id BIGINT UNSIGNED NOT NULL,
 plan_id INT UNSIGNED NOT NULL,
 amount DECIMAL(18,2) NOT NULL,
 balance_before DECIMAL(18,2) NOT NULL,
 balance_after DECIMAL(18,2) NOT NULL,
 status ENUM('completed','failed') NOT NULL DEFAULT 'completed',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (id),
 UNIQUE KEY uq_plan_purchase_user_plan_time (user_id,plan_id,created_at),
 CONSTRAINT fk_plan_purchase_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
 CONSTRAINT fk_plan_purchase_plan FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS daily_checkins (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 user_id BIGINT UNSIGNED NOT NULL,
 checkin_date DATE NOT NULL,
 streak_day INT UNSIGNED NOT NULL DEFAULT 1,
 reward DECIMAL(18,2) NOT NULL DEFAULT 10,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (id),
 UNIQUE KEY uq_user_checkin_date (user_id,checkin_date),
 CONSTRAINT fk_checkin_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS wallet_transactions (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 user_id BIGINT UNSIGNED NOT NULL,
 type VARCHAR(40) NOT NULL,
 amount DECIMAL(18,2) NOT NULL,
 status ENUM('pending','completed','rejected') NOT NULL DEFAULT 'completed',
 reference VARCHAR(100),
 note VARCHAR(255),
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (id),
 INDEX idx_wallet_user_created (user_id,created_at),
 CONSTRAINT fk_wallet_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS deposits (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 user_id BIGINT UNSIGNED NOT NULL,
 plan_id INT UNSIGNED NULL,
 plan_code VARCHAR(20) NOT NULL,
 amount DECIMAL(18,2) NOT NULL,
 payment_method ENUM('JazzCash','SadaPay','EasyPaisa','Binance (BEP-20)') NOT NULL DEFAULT 'JazzCash',
 tid VARCHAR(120) NOT NULL UNIQUE,
 wallet_number VARCHAR(40) NOT NULL,
 proof_data LONGTEXT NULL,
 status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
 submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 reviewed_at TIMESTAMP NULL,
 PRIMARY KEY (id),
 INDEX idx_deposit_user_created (user_id,submitted_at),
 CONSTRAINT fk_deposit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
 CONSTRAINT fk_deposit_plan FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payout_accounts (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 user_id BIGINT UNSIGNED NOT NULL,
 method ENUM('JazzCash','EasyPaisa','Bank','BEP-20') NOT NULL,
 account_name VARCHAR(120) NOT NULL,
 account_number VARCHAR(190) NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (id),
 CONSTRAINT fk_payout_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS withdrawals (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 user_id BIGINT UNSIGNED NOT NULL,
 wallet_type ENUM('personal','commission') NOT NULL DEFAULT 'commission',
 amount DECIMAL(18,2) NOT NULL,
 fee DECIMAL(18,2) NOT NULL DEFAULT 0,
 net_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
 payout_account_id BIGINT UNSIGNED NULL,
 status ENUM('pending','approved','paid','rejected') NOT NULL DEFAULT 'pending',
 requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 processed_at TIMESTAMP NULL,
 PRIMARY KEY (id),
 CONSTRAINT fk_withdrawal_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
 CONSTRAINT fk_withdrawal_account FOREIGN KEY (payout_account_id) REFERENCES payout_accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS team_earnings (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 user_id BIGINT UNSIGNED NOT NULL,
 member_user_id BIGINT UNSIGNED NOT NULL,
 level TINYINT UNSIGNED NOT NULL,
 source_type VARCHAR(40) NOT NULL DEFAULT 'member_activity',
 amount DECIMAL(18,2) NOT NULL DEFAULT 0,
 reference VARCHAR(100) NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (id),
 INDEX idx_team_earning_user_created (user_id,created_at),
 INDEX idx_team_earning_member (member_user_id,created_at),
 CONSTRAINT fk_team_earning_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
 CONSTRAINT fk_team_earning_member FOREIGN KEY (member_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reward_history (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 user_id BIGINT UNSIGNED NOT NULL,
 type ENUM('Task','Referral','Commission','Check-in','Adjustment') NOT NULL,
 detail VARCHAR(255) NOT NULL,
 amount DECIMAL(18,2) NOT NULL,
 status ENUM('Completed','Pending','Rejected') NOT NULL DEFAULT 'Completed',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (id),
 INDEX idx_reward_user_created (user_id,created_at),
 CONSTRAINT fk_reward_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 user_id BIGINT UNSIGNED NOT NULL,
 type ENUM('System','Task','Reward','Team') NOT NULL DEFAULT 'System',
 title VARCHAR(180) NOT NULL,
 message TEXT NOT NULL,
 is_read TINYINT(1) NOT NULL DEFAULT 0,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (id),
 INDEX idx_notification_user_created (user_id,created_at),
 CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS support_requests (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 user_id BIGINT UNSIGNED NULL,
 subject VARCHAR(180) NOT NULL,
 message TEXT NOT NULL,
 status ENUM('open','in_progress','closed') NOT NULL DEFAULT 'open',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (id),
 CONSTRAINT fk_support_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS wealth_funds (
 id INT UNSIGNED NOT NULL AUTO_INCREMENT,
 name VARCHAR(150) NOT NULL,
 provider VARCHAR(150) NULL,
 term_days INT UNSIGNED NOT NULL,
 daily_profit_rate DECIMAL(8,4) NOT NULL,
 target_return_rate DECIMAL(8,4) NOT NULL,
 capacity_percent DECIMAL(8,4) NOT NULL DEFAULT 0,
 status ENUM('active','coming_soon','closed') NOT NULL DEFAULT 'active',
 PRIMARY KEY (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS wealth_purchases (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 user_id BIGINT UNSIGNED NOT NULL,
 fund_id INT UNSIGNED NOT NULL,
 principal DECIMAL(18,2) NOT NULL,
 expected_profit DECIMAL(18,2) NOT NULL,
 started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 expires_at TIMESTAMP NULL,
 status ENUM('active','completed','cancelled') NOT NULL DEFAULT 'active',
 PRIMARY KEY (id),
 CONSTRAINT fk_wealth_purchase_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
 CONSTRAINT fk_wealth_purchase_fund FOREIGN KEY (fund_id) REFERENCES wealth_funds(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS loans (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 user_id BIGINT UNSIGNED NULL,
 product_name VARCHAR(100) NOT NULL,
 amount DECIMAL(18,2) NOT NULL,
 status ENUM('coming_soon','pending','approved','rejected','paid') NOT NULL DEFAULT 'coming_soon',
 requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (id),
 CONSTRAINT fk_loan_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payment_settings (
 id INT UNSIGNED NOT NULL AUTO_INCREMENT,
 method VARCHAR(40) NOT NULL,
 account_label VARCHAR(120) NOT NULL,
 account_number VARCHAR(255) NOT NULL DEFAULT '',
 qr_data LONGTEXT NULL,
 instructions TEXT NULL,
 active TINYINT(1) NOT NULL DEFAULT 1,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (id),
 UNIQUE KEY uq_payment_method (method)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS news (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 title VARCHAR(200) NOT NULL,
 summary TEXT NULL,
 body LONGTEXT NULL,
 image_url VARCHAR(500) NULL,
 published_at TIMESTAMP NULL,
 status ENUM('draft','published') NOT NULL DEFAULT 'draft',
 PRIMARY KEY (id)
) ENGINE=InnoDB;

-- Plan seed data intentionally omits daily_tasks here because setup-db.js
-- adds that column to older Zen databases before applying the plan values.
INSERT INTO plans (code,name,price,daily_income,commission_rate,status) VALUES
('F1','F1',4500,150,0.10,'active'),
('F2','F2',16500,550,0.10,'active'),
('F3','F3',60000,2000,0.10,'active'),
('F4','F4',216000,7200,0.10,'coming_soon'),
('F5','F5',480000,16000,0.10,'coming_soon'),
('F6','F6',1455000,48500,0.10,'coming_soon'),
('F7','F7',3870000,129000,0.10,'coming_soon'),
('F8','F8',7350000,245000,0.10,'coming_soon'),
('F9','F9',15150000,505000,0.10,'coming_soon')
ON DUPLICATE KEY UPDATE
 name=VALUES(name),price=VALUES(price),daily_income=VALUES(daily_income),commission_rate=VALUES(commission_rate),status=VALUES(status);

INSERT IGNORE INTO wealth_funds (id,name,provider,term_days,daily_profit_rate,target_return_rate,capacity_percent,status) VALUES
(1,'Reader Circle Fund','OnlineBookClub.org',5,2.8,11,11,'active'),
(2,'Ghostwriting Growth Fund','Ghostwriting LLC',6,3.1,37,37,'active'),
(3,'NetGalley Review Fund','NetGalley',7,3.4,62,62,'active'),
(4,'Edelweiss+ Elite Fund','Edelweiss+',8,3.75,84,84,'active');

INSERT IGNORE INTO tasks (id,title,description,image_url,reward,plan_required,status) VALUES (1,'Glass Orchard','Read this long book-review passage carefully, complete the reading, choose a rating, and claim the reward after submission. The story follows ordinary people through a reflective sequence of events, with attention to memory, responsibility, friendship, and the small decisions that change how a familiar place feels.','/src/assets/book-covers/reference-1.png',30,'F1','active');
INSERT IGNORE INTO tasks (id,title,description,image_url,reward,plan_required,status) VALUES (2,'Midnight Street','Read this long book-review passage carefully, complete the reading, choose a rating, and claim the reward after submission. The story follows ordinary people through a reflective sequence of events, with attention to memory, responsibility, friendship, and the small decisions that change how a familiar place feels.','/src/assets/book-covers/reference-2.png',30,'F1','active');
INSERT IGNORE INTO tasks (id,title,description,image_url,reward,plan_required,status) VALUES (3,'Silent Harbor','Read this long book-review passage carefully, complete the reading, choose a rating, and claim the reward after submission. The story follows ordinary people through a reflective sequence of events, with attention to memory, responsibility, friendship, and the small decisions that change how a familiar place feels.','/src/assets/book-covers/reference-3.jpg',30,'F1','active');
INSERT IGNORE INTO tasks (id,title,description,image_url,reward,plan_required,status) VALUES (4,'Winter Sparrow','Read this long book-review passage carefully, complete the reading, choose a rating, and claim the reward after submission. The story follows ordinary people through a reflective sequence of events, with attention to memory, responsibility, friendship, and the small decisions that change how a familiar place feels.','/src/assets/book-covers/reference-4.jpg',30,'F1','active');
INSERT IGNORE INTO tasks (id,title,description,image_url,reward,plan_required,status) VALUES (5,'Kite City','Read this long book-review passage carefully, complete the reading, choose a rating, and claim the reward after submission. The story follows ordinary people through a reflective sequence of events, with attention to memory, responsibility, friendship, and the small decisions that change how a familiar place feels.','/src/assets/book-covers/reference-5.jpg',30,'F1','active');
INSERT IGNORE INTO tasks (id,title,description,image_url,reward,plan_required,status) VALUES (6,'Blue Hour','Read this long book-review passage carefully, complete the reading, choose a rating, and claim the reward after submission. The story follows ordinary people through a reflective sequence of events, with attention to memory, responsibility, friendship, and the small decisions that change how a familiar place feels.','/src/assets/book-covers/reference-6.jpg',30,'F1','active');
INSERT IGNORE INTO tasks (id,title,description,image_url,reward,plan_required,status) VALUES (7,'Golden Orchid','Read this long book-review passage carefully, complete the reading, choose a rating, and claim the reward after submission. The story follows ordinary people through a reflective sequence of events, with attention to memory, responsibility, friendship, and the small decisions that change how a familiar place feels.','/src/assets/book-covers/book-7.svg',30,'F1','active');
INSERT IGNORE INTO tasks (id,title,description,image_url,reward,plan_required,status) VALUES (8,'Letters at Dawn','Read this long book-review passage carefully, complete the reading, choose a rating, and claim the reward after submission. The story follows ordinary people through a reflective sequence of events, with attention to memory, responsibility, friendship, and the small decisions that change how a familiar place feels.','/src/assets/book-covers/book-8.svg',30,'F1','active');
INSERT IGNORE INTO tasks (id,title,description,image_url,reward,plan_required,status) VALUES (9,'Paper Moon','Read this long book-review passage carefully, complete the reading, choose a rating, and claim the reward after submission. The story follows ordinary people through a reflective sequence of events, with attention to memory, responsibility, friendship, and the small decisions that change how a familiar place feels.','/src/assets/book-covers/book-9.svg',30,'F1','active');
INSERT IGNORE INTO tasks (id,title,description,image_url,reward,plan_required,status) VALUES (10,'The Last Lantern','Read this long book-review passage carefully, complete the reading, choose a rating, and claim the reward after submission. The story follows ordinary people through a reflective sequence of events, with attention to memory, responsibility, friendship, and the small decisions that change how a familiar place feels.','/src/assets/book-covers/book-10.svg',30,'F1','active');
INSERT IGNORE INTO tasks (id,title,description,image_url,reward,plan_required,status) VALUES (11,'Rain on Cedar Road','Read this long book-review passage carefully, complete the reading, choose a rating, and claim the reward after submission. The story follows ordinary people through a reflective sequence of events, with attention to memory, responsibility, friendship, and the small decisions that change how a familiar place feels.','/src/assets/book-covers/book-11.svg',30,'F1','active');
INSERT IGNORE INTO tasks (id,title,description,image_url,reward,plan_required,status) VALUES (12,'North Window','Read this long book-review passage carefully, complete the reading, choose a rating, and claim the reward after submission. The story follows ordinary people through a reflective sequence of events, with attention to memory, responsibility, friendship, and the small decisions that change how a familiar place feels.','/src/assets/book-covers/book-12.svg',30,'F1','active');
INSERT IGNORE INTO tasks (id,title,description,image_url,reward,plan_required,status) VALUES (13,'Small Goodbyes','Read this long book-review passage carefully, complete the reading, choose a rating, and claim the reward after submission. The story follows ordinary people through a reflective sequence of events, with attention to memory, responsibility, friendship, and the small decisions that change how a familiar place feels.','/src/assets/book-covers/book-13.svg',30,'F1','active');
INSERT IGNORE INTO tasks (id,title,description,image_url,reward,plan_required,status) VALUES (14,'The Quiet Map','Read this long book-review passage carefully, complete the reading, choose a rating, and claim the reward after submission. The story follows ordinary people through a reflective sequence of events, with attention to memory, responsibility, friendship, and the small decisions that change how a familiar place feels.','/src/assets/book-covers/book-14.svg',30,'F1','active');
INSERT IGNORE INTO tasks (id,title,description,image_url,reward,plan_required,status) VALUES (15,'River of Stars','Read this long book-review passage carefully, complete the reading, choose a rating, and claim the reward after submission. The story follows ordinary people through a reflective sequence of events, with attention to memory, responsibility, friendship, and the small decisions that change how a familiar place feels.','/src/assets/book-covers/book-15.svg',30,'F1','active');
INSERT IGNORE INTO tasks (id,title,description,image_url,reward,plan_required,status) VALUES (16,'A House of Echoes','Read this long book-review passage carefully, complete the reading, choose a rating, and claim the reward after submission. The story follows ordinary people through a reflective sequence of events, with attention to memory, responsibility, friendship, and the small decisions that change how a familiar place feels.','/src/assets/book-covers/book-16.svg',30,'F1','active');
INSERT IGNORE INTO tasks (id,title,description,image_url,reward,plan_required,status) VALUES (17,'After the Train','Read this long book-review passage carefully, complete the reading, choose a rating, and claim the reward after submission. The story follows ordinary people through a reflective sequence of events, with attention to memory, responsibility, friendship, and the small decisions that change how a familiar place feels.','/src/assets/book-covers/book-17.svg',30,'F1','active');
INSERT IGNORE INTO tasks (id,title,description,image_url,reward,plan_required,status) VALUES (18,'Autumn Notebook','Read this long book-review passage carefully, complete the reading, choose a rating, and claim the reward after submission. The story follows ordinary people through a reflective sequence of events, with attention to memory, responsibility, friendship, and the small decisions that change how a familiar place feels.','/src/assets/book-covers/book-18.svg',30,'F1','active');
INSERT IGNORE INTO tasks (id,title,description,image_url,reward,plan_required,status) VALUES (19,'The Green Door','Read this long book-review passage carefully, complete the reading, choose a rating, and claim the reward after submission. The story follows ordinary people through a reflective sequence of events, with attention to memory, responsibility, friendship, and the small decisions that change how a familiar place feels.','/src/assets/book-covers/book-19.svg',30,'F1','active');
INSERT IGNORE INTO tasks (id,title,description,image_url,reward,plan_required,status) VALUES (20,'Snowlight','Read this long book-review passage carefully, complete the reading, choose a rating, and claim the reward after submission. The story follows ordinary people through a reflective sequence of events, with attention to memory, responsibility, friendship, and the small decisions that change how a familiar place feels.','/src/assets/book-covers/book-20.svg',30,'F1','active');
INSERT IGNORE INTO tasks (id,title,description,image_url,reward,plan_required,status) VALUES (21,'Borrowed Time','Read this long book-review passage carefully, complete the reading, choose a rating, and claim the reward after submission. The story follows ordinary people through a reflective sequence of events, with attention to memory, responsibility, friendship, and the small decisions that change how a familiar place feels.','/src/assets/book-covers/book-21.svg',30,'F1','active');
INSERT IGNORE INTO tasks (id,title,description,image_url,reward,plan_required,status) VALUES (22,'City of Letters','Read this long book-review passage carefully, complete the reading, choose a rating, and claim the reward after submission. The story follows ordinary people through a reflective sequence of events, with attention to memory, responsibility, friendship, and the small decisions that change how a familiar place feels.','/src/assets/book-covers/book-22.svg',30,'F1','active');
INSERT IGNORE INTO tasks (id,title,description,image_url,reward,plan_required,status) VALUES (23,'Under the Old Clock','Read this long book-review passage carefully, complete the reading, choose a rating, and claim the reward after submission. The story follows ordinary people through a reflective sequence of events, with attention to memory, responsibility, friendship, and the small decisions that change how a familiar place feels.','/src/assets/book-covers/book-23.svg',30,'F1','active');
INSERT IGNORE INTO tasks (id,title,description,image_url,reward,plan_required,status) VALUES (24,'A Long Evening','Read this long book-review passage carefully, complete the reading, choose a rating, and claim the reward after submission. The story follows ordinary people through a reflective sequence of events, with attention to memory, responsibility, friendship, and the small decisions that change how a familiar place feels.','/src/assets/book-covers/book-24.svg',30,'F1','active');
INSERT IGNORE INTO tasks (id,title,description,image_url,reward,plan_required,status) VALUES (25,'The Far Shore','Read this long book-review passage carefully, complete the reading, choose a rating, and claim the reward after submission. The story follows ordinary people through a reflective sequence of events, with attention to memory, responsibility, friendship, and the small decisions that change how a familiar place feels.','/src/assets/book-covers/book-25.svg',30,'F1','active');
