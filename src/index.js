import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  proto
} from "@whiskeysockets/baileys";

import { Boom } from "@hapi/boom";
import pino from "pino";
import path from "path";
import express from "express";
import fs from "fs";

import config from "../config.js";
import { loadSession } from "./session.js";
import { handleMessage } from "./handler.js";
import { store as globalStore } from "./store.js";
import { handleAntiDelete } from "./features/antidelete.js";

const SESSION_DIR = path.join(process.cwd(), "bot-session");
const logger = pino({ level: "silent" });

// Load session from config.js dynamically before connection in startBot
async function healSession() {
  try {
    console.log("🧹 Healing session: completely clearing session directory and reloading clean credentials from configuration...");
    if (fs.existsSync(SESSION_DIR)) {
      fs.rmSync(SESSION_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(SESSION_DIR, { recursive: true });
    await loadSession();
    console.log("✅ Credentials successfully restored from config.js");
  } catch (err) {
    console.error("❌ Error healing session:", err.message);
  }
}

let isAlreadyOnline = false;
let activeSock = null;
let reconnectTimer = null;
let isReconnecting = false;
let isInitializing = false;
let consecutiveConflicts = 0;
let consecutiveBadSessions = 0;

export async function startBot() {
  if (isInitializing) {
    console.log("⚠️ startBot called while initialization already in progress. Ignoring duplicate call.");
    return;
  }
  isInitializing = true;
  isReconnecting = false;

  try {
    await loadSession();
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (activeSock) {
      console.log("🧹 Closing prior active socket to prevent leaks...");
      try {
        activeSock.ev.removeAllListeners();
        if (activeSock.ws) {
          try { activeSock.ws.close(); } catch (_) {}
        }
        activeSock.end();
      } catch (_) {}
      activeSock = null;
    }

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

    activeSock = sock;

    // ── Cache every incoming message for antidelete ────────────────────────────
    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (sock !== activeSock) return;
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
      if (sock !== activeSock) {
        console.log("⚠️ Ignoring connection update from an outdated/closed socket instance.");
        try {
          sock.ev.removeAllListeners();
          sock.end();
        } catch (_) {}
        return;
      }

      const { connection, lastDisconnect } = update;

      if (connection === "open") {
        isReconnecting = false;
        consecutiveConflicts = 0; // reset on successful connection!
        consecutiveBadSessions = 0; // reset on successful connection!
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
        if (isReconnecting) {
          console.log("⚠️ Reconnection already in progress. Ignoring duplicate close trigger.");
          return;
        }
        isReconnecting = true;

        // Clear closed active socket reference safely
        if (activeSock) {
          try {
            activeSock.ev.removeAllListeners();
          } catch (_) {}
          activeSock = null;
        }

        const error = lastDisconnect?.error;
        const code = error?.output?.statusCode || (error ? new Boom(error)?.output?.statusCode : null) || 500;
        const loggedOut = code === DisconnectReason.loggedOut;
        
        const message = error?.message || error?.toString() || "";
        const stack = error?.stack || "";
        const fullErrorStr = `${message} ${stack}`.toLowerCase();

        console.log(`[${config.BOT_NAME}] Disconnected (code: ${code}, msg: ${message})`);
        
        const isBadSessionOrMac = fullErrorStr.includes("bad mac") || 
                                  fullErrorStr.includes("key used already") || 
                                  fullErrorStr.includes("decrypt") || 
                                  fullErrorStr.includes("session") ||
                                  code === DisconnectReason.badSession ||
                                  code === DisconnectReason.multideviceMismatch;
        const isConflict = fullErrorStr.includes("conflict") || 
                           code === 440 || 
                           code === DisconnectReason.connectionReplaced;

        if (loggedOut) {
          console.log("❌ Session expired. Update SESSION_ID in config.js and restart.");
          process.exit(1);
        } else {
          let delay = 5000;
          
          if (isConflict) {
            consecutiveConflicts++;
            console.log(`⚠️ Stream conflict (code 440) detected (Attempt ${consecutiveConflicts}).`);
            
            if (consecutiveConflicts === 1) {
              delay = 45000;
              console.log("⚠️ First conflict detected. Waiting 45 seconds before reconnecting (leaving session files intact)...");
            } else if (consecutiveConflicts === 2) {
              delay = 90000;
              console.log("⚠️ Second consecutive conflict. Waiting 90 seconds before reconnecting (leaving session files intact)...");
            } else if (consecutiveConflicts === 3) {
              delay = 180000;
              console.log("⚠️ Third consecutive conflict. Waiting 180 seconds before reconnecting (leaving session files intact)...");
            } else {
              delay = 300000;
              console.log("⚠️ Multiple consecutive conflicts. Waiting 5 minutes before reconnecting (leaving session files intact)...");
            }
          } else if (isBadSessionOrMac) {
            consecutiveBadSessions++;
            console.log(`⚠️ Decryption/Bad MAC/Session error detected (Attempt ${consecutiveBadSessions}/3).`);
            
            if (consecutiveBadSessions >= 3) {
              console.log("⚠️ 3 consecutive bad session/decryption errors. Force healing the session now...");
              healSession();
              delay = 20000;
            } else {
              console.log("⚠️ Transient decryption/MAC error. Reconnecting in 10s with session files intact to let pre-keys synchronize...");
              delay = 10000;
            }
          } else {
            consecutiveConflicts = 0;
            consecutiveBadSessions = 0;
          }

          console.log(`🔄 Reconnecting in ${delay/1000} seconds...`);
          reconnectTimer = setTimeout(startBot, delay);
        }
      }
    });

    // ── Save credentials ───────────────────────────────────────────────────────
    sock.ev.on("creds.update", async () => {
      if (sock !== activeSock) return;
      await saveCreds();
    });

    // ── Anti-Delete — always on ────────────────────────────────────────────────
    sock.ev.on("messages.delete", async (item) => {
      if (sock !== activeSock) return;
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

  } catch (err) {
    console.error("❌ Exception during startBot initialization:", err);
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(startBot, 10000);
    }
  } finally {
    isInitializing = false;
  }
}

// ── Minimal Server for AI Studio Preview ─────────────────────────────────────
const app = express();
app.get("/", (req, res) => res.send(`${config.BOT_NAME} is active.`));
app.listen(3000, "0.0.0.0", () => {
  console.log("🚀 Health server running on port 3000");
});

// ── Process Crash & Error Isolation Safeguards ──────────────────────────────
process.on("unhandledRejection", (reason) => {
  console.error("[Unhandled Rejection]", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[Uncaught Exception]", err);
});

// ── Fire up the bot ──────────────────────────────────────────────────────────
startBot().catch(err => {
  console.error("Critical Failure:", err);
  process.exit(1);
});
