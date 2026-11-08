import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { readFileSync } from 'node:fs';
import { writeManifest } from './manifest.mjs';
import { manifestPath } from './paths.mjs';
import { installSkills, packageRoot } from './skills.mjs';
import { installCursorHooks } from './hooks-merge.mjs';

const DEFAULT_PROVIDERS = ['cursor', 'claude', 'codex'];

async function resolveSelection({ scope, providers, yes }) {
  let nextScope = scope || 'global';
  let nextProviders = providers?.length ? providers : null;
  if (!yes && process.stdin.isTTY) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      const scopeAns = (await rl.question('Install scope [global]/project]: ')).trim();
      const provAns = (await rl.question('Providers (comma-separated) [cursor,claude,codex]: ')).trim();
      if (scopeAns) nextScope = scopeAns;
      if (provAns) {
        nextProviders = provAns.split(',').map((s) => s.trim()).filter(Boolean);
      }
    } finally {
      rl.close();
    }
  }
  if (!nextProviders?.length) nextProviders = DEFAULT_PROVIDERS;
  return { scope: nextScope, providers: nextProviders };
}

export async function runInstall({
  scope,
  providers,
  cwd = process.cwd(),
  home = os.homedir(),
  sourceRoot = packageRoot(),
  yes = false,
}) {
  const selected = await resolveSelection({ scope, providers, yes });
  scope = selected.scope;
  providers = selected.providers;
  if (providers.includes('copilot') && scope === 'global') {
    const err = new Error('copilot requires --scope=project');
    err.exitCode = 2;
    throw err;
  }
  const { installed } = installSkills({ providers, scope, cwd, home, sourceRoot });
  if (providers.includes('cursor')) {
    installCursorHooks({ scope, cwd, home, packageRoot: sourceRoot });
  }
  const version = JSON.parse(readFileSync(path.join(sourceRoot, 'package.json'), 'utf8')).version;
  const man = {
    version,
    scope,
    providers,
    paths: installed.map((i) => i.dest),
    hooks: providers.includes('cursor'),
    installedAt: new Date().toISOString(),
  };
  writeManifest(manifestPath(scope, cwd, home), man);
  return man;
}

export { runUninstall } from './uninstall.mjs';
