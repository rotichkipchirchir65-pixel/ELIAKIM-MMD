import ytdl from "@distube/ytdl-core";

export async function ytCmd(sock, msg, { jid, args, command }) {
  const url = args[0];
  if (!url || !/youtu/.test(url)) {
    return sock.sendMessage(jid, { text: `❌ Provide a YouTube URL.\n.yt <url> — audio\n.ytmp4 <url> — video` });
  }
  const isVideo = command === "ytmp4";
  await sock.sendMessage(jid, { text: `⏳ Downloading ${isVideo ? "video" : "audio"}...` });
  try {
    const info = await ytdl.getInfo(url);
    const title = info.videoDetails.title;
    if (parseInt(info.videoDetails.lengthSeconds) > 600)
      return sock.sendMessage(jid, { text: "❌ Max 10 minutes allowed." });

    const chunks = [];
    let total = 0;
    const stream = isVideo
      ? ytdl(url, { quality: "highestvideo", filter: "audioandvideo" })
      : ytdl(url, { quality: "lowestaudio", filter: "audioonly" });

    stream.on("data", (c) => { 
      total += c.length; 
      chunks.push(c); 
      if (total > 50e6) stream.destroy(new Error("Too large")); 
    });
    
    await new Promise((res, rej) => { 
      stream.on("end", res); 
      stream.on("error", rej); 
    });
    
    const buffer = Buffer.concat(chunks);

    if (isVideo) {
      await sock.sendMessage(jid, { video: buffer, caption: `🎬 *${title}*` }, { quoted: msg });
    } else { 
      await sock.sendMessage(jid, { audio: buffer, mimetype: "audio/mp4" }, { quoted: msg }); 
      await sock.sendMessage(jid, { text: `🎵 *${title}*` }); 
    }
  } catch (err) {
    await sock.sendMessage(jid, { text: `❌ ${err.message.includes("large") ? "File too large (max 50MB)." : err.message}` });
  }
}
