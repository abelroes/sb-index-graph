import fs from 'node:fs';
import os from 'node:os';
import { readManifest } from './manifest.mjs';
import { manifestPath, DEFAULT_PROVIDERS } from './paths.mjs';
import { removeSkills } from './skills.mjs';
import { uninstallCursorHooks } from './hooks-merge.mjs';
import { uninstallOpenCodePlugin } from './opencode-plugin.mjs';

export async function runUninstall({
  scope = 'global',
  cwd = process.cwd(),
  home = os.homedir(),
  providers,
  yes = false,
}) {
  const manPath = manifestPath(scope, cwd, home);
  const man = readManifest(manPath);
  const prov = providers || man?.providers || DEFAULT_PROVIDERS;
  const sc = man?.scope || scope;
  removeSkills({ providers: prov, scope: sc, cwd, home });
  // `triggers` is new in 0.3; an older manifest only ever meant Cursor hooks.
  const triggered = man?.triggers || (man?.hooks ? ['cursor'] : []);
  if (prov.includes('cursor') || triggered.includes('cursor')) {
    uninstallCursorHooks({ scope: sc, cwd, home });
  }
  if (prov.includes('opencode') || triggered.includes('opencode')) {
    uninstallOpenCodePlugin({ scope: sc, cwd, home });
  }
  if (fs.existsSync(manPath)) fs.rmSync(manPath, { force: true });
}
