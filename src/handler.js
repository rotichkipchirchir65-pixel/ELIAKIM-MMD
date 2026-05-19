import config from '../config.js';
import { commands } from './commands/index.js';
import { antiLink } from './features/antilink.js';
import { viewOnce } from './features/viewonce.js';

export async function handleMessages(client, m) {
  try {
    const msg = m.messages[0];
    if (!msg.message) return;
    if (msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    
    // Process Features
    await antiLink(client, msg, from);
    await viewOnce(client, msg, from);
    
    // Command parsing
    const type = Object.keys(msg.message)[0];
    const body = type === 'conversation' ? msg.message.conversation : 
                 type === 'extendedTextMessage' ? msg.message.extendedTextMessage.text : 
                 type === 'imageMessage' ? msg.message.imageMessage.caption : 
                 type === 'videoMessage' ? msg.message.videoMessage.caption : '';

    const isCmd = body.startsWith(config.PREFIX);
    const command = isCmd ? body.slice(config.PREFIX.length).trim().split(' ')[0].toLowerCase() : null;
    const args = isCmd ? body.trim().split(' ').slice(1) : [];

    if (isCmd && commands[command]) {
      console.log(`[CMD] ${command} from ${from}`);
      await commands[command](client, msg, from, args);
    }

  } catch (error) {
    console.error('Error handling message:', error);
  }
}
