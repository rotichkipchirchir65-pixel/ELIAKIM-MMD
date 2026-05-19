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

commands['yt'] = yt;
commands['alwaystyping'] = alwaystyping;
commands['typing'] = alwaystyping;
