export async function antiLink(client, msg, from) {
  const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
  if (body.includes("chat.whatsapp.com/")) {
    console.log(`[ANTILINK] Detected link from ${from}`);
    // Logic: Delete message or kick user (requires admin)
    // await client.sendMessage(from, { delete: msg.key });
  }
}
