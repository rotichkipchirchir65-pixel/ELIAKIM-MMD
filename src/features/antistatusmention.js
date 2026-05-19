export async function antiStatusMentionCheck(sock, msg, botState) {
  if (!botState.antiStatusMention) return;
  const jid = msg.key.remoteJid;
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  if (ctx?.remoteJid !== "status@broadcast") return;
  const sender = msg.key.participant || msg.key.remoteJid;
  try { await sock.sendMessage(jid, { delete: msg.key }); } catch (_) {}
  await sock.sendMessage(jid, { text: `📢 @${sender.split("@")[0]} — no status mentions here!`, mentions: [sender] });
}
