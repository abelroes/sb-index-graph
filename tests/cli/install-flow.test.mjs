import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInstall, runUninstall } from '../../cli/install.mjs';

test('install then uninstall cursor global leaves foreign skill', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sbig-home-'));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sbig-cwd-'));
  const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  await runInstall({
    scope: 'global',
    providers: ['cursor'],
    cwd,
    home,
    sourceRoot,
    yes: true,
  });
  assert.equal(
    fs.existsSync(path.join(home, '.cursor', 'skills', 'second-brain', 'SKILL.md')),
    true,
  );
  assert.equal(fs.existsSync(path.join(home, '.cursor', 'hooks', 'sb-index-graph.mjs')), true);
  const foreign = path.join(home, '.cursor', 'skills', 'keep-me');
  fs.mkdirSync(foreign, { recursive: true });
  fs.writeFileSync(path.join(foreign, 'SKILL.md'), 'x\n');
  await runUninstall({ scope: 'global', cwd, home, yes: true });
  assert.equal(fs.existsSync(path.join(home, '.cursor', 'skills', 'second-brain')), false);
  assert.equal(fs.existsSync(path.join(foreign, 'SKILL.md')), true);
  assert.equal(fs.existsSync(path.join(home, '.cursor', 'sb-index-graph-install.json')), false);
});
