export const commands = {};

import { ping } from './ping.js';
import { help } from './help.js';
import { owner } from './owner.js';

commands['ping'] = ping;
commands['help'] = help;
commands['menu'] = help;
commands['owner'] = owner;

import { yt } from './yt.js';
import { alwaystyping } from './alwaystyping.js';
import { block } from './block.js';
import { antiviewonce } from './antiviewonce.js';
import { privateMode } from './private.js';
import { dlviewonce } from './dlviewonce.js';
import { antistatusmention } from './antistatusmention.js';
import { antilink } from './antilink.js';

commands['yt'] = yt;
commands['alwaystyping'] = alwaystyping;
commands['typing'] = alwaystyping;
commands['block'] = block;
commands['antiviewonce'] = antiviewonce;
commands['private'] = privateMode;
commands['dlviewonce'] = dlviewonce;
commands['antistatusmention'] = antistatusmention;
commands['antilink'] = antilink;
