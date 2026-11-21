import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKILL_NAMES } from './constants.mjs';
import { skillRoot, legacySkillRoot } from './paths.mjs';

export function packageRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true, force: true });
}

export function installSkills({ providers, scope, cwd, home, sourceRoot = packageRoot() }) {
  const installed = [];
  for (const provider of providers) {
    const root = skillRoot(provider, scope, cwd, home);
    for (const name of SKILL_NAMES) {
      const src = path.join(sourceRoot, 'skills', name);
      const dest = path.join(root, name);
      if (!fs.existsSync(path.join(src, 'SKILL.md'))) {
        throw new Error(`missing skill source: ${src}`);
      }
      copyDir(src, dest);
      installed.push({ provider, name, dest });
    }
    pruneLegacy(provider, scope, cwd, home);
  }
  return { installed };
}

export function removeSkills({ providers, scope, cwd, home, names = SKILL_NAMES }) {
  const allow = new Set(SKILL_NAMES);
  const targets = names.filter((name) => allow.has(name));
  const removed = [];
  for (const provider of providers) {
    const root = skillRoot(provider, scope, cwd, home);
    for (const name of targets) {
      const dest = path.join(root, name);
      if (fs.existsSync(dest)) {
        fs.rmSync(dest, { recursive: true, force: true });
        removed.push(dest);
      }
    }
    removed.push(...pruneLegacy(provider, scope, cwd, home, targets));
  }
  return { removed };
}

/**
 * Drops skills left in a provider's pre-V2 directory (OpenCode wrote them under
 * `skill/` singular). Runs on install and uninstall so an upgrade migrates the
 * tree and a remove leaves nothing ignored behind.
 */
export function pruneLegacy(provider, scope, cwd, home, names = SKILL_NAMES) {
  const root = legacySkillRoot(provider, scope, cwd, home);
  if (!root || !fs.existsSync(root)) return [];
  const allow = new Set(SKILL_NAMES);
  const removed = [];
  for (const name of names.filter((entry) => allow.has(entry))) {
    const dest = path.join(root, name);
    if (!fs.existsSync(dest)) continue;
    fs.rmSync(dest, { recursive: true, force: true });
    removed.push(dest);
  }
  if (fs.existsSync(root) && fs.readdirSync(root).length === 0) fs.rmdirSync(root);
  return removed;
}
