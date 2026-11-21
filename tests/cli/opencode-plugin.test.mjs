import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildTriggers,
  installOpenCodePlugin,
  uninstallOpenCodePlugin,
} from '../../cli/opencode-plugin.mjs';
import {
  OPENCODE_PLUGIN_FILE,
  OPENCODE_TRIGGERS_FILE,
} from '../../cli/paths.mjs';
import { SESSION, PRECOMPACT, ROUTES } from '../../hooks/lib/messages.mjs';

function fakePackageRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sbig-pkg-'));
  const dir = path.join(root, 'plugins', 'opencode');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, OPENCODE_PLUGIN_FILE), 'export default { id: "sb-index-graph" };\n');
  return root;
}

test('installOpenCodePlugin writes plugin plus triggers data, global scope', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sbig-home-'));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sbig-cwd-'));
  const result = installOpenCodePlugin({
    scope: 'global',
    cwd,
    home,
    packageRoot: fakePackageRoot(),
    version: '0.3.0',
  });
  const dir = path.join(home, '.config', 'opencode', 'plugins');
  assert.equal(result.dir, dir);
  assert.equal(fs.existsSync(path.join(dir, OPENCODE_PLUGIN_FILE)), true);
  const triggers = JSON.parse(fs.readFileSync(path.join(dir, OPENCODE_TRIGGERS_FILE), 'utf8'));
  assert.equal(triggers.version, '0.3.0');
  assert.equal(triggers.session, SESSION);
  assert.equal(triggers.preCompact, PRECOMPACT);
  assert.deepEqual(triggers.routes, ROUTES);
});

test('installOpenCodePlugin project scope writes under .opencode/plugins and keeps foreign plugins', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sbig-home-'));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sbig-cwd-'));
  const dir = path.join(cwd, '.opencode', 'plugins');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'team-plugin.js'), '// keep\n');
  installOpenCodePlugin({ scope: 'project', cwd, home, packageRoot: fakePackageRoot(), version: '0' });
  assert.equal(fs.existsSync(path.join(dir, OPENCODE_PLUGIN_FILE)), true);
  const uninstall = uninstallOpenCodePlugin({ scope: 'project', cwd, home });
  assert.equal(fs.existsSync(path.join(dir, OPENCODE_PLUGIN_FILE)), false);
  assert.equal(fs.existsSync(path.join(dir, OPENCODE_TRIGGERS_FILE)), false);
  assert.equal(uninstall.removed.length, 2);
  assert.equal(fs.readFileSync(path.join(dir, 'team-plugin.js'), 'utf8'), '// keep\n');
});

test('installOpenCodePlugin fails loudly when the plugin source is missing', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sbig-home-'));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sbig-cwd-'));
  assert.throws(
    () => installOpenCodePlugin({ scope: 'global', cwd, home, packageRoot: home }),
    /missing opencode plugin source/,
  );
});

test('the shipped plugin source is plain node builtins, flat, and loadable shape', () => {
  const source = fs.readFileSync(
    path.join(
      path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))),
      'plugins',
      'opencode',
      OPENCODE_PLUGIN_FILE,
    ),
    'utf8',
  );
  assert.match(source, /from ['"]node:fs['"]/);
  assert.doesNotMatch(source, /from\s+['"](\.|\/)/, 'no relative or absolute imports: the plugin must stay one flat file');
  assert.doesNotMatch(source, /from\s+['"]@opencode\/plugin['"]/, 'no runtime dependency on @opencode/plugin');
  assert.match(source, /export default\s*{\s*id: 'sb-index-graph'/);
  assert.match(source, /ctx\.session\.hook\('prompt'/);
  assert.match(source, /ctx\.session\.hook\('compaction'/);
});
