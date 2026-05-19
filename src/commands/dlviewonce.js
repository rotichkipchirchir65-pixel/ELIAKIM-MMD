import { downloadContentFromMessage } from "@whiskeysockets/baileys";

export async function downloadViewOnceCmd(sock, msg, { jid }) {
  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  if (!quoted) return sock.sendMessage(jid, { text: "❌ Reply to a view-once message." });

  const voMsg = quoted.viewOnceMessage?.message || quoted.viewOnceMessageV2?.message;
  if (!voMsg) return sock.sendMessage(jid, { text: "❌ That is not a view-once message." });

  const media = voMsg.imageMessage || voMsg.videoMessage || voMsg.audioMessage;
  if (!media) return sock.sendMessage(jid, { text: "❌ No media found in this view-once." });

  try {
    const type = voMsg.imageMessage ? "image" : voMsg.videoMessage ? "video" : "audio";
    const stream = await downloadContentFromMessage(media, type);
    const chunks = [];
    for await (const c of stream) chunks.push(c);
    const buffer = Buffer.concat(chunks);

    if (type === "image") await sock.sendMessage(jid, { image: buffer, caption: "✅ View-Once Downloaded" }, { quoted: msg });
    else if (type === "video") await sock.sendMessage(jid, { video: buffer, caption: "✅ View-Once Downloaded" }, { quoted: msg });
    else await sock.sendMessage(jid, { audio: buffer, mimetype: "audio/mp4" }, { quoted: msg });
  } catch (err) {
    await sock.sendMessage(jid, { text: `❌ Failed: ${err.message}` });
  }
}
