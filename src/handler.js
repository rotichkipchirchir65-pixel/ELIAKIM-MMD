import config from "../config.js";
import { antilinkCheck } from "./features/antilink.js";
import { antiStatusMentionCheck } from "./features/antistatusmention.js";
import { handleViewOnce } from "./features/viewonce.js";
import { handleCommand } from "./commands/index.js";

export const botState = {
  alwaysTyping: false,
  privateMode: false,
  antilinkGroups: new Set(),
  antiStatusMention: new Set(),
  antiViewOnce: false,
  blockedUsers: new Set(),
};

export function getSender(msg) {
  return msg.key.participant || msg.key.remoteJid;
}

export function isOwner(msg) {
  // fromMe = message sent by the bot's own number (owner messaging themselves)
  if (msg.key.fromMe) return true;

  // Also check if sender number matches OWNER_NUMBER
  const sender = getSender(msg).replace(/\D/g, "");
  const owner = config.OWNER_NUMBER.replace(/\D/g, "");
  return sender === owner || sender.endsWith(owner) || owner.endsWith(sender);
}

export function isGroup(msg) {
  return msg.key.remoteJid.endsWith("@g.us");
}

export function getBody(msg) {
  return (
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    ""
  );
}

export async function handleMessage(sock, msg) {
  const jid = msg.key.remoteJid;
  if (jid === "status@broadcast") return;

  const sender = getSender(msg);
  const body = getBody(msg);
  const owner = isOwner(msg);
  const inGroup = isGroup(msg);

  if (botState.blockedUsers.has(sender)) return;
  if (botState.privateMode && !inGroup && !owner) return;

  if (botState.alwaysTyping) {
    await sock.sendPresenceUpdate("composing", jid).catch(() => {});
  }

  if (inGroup) {
    const blocked = await antilinkCheck(sock, msg, botState);
    if (blocked) return;
    await antiStatusMentionCheck(sock, msg, botState);
  }

  await handleViewOnce(sock, msg, botState);

  if (!body.startsWith(config.PREFIX)) return;

  const args = body.slice(config.PREFIX.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  await handleCommand(sock, msg, { command, args, jid, sender, owner, inGroup, body });
}
