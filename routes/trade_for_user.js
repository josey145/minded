const express = require('express');
const router = express.Router();
const { ensureAdmin } = require('../middleware/authMiddleware');
const db = require('../config/db');
const telegramBot = require('../services/telegramBot');
const emailService = require('../services/emailService');

// ==================== HELPERS ====================

const getSiteName = async () => {
    try {
        const [settings] = await db.execute(
            "SELECT setting_value FROM site_settings WHERE setting_key = 'site_name'"
        );
        return settings[0]?.setting_value || 'Maximum';
    } catch (e) {
        return 'Maximum';
    }
};

const getUnreadCount = async () => {
    try {
        const [[{ count }]] = await db.execute(`
            SELECT COUNT(*) as count 
            FROM user_messages 
            WHERE is_from_admin = FALSE AND status = 'unread'
        `);
        return count;
    } catch (error) {
        console.error('Error fetching unread count:', error);
        return 0;
    }
};

const emailTemplate = ({
    badge, badgeColor,
    username, intro,
    amountDisplay, amountColor,
    rows, footerNote,
    siteName = 'Maximum'
}) => {
    const year = new Date().getFullYear();
    const rowsHtml = rows.map(([label, val, color]) =>
        `<tr>
            <td style="padding:10px 0;color:#6b7280;font-size:13px;border-bottom:1px solid #1e1e2e;">${label}</td>
            <td style="padding:10px 0;font-size:13px;text-align:right;border-bottom:1px solid #1e1e2e;font-weight:600;color:${color || '#f4f4f5'};">${val}</td>
        </tr>`
    ).join('');

    return `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#0a0a0f;padding:0;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#8b5cf6,#6d28d9);padding:32px 40px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:22px;letter-spacing:2px;font-weight:800;">${siteName.toUpperCase()}</h1>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.65);font-size:12px;letter-spacing:1px;text-transform:uppercase;">Trading Platform</p>
    </div>
    <div style="background:#111118;padding:32px 40px 0;">
        <div style="display:inline-block;background:${badgeColor}22;border:1px solid ${badgeColor}55;border-radius:20px;padding:5px 16px;margin-bottom:20px;">
            <span style="color:${badgeColor};font-size:12px;font-weight:700;letter-spacing:1px;">● ${badge}</span>
        </div>
        <p style="color:#a1a1aa;font-size:15px;margin:0 0 24px;line-height:1.6;">
            Hello <strong style="color:#f4f4f5;">${username}</strong>, ${intro}
        </p>
    </div>
    <div style="background:#111118;padding:0 40px 24px;">
        <div style="background:#0d0d14;border:1px solid #1e1e2e;border-left:4px solid ${amountColor};border-radius:12px;padding:28px;text-align:center;">
            <p style="color:#52525b;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 10px;">Transaction Amount</p>
            <p style="color:${amountColor};font-size:44px;font-weight:800;margin:0;font-family:'Courier New',monospace;letter-spacing:2px;">${amountDisplay}</p>
        </div>
    </div>
    <div style="background:#111118;padding:0 40px 28px;">
        <table style="width:100%;border-collapse:collapse;">${rowsHtml}</table>
    </div>
    <div style="background:#0d0d14;border-top:1px solid #1e1e2e;padding:24px 40px;text-align:center;">
        <p style="color:#3f3f5a;font-size:12px;margin:0;line-height:1.6;">${footerNote}</p>
        <p style="color:#2a2a40;font-size:11px;margin:10px 0 0;">© ${year} ${siteName} · All rights reserved.</p>
    </div>
</div>`;
};

// ==================== ADMIN TRADE FOR USER ====================

