import fs from "fs";
import zlib from "zlib";
import path from "path";
import axios from "axios";
import config from "../config.js";

const SESSION_DIR = path.join(process.cwd(), "bot-session");

function cleanSessionDir() {
  try {
    if (fs.existsSync(SESSION_DIR)) {
      fs.rmSync(SESSION_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  } catch (_) {}
}

export async function loadSession() {
  let raw = config.SESSION_ID?.trim();

  if (!raw || raw === "PASTE_YOUR_SESSION_ID_HERE" || raw === "Ice~") {
    console.log("💡 No valid custom SESSION_ID configured in config.js. Starting bot in authentication setup mode (QR/Pairing Code)...");
    cleanSessionDir();
    return;
  }

  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }

  const lastSessionFile = path.join(SESSION_DIR, ".last_session_id");
  const credsPath = path.join(SESSION_DIR, "creds.json");

  // If session folder and creds exist, and session ID is unchanged, skip overwriting
  if (fs.existsSync(credsPath) && fs.existsSync(lastSessionFile)) {
    try {
      const lastSessionId = fs.readFileSync(lastSessionFile, "utf8").trim();
      if (lastSessionId === raw) {
        console.log("✅ Using existing authenticated session (matching SESSION_ID).");
        return;
      }
    } catch (_) {}
  }

  // ── Remote Session Fetching for Short Codes (like Ice~B3Q7OW) ────────────
  const cleanId = raw.includes("~") ? raw.split("~")[1].trim() : raw;
  const isShortCode = cleanId.length < 30; // Real short codes are small (6-12 chars)

  if (isShortCode) {
    console.log(`📡 Short or prefixed Session ID detected ("${raw}"). Resolving credentials remotely...`);
    
    const endpoints = [
      `https://pastecode.dev/api/paste/${cleanId}/raw`,
      `https://pastecode.dev/view/raw/${cleanId}`,
      `https://pastecode.dev/raw/${cleanId}`,
      `https://pastecode.dev/s/${cleanId}/raw`,
      `https://rentry.co/${cleanId}/raw`,
      `https://pastebin.com/raw/${cleanId}`,
      `https://api.giftedtechnexus.co.ke/api/session/decrypt?session_id=${cleanId}`,
      `https://apiv2.giftedtechnexus.co.ke/api/session/decrypt?session_id=${cleanId}`,
      `https://wasi-uploader.onrender.com/session?id=${cleanId}`,
      `https://api.asta.my.id/get-session?id=${cleanId}`,
      `https://session.asta.my.id/get-session?id=${cleanId}`
    ];

    let fetchedContent = null;
    for (const url of endpoints) {
      try {
        const response = await axios.get(url, { 
          timeout: 5000,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "Accept": "text/plain,application/json,application/octet-stream,*/*"
          }
        });
        if (response.data) {
          let dataStr = "";
          if (typeof response.data === "object") {
            dataStr = JSON.stringify(response.data);
          } else {
            dataStr = response.data.toString().trim();
          }

          if (dataStr && dataStr.length > 20) {
            fetchedContent = dataStr;
            console.log(`✅ Success! Downloaded session credentials from remote source: ${url}`);
            break;
          }
        }
      } catch (e) {
        // Silently try next endpoint to avoid polluting the terminal console with 10 lines of 404 warning logs
      }
    }

    if (fetchedContent) {
      raw = fetchedContent;
    } else {
      console.warn(`⚠️ Warning: Session ID "${config.SESSION_ID}" could not be resolved from any remote endpoint (all servers returned 404 or were unreachable).`);
      console.log("💡 The session code might be expired or invalid. Ready you to scan QR or use Pairing Code on the Connection Hub dashboard!");
      cleanSessionDir();
      return;
    }
  }

  try {
    // ── Strip known prefixes (KnightBot!, Baileys-, Ice~, etc.) ─────────────
    const prefixMatch = raw.match(/^[A-Za-z0-9]+[!_~-]/);
    if (prefixMatch) {
      raw = raw.slice(prefixMatch[0].length);
      console.log(`✅ Detected session prefix: ${prefixMatch[0]} — stripped.`);
    }

    // ── Decode base64 ──────────────────────────────────────────────────────
    let buf;
    try {
      buf = Buffer.from(raw, "base64");
    } catch (_) {
      buf = Buffer.from(raw, "utf8");
    }

    // ── Try gzip decompress first (KnightBot uses gzip) ───────────────────
    let jsonStr;
    try {
      jsonStr = zlib.gunzipSync(buf).toString("utf8");
    } catch {
      // Not gzipped — use raw buffer as UTF-8
      jsonStr = buf.toString("utf8");
      if (!jsonStr.trim().startsWith("{") && !jsonStr.trim().startsWith("[")) {
        jsonStr = raw; // Default to raw string in case buffer decoding changed it
      }
    }

    const decoded = JSON.parse(jsonStr);

    // ── Write session files ────────────────────────────────────────────────
    if (typeof decoded === "object" && decoded !== null) {
      if (!decoded.noiseKey) {
        // It's a map of filename → content
        for (const [name, content] of Object.entries(decoded)) {
          const data = typeof content === "string" ? content : JSON.stringify(content);
          fs.writeFileSync(path.join(SESSION_DIR, name), data, "utf8");
        }
      } else {
        // It's a raw creds.json object
        fs.writeFileSync(
          path.join(SESSION_DIR, "creds.json"),
          JSON.stringify(decoded, null, 2),
          "utf8"
        );
      }
    }

    fs.writeFileSync(lastSessionFile, config.SESSION_ID, "utf8");
    console.log("✅ Credentials loaded and prepared successfully.");

  } catch (err) {
    console.warn("⚠️ Failed to parse or decode SESSION_ID credentials:", err.message);
    console.log("💡 Preparing clean authentication setup (QR/Pairing Code)...");
    cleanSessionDir();
  }
}
