import Baileys from "@whiskeysockets/baileys";
const { downloadContentFromMessage, getContentType } = Baileys.default || Baileys;
import config from "../../config.js";

const ownerJid = `${config.OWNER_NUMBER}@s.whatsapp.net`;

export async function handleAntiDelete(sock, deletedKey, msgCache) {
  try {
    // Look up original message from the cache
    const original = msgCache.get(`${deletedKey.remoteJid}:${deletedKey.id}`);
    if (!original || !original.message) return;

    // Don't report owner's own deletions
    const sender = original.key.participant || original.key.remoteJid;
    if (sender.replace(/\D/g, "") === config.OWNER_NUMBER.replace(/\D/g, "")) return;

    // Don't report bot's own messages
    if (original.key.fromMe) return;

    const chatJid = deletedKey.remoteJid;
    const isGroup = chatJid.endsWith("@g.us");
    const senderNum = sender.replace(/\D/g, "");
    const chatTag = isGroup ? `Group: ${chatJid.split("@")[0]}` : `DM`;
    const time = new Date().toLocaleString("en-KE", { timeZone: "Africa/Nairobi" });

    const header =
      `🗑️ *DELETED MESSAGE CAUGHT*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 *From:* +${senderNum}\n` +
      `💬 *Chat:* ${chatTag}\n` +
      `🕐 *Time:* ${time}\n` +
      `━━━━━━━━━━━━━━━━━━━━`;

    const msgType = getContentType(original.message);

    // TEXT
    if (msgType === "conversation" || msgType === "extendedTextMessage") {
      const text = original.message.conversation || original.message.extendedTextMessage?.text || "(empty)";
      await sock.sendMessage(ownerJid, { text: `${header}\n\n💬 *Message:*\n${text}` });
      return;
    }

    // IMAGE
    if (msgType === "imageMessage") {
      const media = original.message.imageMessage;
      const caption = media.caption ? `\n\n📝 *Caption:* ${media.caption}` : "";
      try {
        const stream = await downloadContentFromMessage(media, "image");
        const chunks = [];
        for await (const c of stream) chunks.push(c);
        await sock.sendMessage(ownerJid, { image: Buffer.concat(chunks), caption: `${header}${caption}` });
      } catch {
        await sock.sendMessage(ownerJid, { text: `${header}\n\n🖼️ *Deleted an image*${caption}` });
      }
      return;
    }

    // VIDEO
    if (msgType === "videoMessage") {
      const media = original.message.videoMessage;
      const caption = media.caption ? `\n\n📝 *Caption:* ${media.caption}` : "";
      try {
        const stream = await downloadContentFromMessage(media, "video");
        const chunks = [];
        for await (const c of stream) chunks.push(c);
        await sock.sendMessage(ownerJid, { video: Buffer.concat(chunks), caption: `${header}${caption}` });
      } catch {
        await sock.sendMessage(ownerJid, { text: `${header}\n\n🎬 *Deleted a video*${caption}` });
      }
      return;
    }

    // AUDIO / VOICE NOTE
    if (msgType === "audioMessage") {
      const media = original.message.audioMessage;
      const label = media.ptt ? "🎤 Voice note" : "🎵 Audio";
      try {
        const stream = await downloadContentFromMessage(media, "audio");
        const chunks = [];
        for await (const c of stream) chunks.push(c);
        await sock.sendMessage(ownerJid, { text: `${header}\n\n${label} deleted:` });
        await sock.sendMessage(ownerJid, { audio: Buffer.concat(chunks), mimetype: "audio/mp4", ptt: !!media.ptt });
      } catch {
        await sock.sendMessage(ownerJid, { text: `${header}\n\n${label} deleted (could not retrieve)` });
      }
      return;
    }

    // STICKER
    if (msgType === "stickerMessage") {
      const media = original.message.stickerMessage;
      try {
        const stream = await downloadContentFromMessage(media, "sticker");
        const chunks = [];
        for await (const c of stream) chunks.push(c);
        await sock.sendMessage(ownerJid, { text: `${header}\n\n🎭 *Deleted a sticker:*` });
        await sock.sendMessage(ownerJid, { sticker: Buffer.concat(chunks) });
      } catch {
        await sock.sendMessage(ownerJid, { text: `${header}\n\n🎭 *Deleted a sticker* (could not retrieve)` });
      }
      return;
    }

    // DOCUMENT
    if (msgType === "documentMessage") {
      const media = original.message.documentMessage;
      await sock.sendMessage(ownerJid, { text: `${header}\n\n📄 *Deleted a document*\nFile: ${media.fileName || "unknown"}` });
      return;
    }

    // FALLBACK
    await sock.sendMessage(ownerJid, { text: `${header}\n\n📦 *Deleted a message* (type: ${msgType})` });

  } catch (err) {
    console.error("[ANTIDELETE]", err.message);
  }
}
