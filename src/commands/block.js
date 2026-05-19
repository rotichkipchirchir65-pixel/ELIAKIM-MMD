export async function blockCmd(sock, msg, { jid, sender, owner, args }) {
  if (!owner) return sock.sendMessage(jid, { text: "❌ Owner only." });
  const user = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || (args[0] ? args[0].replace(/\D/g, "") + "@s.whatsapp.net" : null);
  if (!user) return sock.sendMessage(jid, { text: "❌ Tag a user or provide a number." });
  await sock.updateBlockStatus(user, "block");
  await sock.sendMessage(jid, { text: `✅ Blocked @${user.split("@")[0]}`, mentions: [user] });
}

export async function unblockCmd(sock, msg, { jid, owner, args }) {
  if (!owner) return sock.sendMessage(jid, { text: "❌ Owner only." });
  const user = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || (args[0] ? args[0].replace(/\D/g, "") + "@s.whatsapp.net" : null);
  if (!user) return sock.sendMessage(jid, { text: "❌ Tag a user or provide a number." });
  await sock.updateBlockStatus(user, "unblock");
  await sock.sendMessage(jid, { text: `✅ Unblocked @${user.split("@")[0]}`, mentions: [user] });
}
