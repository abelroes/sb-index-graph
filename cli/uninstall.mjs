import fs from 'node:fs';
import os from 'node:os';
import { readManifest } from './manifest.mjs';
import { manifestPath } from './paths.mjs';
import { removeSkills } from './skills.mjs';
import { uninstallCursorHooks } from './hooks-merge.mjs';

export async function runUninstall({
  scope = 'global',
  cwd = process.cwd(),
  home = os.homedir(),
  providers,
  yes = false,
}) {
  const manPath = manifestPath(scope, cwd, home);
  const man = readManifest(manPath);
  const prov = providers || man?.providers || ['cursor', 'claude', 'codex'];
  const sc = man?.scope || scope;
  removeSkills({ providers: prov, scope: sc, cwd, home });
  if (prov.includes('cursor') || man?.hooks) {
    uninstallCursorHooks({ scope: sc, cwd, home });
  }
  if (fs.existsSync(manPath)) fs.rmSync(manPath, { force: true });
}
