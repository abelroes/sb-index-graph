import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mergeHooksJson, stripHooksJson, installCursorHooks, uninstallCursorHooks } from '../../cli/hooks-merge.mjs';

test('mergeHooksJson preserves foreign hooks and upserts ours', () => {
  const existing = {
    version: 1,
    hooks: {
      afterFileEdit: [{ command: './hooks/format.sh' }],
      stop: [{ command: './hooks/sb-index-graph.mjs' }],
    },
  };
  const fragment = {
    version: 1,
    hooks: {
      stop: [{ command: './hooks/sb-index-graph.mjs', timeout: 5 }],
      sessionStart: [{ command: './hooks/sb-index-graph.mjs', timeout: 5 }],
    },
  };
  const merged = mergeHooksJson(existing, fragment);
  assert.equal(merged.hooks.afterFileEdit.length, 1);
  assert.equal(merged.hooks.stop.length, 1);
  assert.equal(merged.hooks.sessionStart.length, 1);
});

test('stripHooksJson removes only sb-index-graph commands', () => {
  const existing = {
    version: 1,
    hooks: {
      stop: [
        { command: './hooks/sb-index-graph.mjs' },
        { command: './hooks/other.sh' },
      ],
    },
  };
  const stripped = stripHooksJson(existing);
  assert.deepEqual(stripped.hooks.stop, [{ command: './hooks/other.sh' }]);
});

test('installCursorHooks writes script and merges json', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sbig-h-'));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sbig-c-'));
  const pkg = fs.mkdtempSync(path.join(os.tmpdir(), 'sbig-p-'));
  fs.mkdirSync(path.join(pkg, 'hooks'), { recursive: true });
  fs.writeFileSync(path.join(pkg, 'hooks', 'sb-index-graph.mjs'), '#!/usr/bin/env node\nconsole.log("{}")\n');
  fs.mkdirSync(path.join(pkg, 'hooks', 'lib'), { recursive: true });
  fs.writeFileSync(path.join(pkg, 'hooks', 'lib', 'messages.mjs'), 'export const SESSION = "x";\n');
  fs.writeFileSync(
    path.join(pkg, 'hooks', 'hooks.json.fragment'),
    JSON.stringify({
      version: 1,
      hooks: {
        sessionStart: [{ command: './hooks/sb-index-graph.mjs', timeout: 5 }],
      },
    }),
  );
  // pre-existing foreign hook
  fs.mkdirSync(path.join(home, '.cursor'), { recursive: true });
  fs.writeFileSync(
    path.join(home, '.cursor', 'hooks.json'),
    JSON.stringify({ version: 1, hooks: { afterFileEdit: [{ command: './hooks/x.sh' }] } }),
  );
  installCursorHooks({ scope: 'global', cwd, home, packageRoot: pkg });
  assert.equal(fs.existsSync(path.join(home, '.cursor', 'hooks', 'sb-index-graph.mjs')), true);
  assert.equal(fs.existsSync(path.join(home, '.cursor', 'hooks', 'lib', 'messages.mjs')), true);
  const hj = JSON.parse(fs.readFileSync(path.join(home, '.cursor', 'hooks.json'), 'utf8'));
  assert.equal(hj.hooks.afterFileEdit.length, 1);
  assert.ok(hj.hooks.sessionStart);
  uninstallCursorHooks({ scope: 'global', cwd, home });
  const hj2 = JSON.parse(fs.readFileSync(path.join(home, '.cursor', 'hooks.json'), 'utf8'));
  assert.equal(hj2.hooks.sessionStart, undefined);
  assert.equal(hj2.hooks.afterFileEdit.length, 1);
  assert.equal(fs.existsSync(path.join(home, '.cursor', 'hooks', 'sb-index-graph.mjs')), false);
  assert.equal(fs.existsSync(path.join(home, '.cursor', 'hooks', 'lib', 'messages.mjs')), false);
});
