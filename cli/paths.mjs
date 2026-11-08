import path from 'node:path';
import { SKILL_NAMES, PROVIDERS } from './constants.mjs';
export { SKILL_NAMES, PROVIDERS };

export function skillRoot(provider, scope, cwd, home) {
  if (provider === 'copilot' && scope === 'global') {
    throw new Error('copilot global not supported in v1');
  }
  const table = {
    cursor: {
      global: path.join(home, '.cursor', 'skills'),
      project: path.join(cwd, '.cursor', 'skills'),
    },
    claude: {
      global: path.join(home, '.claude', 'skills'),
      project: path.join(cwd, '.claude', 'skills'),
    },
    codex: {
      global: path.join(home, '.agents', 'skills'),
      project: path.join(cwd, '.agents', 'skills'),
    },
    copilot: {
      project: path.join(cwd, '.github', 'skills'),
    },
  };
  const row = table[provider];
  if (!row || !row[scope]) throw new Error(`unknown provider/scope: ${provider}/${scope}`);
  return row[scope];
}

export function cursorHooksJsonPath(scope, cwd, home) {
  return scope === 'global'
    ? path.join(home, '.cursor', 'hooks.json')
    : path.join(cwd, '.cursor', 'hooks.json');
}

export function cursorHooksDir(scope, cwd, home) {
  return scope === 'global'
    ? path.join(home, '.cursor', 'hooks')
    : path.join(cwd, '.cursor', 'hooks');
}

export function manifestPath(scope, cwd, home) {
  return scope === 'global'
    ? path.join(home, '.cursor', 'sb-index-graph-install.json')
    : path.join(cwd, '.cursor', 'sb-index-graph-install.json');
}

export { readManifest, writeManifest } from './manifest.mjs';
