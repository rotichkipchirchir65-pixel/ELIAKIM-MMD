import { downloadContentFromMessage } from "@whiskeysockets/baileys";
import config from "../../config.js";

export async function handleViewOnce(sock, msg, botState) {
  if (!botState.antiViewOnce) return;
  const voMsg = msg.message?.viewOnceMessage?.message || msg.message?.viewOnceMessageV2?.message;
  if (!voMsg) return;
  const voImage = voMsg.imageMessage;
  const voVideo = voMsg.videoMessage;
  const voAudio = voMsg.audioMessage;
  const media = voImage || voVideo || voAudio;
  if (!media) return;

  const ownerJid = `${config.OWNER_NUMBER}@s.whatsapp.net`;
  const sender = msg.key.participant || msg.key.remoteJid;
  try {
    const type = voImage ? "image" : voVideo ? "video" : "audio";
    const stream = await downloadContentFromMessage(media, type);
    const chunks = [];
    for await (const c of stream) chunks.push(c);
    const buffer = Buffer.concat(chunks);
    const caption = `👁️ *View-Once captured*\nFrom: @${sender.split("@")[0]}`;
    if (type === "image") await sock.sendMessage(ownerJid, { image: buffer, caption });
    else if (type === "video") await sock.sendMessage(ownerJid, { video: buffer, caption });
    else await sock.sendMessage(ownerJid, { audio: buffer, mimetype: "audio/mp4" });
  } catch (err) {
    console.error("[VIEWONCE]", err.message);
  }
}
