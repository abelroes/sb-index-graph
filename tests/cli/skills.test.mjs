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
