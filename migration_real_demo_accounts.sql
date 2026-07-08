-- Just run these one by one (ignore errors if column already exists):

ALTER TABLE users ADD COLUMN account_type ENUM('real','demo') NOT NULL DEFAULT 'demo' AFTER role;
ALTER TABLE users ADD COLUMN demo_balance DECIMAL(15,2) NOT NULL DEFAULT 10000.00 AFTER balance;

ALTER TABLE forex_trades ADD COLUMN opened_by_admin TINYINT(1) NOT NULL DEFAULT 0 AFTER user_id;
ALTER TABLE forex_trades ADD COLUMN admin_id INT NULL AFTER opened_by_admin;
ALTER TABLE forex_trades ADD COLUMN forced_result ENUM('none','win','loss') NOT NULL DEFAULT 'none' AFTER close_reason;

CREATE TABLE IF NOT EXISTS admin_trade_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id INT NOT NULL,
    user_id INT NOT NULL,
    trade_id INT NULL,
    action VARCHAR(50) NOT NULL,
    pair_symbol VARCHAR(20) NOT NULL,
    direction VARCHAR(10) NOT NULL,
    lot_size DECIMAL(10,2) NOT NULL,
    leverage INT NOT NULL,
    entry_price DECIMAL(15,5) NOT NULL,
    exit_price DECIMAL(15,5) NULL,
    profit_loss DECIMAL(15,2) NULL,
    forced_result ENUM('none','win','loss') NOT NULL DEFAULT 'none',
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_admin_id (admin_id),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_account_type ON users(account_type);
CREATE INDEX idx_forex_trades_admin ON forex_trades(opened_by_admin, admin_id);