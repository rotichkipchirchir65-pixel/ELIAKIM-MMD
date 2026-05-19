export async function ping(client, msg, from, args) {
  const start = Date.now();
  await client.sendMessage(from, { text: 'Pinging...' }, { quoted: msg });
  const latency = Date.now() - start;
  await client.sendMessage(from, { text: `Pong! 🏓\nLatency: ${latency}ms` }, { quoted: msg });
}
