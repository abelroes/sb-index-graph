import fs from 'node:fs';
import path from 'node:path';
import { SESSION, PRECOMPACT, BOOT_SKILL, ROUTES } from '../hooks/lib/messages.mjs';
import { MARKER, OPENCODE_PLUGIN_FILE, OPENCODE_TRIGGERS_FILE } from './constants.mjs';
import { opencodePluginsDir } from './paths.mjs';

/**
 * Trigger data for the OpenCode plugin, generated from the canonical text in
 * `hooks/lib/messages.mjs` so Cursor hooks and the OpenCode plugin cannot drift.
 * RegExp cannot cross a JSON boundary, so patterns travel as source strings and
 * the plugin compiles them.
 */
export function buildTriggers({ version = '0', boot = BOOT_SKILL } = {}) {
  return JSON.stringify(
    {
      generatedBy: MARKER,
      version,
      session: SESSION,
      preCompact: PRECOMPACT,
      boot: boot ?? null,
      routes: ROUTES.map(({ skill, pattern, flags }) => ({ skill, pattern, flags })),
    },
    null,
    2,
  ) + '\n';
}

export function installOpenCodePlugin({ scope, cwd, home, packageRoot, version = '0' }) {
  const pluginsDir = opencodePluginsDir(scope, cwd, home);
  const src = path.join(packageRoot, 'plugins', 'opencode', OPENCODE_PLUGIN_FILE);
  if (!fs.existsSync(src)) throw new Error(`missing opencode plugin source: ${src}`);
  fs.mkdirSync(pluginsDir, { recursive: true });
  fs.copyFileSync(src, path.join(pluginsDir, OPENCODE_PLUGIN_FILE));
  fs.writeFileSync(
    path.join(pluginsDir, OPENCODE_TRIGGERS_FILE),
    buildTriggers({ version }),
  );
  return { dir: pluginsDir, files: [OPENCODE_PLUGIN_FILE, OPENCODE_TRIGGERS_FILE] };
}

export function uninstallOpenCodePlugin({ scope, cwd, home }) {
  const pluginsDir = opencodePluginsDir(scope, cwd, home);
  const removed = [];
  for (const name of [OPENCODE_PLUGIN_FILE, OPENCODE_TRIGGERS_FILE]) {
    const file = path.join(pluginsDir, name);
    if (fs.existsSync(file)) {
      fs.rmSync(file, { force: true });
      removed.push(file);
    }
  }
  return { removed };
}
