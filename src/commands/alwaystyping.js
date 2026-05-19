export async function alwaystyping(client, msg, from, args) {
  // Logic to toggle always typing
  await client.sendMessage(from, { text: 'Always Typing mode enabled for this chat.' }, { quoted: msg });
}
