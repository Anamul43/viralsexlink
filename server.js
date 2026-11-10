require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const Database = require("better-sqlite3");
const { Telegraf } = require("telegraf");

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const db = new Database(process.env.DB_PATH || "viral-link.sqlite");

if (!BOT_TOKEN || !ADMIN_PASSWORD) {
  console.error("Set BOT_TOKEN and ADMIN_PASSWORD in environment variables.");
  process.exit(1);
}

fs.mkdirSync("uploads", { recursive: true });
db.exec(`
  CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    file_id TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pending_deletions (
    chat_id TEXT NOT NULL,
    message_id INTEGER NOT NULL,
    delete_at INTEGER NOT NULL,
    PRIMARY KEY(chat_id, message_id)
  );
`);

const bot = new Telegraf(BOT_TOKEN);
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

function validateWebAppInitData(initData) {
  if (!initData || !BOT_TOKEN) return false;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return false;
  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const calculated = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(calculated, "hex"));
}

function requireAdmin(req, res, next) {
  const supplied = req.headers["x-admin-password"];
  if (!supplied || supplied !== ADMIN_PASSWORD) return res.status(401).json({ error: "Unauthorized" });
  next();
}

app.get("/api/videos", (req, res) => {
  const rows = db.prepare("SELECT id, title FROM videos ORDER BY id DESC").all();
  res.json(rows);
});

app.post("/api/unlock", async (req, res) => {
  const { initData, videoId } = req.body || {};
  if (!validateWebAppInitData(initData)) return res.status(401).json({ error: "Open this app from Telegram." });
  const params = new URLSearchParams(initData);
  let user;
  try { user = JSON.parse(params.get("user") || "{}"); } catch { user = null; }
  if (!user || !user.id) return res.status(400).json({ error: "Telegram user missing." });

  const video = db.prepare("SELECT id, title, file_id FROM videos WHERE id = ?").get(Number(videoId));
  if (!video) return res.status(404).json({ error: "Video not found." });

  try {
    const sent = await bot.telegram.sendVideo(user.id, video.file_id, {
      caption: video.title,
      protect_content: true
    });
    db.prepare("INSERT OR REPLACE INTO pending_deletions(chat_id, message_id, delete_at) VALUES (?, ?, ?)")
      .run(String(user.id), sent.message_id, Date.now() + 20 * 60 * 1000);
    res.json({ ok: true, message: "ভিডিওটি Telegram-এ পাঠানো হয়েছে। ২০ মিনিট পর মুছে যাবে।" });
  } catch (e) {
    console.error("sendVideo failed:", e.message);
    res.status(400).json({ error: "বট থেকে ভিডিও পাঠানো যায়নি। আগে বটকে /start করুন।" });
  }
});

app.post("/api/admin/video", requireAdmin, (req, res) => {
  const { title, file_id } = req.body || {};
  if (!title || !file_id) return res.status(400).json({ error: "title and Telegram file_id are required" });
  const result = db.prepare("INSERT INTO videos(title, file_id, created_at) VALUES (?, ?, ?)")
    .run(String(title).slice(0, 120), String(file_id), Date.now());
  res.json({ ok: true, id: result.lastInsertRowid });
});

app.get("/health", (_req, res) => res.json({ ok: true }));

bot.start((ctx) => ctx.reply("VIRAL LINK bot is ready. Open the Mini App from its website button."));
bot.catch((err) => console.error("Bot error:", err));
bot.launch().then(() => console.log("Telegram bot started")).catch(console.error);

async function processDeletions() {
  const due = db.prepare("SELECT chat_id, message_id FROM pending_deletions WHERE delete_at <= ?").all(Date.now());
  for (const item of due) {
    try { await bot.telegram.deleteMessage(item.chat_id, item.message_id); }
    catch (e) { console.error("Delete failed:", e.message); }
    db.prepare("DELETE FROM pending_deletions WHERE chat_id = ? AND message_id = ?")
      .run(item.chat_id, item.message_id);
  }
}
setInterval(() => processDeletions().catch(console.error), 15000);
processDeletions().catch(console.error);

const server = app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
function shutdown() {
  server.close();
  bot.stop("SIGTERM");
  db.close();
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