// GET /admin/trade-for-user - Admin trading dashboard
router.get('/trade-for-user', ensureAdmin, async (req, res) => {
    try {
        const [users] = await db.execute(`
            SELECT 
                id, username, email, balance, demo_balance, 
                account_type, trading_mode, currency, 
                used_margin, free_margin, created_at
            FROM users
            WHERE role = 'user'
            ORDER BY created_at DESC
        `);

        const [pairs] = await db.execute(`
            SELECT * FROM forex_pairs 
            WHERE is_active = TRUE 
            ORDER BY FIELD(symbol, 'EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'XAGUSD'), symbol
        `);

        const parsedPairs = pairs.map(p => ({
            ...p,
            bid: parseFloat(p.bid) || 0,
            ask: parseFloat(p.ask) || 0,
            spread: parseFloat(p.spread) || 0
        }));

        const [recentTrades] = await db.execute(`
            SELECT 
                atl.*,
                u.username as target_username,
                a.username as admin_username
            FROM admin_trade_logs atl
            JOIN users u ON atl.user_id = u.id
            JOIN users a ON atl.admin_id = a.id
            ORDER BY atl.created_at DESC
            LIMIT 50
        `);

        const [adminManagedPositions] = await db.execute(`
            SELECT 
                t.*, 
                p.name as pair_name,
                u.username as user_username,
                u.account_type,
                u.balance,
                u.demo_balance
            FROM forex_trades t
            JOIN forex_pairs p ON t.pair_id = p.id
            JOIN users u ON t.user_id = u.id
            WHERE t.opened_by_admin = 1 AND t.status = 'open'
            ORDER BY t.opened_at DESC
        `);

        const unreadCount = await getUnreadCount();

        res.render('admin/trade_for_user', {
            title: 'Trade for User',
            users: users || [],
            pairs: parsedPairs,
            recentTrades: recentTrades || [],
            adminManagedPositions: adminManagedPositions || [],
            currentUser: req.session.user,
            unreadCount,
            formatCurrency: require('../utils/currency').formatCurrency
        });

    } catch (error) {
        console.error('Admin trade-for-user error:', error);
        req.flash('error', 'Failed to load trade-for-user panel: ' + error.message);
        res.redirect('/admin');
    }
});

// GET /admin/trade-for-user/:userId - Trade for specific user
router.get('/trade-for-user/:userId', ensureAdmin, async (req, res) => {
    try {
        const userId = req.params.userId;

        const [users] = await db.execute(`
            SELECT 
                id, username, email, balance, demo_balance, 
                account_type, trading_mode, currency,
                used_margin, free_margin, margin_level_percent, leverage
            FROM users WHERE id = ?
        `, [userId]);

        if (!users.length) {
            req.flash('error', 'User not found');
            return res.redirect('/admin/trade-for-user');
        }

        const targetUser = users[0];

        const [pairs] = await db.execute(`
            SELECT * FROM forex_pairs 
            WHERE is_active = TRUE 
            ORDER BY FIELD(symbol, 'EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'XAGUSD'), symbol
        `);

        const [openPositions] = await db.execute(`
            SELECT t.*, p.name as pair_name, p.pip_value
            FROM forex_trades t
            JOIN forex_pairs p ON t.pair_id = p.id
            WHERE t.user_id = ? AND t.status = 'open'
            ORDER BY t.opened_at DESC
        `, [userId]);

        const [tradeHistory] = await db.execute(`
            SELECT t.*, p.name as pair_name
            FROM forex_trades t
            JOIN forex_pairs p ON t.pair_id = p.id
            WHERE t.user_id = ? AND t.status = 'closed'
            ORDER BY t.closed_at DESC
            LIMIT 20
        `, [userId]);

        let totalOpenPnL = 0;
        for (const pos of openPositions) {
            totalOpenPnL += parseFloat(pos.profit_loss || 0);
        }

        const effectiveBalance = targetUser.account_type === 'demo' 
            ? parseFloat(targetUser.demo_balance) || 10000
            : parseFloat(targetUser.balance) || 0;

        const parsedPairs = pairs.map(p => ({
            ...p,
            bid: parseFloat(p.bid) || 0,
            ask: parseFloat(p.ask) || 0,
            spread: parseFloat(p.spread) || 0
        }));

        const unreadCount = await getUnreadCount();

        res.render('admin/trade_for_user_detail', {
            title: `Trading for ${targetUser.username}`,
            targetUser,
            pairs: parsedPairs,
            openPositions: openPositions || [],
            tradeHistory: tradeHistory || [],
            account: {
                balance: effectiveBalance,
                equity: effectiveBalance + totalOpenPnL,
                usedMargin: parseFloat(targetUser.used_margin) || 0,
                freeMargin: parseFloat(targetUser.free_margin) || effectiveBalance,
                marginLevel: parseFloat(targetUser.margin_level_percent) || 0,
                currency: targetUser.currency || 'USD',
                totalOpenPnL: totalOpenPnL || 0,
                accountType: targetUser.account_type
            },
            currentUser: req.session.user,
            unreadCount,
            formatCurrency: require('../utils/currency').formatCurrency
        });

    } catch (error) {
        console.error('Admin trade-for-user detail error:', error);
        req.flash('error', 'Failed to load user trading panel: ' + error.message);
        res.redirect('/admin/trade-for-user');
    }
});

