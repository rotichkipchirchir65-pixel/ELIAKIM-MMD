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
    browser: [config.BOT_NAME, 'Safari', '3.0']
  });

  client.ev.on('creds.update', saveCreds);

  client.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
      if (shouldReconnect) {
        startBot();
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
