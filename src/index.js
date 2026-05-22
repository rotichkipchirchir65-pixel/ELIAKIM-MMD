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

// ── Log history logger to stream log statements on the UI ───────────────────
const logHistory = [];
const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
  originalLog(...args);
  const line = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
  logHistory.push({ type: 'info', text: line, time: new Date().toLocaleTimeString() });
  if (logHistory.length > 50) logHistory.shift();
};

console.error = (...args) => {
  originalError(...args);
  const line = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
  logHistory.push({ type: 'error', text: line, time: new Date().toLocaleTimeString() });
  if (logHistory.length > 50) logHistory.shift();
};

let qrCodeData = null;
let botConnectionState = "DISCONNECTED"; // DISCONNECTED, CONNECTING, QR_AVAILABLE, PAIRING, CONNECTED
let pairingCode = null;
let generatedSessionString = null;

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

    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true });
    }

    // Try preloading already saved session string on initialization
    const credsPath = path.join(SESSION_DIR, "creds.json");
    if (fs.existsSync(credsPath)) {
      try {
        const credsData = fs.readFileSync(credsPath, "utf8");
        const parsed = JSON.parse(credsData);
        if (parsed && parsed.noiseKey) {
          generatedSessionString = "Ice~" + Buffer.from(credsData).toString("base64");
          botConnectionState = "CONNECTING";
        }
      } catch (_) {}
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
      printQRInTerminal: true,
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

      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        qrCodeData = qr;
        botConnectionState = "QR_AVAILABLE";
        pairingCode = null;
        console.log("📡 New WhatsApp QR Code is generated! Access Web dashboard to scan.");
      }

      if (connection === "connecting") {
        if (botConnectionState !== "PAIRING" && botConnectionState !== "QR_AVAILABLE") {
          botConnectionState = "CONNECTING";
        }
      }

      if (connection === "open") {
        botConnectionState = "CONNECTED";
        qrCodeData = null;
        pairingCode = null;
        consecutiveConflicts = 0; // reset on successful connection!
        consecutiveBadSessions = 0; // reset on successful connection!
        const ownerJid = `${config.OWNER_NUMBER}@s.whatsapp.net`;
        console.log("╔══════════════════════════════════════════╗");
        console.log(`║  ✅  ${config.BOT_NAME} is now CONNECTED!  ║`);
        console.log("╚══════════════════════════════════════════╝");
        console.log(`   Owner : ${config.OWNER_NUMBER}`);
        console.log(`   Prefix: ${config.PREFIX}`);
        console.log(`   Time  : ${new Date().toLocaleString()}\n`);

        // Generate copying session id!
        try {
          const credsPath = path.join(SESSION_DIR, "creds.json");
          if (fs.existsSync(credsPath)) {
            const credsData = fs.readFileSync(credsPath, "utf8");
            generatedSessionString = "Ice~" + Buffer.from(credsData).toString("base64");
          }
        } catch (e) {
          console.error("Could not construct copyable session ID:", e.message);
        }

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
        botConnectionState = "DISCONNECTED";
        qrCodeData = null;
        pairingCode = null;
        generatedSessionString = null;

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

        let delay = 5000;

        if (loggedOut) {
          console.log("❌ Session expired or logged out manually. Resetting credentials...");
          consecutiveBadSessions = 0;
          consecutiveConflicts = 0;
          if (fs.existsSync(SESSION_DIR)) {
            fs.rmSync(SESSION_DIR, { recursive: true, force: true });
          }
          fs.mkdirSync(SESSION_DIR, { recursive: true });
          delay = 2000;
        } else {
          if (isConflict) {
            consecutiveConflicts++;
            console.log(`⚠️ Stream conflict (code 440) detected (Attempt ${consecutiveConflicts}).`);
            
            if (consecutiveConflicts === 1) {
              delay = 15000;
              console.log("⚠️ First conflict detected. Waiting 15 seconds before reconnecting...");
            } else {
              delay = 30000;
              console.log("⚠️ Multiple conflicts. Waiting 30 seconds before reconnecting...");
            }
          } else if (isBadSessionOrMac) {
            consecutiveBadSessions++;
            console.log(`⚠️ Decryption/Bad MAC/Session error detected (Attempt ${consecutiveBadSessions}/3).`);
            
            if (consecutiveBadSessions >= 3) {
              console.log("⚠️ 3 consecutive bad session/decryption errors. Force healing the session now...");
              healSession();
              delay = 10000;
            } else {
              console.log("⚠️ Transient decryption/MAC error. Reconnecting in 5s...");
              delay = 5000;
            }
          } else {
            consecutiveConflicts = 0;
            consecutiveBadSessions = 0;
          }
        }

        console.log(`🔄 Reconnecting in ${delay/1000} seconds...`);
        reconnectTimer = setTimeout(startBot, delay);
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
app.use(express.json());

const dashboardHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.BOT_NAME} - Connection Hub</title>
  <script src="https://unpkg.com/@tailwindcss/browser@4"></script>
  <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
