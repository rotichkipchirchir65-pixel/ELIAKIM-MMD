let _store = null;
export const store = { set: (s) => { _store = s; }, get: () => _store };
const LINK_REGEX = /(https?:\/\/[^\s]+|wa\.me\/[^\s]+|chat\.whatsapp\.com\/[^\s]+)/gi;
const strikes = new Map();

export async function antilinkCheck(sock, msg, botState) {
  const jid = msg.key.remoteJid;
  if (!botState.antilinkGroups.has(jid)) return false;
  const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || "";
  if (!LINK_REGEX.test(text)) return false;

  const sender = msg.key.participant || msg.key.remoteJid;
  const k = `${jid}:${sender}`;
  const count = (strikes.get(k) || 0) + 1;
  strikes.set(k, count);

  try { await sock.sendMessage(jid, { delete: msg.key }); } catch (_) {}

  if (count >= 3) {
    strikes.delete(k);
    try {
      await sock.groupParticipantsUpdate(jid, [sender], "remove");
      await sock.sendMessage(jid, { text: `🚫 @${sender.split("@")[0]} removed for sending 3 links.`, mentions: [sender] });
    } catch {
      await sock.sendMessage(jid, { text: `⚠️ @${sender.split("@")[0]} hit 3 strikes — make me *admin* to remove them!`, mentions: [sender] });
    }
  } else {
    await sock.sendMessage(jid, { text: `⚠️ @${sender.split("@")[0]} — no links allowed!\n🟡 Strike *${count}/3* — ${3-count} more = removed.`, mentions: [sender] });
  }
  return true;
}
