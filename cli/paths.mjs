import path from 'node:path';
import {
  SKILL_NAMES,
  PROVIDERS,
  DEFAULT_PROVIDERS,
  OPENCODE_PLUGIN_FILE,
  OPENCODE_TRIGGERS_FILE,
} from './constants.mjs';
export { SKILL_NAMES, PROVIDERS, DEFAULT_PROVIDERS, OPENCODE_PLUGIN_FILE, OPENCODE_TRIGGERS_FILE };

/**
 * OpenCode V2 discovers skills from `~/.config/opencode/skills` (plural), with
 * `.claude/skills` and `.agents/skills` as compatibility sources. The singular
 * `skill/` directory was the V1 name: kept in `legacy` so install and uninstall
 * clean old copies instead of leaving a second, ignored tree behind.
 */
const OPENCODE_SKILL_DIRS = { global: ['.config', 'opencode', 'skills'], project: ['.opencode', 'skills'] };
const OPENCODE_SKILL_DIRS_LEGACY = { global: ['.config', 'opencode', 'skill'], project: ['.opencode', 'skill'] };

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
    opencode: {
      global: path.join(home, ...OPENCODE_SKILL_DIRS.global),
      project: path.join(cwd, ...OPENCODE_SKILL_DIRS.project),
    },
    copilot: {
      project: path.join(cwd, '.github', 'skills'),
    },
  };
  const row = table[provider];
  if (!row || !row[scope]) throw new Error(`unknown provider/scope: ${provider}/${scope}`);
  return row[scope];
}

export function legacySkillRoot(provider, scope, cwd, home) {
  if (provider !== 'opencode') return null;
  const parts = OPENCODE_SKILL_DIRS_LEGACY[scope];
  if (!parts) return null;
  return path.join(scope === 'global' ? home : cwd, ...parts);
}

/** OpenCode auto-loads plugins from `~/.config/opencode/plugins` and `.opencode/plugins`. */
export function opencodePluginsDir(scope, cwd, home) {
  return scope === 'global'
    ? path.join(home, '.config', 'opencode', 'plugins')
    : path.join(cwd, '.opencode', 'plugins');
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
