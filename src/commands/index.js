import { pingCmd }             from "./ping.js";
import { helpCmd }             from "./help.js";
import { ownerCmd }            from "./owner.js";
import { blockCmd, unblockCmd } from "./block.js";
import { privateCmd }          from "./private.js";
import { alwaysTypingCmd, autoStatusCmd } from "./alwaystyping.js";
import { antilinkCmd }         from "./antilink.js";
import { antiStatusMentionCmd } from "./antistatusmention.js";
import { antiViewOnceCmd }     from "./antiviewonce.js";
import { downloadViewOnceCmd } from "./dlviewonce.js";
import { ytCmd }               from "./yt.js";
import { kickCmd }             from "./kick.js";

const commands = {
  ping:                   pingCmd,
  menu:                   helpCmd,
  help:                   helpCmd,
  owner:                  ownerCmd,
  block:                  blockCmd,
  unblock:                unblockCmd,
  private:                privateCmd,
  alwaystyping:           alwaysTypingCmd,
  autostatus:             autoStatusCmd,
  antilink:               antilinkCmd,
  antilinkgroup:          antilinkCmd,
  antistatusmention:      antiStatusMentionCmd,
  antistatusmentiongroup: antiStatusMentionCmd,
  antiviewonce:           antiViewOnceCmd,
  dlviewonce:             downloadViewOnceCmd,
  downloadviewonce:       downloadViewOnceCmd,
  yt:                     ytCmd,
  ytmp4:                  ytCmd,
  ytdl:                   ytCmd,
  kick:                   kickCmd,
};

export async function handleCommand(sock, msg, ctx) {
  const fn = commands[ctx.command];
  if (!fn) return;
  try {
    await fn(sock, msg, ctx);
  } catch (err) {
    console.error(`[CMD:${ctx.command}]`, err.message);
    await sock.sendMessage(ctx.jid, { text: `❌ Error in *${ctx.command}*: ${err.message}` });
  }
}
