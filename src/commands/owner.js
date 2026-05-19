import config from "../../config.js";
export async function ownerCmd(sock, msg, { jid }) {
  const ownerJid = `${config.OWNER_NUMBER}@s.whatsapp.net`;
  await sock.sendMessage(jid, {
    text: `👑 *BOT OWNER*\n\n📱 +${config.OWNER_NUMBER}`,
    mentions: [ownerJid],
  });
}
