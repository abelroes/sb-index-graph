import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { installSkills, removeSkills } from '../../cli/skills.mjs';

function fixtureSkills() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sbig-src-'));
  for (const name of ['second-brain', 'second-brain-retrieval', 'setup-second-brain', 'managing-learnings']) {
    const d = path.join(root, 'skills', name);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'SKILL.md'), `# ${name}\n`);
  }
  return root;
}

test('installSkills copies into cursor global root', () => {
  const sourceRoot = fixtureSkills();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sbig-home-'));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sbig-cwd-'));
  const result = installSkills({
    providers: ['cursor'],
    scope: 'global',
    cwd,
    home,
    sourceRoot,
  });
  assert.equal(result.installed.length, 4);
  const dest = path.join(home, '.cursor', 'skills', 'second-brain', 'SKILL.md');
  assert.equal(fs.readFileSync(dest, 'utf8'), '# second-brain\n');
});

test('installSkills copies into opencode global root (V2 plural skills dir)', () => {
  const sourceRoot = fixtureSkills();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sbig-home-'));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sbig-cwd-'));
  const result = installSkills({
    providers: ['opencode'],
    scope: 'global',
    cwd,
    home,
    sourceRoot,
  });
  assert.equal(result.installed.length, 4);
  const dest = path.join(home, '.config', 'opencode', 'skills', 'second-brain', 'SKILL.md');
  assert.equal(fs.readFileSync(dest, 'utf8'), '# second-brain\n');
});

test('installSkills drops skills left in the old singular opencode skill dir', () => {
  const sourceRoot = fixtureSkills();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sbig-home-'));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sbig-cwd-'));
  const legacy = path.join(home, '.config', 'opencode', 'skill');
  for (const name of ['second-brain', 'second-brain-retrieval', 'setup-second-brain', 'managing-learnings']) {
    const dir = path.join(legacy, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), 'stale\n');
  }
  const foreign = path.join(legacy, 'other-skill');
  fs.mkdirSync(foreign, { recursive: true });
  fs.writeFileSync(path.join(foreign, 'SKILL.md'), 'keep\n');
  installSkills({ providers: ['opencode'], scope: 'global', cwd, home, sourceRoot });
  assert.equal(fs.existsSync(path.join(legacy, 'second-brain')), false);
  assert.equal(fs.existsSync(path.join(foreign, 'SKILL.md')), true);
  assert.ok(fs.existsSync(legacy));
});

test('removeSkills clears the V2 tree and the legacy singular tree', () => {
  const sourceRoot = fixtureSkills();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sbig-home-'));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sbig-cwd-'));
  const legacy = path.join(home, '.config', 'opencode', 'skill', 'second-brain');
  fs.mkdirSync(legacy, { recursive: true });
  fs.writeFileSync(path.join(legacy, 'SKILL.md'), 'stale\n');
  const result = removeSkills({ providers: ['opencode'], scope: 'global', cwd, home });
  assert.equal(fs.existsSync(path.join(home, '.config', 'opencode', 'skill')), false);
  assert.equal(result.removed.length, 1);
  installSkills({ providers: ['opencode'], scope: 'global', cwd, home, sourceRoot });
  const second = removeSkills({ providers: ['opencode'], scope: 'global', cwd, home });
  assert.equal(fs.existsSync(path.join(home, '.config', 'opencode', 'skills', 'second-brain')), false);
  assert.equal(second.removed.length, 4);
});

test('removeSkills deletes only our four skill dirs', () => {
  const sourceRoot = fixtureSkills();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sbig-home-'));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sbig-cwd-'));
  installSkills({ providers: ['cursor'], scope: 'global', cwd, home, sourceRoot });
  const foreign = path.join(home, '.cursor', 'skills', 'other-skill');
  fs.mkdirSync(foreign, { recursive: true });
  fs.writeFileSync(path.join(foreign, 'SKILL.md'), 'keep\n');
  removeSkills({ providers: ['cursor'], scope: 'global', cwd, home });
  assert.equal(fs.existsSync(path.join(home, '.cursor', 'skills', 'second-brain')), false);
  assert.equal(fs.existsSync(path.join(foreign, 'SKILL.md')), true);
});

test('removeSkills does not delete names outside SKILL_NAMES', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sbig-home-'));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sbig-cwd-'));
  const foreign = path.join(home, '.cursor', 'skills', 'other-skill');
  fs.mkdirSync(foreign, { recursive: true });
  fs.writeFileSync(path.join(foreign, 'SKILL.md'), 'keep\n');
  const result = removeSkills({
    providers: ['cursor'],
    scope: 'global',
    cwd,
    home,
    names: ['other-skill'],
  });
  assert.equal(fs.existsSync(foreign), true);
  assert.equal(fs.readFileSync(path.join(foreign, 'SKILL.md'), 'utf8'), 'keep\n');
  assert.deepEqual(result.removed, []);
});
