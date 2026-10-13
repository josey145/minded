# Project Documentation — Maximum Crypto Trading Platform

## Overview

Maximum is a Node.js/Express application that provides a crypto trading dashboard with real-time price updates, basic user authentication, an admin panel, Telegram integration, and webhook handling for TradingView.

## Quick start

- Install dependencies:

```bash
npm install
```

- Create a `.env` file (see Environment section) and configure your MySQL database in `config/db.js`.
- Start the app in development:

```bash
npm run dev
```

The app listens on `PORT` (defaults to `3000`). Webhook endpoint: `POST /webhook/tradingview`.

## Environment variables

Typical variables expected (create a `.env` in project root):

- `PORT` — server port (default 3000)
- `NODE_ENV` — `development` or `production`
- `SESSION_SECRET` — secret for express-session
- Telegram-related keys used in `services/telegramBot.js` (set if using Telegram integration)

## Database

- Uses MySQL via `mysql2`.
- DB connection is configured in `config/db.js`.
- Example tables exist in project root SQL file: `migration_real_demo_accounts.sql` — inspect for table schemas.

## Scripts

- `npm start` — run production server (`node app.js`)
- `npm run dev` — run with `nodemon` for development

## Major components

- `app.js` — main entry, middleware, route mounting, Socket.IO setup, TradingView webhook.
- `config/db.js` — MySQL connection helper.
- `controllers/` — request handlers (`authController.js`, `tradeController.js`, ...).
- `routes/` — route definitions (example: `routes/auth.js`, `routes/public.js`, `routes/dashboard.js`).
- `models/` — data model files (`user.js`, `trade.js`).
- `services/` — background services and integrations (`telegramBot.js`, `signalBot.js`, `tradingViewService.js`).
- `sockets/` — socket handlers for real-time updates (`priceSocket.js`, `cryptoSocket.js`).
- `public/` and `views/` — frontend assets and EJS templates.

## Routes / Endpoints (mount points)

The application mounts route groups in `app.js` as follows:

- `/` — public pages (`routes/public.js`, `routes/auth.js`)
- `/dashboard` — user dashboard (`routes/dashboard.js`)
- `/transactions` — transaction routes (`routes/transactions.js`)
- `/admin` — admin panel and admin-mounted trade routes (`routes/admin.js`, `routes/trade_for_user.js`)
- `/admin/crypto-wallets` — admin wallet pages (`routes/adminWallets.js`)
- `/profile` — user profile pages (`routes/profile.js`)
- `/trading` — trading pages (`routes/trading.js`)
- `/investments` — investments routes (`routes/investments.js`)
- `/edit` — edit pages (`routes/edit.js`)
- `/messages` — user messages (`routes/messages.js`)
- `/api` — API router (`routes/api.js`)
- `POST /webhook/tradingview` — webhook receiver implemented directly in `app.js`

For details on individual endpoints, open each `routes/*.js` file and inspect the router methods (GET/POST/PUT/DELETE).

## Websockets & Real-time

- Socket.IO is initialized in `app.js` and `sockets/priceSocket.js` handles emitting real-time price updates.
- `tradingViewService` is initialized at startup and can be used to process webhook events and push updates via Socket.IO.

## Integrations

- Telegram Bot: `services/telegramBot.js` — sends notifications on events (e.g., new registration). Check that Telegram credentials are set for it to work.
- TradingView Webhook: `POST /webhook/tradingview` handles incoming price alerts and forwards them to `tradingViewService`.
- CoinGecko (or similar): used by price fetchers in sockets/services (see `sockets/cryptoSocket.js`).

## Security & Middleware

- Helmet is used for security headers and a CSP is configured in `app.js`.
- Rate limiting is applied via `express-rate-limit`.
- Sessions via `express-session`; session secret comes from env.
- There is a maintenance-mode middleware that blocks non-admin users when enabled in site settings.

## Testing utilities

- `test-telegram.js` and `test-webhook.js` are present for manual testing of Telegram and webhook flows.

## Troubleshooting & Notes

- If the server fails to start on port, `app.js` includes a Windows `taskkill` command to free the port — adjust for non-Windows environments.
- Ensure `config/db.js` points to a running MySQL instance and that migrations or schema SQL are loaded.
- Many model files are minimal; review `models/` and implement missing DB operations as needed.

## Suggested next steps

1. Add a `.env.example` file listing required environment variables.
2. Document each route with method, path, required params, and response sample (can be added to this document).
3. Implement/describe DB schema more thoroughly (export from MySQL or add migrations).
4. Add unit/integration tests for critical controllers and services.

---
Generated from project files on local workspace. For expanded API docs, tell me which routes or files to document next.
