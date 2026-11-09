import fs from 'node:fs';
import path from 'node:path';
import { cursorHooksDir, cursorHooksJsonPath } from './paths.mjs';
import { MARKER } from './constants.mjs';

export const HOOK_COMMAND_GLOBAL = './hooks/sb-index-graph.mjs';
export const HOOK_COMMAND_PROJECT = '.cursor/hooks/sb-index-graph.mjs';

const HOOK_LIB_FILES = ['messages.mjs'];
/** Removed from the package; still deleted on install/uninstall so upgrades clean up. */
const LEGACY_HOOK_LIB_FILES = ['heuristics.mjs', 'dedup.mjs'];

function copyHookLib(packageRoot, hooksDir) {
  const libSrc = path.join(packageRoot, 'hooks', 'lib');
  if (!fs.existsSync(libSrc)) return;
  const libDest = path.join(hooksDir, 'lib');
  fs.mkdirSync(libDest, { recursive: true });
  for (const name of LEGACY_HOOK_LIB_FILES) {
    fs.rmSync(path.join(libDest, name), { force: true });
  }
  for (const name of HOOK_LIB_FILES) {
    const src = path.join(libSrc, name);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(libDest, name));
  }
}

function removeHookLib(hooksDir) {
  const libDest = path.join(hooksDir, 'lib');
  for (const name of [...HOOK_LIB_FILES, ...LEGACY_HOOK_LIB_FILES]) {
    fs.rmSync(path.join(libDest, name), { force: true });
  }
  if (!fs.existsSync(libDest)) return;
  if (fs.readdirSync(libDest).length === 0) fs.rmdirSync(libDest);
}

function isOurs(entry) {
  return typeof entry?.command === 'string' && entry.command.includes(MARKER);
}

export function mergeHooksJson(existing, fragment) {
  // Strip all our entries first so retired events (stop, etc.) leave on upgrade.
  const base = stripHooksJson(
    existing && typeof existing === 'object' ? existing : { version: 1, hooks: {} },
  );
  base.version = base.version ?? 1;
  base.hooks = base.hooks ?? {};
  for (const [event, entries] of Object.entries(fragment.hooks || {})) {
    const current = Array.isArray(base.hooks[event]) ? base.hooks[event] : [];
    base.hooks[event] = [...current, ...entries];
  }
  return base;
}

export function stripHooksJson(existing) {
  const base = structuredClone(existing || { version: 1, hooks: {} });
  base.hooks = base.hooks ?? {};
  for (const event of Object.keys(base.hooks)) {
    const next = (base.hooks[event] || []).filter((e) => !isOurs(e));
    if (next.length === 0) delete base.hooks[event];
    else base.hooks[event] = next;
  }
  return base;
}

function rewriteFragmentCommands(fragment, scope) {
  const cmd = scope === 'global' ? HOOK_COMMAND_GLOBAL : HOOK_COMMAND_PROJECT;
  const out = structuredClone(fragment);
  for (const entries of Object.values(out.hooks || {})) {
    for (const e of entries) e.command = cmd;
  }
  return out;
}

export function installCursorHooks({ scope, cwd, home, packageRoot }) {
  const hooksDir = cursorHooksDir(scope, cwd, home);
  const hooksJsonPath = cursorHooksJsonPath(scope, cwd, home);
  fs.mkdirSync(hooksDir, { recursive: true });
  const scriptSrc = path.join(packageRoot, 'hooks', 'sb-index-graph.mjs');
  const scriptDest = path.join(hooksDir, 'sb-index-graph.mjs');
  fs.copyFileSync(scriptSrc, scriptDest);
  fs.chmodSync(scriptDest, 0o755);
  copyHookLib(packageRoot, hooksDir);
  const fragmentRaw = JSON.parse(
    fs.readFileSync(path.join(packageRoot, 'hooks', 'hooks.json.fragment'), 'utf8'),
  );
  const fragment = rewriteFragmentCommands(fragmentRaw, scope);
  let existing = { version: 1, hooks: {} };
  if (fs.existsSync(hooksJsonPath)) {
    existing = JSON.parse(fs.readFileSync(hooksJsonPath, 'utf8'));
  }
  const merged = mergeHooksJson(existing, fragment);
  fs.mkdirSync(path.dirname(hooksJsonPath), { recursive: true });
  fs.writeFileSync(hooksJsonPath, JSON.stringify(merged, null, 2) + '\n');
}

export function uninstallCursorHooks({ scope, cwd, home }) {
  const hooksDir = cursorHooksDir(scope, cwd, home);
  const hooksJsonPath = cursorHooksJsonPath(scope, cwd, home);
  const scriptDest = path.join(hooksDir, 'sb-index-graph.mjs');
  if (fs.existsSync(scriptDest)) fs.rmSync(scriptDest, { force: true });
  removeHookLib(hooksDir);
  if (!fs.existsSync(hooksJsonPath)) return;
  const existing = JSON.parse(fs.readFileSync(hooksJsonPath, 'utf8'));
  const stripped = stripHooksJson(existing);
  fs.writeFileSync(hooksJsonPath, JSON.stringify(stripped, null, 2) + '\n');
}