</head>
<body class="bg-[#0b0f19] text-[#e2e8f0] font-sans selection:bg-teal-500 selection:text-white p-4 md:p-8 min-h-screen">
  <div class="max-w-4xl mx-auto space-y-6">
    <!-- Header -->
    <header class="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-zinc-800 gap-4">
      <div>
        <h1 class="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-teal-400 to-emerald-500 bg-clip-text text-transparent">${config.BOT_NAME}</h1>
        <p class="text-zinc-500 text-sm mt-1">Status and Connection Control Hub</p>
      </div>
      <div class="flex items-center gap-3">
        <span id="status-badge" class="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 bg-zinc-800 text-zinc-400">
          <span class="h-2 w-2 rounded-full bg-zinc-505 bg-zinc-500 animate-pulse"></span>
          Checking...
        </span>
      </div>
    </header>

    <!-- Main Content Grid -->
    <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
      
      <!-- Connection Options (Left / Top) -->
      <div class="md:col-span-5 space-y-6">
        
        <!-- Status Card -->
        <div class="bg-[#111827] border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 class="text-lg font-bold text-teal-400 flex items-center gap-2">
            🔌 Authenticate Bot
          </h2>
          <p class="text-zinc-400 text-sm">
            Choose either QR code scanning or 8-digit Pairing Code to connect your phone.
          </p>

          <!-- QR Module -->
          <div id="qr-module" class="hidden flex flex-col items-center justify-center p-4 bg-[#1f2937] rounded-xl border border-zinc-700">
            <p class="text-[#e2e8f0] text-xs font-semibold mb-3 text-center">Scan QR code using WhatsApp Link Devices</p>
            <canvas id="qr-canvas" class="bg-white p-2 rounded shadow"></canvas>
            <p class="text-xs text-zinc-400 mt-2 text-center animate-pulse">QR refreshes automatically</p>
          </div>

          <!-- Pairing Code Module -->
          <div id="pairing-module" class="space-y-3">
            <div id="pairing-form" class="space-y-2">
              <label class="block text-xs font-medium text-zinc-400">Pair via Phone Number</label>
              <div class="flex gap-2">
                <input type="text" id="phone-number" placeholder="${config.OWNER_NUMBER}" class="bg-[#1f2937] border border-zinc-700 rounded-xl px-3 py-2 text-sm w-full outline-none focus:border-teal-500 text-[#f3f4f6]" />
                <button onclick="requestPairingCode()" id="pair-btn" class="bg-teal-600 hover:bg-teal-500 text-white font-bold py-2 px-4 rounded-xl text-sm transition shadow-lg transition-all duration-200 cursor-pointer">
                  Generate
                </button>
              </div>
              <p class="text-zinc-500 text-[11px]">Include country code, no "+" or spaces. e.g., ${config.OWNER_NUMBER}</p>
            </div>

            <!-- Custom code display -->
            <div id="displayed-code" class="hidden p-4 bg-[#1f2937] border-2 border-dashed border-teal-500 rounded-xl text-center space-y-1">
              <span class="text-xs text-zinc-400 block font-medium">WhatsApp Pairing Code:</span>
              <span id="numeric-code" class="text-3xl font-mono font-bold tracking-widest text-teal-300"></span>
            </div>
          </div>
          
          <!-- Connected Info -->
          <div id="connected-module" class="hidden bg-emerald-950/40 border border-emerald-800/80 rounded-xl p-4 text-center space-y-2 col-span-12">
            <span class="text-3xl">🎉</span>
            <h3 class="text-emerald-400 font-bold">Successfully Connected!</h3>
            <p class="text-zinc-400 text-xs">${config.BOT_NAME} is online and actively handling messages.</p>
          </div>
        </div>

        <!-- Session Copy Card -->
        <div id="session-card" class="bg-[#111827] border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 class="text-lg font-bold text-teal-400">📝 Generated Session ID</h2>
          <p class="text-zinc-400 text-xs">Here is your generated session ID credentials. Use this string as your <b>SESSION_ID</b> in <b>config.js</b> to auto-login permanently!</p>
          <div class="space-y-2">
            <textarea id="session-output" readonly rows="3" onclick="this.select()" class="w-full bg-[#1f2937] border border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono text-teal-300 resize-none outline-none focus:border-teal-500" placeholder="Awaiting connection..."></textarea>
            <button onclick="copySession()" id="copy-btn" class="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium py-2 rounded-xl text-xs transition duration-150 flex items-center justify-center gap-1 cursor-pointer">
              Copy Session ID
            </button>
          </div>
        </div>
      </div>

      <!-- Live Logs (Right / Bottom) -->
      <div class="md:col-span-7 space-y-4">
        <div class="bg-[#111827] border border-zinc-800 rounded-2xl p-6 shadow-xl flex flex-col h-[524px]">
          <div class="flex items-center justify-between pb-4 border-b border-zinc-800">
            <div class="flex items-center gap-2">
              <span class="h-2 w-2 rounded-full bg-teal-500"></span>
              <h2 class="text-sm font-bold uppercase tracking-wider text-teal-400">Live Terminal Console</h2>
            </div>
            <button onclick="clearSession()" class="text-[11px] text-rose-400 hover:text-rose-300 font-medium py-1 px-2.5 rounded-lg border border-rose-900/40 hover:bg-rose-950/20 transition cursor-pointer">
              Force Reconnect / Logout
            </button>
          </div>
          
          <!-- Terminal logs content -->
          <div id="terminal" class="flex-1 overflow-y-auto mt-4 font-mono text-xs space-y-2 p-3 bg-black/40 rounded-xl border border-zinc-900 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
            <!-- Populated dynamically -->
          </div>
        </div>
      </div>

    </div>
  </div>

  <script>
    let activeQR = null;
    let isConnected = false;

    async function updateState() {
      try {
        const response = await fetch('/api/state');
        if (!response.ok) return;
        const data = await response.json();

        // Update status badge
        const badge = document.getElementById('status-badge');
        let badgeHtml = '';
        if (data.status === 'CONNECTED') {
          badgeHtml = '<span class="h-2 w-2 rounded-full bg-emerald-505 bg-emerald-500 animate-pulse"></span> <span class="text-emerald-400">Online</span>';
        } else if (data.status === 'QR_AVAILABLE') {
          badgeHtml = '<span class="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span> <span class="text-amber-400">Awaiting Scan</span>';
        } else if (data.status === 'CONNECTING' || data.status === 'PAIRING') {
          badgeHtml = '<span class="h-2 w-2 rounded-full bg-teal-500 animate-spin"></span> <span class="text-teal-400">Connecting</span>';
        } else {
          badgeHtml = '<span class="h-2 w-2 rounded-full bg-rose-500"></span> <span class="text-rose-400">Offline</span>';
        }
        badge.innerHTML = badgeHtml;

        // Display connected info or option panels
        const qrModule = document.getElementById('qr-module');
        const displayedCode = document.getElementById('displayed-code');
        const connectedModule = document.getElementById('connected-module');
        const pairingForm = document.getElementById('pairing-form');
        const sessionOutput = document.getElementById('session-output');

        if (data.status === 'CONNECTED') {
          qrModule.classList.add('hidden');
          displayedCode.classList.add('hidden');
          pairingForm.classList.add('hidden');
          connectedModule.classList.remove('hidden');
          
          if (data.sessionString) {
            sessionOutput.value = data.sessionString;
          } else {
            sessionOutput.value = 'Offline - Session code is generated once connection completes.';
          }
          isConnected = true;
        } else {
          connectedModule.classList.add('hidden');
          pairingForm.classList.remove('hidden');
          sessionOutput.value = 'Offline - Awaiting connection credentials...';
          isConnected = false;

          if (data.status === 'QR_AVAILABLE' && data.qr) {
            qrModule.classList.remove('hidden');
            if (activeQR !== data.qr) {
              activeQR = data.qr;
              QRCode.toCanvas(document.getElementById('qr-canvas'), data.qr, { width: 180, margin: 1 }, function (error) {
                if (error) console.error(error);
              });
            }
          } else {
            qrModule.classList.add('hidden');
            activeQR = null;
          }

          if (data.pairingCode) {
            displayedCode.classList.remove('hidden');
            document.getElementById('numeric-code').innerText = data.pairingCode;
          } else {
            displayedCode.classList.add('hidden');
          }
        }

        // Display logs
        const terminal = document.getElementById('terminal');
        const wasAtBottom = terminal.scrollHeight - terminal.clientHeight <= terminal.scrollTop + 40;
        
        let logsHtml = '';
        data.logs.forEach(log => {
          const colorClass = log.type === 'error' ? 'text-rose-400' : 'text-zinc-300';
          logsHtml += '<div class="leading-relaxed"><span class="text-zinc-600 select-none">[' + log.time + ']</span> <span class="' + colorClass + '">' + escapeHtml(log.text) + '</span></div>';
        });
        terminal.innerHTML = logsHtml || '<div class="text-zinc-600 italic font-mono">No logs yet...</div>';

        if (wasAtBottom || terminal.scrollTop === 0) {
          terminal.scrollTop = terminal.scrollHeight;
        }

      } catch (err) {
        console.error('Error fetching state:', err);
      }
    }

    async function requestPairingCode() {
      const btn = document.getElementById('pair-btn');
      const input = document.getElementById('phone-number');
      const num = input.value.trim() || input.placeholder;
      if (!num) return alert('Please enter a phone number in international format.');

      btn.disabled = true;
      btn.innerText = 'Generating...';

      try {
        const response = await fetch('/api/pair', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber: num })
        });
        const data = await response.json();
        if (data.error) {
          alert('Error: ' + data.error);
        } else {
          document.getElementById('displayed-code').classList.remove('hidden');
          document.getElementById('numeric-code').innerText = data.code;
        }
      } catch (err) {
        alert('Exception: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.innerText = 'Generate';
        updateState();
      }
    }

    async function clearSession() {
      if (!confirm('Are you sure you want to log out and clear all credentials? This will restart the bot.')) return;
      try {
        const response = await fetch('/api/logout', { method: 'POST' });
        const data = await response.json();
        if (data.success) {
          alert('Session cleared. Restarting bot to await login...');
          updateState();
        } else {
          alert('Failed to clear session.');
        }
      } catch (err) {
        alert('Error: ' + err.message);
      }
    }

    function copySession() {
      const text = document.getElementById('session-output').value;
      if (!text || text.startsWith('Offline')) {
        alert('No active session credentials available. Please connect first.');
        return;
      }
      navigator.clipboard.writeText(text);
      
      const copyBtn = document.getElementById('copy-btn');
      copyBtn.innerText = 'Copied! ✅';
      copyBtn.classList.add('bg-teal-900', 'text-teal-200');
      setTimeout(() => {
        copyBtn.innerText = 'Copy Session ID';
        copyBtn.classList.remove('bg-teal-900', 'text-teal-200');
      }, 2000);
    }

    function escapeHtml(text) {
      return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    // Poll status index
    updateState();
    setInterval(updateState, 2000);
  </script>
</body>
</html>`;

app.get("/", (req, res) => {
  res.send(dashboardHtml);
});

app.get("/api/state", (req, res) => {
  res.json({
    status: botConnectionState,
    qr: qrCodeData,
    pairingCode: pairingCode,
    sessionString: generatedSessionString,
    owner: config.OWNER_NUMBER,
    botName: config.BOT_NAME,
    prefix: config.PREFIX,
    logs: logHistory
  });
});

app.post("/api/pair", async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) {
    return res.status(400).json({ error: "Phone number required" });
  }

  const cleanPhone = phoneNumber.replace(/[^0-9]/g, "");
  if (!cleanPhone || cleanPhone.length < 8) {
    return res.status(400).json({ error: "Invalid telephone number format. Must use international standard with country prefix, eg: 254739320033" });
  }

  if (!activeSock) {
    return res.status(500).json({ error: "WhatsApp Client Socket not active or initializing. Please wait a moment." });
  }

  try {
    console.log(`📲 Requesting Pairing Code for: ${cleanPhone}...`);
    botConnectionState = "PAIRING";
    const code = await activeSock.requestPairingCode(cleanPhone);
    pairingCode = code;
    console.log(`✅ Pairing Code successfully generated: ${code}`);
    res.json({ success: true, code });
  } catch (err) {
    console.error("❌ Error generating request pairing code:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/logout", async (req, res) => {
  try {
    isAlreadyOnline = false;
    botConnectionState = "DISCONNECTED";
    qrCodeData = null;
    pairingCode = null;
    generatedSessionString = null;

    console.log("🧹 Manual clean/logout request triggered. Restoring connection state...");

    if (activeSock) {
      try {
        activeSock.ev.removeAllListeners();
        activeSock.end();
      } catch (_) {}
      activeSock = null;
    }

    if (fs.existsSync(SESSION_DIR)) {
      fs.rmSync(SESSION_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(SESSION_DIR, { recursive: true });

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    // Trigger immediate new start
    setTimeout(() => {
      startBot().catch(err => console.error("Error restarted bot:", err.message));
    }, 1500);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, "0.0.0.0", () => {
  console.log("🚀 Connection Web Hub server is up and listening on port 3000!");
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
