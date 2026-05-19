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
      console.log(`Status Code: ${statusCode}, Reconnecting: ${shouldReconnect}`);

      if (shouldReconnect) {
        console.log('Waiting 5 seconds before reconnecting...');
        setTimeout(() => {
          startBot();
        }, 5000);
      } else {
        console.log('Logged out. Please delete session folder and restart with new SESSION_ID.');
      }
    } else if (connection === 'open') {
      console.log('ELIAKIM MD connected successfully');
    }
  });

  client.ev.on('messages.upsert', async (m) => {
    await handleMessages(client, m);
  });

  return client;
}
