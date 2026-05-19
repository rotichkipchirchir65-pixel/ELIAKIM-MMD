export async function viewOnce(client, msg, from) {
  const type = Object.keys(msg.message)[0];
  if (type === 'viewOnceMessage' || type === 'viewOnceMessageV2') {
    console.log(`[VIEWONCE] Detected view-once message from ${from}`);
    // Logic: Resend the media to the bot owner or back to the chat
    // const media = msg.message[type].message;
    // await client.sendMessage(config.OWNER_NUMBER + '@s.whatsapp.net', { ...media });
  }
}
