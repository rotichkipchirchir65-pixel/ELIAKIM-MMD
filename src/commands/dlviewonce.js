export async function dlviewonce(client, msg, from, args) {
  await client.sendMessage(from, { text: 'Downloading the last view-once message...' }, { quoted: msg });
}
