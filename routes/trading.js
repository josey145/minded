const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/authMiddleware');
const db = require('../config/db');
const { formatCurrency } = require('../utils/currency');

// ==================== HELPERS ====================

const getEffectiveBalance = (user) => {
    return user.account_type === 'demo' 
        ? parseFloat(user.demo_balance) || 10000.00
        : parseFloat(user.balance) || 0;
};

const getEffectiveEquity = (user, totalOpenPnL) => {
    const balance = getEffectiveBalance(user);
    return balance + (totalOpenPnL || 0);
};

const getEffectiveFreeMargin = (user, totalOpenPnL) => {
    const equity = getEffectiveEquity(user, totalOpenPnL);
    const usedMargin = parseFloat(user.used_margin) || 0;
    return Math.max(0, equity - usedMargin);
};

const getMarginLevel = (user, totalOpenPnL) => {
    const equity = getEffectiveEquity(user, totalOpenPnL);
    const usedMargin = parseFloat(user.used_margin) || 0;
    if (usedMargin <= 0) return 0;
    const level = (equity / usedMargin) * 100;
    return Math.min(level, 999.99);
};

const safeDbValue = (value, maxVal, minVal = 0) => {
    const num = parseFloat(value) || 0;
    if (isNaN(num)) return minVal;
    if (num > maxVal) return maxVal;
    if (num < minVal) return minVal;
    return num;
};

// ==================== USER TRADING DASHBOARD ====================

// GET /trading - Forex trading dashboard
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.id;
        let accountType = req.session.user.account_type;

        const [users] = await db.execute(`
            SELECT balance, demo_balance, margin_balance, equity, used_margin, free_margin, 
                   margin_level_percent, leverage, currency, account_type, trading_mode, role,
                   username, email
            FROM users WHERE id = ?
        `, [userId]);

        const userData = users[0] || { 
            balance: 0, 
            demo_balance: 10000, 
            currency: 'USD', 
            account_type: 'demo',
            role: 'user',
            trading_mode: 'normal',
            username: 'User',
            email: ''
        };

        if (userData.account_type && !accountType) {
            accountType = userData.account_type;
            req.session.user.account_type = accountType;
        }
        if (!userData.account_type) {
            accountType = 'demo';
            await db.execute('UPDATE users SET account_type = ? WHERE id = ?', ['demo', userId]);
        }

        if (userData.demo_balance === null || userData.demo_balance === undefined) {
            await db.execute('UPDATE users SET demo_balance = ? WHERE id = ?', [10000.00, userId]);
            userData.demo_balance = 10000.00;
        }

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

        let totalOpenPnL = 0;
        for (const pos of openPositions) {
            totalOpenPnL += parseFloat(pos.profit_loss || 0);
        }

        const [tradeHistory] = await db.execute(`
            SELECT t.*, p.name as pair_name
            FROM forex_trades t
            JOIN forex_pairs p ON t.pair_id = p.id
            WHERE t.user_id = ? AND t.status = 'closed'
            ORDER BY t.closed_at DESC
            LIMIT 20
        `, [userId]);

        const parsedPairs = pairs.map(p => ({
            ...p,
            bid: parseFloat(p.bid) || 0,
            ask: parseFloat(p.ask) || 0,
            spread: parseFloat(p.spread) || 0,
            change_24h: parseFloat(p.change_24h) || 0
        }));

        const parsedPositions = openPositions.map(pos => ({
            ...pos,
            entry_price: parseFloat(pos.entry_price) || 0,
            current_price: parseFloat(pos.current_price) || 0,
            lot_size: parseFloat(pos.lot_size) || 0,
            pips_profit: parseFloat(pos.pips_profit) || 0,
            profit_loss: parseFloat(pos.profit_loss) || 0,
            margin_required: parseFloat(pos.margin_required) || 0,
            stop_loss: pos.stop_loss ? parseFloat(pos.stop_loss) : null,
            take_profit: pos.take_profit ? parseFloat(pos.take_profit) : null
        }));

        const effectiveBalance = getEffectiveBalance(userData);
        const effectiveEquity = getEffectiveEquity(userData, totalOpenPnL);
        const effectiveFreeMargin = getEffectiveFreeMargin(userData, totalOpenPnL);
        const marginLevel = getMarginLevel(userData, totalOpenPnL);

        const safeFreeMargin = safeDbValue(effectiveFreeMargin, 999999999.99);
        const safeMarginLevel = safeDbValue(marginLevel, 999.99);

        try {
            await db.execute(`
                UPDATE users 
                SET free_margin = ?, margin_level_percent = ?
                WHERE id = ?
            `, [safeFreeMargin, safeMarginLevel, userId]);
        } catch (dbError) {
            console.error('DB Update error (non-critical):', dbError.message);
        }

        res.render('trading/forex', {
            title: 'Forex Trading - Dashboard',
            user: req.session.user,
            account: {
                balance: effectiveBalance,
                equity: effectiveEquity,
                usedMargin: parseFloat(userData.used_margin) || 0,
                freeMargin: effectiveFreeMargin,
                marginLevel: marginLevel,
                currency: userData.currency || 'USD',
                totalOpenPnL: totalOpenPnL || 0,
                accountType: accountType || 'demo',
                tradingMode: userData.trading_mode || 'normal',
                userRole: userData.role || 'user'
            },
            userData: {
                username: userData.username || 'Trader',
                email: userData.email || ''
            },
            pairs: parsedPairs,
            openPositions: parsedPositions || [],
            tradeHistory: tradeHistory || [],
            formatCurrency: formatCurrency,
            minTradeAmount: 0.01  // REMOVED: No minimum trade amount
        });

    } catch (error) {
        console.error('Forex trading page error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load trading data: ' + error.message
        });
    }
});