// POST /admin/trade-for-user/open-position - Admin opens position for user
router.post('/trade-for-user/open-position', ensureAdmin, async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { 
            user_id, pair_id, direction, lot_size, leverage, 
            stop_loss, take_profit, forced_result, notes 
        } = req.body;
        const adminId = req.session.user.id;

        const lotSize = parseFloat(lot_size);
        if (!lotSize || lotSize < 0.01) {
            req.flash('error', 'Minimum lot size is 0.01');
            return res.redirect(`/admin/trade-for-user/${user_id}`);
        }

        const lev = parseInt(leverage) || 100;
        if (lev > 500) {
            req.flash('error', 'Maximum leverage is 500:1');
            return res.redirect(`/admin/trade-for-user/${user_id}`);
        }

        await connection.beginTransaction();

        const [users] = await connection.execute(
            'SELECT * FROM users WHERE id = ? FOR UPDATE',
            [user_id]
        );

        if (!users.length) {
            await connection.rollback();
            req.flash('error', 'User not found');
            return res.redirect('/admin/trade-for-user');
        }

        const targetUser = users[0];
        const effectiveBalance = targetUser.account_type === 'demo' 
            ? parseFloat(targetUser.demo_balance) || 10000
            : parseFloat(targetUser.balance) || 0;

        const [pairs] = await connection.execute(
            'SELECT * FROM forex_pairs WHERE id = ? AND is_active = TRUE',
            [pair_id]
        );

        if (!pairs.length) {
            await connection.rollback();
            req.flash('error', 'Trading pair not found or inactive');
            return res.redirect(`/admin/trade-for-user/${user_id}`);
        }

        const pair = pairs[0];
        const entryPrice = direction === 'buy' ? pair.ask : pair.bid;
        const contractValue = lotSize * 100000;
        const marginRequired = contractValue / lev;

        if (marginRequired < 10) {
            await connection.rollback();
            req.flash('error', 'Minimum trade size is $10. Increase lot size or reduce leverage.');
            return res.redirect(`/admin/trade-for-user/${user_id}`);
        }

        const freeMargin = parseFloat(targetUser.free_margin) || effectiveBalance;

        if (freeMargin < marginRequired) {
            await connection.rollback();
            req.flash('error', `Insufficient margin for user. Required: $${marginRequired.toFixed(2)}, Available: $${freeMargin.toFixed(2)}`);
            return res.redirect(`/admin/trade-for-user/${user_id}`);
        }

        const [tradeResult] = await connection.execute(`
            INSERT INTO forex_trades 
            (user_id, opened_by_admin, admin_id, pair_id, pair_symbol, direction, 
             entry_price, current_price, lot_size, volume_usd, leverage_used, 
             margin_required, stop_loss, take_profit, status, opened_at, forced_result)
            VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', NOW(), ?)
        `, [
            user_id, adminId, pair.id, pair.symbol, direction,
            entryPrice, entryPrice, lotSize, contractValue, lev,
            marginRequired, stop_loss || null, take_profit || null,
            forced_result || 'none'
        ]);

        const tradeId = tradeResult.insertId;

        if (targetUser.account_type === 'demo') {
            await connection.execute(`
                UPDATE users 
                SET used_margin = used_margin + ?,
                    free_margin = free_margin - ?
                WHERE id = ?
            `, [marginRequired, marginRequired, user_id]);
        } else {
            await connection.execute(`
                UPDATE users 
                SET used_margin = used_margin + ?,
                    free_margin = free_margin - ?,
                    margin_balance = margin_balance + ?
                WHERE id = ?
            `, [marginRequired, marginRequired, marginRequired, user_id]);
        }

        await connection.execute(`
            INSERT INTO admin_trade_logs 
            (admin_id, user_id, trade_id, action, pair_symbol, direction, 
             lot_size, leverage, entry_price, forced_result, notes, created_at)
            VALUES (?, ?, ?, 'open_position', ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [
            adminId, user_id, tradeId, pair.symbol, direction,
            lotSize, lev, entryPrice, forced_result || 'none', notes || null
        ]);

        await connection.commit();

        await telegramBot.notifyAdminAction('Trade Opened for User', { 
            admin: req.session.user.username, 
            targetUser: targetUser.username,
            pair: pair.symbol,
            direction,
            lotSize,
            forced_result: forced_result || 'none'
        });

        req.flash('success', `Position opened for ${targetUser.username}: ${direction.toUpperCase()} ${lotSize} lots ${pair.symbol}`);
        res.redirect(`/admin/trade-for-user/${user_id}`);

    } catch (error) {
        await connection.rollback();
        console.error('Admin open position error:', error);
        req.flash('error', 'Failed to open position: ' + error.message);
        res.redirect(`/admin/trade-for-user/${req.body.user_id || ''}`);
    } finally {
        connection.release();
    }
});

// POST /admin/trade-for-user/close-position/:tradeId
router.post('/trade-for-user/close-position/:tradeId', ensureAdmin, async (req, res) => {
    const connection = await db.getConnection();
    try {
        const tradeId = req.params.tradeId;
        const { forced_pnl, notes } = req.body;
        const adminId = req.session.user.id;

        await connection.beginTransaction();

        const [trades] = await connection.execute(
            "SELECT t.*, u.username, u.account_type, u.balance, u.demo_balance, u.email FROM forex_trades t JOIN users u ON t.user_id = u.id WHERE t.id = ? AND t.status = 'open'",
            [tradeId]
        );

        if (!trades.length) {
            await connection.rollback();
            req.flash('error', 'Position not found or already closed');
            return res.redirect(req.get('Referrer') || '/admin/trade-for-user');
        }

        const trade = trades[0];
        const userId = trade.user_id;

        const [pairs] = await connection.execute(
            'SELECT bid, ask FROM forex_pairs WHERE symbol = ?',
            [trade.pair_symbol]
        );

        const currentPrice = trade.direction === 'buy' ? pairs[0].bid : pairs[0].ask;
        const pipSize = trade.pair_symbol.includes('JPY') ? 0.01 : 0.0001;
        let pipsProfit;

        if (trade.direction === 'buy') {
            pipsProfit = (currentPrice - trade.entry_price) / pipSize;
        } else {
            pipsProfit = (trade.entry_price - currentPrice) / pipSize;
        }

        const pipValue = trade.lot_size * 10;
        let profitLoss = pipsProfit * pipValue;

        if (forced_pnl && !isNaN(parseFloat(forced_pnl))) {
            profitLoss = parseFloat(forced_pnl);
            pipsProfit = profitLoss / pipValue;
        } else if (trade.forced_result === 'win') {
            if (profitLoss <= 0) {
                pipsProfit = Math.abs(pipsProfit) || (10 + Math.random() * 40);
                profitLoss = Math.abs(profitLoss) || (pipsProfit * pipValue);
            }
        } else if (trade.forced_result === 'loss') {
            if (profitLoss >= 0) {
                pipsProfit = -(Math.abs(pipsProfit) || (10 + Math.random() * 40));
                profitLoss = -(Math.abs(profitLoss) || (Math.abs(pipsProfit) * pipValue));
            }
            const effectiveBalance = trade.account_type === 'demo' 
                ? parseFloat(trade.demo_balance) || 10000
                : parseFloat(trade.balance) || 0;
            const maxLoss = effectiveBalance * 0.9;
            if (Math.abs(profitLoss) > maxLoss) {
                profitLoss = -maxLoss;
            }
        }

        // FIX: Use 'manual' to match ENUM('manual','sl','tp','margin_call','liquidation')
        const closeReason = 'manual';

        await connection.execute(`
            UPDATE forex_trades 
            SET status = 'closed',
                exit_price = ?,
                current_price = ?,
                pips_profit = ?,
                profit_loss = ?,
                closed_at = NOW(),
                close_reason = ?
            WHERE id = ?
        `, [currentPrice, currentPrice, pipsProfit, profitLoss, closeReason, tradeId]);

        if (trade.account_type === 'demo') {
            await connection.execute(`
                UPDATE users 
                SET demo_balance = demo_balance + ?,
                    free_margin = free_margin + ?,
                    used_margin = used_margin - ?
                WHERE id = ?
            `, [profitLoss, trade.margin_required, trade.margin_required, userId]);
        } else {
            await connection.execute(`
                UPDATE users 
                SET balance = balance + ?,
                    free_margin = free_margin + ?,
                    used_margin = used_margin - ?
                WHERE id = ?
            `, [profitLoss, trade.margin_required, trade.margin_required, userId]);
        }

        await connection.execute(`
            INSERT INTO admin_trade_logs 
            (admin_id, user_id, trade_id, action, pair_symbol, direction, 
             lot_size, leverage, entry_price, exit_price, profit_loss, forced_result, notes, created_at)
            VALUES (?, ?, ?, 'close_position', ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [
            adminId, userId, tradeId, trade.pair_symbol, trade.direction,
            trade.lot_size, trade.leverage_used, trade.entry_price,
            currentPrice, profitLoss, trade.forced_result, notes || null
        ]);

        await connection.commit();

        try {
            const siteName = await getSiteName();
            await emailService.sendEmail({
                to: trade.email,
                subject: `Trade Closed — ${siteName}`,
                html: emailTemplate({
                    badge: 'TRADE CLOSED',
                    badgeColor: profitLoss >= 0 ? '#22c55e' : '#ef4444',
                    username: trade.username,
                    intro: `your ${trade.pair_symbol} position has been closed by our trading team.`,
                    amountDisplay: `${profitLoss >= 0 ? '+' : ''}$${profitLoss.toFixed(2)}`,
                    amountColor: profitLoss >= 0 ? '#22c55e' : '#ef4444',
                    rows: [
                        ['Pair', trade.pair_symbol, '#f4f4f5'],
                        ['Direction', trade.direction.toUpperCase(), '#f4f4f5'],
                        ['Lot Size', trade.lot_size.toString(), '#f4f4f5'],
                        ['Entry Price', (parseFloat(trade.entry_price) || 0).toFixed(5), '#f4f4f5'],
                        ['Exit Price', (parseFloat(currentPrice) || 0).toFixed(5), '#f4f4f5'],
                        ['P&L', `${profitLoss >= 0 ? '+' : ''}$${profitLoss.toFixed(2)}`, profitLoss >= 0 ? '#22c55e' : '#ef4444'],
                        ['Closed By', 'Admin', '#f4f4f5'],
                        ['Date', new Date().toUTCString(), '#f4f4f5']
                    ],
                    footerNote: 'This trade was managed by our professional trading team on your behalf.',
                    siteName: siteName
                })
            });
        } catch (emailErr) {
            console.error('Failed to send trade closure email:', emailErr);
        }

        await telegramBot.notifyAdminAction('Trade Closed for User', { 
            admin: req.session.user.username, 
            targetUser: trade.username,
            pair: trade.pair_symbol,
            pnl: profitLoss.toFixed(2)
        });

        const pnlText = `${profitLoss > 0 ? '+' : ''}$${profitLoss.toFixed(2)}`;
        req.flash('success', `Position closed for ${trade.username}. P&L: ${pnlText}`);
        res.redirect(`/admin/trade-for-user/${userId}`);

    } catch (error) {
        await connection.rollback();
        console.error('Admin close position error:', error);
        req.flash('error', 'Failed to close position: ' + error.message);
        res.redirect(req.get('Referrer') || '/admin/trade-for-user');
    } finally {
        connection.release();
    }
});

