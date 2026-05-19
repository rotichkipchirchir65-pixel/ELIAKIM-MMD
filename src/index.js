import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import { restoreSession } from './session.js';
import { handleMessages } from './handler.js';
import config from '../config.js';

export async function startBot() {
  await restoreSession();

  const { state, saveCreds } = await useMultiFileAuthState('session');

  const client = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    logger: pino({ level: 'silent' }),
    browser: ['Ubuntu', 'Chrome', '20.0.04']
  });

  client.ev.on('creds.update', saveCreds);

  client.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const statusCode = (lastDisconnect.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      
      console.log(`Connection closed: ${lastDisconnect.error?.message || 'Unknown error'}`);
      
      if (statusCode === 440) {
        console.log('Conflict detected. Waiting 10 seconds before clearing instance...');
        setTimeout(() => startBot(), 10000);
      } else if (shouldReconnect) {
        setTimeout(() => startBot(), 5000);
      }
    } else if (connection === 'open') {
      console.log('ELIAKIM MD connected successfully');
      const ownerId = config.OWNER_NUMBER + "@s.whatsapp.net";
      try {
        await client.sendMessage(ownerId, { text: "ELIAKIM MD Connected Successfully! 🚀\n\nPrefix: " + config.PREFIX });
      } catch (e) {
        console.error("Failed to send welcome message:", e);
      }
    }
  });

  client.ev.on('messages.upsert', async (m) => {
    await handleMessages(client, m);
  });

  return client;
}
