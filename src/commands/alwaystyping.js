import { botState } from "../handler.js";

export async function privateCmd(sock, msg, { jid, args, owner }) {
  if (!owner) return sock.sendMessage(jid, { text: "❌ Owner only." });
  const on = (args[0] || "").toLowerCase() === "on";
  botState.privateMode = on;
  await sock.sendMessage(jid, { text: `🔒 Private Mode *${on ? "ON" : "OFF"}*` });
}

export async function alwaysTypingCmd(sock, msg, { jid, args, owner }) {
  if (!owner) return sock.sendMessage(jid, { text: "❌ Owner only." });
  const on = (args[0] || "").toLowerCase() === "on";
  botState.alwaysTyping = on;
  await sock.sendMessage(jid, { text: `⌨️ Always Typing *${on ? "ON" : "OFF"}*` });
}

export async function antilinkCmd(sock, msg, { jid, args, owner }) {
  if (!owner) return sock.sendMessage(jid, { text: "❌ Owner only." });
  const on = (args[0] || "").toLowerCase() === "on";
  botState.antilink = on;
  await sock.sendMessage(jid, { text: `🔗 Anti-Link *${on ? "ON" : "OFF"}* — Global` });
}

export async function antiStatusMentionCmd(sock, msg, { jid, args, owner }) {
  if (!owner) return sock.sendMessage(jid, { text: "❌ Owner only." });
  const on = (args[0] || "").toLowerCase() === "on";
  botState.antiStatusMention = on;
  await sock.sendMessage(jid, { text: `📢 Anti-Status-Mention *${on ? "ON" : "OFF"}* — Global` });
}

export async function antiViewOnceCmd(sock, msg, { jid, args, owner }) {
  if (!owner) return sock.sendMessage(jid, { text: "❌ Owner only." });
  const on = (args[0] || "").toLowerCase() === "on";
  botState.antiViewOnce = on;
  await sock.sendMessage(jid, { text: `👁️ Anti-View-Once *${on ? "ON" : "OFF"}*` });
}

export async function autoStatusCmd(sock, msg, { jid, args, owner }) {
  if (!owner) return sock.sendMessage(jid, { text: "❌ Owner only." });
  const on = (args[0] || "").toLowerCase() === "on";
  botState.autoStatusView = on;
  await sock.sendMessage(jid, { text: `📲 Auto Status View & React *${on ? "ON" : "OFF"}*` });
}
