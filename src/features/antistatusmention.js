import config from "../../config.js";

export async function antiStatusMentionCheck(sock, msg, botState) {
  if (!botState.antiStatusMention) return;
  const jid = msg.key.remoteJid;
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  if (ctx?.remoteJid !== "status@broadcast") return;

  // Don't act on bot's own or owner's posts
  if (msg.key.fromMe) return;

  const sender = msg.key.participant || msg.key.remoteJid;
  const senderNumber = sender.replace(/\D/g, "");
  const ownerNumber = config.OWNER_NUMBER.replace(/\D/g, "");

  if (senderNumber === ownerNumber || senderNumber.endsWith(ownerNumber) || ownerNumber.endsWith(senderNumber)) {
    return;
  }

  // Admin bypass
  try {
    const groupMetadata = await sock.groupMetadata(jid);
    const admins = groupMetadata.participants
      .filter(p => p.admin === "admin" || p.admin === "superadmin")
      .map(p => p.id);
    if (admins.includes(sender)) return;
  } catch (_) {}

  try { await sock.sendMessage(jid, { delete: msg.key }); } catch (_) {}
  await sock.sendMessage(jid, { text: `📢 @${sender.split("@")[0]} — no status mentions here!`, mentions: [sender] });
}

