export async function kickCmd(sock, msg, { jid, owner, inGroup }) {
  if (!inGroup) return sock.sendMessage(jid, { text: "❌ This command can only be used in groups." });

  // Get the message being replied to
  const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const participant = msg.message?.extendedTextMessage?.contextInfo?.participant;

  if (!quotedMsg || !participant) {
    return sock.sendMessage(jid, { text: "❌ Reply to the message of the user you want to kick." });
  }

  // Get group metadata to check sender's admin status
  const groupMetadata = await sock.groupMetadata(jid);
  const admins = groupMetadata.participants
    .filter(p => p.admin === "admin" || p.admin === "superadmin")
    .map(p => p.id);

  const sender = msg.key.participant || msg.key.remoteJid;
  const senderIsAdmin = admins.includes(sender);

  if (!owner && !senderIsAdmin) {
    return sock.sendMessage(jid, { text: "❌ Only group admins or the owner can use this command." });
  }

  // Check if bot is admin
  const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
  const botIsAdmin = admins.includes(botNumber);

  if (!botIsAdmin) {
    return sock.sendMessage(jid, { text: "❌ I need to be an *admin* to kick users." });
  }

  try {
    await sock.groupParticipantsUpdate(jid, [participant], "remove");
    await sock.sendMessage(jid, { 
      text: `✅ Removed @${participant.split("@")[0]} from the group.`, 
      mentions: [participant] 
    });
  } catch (err) {
    await sock.sendMessage(jid, { text: `❌ Failed to kick user: ${err.message}` });
  }
}
