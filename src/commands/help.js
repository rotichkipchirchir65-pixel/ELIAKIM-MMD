import config from '../../config.js';

export async function help(client, msg, from, args) {
  const menuText = `
🌟 *${config.BOT_NAME}* 🌟

*Prefix:* [ ${config.PREFIX} ]

*Commands:*
- .ping : Check bot latency
- .help : Show this menu
- .owner : Get owner contact
- .yt : Download YouTube videos (Coming soon)

_Powered by ELIAKIM MD_
  `.trim();

  await client.sendMessage(from, { text: menuText }, { quoted: msg });
}
