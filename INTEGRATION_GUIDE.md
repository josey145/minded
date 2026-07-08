============================================================
INTEGRATION GUIDE: Real/Demo Accounts + Admin Trade-for-User
============================================================
STEP 1: Run Database Migration
Execute the SQL in migration_real_demo_accounts.sql against your MySQL database:
bash
mysql -u your_user -p your_database < migration_real_demo_accounts.sql
This adds:
account_type (ENUM: 'real', 'demo') to users table
demo_balance (DECIMAL) to users table
opened_by_admin, admin_id, forced_result to forex_trades
New admin_trade_logs audit table
STEP 2: Update User Trading Router
Replace your existing routes/trading.js with trading_router_updated.js.
Key changes:
getEffectiveBalance() helper uses demo_balance for demo accounts
getEffectiveFreeMargin() calculates margin for active account type
$10 minimum trade validation on every position open
POST /trading/switch-account endpoint for real/demo toggle
Demo trades update demo_balance instead of balance
STEP 3: Add Admin Trade Routes
Copy ALL routes from admin_trade_for_user_routes.js and paste them into your
routes/admin.js file BEFORE the final module.exports = router; line.
New admin endpoints:
plain
GET    /admin/trade-for-user              → Dashboard (user list)
GET    /admin/trade-for-user/:userId      → Trade for specific user
POST   /admin/trade-for-user/open-position → Admin opens trade
POST   /admin/trade-for-user/close-position/:tradeId → Admin closes trade
POST   /admin/trade-for-user/set-force-result/:tradeId → Set win/loss
POST   /admin/trade-for-user/bulk-close/:userId → Close all positions
GET    /admin/trade-for-user/logs         → Audit trail
STEP 4: Copy EJS Templates
Place these files in your views/admin/ directory:
plain
views/
  admin/
    trade_for_user.ejs         ← from admin_trade_for_user.ejs
    trade_for_user_detail.ejs  ← from admin_trade_for_user_detail.ejs
    trade_logs.ejs             ← from admin_trade_logs.ejs
Replace views/trading/forex.ejs with forex_trading_updated.ejs.
STEP 5: Add Navigation Link
Add this to your admin sidebar/navigation (wherever admin nav links are):
HTML
<a href="/admin/trade-for-user" class="nav-link">
    <span>📈</span> Trade for User
</a>
STEP 6: Update User Registration (Optional)
New users should start with demo accounts. In your registration handler:
JavaScript
await db.execute(`
    INSERT INTO users (username, email, password, role, account_type, demo_balance, balance, ...)
    VALUES (?, ?, ?, 'user', 'demo', 10000.00, 0.00, ...)
`, [username, email, hashedPassword]);
HOW IT WORKS
For Users:
New users start with $10,000 demo balance
Toggle between REAL and DEMO accounts via the switcher
Real account trades affect balance column
Demo account trades affect demo_balance column
Minimum $10 trade size enforced server-side
Users see which account type they're on (green=real, purple=demo)
For Admins:
Go to /admin/trade-for-user to see all users
Click "Trade for User →" to open their trading dashboard
Select a currency pair, set lot size/leverage
Choose FORCE RESULT: No Force / Force Win / Force Loss
Click Open Position — trade opens on user's account
Close positions with "Win" or "Loss" buttons for instant control
Bulk close all positions with forced result
All actions logged to admin_trade_logs table
Force Win/Loss Logic:
No Force: Normal market P&L calculation
Force Win: If market P&L is negative, flip to positive (+$10 to +$500 random)
Force Loss: If market P&L is positive, flip to negative (-$10 to -maxLoss)
Admin can also manually specify exact P&L when closing
Margin Handling:
Demo accounts track used_margin and free_margin conceptually
Real accounts use actual balance deductions
Both account types respect the $10 minimum margin requirement