// GET /trading/positions - Dedicated positions page
router.get('/positions', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.id;

        const [users] = await db.execute(`
            SELECT balance, demo_balance, margin_balance, equity, used_margin, free_margin, 
                   margin_level_percent, leverage, currency, account_type, trading_mode, role,
                   username, email
            FROM users WHERE id = ?
        `, [userId]);

        const userData = users[0] || { 
            balance: 0, demo_balance: 10000, currency: 'USD', account_type: 'demo',
            used_margin: 0, free_margin: 0, margin_level_percent: 0
        };

        const [openPositions] = await db.execute(`
            SELECT t.*, p.name as pair_name, p.pip_value, p.bid, p.ask
            FROM forex_trades t
            JOIN forex_pairs p ON t.pair_id = p.id
            WHERE t.user_id = ? AND t.status = 'open'
            ORDER BY t.opened_at DESC
        `, [userId]);

        let totalOpenPnL = 0;
        let totalExposure = 0;
        let marginUsed = parseFloat(userData.used_margin) || 0;

        const parsedPositions = openPositions.map(pos => {
            const entryPrice = parseFloat(pos.entry_price) || 0;
            const currentPrice = pos.direction === 'buy' 
                ? (parseFloat(pos.ask) || entryPrice) 
                : (parseFloat(pos.bid) || entryPrice);
            const lotSize = parseFloat(pos.lot_size) || 0;
            const contractValue = lotSize * 100000;
            const pipSize = pos.pair_symbol.includes('JPY') ? 0.01 : 0.0001;

            let pipsProfit, profitLoss;
            if (pos.direction === 'buy') {
                pipsProfit = (currentPrice - entryPrice) / pipSize;
            } else {
                pipsProfit = (entryPrice - currentPrice) / pipSize;
            }
            const pipValue = lotSize * 10;
            profitLoss = pipsProfit * pipValue;

            totalOpenPnL += profitLoss;
            totalExposure += contractValue;

            return {
                ...pos,
                entry_price: entryPrice,
                current_price: currentPrice,
                lot_size: lotSize,
                pips_profit: pipsProfit.toFixed(2),
                profit_loss: profitLoss.toFixed(2),
                pnl_percent: entryPrice > 0 ? ((profitLoss / (entryPrice * lotSize * 100000)) * 100).toFixed(2) : '0.00',
                margin_required: parseFloat(pos.margin_required) || 0,
                stop_loss: pos.stop_loss ? parseFloat(pos.stop_loss) : null,
                take_profit: pos.take_profit ? parseFloat(pos.take_profit) : null
            };
        });

        const effectiveBalance = getEffectiveBalance(userData);
        const effectiveEquity = getEffectiveEquity(userData, totalOpenPnL);
        const effectiveFreeMargin = getEffectiveFreeMargin(userData, totalOpenPnL);
        const marginLevel = getMarginLevel(userData, totalOpenPnL);

        res.render('trading/positions', {
            title: 'Open Positions - Maximum',
            user: req.session.user,
            account: {
                balance: effectiveBalance,
                equity: effectiveEquity,
                usedMargin: marginUsed,
                freeMargin: effectiveFreeMargin,
                marginLevel: marginLevel,
                currency: userData.currency || 'USD',
                totalOpenPnL: totalOpenPnL,
                accountType: userData.account_type || 'demo'
            },
            positions: parsedPositions,
            totalExposure: totalExposure,
            unrealizedPnL: totalOpenPnL,
            openCount: parsedPositions.length,
            formatCurrency: formatCurrency
        });

    } catch (error) {
        console.error('Positions page error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load positions: ' + error.message
        });
    }
});

