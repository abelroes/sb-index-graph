import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  skillRoot,
  legacySkillRoot,
  opencodePluginsDir,
  manifestPath,
  writeManifest,
  readManifest,
  SKILL_NAMES,
  DEFAULT_PROVIDERS,
} from '../../cli/paths.mjs';
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

test('skillRoot opencode global under ~/.config/opencode/skills (V2 plural)', () => {
  assert.equal(
    skillRoot('opencode', 'global', '/repo', '/tmp/fake-home'),
    path.join('/tmp/fake-home', '.config', 'opencode', 'skills'),
  );
});

test('skillRoot opencode project under .opencode/skills', () => {
  assert.equal(
    skillRoot('opencode', 'project', '/repo', '/home'),
    path.join('/repo', '.opencode', 'skills'),
  );
});

test('legacySkillRoot points at the V1 singular dir for opencode only', () => {
  assert.equal(
    legacySkillRoot('opencode', 'global', '/repo', '/tmp/fake-home'),
    path.join('/tmp/fake-home', '.config', 'opencode', 'skill'),
  );
  assert.equal(
    legacySkillRoot('opencode', 'project', '/repo', '/home'),
    path.join('/repo', '.opencode', 'skill'),
  );
  assert.equal(legacySkillRoot('cursor', 'global', '/repo', '/home'), null);
});

test('opencodePluginsDir is where OpenCode auto-loads plugins', () => {
  assert.equal(
    opencodePluginsDir('global', '/repo', '/tmp/fake-home'),
    path.join('/tmp/fake-home', '.config', 'opencode', 'plugins'),
  );
  assert.equal(
    opencodePluginsDir('project', '/repo', '/home'),
    path.join('/repo', '.opencode', 'plugins'),
  );
});

test('opencode is a default provider', () => {
  assert.deepEqual(DEFAULT_PROVIDERS, ['cursor', 'claude', 'codex', 'opencode']);
});

test('manifest round-trip', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbig-man-'));
  const p = path.join(dir, 'sb-index-graph-install.json');
  writeManifest(p, { version: '0.0.0', scope: 'global', providers: ['cursor'] });
  const m = readManifest(p);
  assert.equal(m.scope, 'global');
  assert.deepEqual(m.providers, ['cursor']);
});
