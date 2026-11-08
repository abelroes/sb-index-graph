import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { skillRoot, manifestPath, writeManifest, readManifest, SKILL_NAMES } from '../../cli/paths.mjs';
// re-export manifest helpers from paths or import from manifest.mjs — keep one import surface in test

test('SKILL_NAMES has four skills', () => {
  assert.deepEqual(SKILL_NAMES, [
    'second-brain',
    'second-brain-retrieval',
    'setup-second-brain',
    'managing-learnings',
  ]);
});

test('skillRoot cursor global under ~/.cursor/skills', () => {
  const home = '/tmp/fake-home';
  assert.equal(
    skillRoot('cursor', 'global', '/repo', home),
    path.join(home, '.cursor', 'skills'),
  );
});

test('skillRoot copilot project under .github/skills', () => {
  assert.equal(
    skillRoot('copilot', 'project', '/repo', '/home'),
    path.join('/repo', '.github', 'skills'),
  );
});

test('manifest round-trip', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbig-man-'));
  const p = path.join(dir, 'sb-index-graph-install.json');
  writeManifest(p, { version: '0.0.0', scope: 'global', providers: ['cursor'] });
  const m = readManifest(p);
  assert.equal(m.scope, 'global');
  assert.deepEqual(m.providers, ['cursor']);
});