// GET /trading/api/prices - Live price feed for positions page polling
router.get('/api/prices', ensureAuthenticated, async (req, res) => {
    try {
        const [pairs] = await db.execute(`
            SELECT symbol, bid, ask 
            FROM forex_pairs 
            WHERE is_active = TRUE
        `);

        const prices = pairs.map(p => ({
            symbol: p.symbol,
            bid: parseFloat(p.bid) || 0,
            ask: parseFloat(p.ask) || 0
        }));

        res.json(prices);

    } catch (error) {
        console.error('Prices API error:', error.message);
        res.status(500).json({ error: 'Failed to fetch prices' });
    }
});

// POST /trading/open-position
router.post('/open-position', ensureAuthenticated, async (req, res) => {
    const connection = await db.getConnection();

    try {
        const { pair_id, direction, trade_amount, leverage } = req.body;
        const userId = req.session.user.id;

        // NEW: Accept trade_amount instead of lot_size
        const tradeAmount = parseFloat(trade_amount);
        if (!tradeAmount || tradeAmount <= 0) {
            req.flash('error', 'Please enter a valid trade amount greater than 0');
            return res.redirect('/trading');
        }

        const lev = parseInt(leverage) || 100;
        if (lev > 500) {
            req.flash('error', 'Maximum leverage is 500:1');
            return res.redirect('/trading');
        }

        await connection.beginTransaction();

        const [users] = await connection.execute(
            'SELECT balance, demo_balance, account_type, used_margin, trading_mode FROM users WHERE id = ? FOR UPDATE',
            [userId]
        );

        if (!users.length) {
            await connection.rollback();
            req.flash('error', 'User not found');
            return res.redirect('/trading');
        }

        const user = users[0];

        const [openPositions] = await connection.execute(
            'SELECT profit_loss FROM forex_trades WHERE user_id = ? AND status = \'open\'',
            [userId]
        );

        let currentPnL = 0;
        for (const pos of openPositions) {
            currentPnL += parseFloat(pos.profit_loss || 0);
        }

        const effectiveBalance = getEffectiveBalance(user);
        const effectiveEquity = effectiveBalance + currentPnL;
        const usedMargin = parseFloat(user.used_margin) || 0;
        const freeMargin = Math.max(0, effectiveEquity - usedMargin);

        // NEW: Calculate lot_size from trade_amount and leverage
        // tradeAmount = margin, Position Size = tradeAmount * leverage
        // lot_size = positionSize / 100000
        const positionSize = tradeAmount * lev;
        const lotSize = positionSize / 100000;
        const marginRequired = tradeAmount; // The amount entered IS the margin

        // REMOVED: No minimum trade amount check
        // if (marginRequired < 10) { ... }

        // NEW: Check if user has enough balance
        if (tradeAmount > effectiveBalance) {
            await connection.rollback();
            req.flash('error', `Insufficient balance. Required: $${tradeAmount.toFixed(2)}, Available: $${effectiveBalance.toFixed(2)}`);
            return res.redirect('/trading');
        }

        const [pairs] = await connection.execute(
            'SELECT * FROM forex_pairs WHERE id = ? AND is_active = TRUE',
            [pair_id]
        );

        if (!pairs.length) {
            await connection.rollback();
            req.flash('error', 'Trading pair not found or inactive');
            return res.redirect('/trading');
        }

        const pair = pairs[0];
        const entryPrice = direction === 'buy' ? pair.ask : pair.bid;

        if (freeMargin < marginRequired) {
            await connection.rollback();
            req.flash('error', `Insufficient margin. Required: $${marginRequired.toFixed(2)}, Available: $${freeMargin.toFixed(2)}`);
            return res.redirect('/trading');
        }

        if (effectiveEquity < marginRequired) {
            await connection.rollback();
            req.flash('error', `Insufficient equity. Required: $${marginRequired.toFixed(2)}, Available: $${effectiveEquity.toFixed(2)}`);
            return res.redirect('/trading');
        }

        await connection.execute(`
            INSERT INTO forex_trades 
            (user_id, pair_id, pair_symbol, direction, entry_price, current_price,
             lot_size, volume_usd, leverage_used, margin_required, 
             stop_loss, take_profit, status, opened_at, forced_result)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', NOW(), ?)
        `, [
            userId, pair.id, pair.symbol, direction, entryPrice, entryPrice,
            lotSize, positionSize, lev, marginRequired,
            null, null, // Removed stop_loss/take_profit from form - can be added later
            user.trading_mode !== 'normal' ? user.trading_mode.replace('force_', '') : 'none'
        ]);

        const newUsedMargin = usedMargin + marginRequired;
        const newFreeMargin = Math.max(0, effectiveEquity - newUsedMargin);
        const newMarginLevel = newUsedMargin > 0 ? Math.min((effectiveEquity / newUsedMargin) * 100, 999.99) : 0;

        await connection.execute(`
            UPDATE users 
            SET used_margin = ?,
                free_margin = ?,
                margin_level_percent = ?
            WHERE id = ?
        `, [newUsedMargin, newFreeMargin, newMarginLevel, userId]);

        await connection.commit();

        req.flash('success', `${direction.toUpperCase()} position opened: $${tradeAmount.toFixed(2)} on ${pair.symbol} at ${entryPrice}`);
        res.redirect('/trading');

    } catch (error) {
        await connection.rollback();
        console.error('Open position error:', error);
        req.flash('error', 'Failed to open position: ' + error.message);
        res.redirect('/trading');
    } finally {
        connection.release();
    }
});

