import fs from "fs";
import zlib from "zlib";
import path from "path";
import config from "../config.js";

const SESSION_DIR = path.join(process.cwd(), "bot-session");

export function loadSession() {
  let raw = config.SESSION_ID?.trim();

  if (!raw || raw === "PASTE_YOUR_SESSION_ID_HERE") {
    console.log("❌ SESSION ID NOT SET IN config.js");
    process.exit(1);
  }

  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }

  try {
    // ── Strip known prefixes (KnightBot!, Baileys-, etc.) ──────────────────
    const prefixMatch = raw.match(/^[A-Za-z]+[!_-]/);
    if (prefixMatch) {
      raw = raw.slice(prefixMatch[0].length);
      console.log(`✅ Detected session prefix: ${prefixMatch[0]} — stripped.`);
    }

    // ── Decode base64 ──────────────────────────────────────────────────────
    const buf = Buffer.from(raw, "base64");

    // ── Try gzip decompress first (KnightBot uses gzip) ───────────────────
    let jsonStr;
    try {
      jsonStr = zlib.gunzipSync(buf).toString("utf8");
    } catch {
      // Not gzipped — use raw buffer as UTF-8
      jsonStr = buf.toString("utf8");
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

    console.log("✅ Session loaded successfully.");

  } catch (err) {
    console.error("❌ Failed to decode SESSION_ID:", err.message);
    console.error("   Check that you pasted the full session string in config.js");
    process.exit(1);
  }
}
