export async function block(client, msg, from, args) {
  if (!msg.key.remoteJid.endsWith('@s.whatsapp.net')) return; // Only for private chats
  await client.updateBlockStatus(from, "block");
  await client.sendMessage(from, { text: 'You have been blocked.' });
}