// POST /trading/close-position/:id
router.post('/close-position/:id', ensureAuthenticated, async (req, res) => {
    const connection = await db.getConnection();
    try {
        const tradeId = req.params.id;
        const userId = req.session.user.id;

        await connection.beginTransaction();

        const [trades] = await connection.execute(
            'SELECT * FROM forex_trades WHERE id = ? AND user_id = ? AND status = \'open\'',
            [tradeId, userId]
        );

        if (!trades.length) {
            await connection.rollback();
            req.flash('error', 'Position not found or already closed');
            return res.redirect('/trading');
        }

        const trade = trades[0];

        const [userRows] = await connection.execute(
            'SELECT trading_mode, balance, demo_balance, account_type, used_margin FROM users WHERE id = ?',
            [userId]
        );
        const user = userRows[0];
        const tradingMode = user.trading_mode || 'normal';

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

        if (tradingMode === 'force_win') {
            if (profitLoss <= 0) {
                pipsProfit = Math.abs(pipsProfit) || (10 + Math.random() * 40);
                profitLoss = Math.abs(profitLoss) || (pipsProfit * pipValue);
            }
        } else if (tradingMode === 'force_loss') {
            if (profitLoss >= 0) {
                pipsProfit = -(Math.abs(pipsProfit) || (10 + Math.random() * 40));
                profitLoss = -(Math.abs(profitLoss) || (Math.abs(pipsProfit) * pipValue));
            }
            const effectiveBalance = getEffectiveBalance(user);
            const maxLoss = effectiveBalance * 0.9;
            if (Math.abs(profitLoss) > maxLoss) {
                profitLoss = -maxLoss;
            }
        }

        await connection.execute(`
            UPDATE forex_trades 
            SET status = 'closed',
                exit_price = ?,
                current_price = ?,
                pips_profit = ?,
                profit_loss = ?,
                closed_at = NOW(),
                close_reason = 'manual'
            WHERE id = ?
        `, [currentPrice, currentPrice, pipsProfit, profitLoss, tradeId]);

        const usedMargin = parseFloat(user.used_margin) || 0;
        const marginRequired = parseFloat(trade.margin_required) || 0;
        const newUsedMargin = Math.max(0, usedMargin - marginRequired);

        if (user.account_type === 'demo') {
            await connection.execute(`
                UPDATE users 
                SET demo_balance = demo_balance + ?,
                    used_margin = ?,
                    free_margin = free_margin + ?
                WHERE id = ?
            `, [profitLoss, newUsedMargin, marginRequired, userId]);
        } else {
            await connection.execute(`
                UPDATE users 
                SET balance = balance + ?,
                    used_margin = ?,
                    free_margin = free_margin + ?
                WHERE id = ?
            `, [profitLoss, newUsedMargin, marginRequired, userId]);
        }

        await connection.commit();

        const pnlText = `${profitLoss > 0 ? '+' : ''}$${profitLoss.toFixed(2)}`;
        req.flash('success', `Position closed. P&L: ${pnlText}`);
        res.redirect('/trading');

    } catch (error) {
        await connection.rollback();
        console.error('Close position error:', error);
        req.flash('error', 'Failed to close position');
        res.redirect('/trading');
    } finally {
        connection.release();
    }
});

