const EMOJIS = ['🔥', '✨', '💖', '❤️', '💯', '👏', '🙌', '🥰', '😍', '🤩', '👍', '😎', '⚡', '🎉', '💥', '👻', '👑', '🌈', '🛸', '🎈', '🧸', '🍪', '🍕', '🥤', '🍷', '🥂', '👀', '💃', '🕺', '🥳', '🌟', '💎', '🚀'];

export async function handleStatusUpdate(sock, msg, botState) {
  if (botState?.autoStatusView === false) return;

  try {
    const key = msg.key;
    const participant = key.participant || key.remoteJid;

    // View/Read status update
    await sock.readMessages([key]);
    console.log(`[STATUS-VIEW] Auto-viewed status from: ${participant}`);

    // Dynamic random emoji reaction
    const randomEmoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];

    await sock.sendMessage("status@broadcast", {
      react: {
        key: key,
        text: randomEmoji
      }
    }, {
      statusJidList: [participant]
    });

    console.log(`[STATUS-REACT] Reacted with ${randomEmoji} to status from: ${participant}`);
  } catch (err) {
    console.error(`[STATUS-ERROR] Failed to view/react to status update:`, err.message);
  }
}
