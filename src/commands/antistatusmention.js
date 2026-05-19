export async function antistatusmention(client, msg, from, args) {
  await client.sendMessage(from, { text: 'Anti-Status Mention mode updated.' }, { quoted: msg });
}