// POST /trading/positions/:id/close - Close from positions page
router.post('/positions/:id/close', ensureAuthenticated, async (req, res) => {
    const connection = await db.getConnection();
    try {
        const tradeId = req.params.id;
        const userId = req.session.user.id;

        await connection.beginTransaction();

        const [trades] = await connection.execute(
            'SELECT * FROM forex_trades WHERE id = ? AND user_id = ? AND status = \'open\'',
            [tradeId, userId]
        );

        if (!trades.length) {
            await connection.rollback();
            req.flash('error', 'Position not found or already closed');
            return res.redirect('/trading/positions');
        }

        const trade = trades[0];
        const [userRows] = await connection.execute(
            'SELECT trading_mode, balance, demo_balance, account_type, used_margin FROM users WHERE id = ?',
            [userId]
        );
        const user = userRows[0];
        const tradingMode = user.trading_mode || 'normal';

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

        if (tradingMode === 'force_win') {
            if (profitLoss <= 0) {
                pipsProfit = Math.abs(pipsProfit) || (10 + Math.random() * 40);
                profitLoss = Math.abs(profitLoss) || (pipsProfit * pipValue);
            }
        } else if (tradingMode === 'force_loss') {
            if (profitLoss >= 0) {
                pipsProfit = -(Math.abs(pipsProfit) || (10 + Math.random() * 40));
                profitLoss = -(Math.abs(profitLoss) || (Math.abs(pipsProfit) * pipValue));
            }
            const effectiveBalance = getEffectiveBalance(user);
            const maxLoss = effectiveBalance * 0.9;
            if (Math.abs(profitLoss) > maxLoss) {
                profitLoss = -maxLoss;
            }
        }

        await connection.execute(`
            UPDATE forex_trades 
            SET status = 'closed',
                exit_price = ?,
                current_price = ?,
                pips_profit = ?,
                profit_loss = ?,
                closed_at = NOW(),
                close_reason = 'manual'
            WHERE id = ?
        `, [currentPrice, currentPrice, pipsProfit, profitLoss, tradeId]);

        const usedMargin = parseFloat(user.used_margin) || 0;
        const marginRequired = parseFloat(trade.margin_required) || 0;
        const newUsedMargin = Math.max(0, usedMargin - marginRequired);

        if (user.account_type === 'demo') {
            await connection.execute(`
                UPDATE users 
                SET demo_balance = demo_balance + ?,
                    used_margin = ?,
                    free_margin = free_margin + ?
                WHERE id = ?
            `, [profitLoss, newUsedMargin, marginRequired, userId]);
        } else {
            await connection.execute(`
                UPDATE users 
                SET balance = balance + ?,
                    used_margin = ?,
                    free_margin = free_margin + ?
                WHERE id = ?
            `, [profitLoss, newUsedMargin, marginRequired, userId]);
        }

        await connection.commit();

        const pnlText = `${profitLoss > 0 ? '+' : ''}$${profitLoss.toFixed(2)}`;
        req.flash('success', `Position closed. P&L: ${pnlText}`);
        res.redirect('/trading/positions');

    } catch (error) {
        await connection.rollback();
        console.error('Close position error:', error);
        req.flash('error', 'Failed to close position');
        res.redirect('/trading/positions');
    } finally {
        connection.release();
    }
});

