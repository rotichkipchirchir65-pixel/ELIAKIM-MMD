import config from '../../config.js';

export async function owner(client, msg, from, args) {
  const vcard = 'BEGIN:VCARD\n' 
                + 'VERSION:3.0\n' 
                + `FN:${config.BOT_NAME} Owner\n` 
                + `TEL;type=CELL;type=VOICE;waid=${config.OWNER_NUMBER}:+${config.OWNER_NUMBER}\n` 
                + 'END:VCARD';

  await client.sendMessage(from, { 
    contacts: { 
      displayName: 'Owner', 
      contacts: [{ vcard }] 
    }
  }, { quoted: msg });
}
