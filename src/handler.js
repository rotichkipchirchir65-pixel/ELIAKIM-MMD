import config from "../config.js";
import { antilinkCheck } from "./features/antilink.js";
import { antiStatusMentionCheck } from "./features/antistatusmention.js";
import { handleViewOnce } from "./features/viewonce.js";
import { handleCommand } from "./commands/index.js";
import { handleStatusUpdate } from "./features/autostatus.js";

export const botState = {
  alwaysTyping: true,
  privateMode: true,
  antilink: true,
  antiStatusMention: true,
  antiViewOnce: true,
  autoStatusView: true,
  blockedUsers: new Set(),
};

export function getSender(msg, sock) {
  if (msg.key?.fromMe) {
    const botId = sock?.user?.id ? sock.user.id.split(":")[0] + "@s.whatsapp.net" : (msg.key.remoteJid || "");
    return botId;
  }
  return msg.key?.participant || msg.key?.remoteJid || "";
}

export function isOwner(msg, sock) {
  if (msg.key?.fromMe) return true;

  const senderJid = msg.key?.participant || msg.message?.extendedTextMessage?.contextInfo?.participant || msg.key?.remoteJid || "";
  const sender = senderJid.replace(/\D/g, "");
  const owner = config.OWNER_NUMBER.replace(/\D/g, "");

  const botJid = sock?.user?.id ? sock.user.id.split(":")[0] : "";
  const botNum = botJid.replace(/\D/g, "");

  if (sender) {
    if (owner && (sender === owner || sender.endsWith(owner) || owner.endsWith(sender))) {
      return true;
    }
    if (botNum && (sender === botNum || sender.endsWith(botNum) || botNum.endsWith(sender))) {
      return true;
    }
  }

  return false;
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
  if (jid === "status@broadcast") {
    await handleStatusUpdate(sock, msg, botState);
    return;
  }

  const sender = getSender(msg, sock);
  const body = getBody(msg);
  const owner = isOwner(msg, sock);
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