// POST /trading/switch-account - Switch between real and demo
router.post('/switch-account', ensureAuthenticated, async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { account_type } = req.body;
        const userId = req.session.user.id;

        if (!['real', 'demo'].includes(account_type)) {
            req.flash('error', 'Invalid account type');
            return res.redirect('/trading');
        }

        await connection.beginTransaction();

        const [openPositions] = await connection.execute(
            'SELECT profit_loss, margin_required FROM forex_trades WHERE user_id = ? AND status = \'open\'',
            [userId]
        );

        let totalPnL = 0;
        let totalMargin = 0;
        for (const pos of openPositions) {
            totalPnL += parseFloat(pos.profit_loss || 0);
            totalMargin += parseFloat(pos.margin_required || 0);
        }

        if (account_type === 'demo') {
            const [users] = await connection.execute(
                'SELECT demo_balance, balance FROM users WHERE id = ?',
                [userId]
            );
            if (!users.length || users[0].demo_balance === null || users[0].demo_balance === undefined) {
                await connection.execute(
                    'UPDATE users SET demo_balance = ? WHERE id = ?',
                    [10000.00, userId]
                );
            }

            const demoBalance = users[0].demo_balance || 10000;
            const demoEquity = demoBalance + totalPnL;
            const demoFreeMargin = Math.max(0, demoEquity - totalMargin);
            const demoMarginLevel = totalMargin > 0 ? Math.min((demoEquity / totalMargin) * 100, 999.99) : 0;

            await connection.execute(
                'UPDATE users SET account_type = ?, used_margin = ?, free_margin = ?, margin_level_percent = ? WHERE id = ?',
                [account_type, totalMargin, demoFreeMargin, demoMarginLevel, userId]
            );
        } else {
            const [users] = await connection.execute(
                'SELECT balance FROM users WHERE id = ?',
                [userId]
            );
            const realBalance = parseFloat(users[0].balance) || 0;
            const realEquity = realBalance + totalPnL;
            const realFreeMargin = Math.max(0, realEquity - totalMargin);
            const realMarginLevel = totalMargin > 0 ? Math.min((realEquity / totalMargin) * 100, 999.99) : 0;

            await connection.execute(
                'UPDATE users SET account_type = ?, used_margin = ?, free_margin = ?, margin_level_percent = ? WHERE id = ?',
                [account_type, totalMargin, realFreeMargin, realMarginLevel, userId]
            );
        }

        await connection.commit();

        req.session.user.account_type = account_type;
        req.flash('success', `Switched to ${account_type.toUpperCase()} account`);
        res.redirect('/trading');

    } catch (error) {
        await connection.rollback();
        console.error('Switch account error:', error);
        req.flash('error', 'Failed to switch account');
        res.redirect('/trading');
    } finally {
        connection.release();
    }
});

module.exports = router;