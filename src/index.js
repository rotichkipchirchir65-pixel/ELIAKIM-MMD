import pkg from "@whiskeysockets/baileys";
const { 
  makeWASocket, 
  useMultiFileAuthState, 
  fetchLatestBaileysVersion, 
  DisconnectReason, 
  proto 
} = pkg.default || pkg;

import { Boom } from "@hapi/boom";
import pino from "pino";
import path from "path";
import express from "express";

import config from "../config.js";
import { loadSession } from "./session.js";
import { handleMessage } from "./handler.js";
import { store as globalStore } from "./store.js";
import { handleAntiDelete } from "./features/antidelete.js";

const SESSION_DIR = path.join(process.cwd(), "bot-session");
const logger = pino({ level: "silent" });

// Load session from config.js before connecting
loadSession();

let isAlreadyOnline = false;

export async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  // Simple message cache — stores last 1000 messages for antidelete
  const msgCache = new Map();
  globalStore.set({
    loadMessage: (jid, id) => msgCache.get(`${jid}:${id}`) || null,
  });

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    auth: state,
    browser: [config.BOT_NAME, "Chrome", "1.0.0"],
    syncFullHistory: false,
    shouldSyncFullHistory: () => false,
    generateHighQualityLinkPreview: true,
    linkPreview: false,
    maxMsgRetryCount: 15,
    msgRetryCounterCache: new Map(),
    getMessage: async (key) => {
      const cached = msgCache.get(`${key.remoteJid}:${key.id}`);
      return cached?.message || proto.Message.fromObject({});
    },
  });

  // ── Cache every incoming message for antidelete ────────────────────────────
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    for (const msg of messages) {
      if (msg?.key?.id && msg?.message) {
        msgCache.set(`${msg.key.remoteJid}:${msg.key.id}`, msg);
        // Keep cache under 1000 messages
        if (msgCache.size > 1000) {
          msgCache.delete(msgCache.keys().next().value);
        }
      }
    }
    if (type !== "notify") return;
    for (const msg of messages) {
      if (!msg.message) continue;
      try {
        await handleMessage(sock, msg);
      } catch (err) {
        console.error("[ERROR]", err.message);
      }
    }
  });

  // ── Connection events ──────────────────────────────────────────────────────
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      const ownerJid = `${config.OWNER_NUMBER}@s.whatsapp.net`;
      console.log("╔══════════════════════════════════════════╗");
      console.log(`║  ✅  ${config.BOT_NAME} is now CONNECTED!  ║`);
      console.log("╚══════════════════════════════════════════╝");
      console.log(`   Owner : ${config.OWNER_NUMBER}`);
      console.log(`   Prefix: ${config.PREFIX}`);
      console.log(`   Time  : ${new Date().toLocaleString()}\n`);

      if (!isAlreadyOnline) {
        const now = new Date().toLocaleString("en-KE", { timeZone: "Africa/Nairobi" });
        await sock.sendMessage(ownerJid, {
          text:
            `╔══════════════════════╗\n` +
            `║  ⚡ *${config.BOT_NAME}*  ║\n` +
            `╚══════════════════════╝\n\n` +
            `✅ *Bot is now ONLINE!*\n\n` +
            `📱 *Number:* ${config.OWNER_NUMBER}\n` +
            `🕐 *Time:* ${now}\n` +
            `🔤 *Prefix:* ${config.PREFIX}\n\n` +
            `Type *${config.PREFIX}menu* to see all commands 🚀`,
        });
        isAlreadyOnline = true;
      }
    }

    if (connection === "close") {
      const error = lastDisconnect?.error;
      const code = new Boom(error)?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      const message = error?.message || "";

      console.log(`[${config.BOT_NAME}] Disconnected (code: ${code}, msg: ${message})`);
      
      // If the error looks like a Bad MAC or sync issue, we might want to wait longer or alert
      const isBadMAC = message.includes("Bad MAC") || message.includes("Key used already");
      
      if (loggedOut) {
        console.log("❌ Session expired. Update SESSION_ID in config.js and restart.");
        process.exit(1);
      } else {
        const delay = isBadMAC ? 15000 : 5000;
        if (isBadMAC) console.log("⚠️ Sync/MAC error detected. Increased delay to 15s to let server stabilize.");
        console.log(`🔄 Reconnecting in ${delay/1000} seconds...`);
        setTimeout(startBot, delay);
      }
    }
  });

  // ── Save credentials ───────────────────────────────────────────────────────
  sock.ev.on("creds.update", saveCreds);

  // ── Anti-Delete — always on ────────────────────────────────────────────────
  sock.ev.on("messages.delete", async (item) => {
    try {
      const keys = item.keys ?? [item];
      for (const key of keys) {
        if (!key?.id) continue;
        await handleAntiDelete(sock, key, msgCache);
      }
    } catch (err) {
      console.error("[ANTIDELETE EVENT]", err.message);
    }
  });
}

// ── Minimal Server for AI Studio Preview ─────────────────────────────────────
const app = express();
app.get("/", (req, res) => res.send(`${config.BOT_NAME} is active.`));
app.listen(3000, "0.0.0.0", () => {
  console.log("🚀 Health server running on port 3000");
});

// ── Fire up the bot ──────────────────────────────────────────────────────────
startBot().catch(err => {
  console.error("Critical Failure:", err);
  process.exit(1);
});
