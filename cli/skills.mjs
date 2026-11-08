import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKILL_NAMES } from './constants.mjs';
import { skillRoot } from './paths.mjs';

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
  }
  return { removed };
}
