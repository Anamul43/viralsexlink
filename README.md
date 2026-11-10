# VIRAL LINK — Telegram Mini App starter

This is a starter template, not a production-audited service. It supports:
- Telegram Mini App `initData` signature validation
- Listing videos stored by Telegram `file_id`
- Sending a selected video to the user via the bot with `protect_content: true`
- Scheduling deletion 20 minutes after the bot sends it (SQLite queue survives app restarts if the database file is on persistent storage)

## Important limitations
- `protect_content` limits Telegram forwarding/saving, but cannot prevent screenshots, screen recording, or external capture.
- The 20-minute timer starts when the bot sends the message. It cannot prove that a user watched the video.
- The bot user must press `/start` before it can message them.
- Only upload/share content you own or have permission to distribute. Do not use this starter for explicit/adult content.
- Keep the bot token private. Never put it in browser JavaScript or commit `.env`.
- The admin API below is intentionally minimal. Add proper admin sessions, HTTPS, rate limits, audit logs, and CSRF protections before public production use.
- Telegram Bot API file-size and hosting limits can change; verify current limits before choosing upload workflow.
- Free hosting often sleeps and may have ephemeral storage. If the SQLite database or uploads are on ephemeral storage, data and deletion jobs may be lost on redeploy/restart. Use persistent storage or a managed database for production.

## Run locally
1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env`.
3. Set `BOT_TOKEN`, `BOT_USERNAME`, `ADMIN_PASSWORD`, and `PUBLIC_BASE_URL`.
4. Run `npm install`, then `npm start`.
5. Open `http://localhost:3000/health`.

## Add a video
1. Send your own/authorized video to your bot or a private channel where the bot can access it.
2. Obtain the Telegram `file_id` using a bot update/logging utility you control.
3. POST to `/api/admin/video` with header `x-admin-password: YOUR_ADMIN_PASSWORD` and JSON:
   `{"title":"My video","file_id":"TELEGRAM_FILE_ID"}`

Example:
```bash
curl -X POST http://localhost:3000/api/admin/video \
  -H "Content-Type: application/json" \
  -H "x-admin-password: YOUR_ADMIN_PASSWORD" \
  -d '{"title":"My video","file_id":"TELEGRAM_FILE_ID"}'
```

## Telegram Mini App setup
Configure the bot's menu button or Mini App URL in BotFather to point to your HTTPS deployment URL. The website must be served over HTTPS for Telegram Mini Apps. This starter does not automatically configure BotFather.

## Deploy
Deploy as a Node.js web service on a host that supports long-running Node processes. Configure environment variables from `.env.example`. Attach persistent storage for the working directory (or move SQLite to a managed persistent database). Do not assume a free tier provides persistent disk.
