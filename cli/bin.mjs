#!/usr/bin/env node
import { parseArgs } from './parse-args.mjs';
import { runInstall } from './install.mjs';
import { runUninstall } from './uninstall.mjs';
import { runUpdate } from './update.mjs';

const USAGE = 'Usage: sb-index-graph <install|uninstall|update> [--scope=global|project] [--providers=cursor,claude,codex,copilot] [-y]';

const opts = parseArgs(process.argv);
try {
  if (opts.help) {
    console.log(USAGE);
    process.exit(0);
  }
  if (opts.cmd === 'install') await runInstall(opts);
  else if (opts.cmd === 'uninstall') await runUninstall(opts);
  else if (opts.cmd === 'update') await runUpdate(opts);
  else {
    console.error(USAGE);
    process.exit(2);
  }
} catch (err) {
  console.error(err.message || err);
  process.exit(err.exitCode || 1);
}
