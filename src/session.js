import fs from 'fs-extra';
import path from 'path';
import zlib from 'zlib';
import config from '../config.js';

const sessionPath = './session';

export async function restoreSession() {
  if (!config.SESSION_ID) return;

  try {
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath);
    }

    const sessionData = config.SESSION_ID.split('KnightBot!')[1];
    if (!sessionData) return;

    const buffer = Buffer.from(sessionData, 'base64');
    const decompressed = zlib.gunzipSync(buffer);
    const json = JSON.parse(decompressed.toString());

    await fs.writeJSON(path.join(sessionPath, 'creds.json'), json);
    console.log('Session restored from SESSION_ID');
  } catch (error) {
    console.error('Failed to restore session:', error);
  }
}
