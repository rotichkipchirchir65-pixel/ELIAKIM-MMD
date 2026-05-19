export async function antilink(client, msg, from, args) {
  await client.sendMessage(from, { text: 'Anti-Link mode has been updated for this group.' }, { quoted: msg });
}
