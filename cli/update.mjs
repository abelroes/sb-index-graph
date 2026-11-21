import os from 'node:os';
import { readManifest } from './manifest.mjs';
import { manifestPath, DEFAULT_PROVIDERS } from './paths.mjs';
import { runInstall } from './install.mjs';

export async function runUpdate(opts) {
  const cwd = opts.cwd || process.cwd();
  const home = opts.home || os.homedir();
  const scope = opts.scope || 'global';
  const man = readManifest(manifestPath(scope, cwd, home));
  return runInstall({
    ...opts,
    scope: opts.scope || man?.scope || 'global',
    providers: opts.providers || man?.providers || DEFAULT_PROVIDERS,
    yes: true,
  });
}