// POST /admin/trade-for-user/set-force-result/:tradeId
router.post('/trade-for-user/set-force-result/:tradeId', ensureAdmin, async (req, res) => {
    try {
        const tradeId = req.params.tradeId;
        const { forced_result } = req.body;

        if (!['win', 'loss', 'none'].includes(forced_result)) {
            req.flash('error', 'Invalid force result value');
            return res.redirect(req.get('Referrer') || '/admin/trade-for-user');
        }

        const [trades] = await db.execute(
            "SELECT t.*, u.username FROM forex_trades t JOIN users u ON t.user_id = u.id WHERE t.id = ? AND t.status = 'open'",
            [tradeId]
        );

        if (!trades.length) {
            req.flash('error', 'Trade not found or already closed');
            return res.redirect(req.get('Referrer') || '/admin/trade-for-user');
        }

        await db.execute(
            'UPDATE forex_trades SET forced_result = ? WHERE id = ?',
            [forced_result, tradeId]
        );

        await telegramBot.notifyAdminAction('Force Result Set', { 
            admin: req.session.user.username, 
            targetUser: trades[0].username,
            tradeId,
            result: forced_result
        });

        req.flash('success', `Force ${forced_result.toUpperCase()} set on trade #${tradeId} for ${trades[0].username}`);
        res.redirect(req.get('Referrer') || '/admin/trade-for-user');

    } catch (error) {
        console.error('Set force result error:', error);
        req.flash('error', 'Failed to set force result');
        res.redirect(req.get('Referrer') || '/admin/trade-for-user');
    }
});

