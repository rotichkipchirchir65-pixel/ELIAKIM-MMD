export async function pingCmd(sock, msg, { jid }) {
  const t = Date.now();
  await sock.sendMessage(jid, { text: "🏓 Pong!" });
  await sock.sendMessage(jid, { text: `⚡ *${Date.now() - t}ms*` });
}
