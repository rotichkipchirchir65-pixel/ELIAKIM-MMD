import config from "../../config.js";
const P = config.PREFIX;

export async function helpCmd(sock, msg, { jid }) {
  await sock.sendMessage(jid, {
    text:
`╔══════════════════════╗
║  ⚡ *${config.BOT_NAME} — MENU*  ║
╚══════════════════════╝

🛠 *UTILITY*
▸ ${P}ping — Bot speed test
▸ ${P}menu — This menu
▸ ${P}owner — Owner info

👑 *OWNER ONLY*
▸ ${P}block @user — Block user
▸ ${P}unblock @user — Unblock user
▸ ${P}private on/off — DMs for owner only
▸ ${P}alwaystyping on/off — Always appear typing
▸ ${P}antilink on/off — Deletes all links globally
▸ ${P}antistatusmention on/off — Deletes status forwards
▸ ${P}antiviewonce on/off — Auto-save view-once

👥 *GROUP MANAGEMENT*
▸ ${P}kick — Reply to a message to remove user (Admin only)

👁️ *VIEW-ONCE*
▸ ${P}dlviewonce — Reply to view-once to save it

📥 *DOWNLOADS*
▸ ${P}yt <url> — YouTube → MP3
▸ ${P}ytmp4 <url> — YouTube → MP4 (max 10min)

━━━━━━━━━━━━━━━━━━━━━━
_Powered by ${config.BOT_NAME}_`
  });
}