// POST /admin/trade-for-user/bulk-close/:userId
router.post('/trade-for-user/bulk-close/:userId', ensureAdmin, async (req, res) => {
    const connection = await db.getConnection();
    try {
        const userId = req.params.userId;
        const { forced_result_all, notes } = req.body;
        const adminId = req.session.user.id;

        await connection.beginTransaction();

        const [users] = await connection.execute(
            'SELECT * FROM users WHERE id = ?',
            [userId]
        );

        if (!users.length) {
            await connection.rollback();
            req.flash('error', 'User not found');
            return res.redirect('/admin/trade-for-user');
        }

        const targetUser = users[0];

        const [openTrades] = await connection.execute(
            "SELECT * FROM forex_trades WHERE user_id = ? AND status = 'open'",
            [userId]
        );

        if (!openTrades.length) {
            await connection.rollback();
            req.flash('info', 'No open positions to close');
            return res.redirect(`/admin/trade-for-user/${userId}`);
        }

        let totalPnL = 0;
        const [pairs] = await connection.execute('SELECT symbol, bid, ask FROM forex_pairs');
        const pairMap = {};
        pairs.forEach(p => pairMap[p.symbol] = p);

        for (const trade of openTrades) {
            const pair = pairMap[trade.pair_symbol];
            if (!pair) continue;

            const currentPrice = trade.direction === 'buy' ? pair.bid : pair.ask;
            const pipSize = trade.pair_symbol.includes('JPY') ? 0.01 : 0.0001;

            let pipsProfit;
            if (trade.direction === 'buy') {
                pipsProfit = (currentPrice - trade.entry_price) / pipSize;
            } else {
                pipsProfit = (trade.entry_price - currentPrice) / pipSize;
            }

            const pipValue = trade.lot_size * 10;
            let profitLoss = pipsProfit * pipValue;

            if (forced_result_all === 'win') {
                if (profitLoss <= 0) {
                    pipsProfit = Math.abs(pipsProfit) || (10 + Math.random() * 40);
                    profitLoss = Math.abs(profitLoss) || (pipsProfit * pipValue);
                }
            } else if (forced_result_all === 'loss') {
                if (profitLoss >= 0) {
                    pipsProfit = -(Math.abs(pipsProfit) || (10 + Math.random() * 40));
                    profitLoss = -(Math.abs(profitLoss) || (Math.abs(pipsProfit) * pipValue));
                }
            }

            totalPnL += profitLoss;

            // FIX: Use 'manual' to match ENUM('manual','sl','tp','margin_call','liquidation')
            const closeReason = 'manual';

            await connection.execute(`
                UPDATE forex_trades 
                SET status = 'closed',
                    exit_price = ?,
                    current_price = ?,
                    pips_profit = ?,
                    profit_loss = ?,
                    closed_at = NOW(),
                    close_reason = ?
                WHERE id = ?
            `, [currentPrice, currentPrice, pipsProfit, profitLoss, closeReason, trade.id]);

            await connection.execute(`
                INSERT INTO admin_trade_logs 
                (admin_id, user_id, trade_id, action, pair_symbol, direction, 
                 lot_size, leverage, entry_price, exit_price, profit_loss, forced_result, notes, created_at)
                VALUES (?, ?, ?, 'bulk_close', ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `, [
                adminId, userId, trade.id, trade.pair_symbol, trade.direction,
                trade.lot_size, trade.leverage_used, trade.entry_price,
                currentPrice, profitLoss, forced_result_all || 'none', notes || 'Bulk close'
            ]);
        }

        if (targetUser.account_type === 'demo') {
            await connection.execute(`
                UPDATE users 
                SET demo_balance = demo_balance + ?,
                    used_margin = 0,
                    free_margin = demo_balance + ?
                WHERE id = ?
            `, [totalPnL, totalPnL, userId]);
        } else {
            await connection.execute(`
                UPDATE users 
                SET balance = balance + ?,
                    used_margin = 0,
                    free_margin = balance + ?
                WHERE id = ?
            `, [totalPnL, totalPnL, userId]);
        }

        await connection.commit();

        await telegramBot.notifyAdminAction('Bulk Close Completed', { 
            admin: req.session.user.username, 
            targetUser: targetUser.username,
            positionsClosed: openTrades.length,
            totalPnL: totalPnL.toFixed(2)
        });

        req.flash('success', `Closed ${openTrades.length} positions for ${targetUser.username}. Total P&L: ${totalPnL > 0 ? '+' : ''}$${totalPnL.toFixed(2)}`);
        res.redirect(`/admin/trade-for-user/${userId}`);

    } catch (error) {
        await connection.rollback();
        console.error('Bulk close error:', error);
        req.flash('error', 'Failed to bulk close positions: ' + error.message);
        res.redirect(req.get('Referrer') || '/admin/trade-for-user');
    } finally {
        connection.release();
    }
});

// GET /admin/trade-for-user/logs
router.get('/trade-for-user/logs', ensureAdmin, async (req, res) => {
    try {
        const [logs] = await db.execute(`
            SELECT 
                atl.*,
                u.username as target_username,
                a.username as admin_username
            FROM admin_trade_logs atl
            JOIN users u ON atl.user_id = u.id
            JOIN users a ON atl.admin_id = a.id
            ORDER BY atl.created_at DESC
            LIMIT 200
        `);

        const unreadCount = await getUnreadCount();

        res.render('admin/trade_logs', {
            title: 'Admin Trade Logs',
            logs: logs || [],
            currentUser: req.session.user,
            unreadCount
        });

    } catch (error) {
        console.error('Trade logs error:', error);
        req.flash('error', 'Failed to load trade logs');
        res.redirect('/admin/trade-for-user');
    }
});

module.exports = router;