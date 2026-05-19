export async function antiDelete(client, m) {
  if (m.type !== 'delete') return;
  
  // Logic to catch deleted messages
  // This requires the bot to store messages in a cache (store.js)
  // For now, we log the detection
  console.log('[ANTIDELETE] Detected message deletion');
}
