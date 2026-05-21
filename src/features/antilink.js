import config from "../../config.js";

let _store = null;
export const store = { set: (s) => { _store = s; }, get: () => _store };
const LINK_REGEX = /(https?:\/\/[^\s]+|wa\.me\/[^\s]+|chat\.whatsapp\.com\/[^\s]+)/gi;
const strikes = new Map();

export async function antilinkCheck(sock, msg, botState) {
  if (!botState.antilink) return false;
  const jid = msg.key.remoteJid;
  const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || "";
  if (!LINK_REGEX.test(text)) return false;

  // Don't delete owner or bot messages
  if (msg.key.fromMe) return false;

  const sender = msg.key.participant || msg.key.remoteJid;
  const senderNumber = sender.replace(/\D/g, "");
  const ownerNumber = config.OWNER_NUMBER.replace(/\D/g, "");

  if (senderNumber === ownerNumber || senderNumber.endsWith(ownerNumber) || ownerNumber.endsWith(senderNumber)) {
    return false;
  }

  // Admin check
  try {
    const groupMetadata = await sock.groupMetadata(jid);
    const admins = groupMetadata.participants
      .filter(p => p.admin === "admin" || p.admin === "superadmin")
      .map(p => p.id);
    if (admins.includes(sender)) return false;
  } catch (_) {}

  try { 
    await sock.sendMessage(jid, { delete: msg.key }); 
    await sock.sendMessage(jid, { text: `🚫 @${sender.split("@")[0]} — no links allowed!`, mentions: [sender] });
  } catch (_) {}
  
  return true;
}

