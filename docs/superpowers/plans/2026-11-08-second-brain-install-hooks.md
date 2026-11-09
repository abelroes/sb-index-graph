# Second-brain Install + Cursor Hooks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `npx sb-index-graph install|uninstall|update` that installs the four second-brain skills across Cursor, Claude Code, Codex/`.agents`, and VS Code/Copilot, plus Cursor-only lifecycle hooks that nudge second-brain without requiring a manual `/second-brain` invoke.

**Architecture:** Zero-dependency Node CLI (`cli/`) copies skills from `skills/` into provider skill dirs, merges a marked Cursor `hooks.json` fragment, and writes a scope manifest for surgical uninstall. One Cursor hook script (`hooks/sb-index-graph.mjs`) handles `sessionStart`, `beforeSubmitPrompt`, `stop`, `subagentStop`, and `preCompact` fail-open with short English nudges—no MCP/`indexGraph` calls.

**Tech Stack:** Node.js ≥20 (`node:test`, `node:fs`, `node:path`, `node:os`), plain `.mjs`, existing `skills/*/SKILL.md`, README/`agents/PROTOCOL.md`/`agents/TESTING.md`.

## Global Constraints

- Skill bodies and shipped docs in **English**; chat with the user may stay Portuguese.
- Do **not** change `PLUG.md` / `src/graph.lua` / Library Lua API.
- Hooks **fail-open**; never call SilverBullet MCP or `indexGraph` from the hook process.
- Cursor hooks only in v1; other providers get skills only.
- Uninstall removes **only** artifacts this installer wrote (`sb-index-graph` markers + manifest).
- Skills install via **copy** (not symlink) for portable uninstall.
- `npx skills add` remains a documented skills-only fallback; primary path is this CLI.
- Cite-before-persist / skill split behavior unchanged (skills already shipped).

## Locked defaults (spec §10)

| Open item | Decision |
|-----------|----------|
| Substantial `stop` threshold | Fire when `toolCallCount >= 5` **or** `editCount >= 3` (see payload helpers below); else `{}` |
| Skills link mode | **Copy** directories recursively |
| Copilot global | v1: **project** `.github/skills/` only; README notes global Copilot path is out of scope |

## File map

| Path | Responsibility |
|------|----------------|
| `package.json` | Package name `sb-index-graph`, `bin.sb-index-graph` → `cli/bin.mjs`, `engines.node`, scripts `test` |
| `cli/bin.mjs` | Arg parse; dispatch `install` / `uninstall` / `update` |
| `cli/paths.mjs` | Provider skill roots (project/global); Cursor hooks paths; manifest paths |
| `cli/manifest.mjs` | Read/write/delete install manifest |
| `cli/skills.mjs` | Copy / remove the four skill directories |
| `cli/hooks-merge.mjs` | Merge/remove Cursor hook fragment + copy/remove hook script |
| `cli/install.mjs` | Orchestrate install |
| `cli/uninstall.mjs` | Orchestrate uninstall |
| `cli/update.mjs` | Re-run install for recorded/flagged scope+providers |
| `hooks/sb-index-graph.mjs` | Cursor hook entry (stdin JSON → stdout JSON) |
| `hooks/hooks.json.fragment` | Canonical hook registration fragment |
| `cli/lib/dedup.mjs` | In-memory / tempfile dedup window for nudges |
| `tests/cli/*.test.mjs` | CLI unit tests with temp dirs |
| `tests/hooks/*.test.mjs` | Hook unit tests with synthetic stdin |
| `README.md`, `agents/PROTOCOL.md`, `agents/TESTING.md` | Install/uninstall docs + ledger |

**Skill names (constant):** `second-brain`, `second-brain-retrieval`, `setup-second-brain`, `managing-learnings`.

---

### Task 1: Package scaffold + path/manifest helpers (TDD)

**Files:**
- Create: `package.json`
- Create: `cli/paths.mjs`
- Create: `cli/manifest.mjs`
- Create: `cli/constants.mjs`
- Create: `tests/cli/paths-manifest.test.mjs`

**Interfaces:**
- Consumes: `os.homedir()`, `process.cwd()`
- Produces:
  - `SKILL_NAMES: string[]`
  - `PROVIDERS: ['cursor','claude','codex','copilot']`
  - `skillRoot(provider, scope, cwd, home) → absolute path`
  - `cursorHooksJsonPath(scope, cwd, home) → absolute path`
  - `cursorHooksDir(scope, cwd, home) → absolute path`
  - `manifestPath(scope, cwd, home) → absolute path`  
    - global Cursor-centric default: `{home}/.cursor/sb-index-graph-install.json`  
    - project: `{cwd}/.cursor/sb-index-graph-install.json`
  - `readManifest(path) → object|null`
  - `writeManifest(path, data) → void`
  - `defaultManifest({version, scope, providers, paths, installedAt}) → object`

- [ ] **Step 1: Write the failing test**

```js
// tests/cli/paths-manifest.test.mjs
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
```

Also export from `cli/paths.mjs` (or split `manifest.mjs` and re-export in test):

```js
// expected path table (implement exactly)
// cursor  global  → ~/.cursor/skills
// cursor  project → <cwd>/.cursor/skills
// claude  global  → ~/.claude/skills
// claude  project → <cwd>/.claude/skills
// codex   global  → ~/.agents/skills
// codex   project → <cwd>/.agents/skills
// copilot global  → throw Error('copilot global not supported in v1')
// copilot project → <cwd>/.github/skills
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/cli/paths-manifest.test.mjs`  
Expected: FAIL (module not found / exports missing)

- [ ] **Step 3: Write minimal implementation**

```json
// package.json
{
  "name": "sb-index-graph",
  "version": "0.1.0",
  "description": "SilverBullet indexGraph library helpers and second-brain agent skills installer",
  "type": "module",
  "bin": {
    "sb-index-graph": "./cli/bin.mjs"
  },
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "test": "node --test tests/cli/*.test.mjs tests/hooks/*.test.mjs"
  },
  "files": [
    "cli",
    "hooks",
    "skills",
    "README.md",
    "PLUG.md",
    "Library",
    "src"
  ],
  "license": "SEE LICENSE IN repo"
}
```

```js
// cli/constants.mjs
export const SKILL_NAMES = [
  'second-brain',
  'second-brain-retrieval',
  'setup-second-brain',
  'managing-learnings',
];
export const PROVIDERS = ['cursor', 'claude', 'codex', 'copilot'];
export const MARKER = 'sb-index-graph';
export const STOP_TOOL_THRESHOLD = 5;
export const STOP_EDIT_THRESHOLD = 3;
export const DEDUP_MS = 5 * 60 * 1000;
```

```js
// cli/paths.mjs
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
```

```js
// cli/manifest.mjs
import fs from 'node:fs';
import path from 'node:path';

export function readManifest(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

export function writeManifest(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/cli/paths-manifest.test.mjs`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json cli/constants.mjs cli/paths.mjs cli/manifest.mjs tests/cli/paths-manifest.test.mjs
git commit -m "$(cat <<'EOF'
✨ feat: (cli) scaffold paths and install manifest helpers

Lock provider skill roots and manifest locations for multi-IDE install.
EOF
)"
```

---

### Task 2: Skills copy/remove helpers (TDD)

**Files:**
- Create: `cli/skills.mjs`
- Create: `tests/cli/skills.test.mjs`

**Interfaces:**
- Consumes: `SKILL_NAMES`, `skillRoot`, repo `skills/` next to package root
- Produces:
  - `packageRoot() →` directory containing `skills/` (resolve from `import.meta.url` → `../`)
  - `installSkills({ providers, scope, cwd, home, sourceRoot }) → { installed: [{provider, name, dest}] }`
  - `removeSkills({ providers, scope, cwd, home, names? }) → { removed: string[] }`  
    Only deletes dirs named in `SKILL_NAMES` under our skill roots (never foreign skills).

- [ ] **Step 1: Write the failing test**

```js
// tests/cli/skills.test.mjs
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/cli/skills.test.mjs`  
Expected: FAIL (module missing)

- [ ] **Step 3: Write minimal implementation**

```js
// cli/skills.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKILL_NAMES } from './constants.mjs';
import { skillRoot } from './paths.mjs';

export function packageRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true, force: true });
}

export function installSkills({ providers, scope, cwd, home, sourceRoot = packageRoot() }) {
  const installed = [];
  for (const provider of providers) {
    const root = skillRoot(provider, scope, cwd, home);
    for (const name of SKILL_NAMES) {
      const src = path.join(sourceRoot, 'skills', name);
      const dest = path.join(root, name);
      if (!fs.existsSync(path.join(src, 'SKILL.md'))) {
        throw new Error(`missing skill source: ${src}`);
      }
      copyDir(src, dest);
      installed.push({ provider, name, dest });
    }
  }
  return { installed };
}

export function removeSkills({ providers, scope, cwd, home, names = SKILL_NAMES }) {
  const removed = [];
  for (const provider of providers) {
    const root = skillRoot(provider, scope, cwd, home);
    for (const name of names) {
      const dest = path.join(root, name);
      if (fs.existsSync(dest)) {
        fs.rmSync(dest, { recursive: true, force: true });
        removed.push(dest);
      }
    }
  }
  return { removed };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/cli/skills.test.mjs`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add cli/skills.mjs tests/cli/skills.test.mjs
git commit -m "$(cat <<'EOF'
✨ feat: (cli) copy and remove second-brain skill dirs

Idempotent recursive copy into provider skill roots; uninstall leaves foreign skills.
EOF
)"
```

---

### Task 3: Cursor hooks.json merge + script install (TDD)

**Files:**
- Create: `hooks/hooks.json.fragment`
- Create: `hooks/sb-index-graph.mjs` (stub that prints `{}` — full logic in Task 5)
- Create: `cli/hooks-merge.mjs`
- Create: `tests/cli/hooks-merge.test.mjs`

**Interfaces:**
- Consumes: `cursorHooksJsonPath`, `cursorHooksDir`, fragment file
- Produces:
  - `HOOK_COMMAND_GLOBAL = './hooks/sb-index-graph.mjs'` (cwd = `~/.cursor`)
  - `HOOK_COMMAND_PROJECT = '.cursor/hooks/sb-index-graph.mjs'` (cwd = project root)
  - `mergeHooksJson(existing, fragment) → merged object` — replace prior entries whose `command` contains `sb-index-graph`
  - `stripHooksJson(existing) → object` — remove entries whose `command` contains `sb-index-graph`
  - `installCursorHooks({ scope, cwd, home, packageRoot }) → void`
  - `uninstallCursorHooks({ scope, cwd, home }) → void`

Fragment events (exact keys): `sessionStart`, `beforeSubmitPrompt`, `stop`, `subagentStop`, `preCompact`. Each entry: `{ "command": "<path>", "timeout": 5 }` — no `failClosed`.

- [ ] **Step 1: Write the failing test**

```js
// tests/cli/hooks-merge.test.mjs
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
  const hj = JSON.parse(fs.readFileSync(path.join(home, '.cursor', 'hooks.json'), 'utf8'));
  assert.equal(hj.hooks.afterFileEdit.length, 1);
  assert.ok(hj.hooks.sessionStart);
  uninstallCursorHooks({ scope: 'global', cwd, home });
  const hj2 = JSON.parse(fs.readFileSync(path.join(home, '.cursor', 'hooks.json'), 'utf8'));
  assert.equal(hj2.hooks.sessionStart, undefined);
  assert.equal(hj2.hooks.afterFileEdit.length, 1);
  assert.equal(fs.existsSync(path.join(home, '.cursor', 'hooks', 'sb-index-graph.mjs')), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/cli/hooks-merge.test.mjs`  
Expected: FAIL

- [ ] **Step 3: Write fragment, stub script, and merge module**

```json
// hooks/hooks.json.fragment
{
  "version": 1,
  "hooks": {
    "sessionStart": [{ "command": "./hooks/sb-index-graph.mjs", "timeout": 5 }],
    "beforeSubmitPrompt": [{ "command": "./hooks/sb-index-graph.mjs", "timeout": 5 }],
    "stop": [{ "command": "./hooks/sb-index-graph.mjs", "timeout": 5 }],
    "subagentStop": [{ "command": "./hooks/sb-index-graph.mjs", "timeout": 5 }],
    "preCompact": [{ "command": "./hooks/sb-index-graph.mjs", "timeout": 5 }]
  }
}
```

Note: for **project** scope, `installCursorHooks` rewrites each `command` to `.cursor/hooks/sb-index-graph.mjs` before merge.

```js
// hooks/sb-index-graph.mjs — stub until Task 5
#!/usr/bin/env node
process.stdin.resume();
process.stdin.on('end', () => {
  process.stdout.write('{}\n');
});
```

```js
// cli/hooks-merge.mjs
import fs from 'node:fs';
import path from 'node:path';
import { cursorHooksDir, cursorHooksJsonPath } from './paths.mjs';
import { MARKER } from './constants.mjs';

function isOurs(entry) {
  return typeof entry?.command === 'string' && entry.command.includes(MARKER);
}

export function mergeHooksJson(existing, fragment) {
  const base = existing && typeof existing === 'object'
    ? structuredClone(existing)
    : { version: 1, hooks: {} };
  base.version = base.version ?? 1;
  base.hooks = base.hooks ?? {};
  for (const [event, entries] of Object.entries(fragment.hooks || {})) {
    const current = Array.isArray(base.hooks[event]) ? base.hooks[event] : [];
    const kept = current.filter((e) => !isOurs(e));
    base.hooks[event] = [...kept, ...entries];
  }
  return base;
}

export function stripHooksJson(existing) {
  const base = structuredClone(existing || { version: 1, hooks: {} });
  base.hooks = base.hooks ?? {};
  for (const event of Object.keys(base.hooks)) {
    const next = (base.hooks[event] || []).filter((e) => !isOurs(e));
    if (next.length === 0) delete base.hooks[event];
    else base.hooks[event] = next;
  }
  return base;
}

function rewriteFragmentCommands(fragment, scope) {
  const cmd =
    scope === 'global' ? './hooks/sb-index-graph.mjs' : '.cursor/hooks/sb-index-graph.mjs';
  const out = structuredClone(fragment);
  for (const entries of Object.values(out.hooks || {})) {
    for (const e of entries) e.command = cmd;
  }
  return out;
}

export function installCursorHooks({ scope, cwd, home, packageRoot }) {
  const hooksDir = cursorHooksDir(scope, cwd, home);
  const hooksJsonPath = cursorHooksJsonPath(scope, cwd, home);
  fs.mkdirSync(hooksDir, { recursive: true });
  const scriptSrc = path.join(packageRoot, 'hooks', 'sb-index-graph.mjs');
  const scriptDest = path.join(hooksDir, 'sb-index-graph.mjs');
  fs.copyFileSync(scriptSrc, scriptDest);
  fs.chmodSync(scriptDest, 0o755);
  const fragmentRaw = JSON.parse(
    fs.readFileSync(path.join(packageRoot, 'hooks', 'hooks.json.fragment'), 'utf8'),
  );
  const fragment = rewriteFragmentCommands(fragmentRaw, scope);
  let existing = { version: 1, hooks: {} };
  if (fs.existsSync(hooksJsonPath)) {
    existing = JSON.parse(fs.readFileSync(hooksJsonPath, 'utf8'));
  }
  const merged = mergeHooksJson(existing, fragment);
  fs.mkdirSync(path.dirname(hooksJsonPath), { recursive: true });
  fs.writeFileSync(hooksJsonPath, JSON.stringify(merged, null, 2) + '\n');
}

export function uninstallCursorHooks({ scope, cwd, home }) {
  const hooksDir = cursorHooksDir(scope, cwd, home);
  const hooksJsonPath = cursorHooksJsonPath(scope, cwd, home);
  const scriptDest = path.join(hooksDir, 'sb-index-graph.mjs');
  if (fs.existsSync(scriptDest)) fs.rmSync(scriptDest, { force: true });
  if (!fs.existsSync(hooksJsonPath)) return;
  const existing = JSON.parse(fs.readFileSync(hooksJsonPath, 'utf8'));
  const stripped = stripHooksJson(existing);
  fs.writeFileSync(hooksJsonPath, JSON.stringify(stripped, null, 2) + '\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/cli/hooks-merge.test.mjs`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add hooks/hooks.json.fragment hooks/sb-index-graph.mjs cli/hooks-merge.mjs tests/cli/hooks-merge.test.mjs
git commit -m "$(cat <<'EOF'
✨ feat: (cli) merge Cursor hooks fragment for second-brain

Install/uninstall only sb-index-graph hook entries; preserve foreign hooks.
EOF
)"
```

---

### Task 4: `install` / `uninstall` / `update` + `bin.mjs` (TDD)

**Files:**
- Create: `cli/install.mjs`
- Create: `cli/uninstall.mjs`
- Create: `cli/update.mjs`
- Create: `cli/bin.mjs`
- Create: `cli/parse-args.mjs`
- Create: `tests/cli/install-flow.test.mjs`

**Interfaces:**
- Consumes: skills + hooks-merge + manifest + paths
- Produces:
  - `parseArgs(argv) → { cmd, scope, providers, yes, help }`
  - `runInstall(opts) → manifest written`
  - `runUninstall(opts) → removes via manifest or best-effort`
  - `runUpdate(opts) → install with prior providers/scope`
  - CLI: `node cli/bin.mjs install|uninstall|update [--scope=global|project] [--providers=a,b] [-y]`

Behavior:
- Default `scope=global`. Default providers when `-y` and none passed: `cursor,claude,codex` (skip `copilot` unless listed — copilot is project-only).
- If `providers` includes `copilot` and `scope=global`, exit 2 with clear error.
- `install` with Cursor in providers → also `installCursorHooks`.
- Without `-y`, if stdin is a TTY, print detected defaults and proceed with defaults (v1: no interactive checklist library—document that `--providers` + `-y` is the non-interactive path; optional simple readline later). Spec asked for checklist: implement a minimal prompt using `readline` when TTY and not `-y`:

```text
Install scope [global]/project]: 
Providers (comma-separated) [cursor,claude,codex]:
```

- [ ] **Step 1: Write the failing test**

```js
// tests/cli/install-flow.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runInstall, runUninstall } from '../../cli/install.mjs';
// export runUninstall from uninstall.mjs; test imports both

test('install then uninstall cursor global leaves foreign skill', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sbig-home-'));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sbig-cwd-'));
  const sourceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
  // ensure real skills exist in repo for this test
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
```

Fix URL path on Windows later if needed; prefer `fileURLToPath`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/cli/install-flow.test.mjs`  
Expected: FAIL

- [ ] **Step 3: Implement orchestrators + bin**

```js
// cli/parse-args.mjs
export function parseArgs(argv) {
  const args = argv.slice(2);
  const cmd = args[0];
  let scope = 'global';
  let providers = null;
  let yes = false;
  for (const a of args.slice(1)) {
    if (a === '-y' || a === '--yes') yes = true;
    else if (a.startsWith('--scope=')) scope = a.slice(8);
    else if (a.startsWith('--providers=')) providers = a.slice(12).split(',').map((s) => s.trim()).filter(Boolean);
  }
  return { cmd, scope, providers, yes };
}
```

```js
// cli/install.mjs
import os from 'node:os';
import { writeManifest } from './manifest.mjs';
import { manifestPath } from './paths.mjs';
import { installSkills, packageRoot } from './skills.mjs';
import { installCursorHooks } from './hooks-merge.mjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export async function runInstall({
  scope,
  providers,
  cwd = process.cwd(),
  home = os.homedir(),
  sourceRoot = packageRoot(),
  yes = false,
}) {
  if (!providers?.length) providers = ['cursor', 'claude', 'codex'];
  if (providers.includes('copilot') && scope === 'global') {
    throw new Error('copilot requires --scope=project');
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
```

```js
// cli/uninstall.mjs
import fs from 'node:fs';
import os from 'node:os';
import { readManifest } from './manifest.mjs';
import { manifestPath } from './paths.mjs';
import { removeSkills } from './skills.mjs';
import { uninstallCursorHooks } from './hooks-merge.mjs';

export async function runUninstall({
  scope = 'global',
  cwd = process.cwd(),
  home = os.homedir(),
  providers,
  yes = false,
}) {
  const manPath = manifestPath(scope, cwd, home);
  const man = readManifest(manPath);
  const prov = providers || man?.providers || ['cursor', 'claude', 'codex'];
  const sc = man?.scope || scope;
  removeSkills({ providers: prov, scope: sc, cwd, home });
  if (prov.includes('cursor') || man?.hooks) {
    uninstallCursorHooks({ scope: sc, cwd, home });
  }
  if (fs.existsSync(manPath)) fs.rmSync(manPath, { force: true });
}
```

```js
// cli/update.mjs
import os from 'node:os';
import { readManifest } from './manifest.mjs';
import { manifestPath } from './paths.mjs';
import { runInstall } from './install.mjs';

export async function runUpdate(opts) {
  const cwd = opts.cwd || process.cwd();
  const home = opts.home || os.homedir();
  const scope = opts.scope || 'global';
  const man = readManifest(manifestPath(scope, cwd, home));
  return runInstall({
    ...opts,
    scope: opts.scope || man?.scope || 'global',
    providers: opts.providers || man?.providers || ['cursor', 'claude', 'codex'],
    yes: true,
  });
}
```

```js
// cli/bin.mjs
#!/usr/bin/env node
import { parseArgs } from './parse-args.mjs';
import { runInstall } from './install.mjs';
import { runUninstall } from './uninstall.mjs';
import { runUpdate } from './update.mjs';

const opts = parseArgs(process.argv);
try {
  if (opts.cmd === 'install') await runInstall(opts);
  else if (opts.cmd === 'uninstall') await runUninstall(opts);
  else if (opts.cmd === 'update') await runUpdate(opts);
  else {
    console.error('Usage: sb-index-graph <install|uninstall|update> [--scope=global|project] [--providers=cursor,claude,codex,copilot] [-y]');
    process.exit(2);
  }
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
```

Add shebang file mode in commit (`chmod +x cli/bin.mjs`).

- [ ] **Step 4: Run tests**

Run: `node --test tests/cli/*.test.mjs`  
Expected: all PASS

Manual smoke:  
`node cli/bin.mjs install -y --scope=project --providers=cursor` from repo (uses project `.cursor/`).  
Then `node cli/bin.mjs uninstall -y --scope=project`.

- [ ] **Step 5: Commit**

```bash
git add cli/bin.mjs cli/parse-args.mjs cli/install.mjs cli/uninstall.mjs cli/update.mjs tests/cli/install-flow.test.mjs
git commit -m "$(cat <<'EOF'
✨ feat: (cli) install uninstall and update for second-brain skills

Wire multi-provider skill copy with Cursor hook merge and scoped manifest.
EOF
)"
```

---

### Task 5: Hook script behavior (TDD)

**Files:**
- Modify: `hooks/sb-index-graph.mjs` (full implementation)
- Create: `hooks/lib/heuristics.mjs`
- Create: `hooks/lib/messages.mjs`
- Create: `hooks/lib/dedup.mjs`
- Create: `tests/hooks/hook.test.mjs`

**Interfaces:**
- Consumes: stdin JSON with at least `{ hook_event_name }` or `{ event }` — normalize to `eventName`. Also read optional `prompt`, `tool_call_count` / `toolCallCount`, `edit_count` / `editCount`, `transcript_path` (ignore if unused).
- Produces stdout JSON only; on any error print `{}` and exit 0.

**Payload rules (English):**

| Event | Gate | Output field |
|-------|------|--------------|
| `sessionStart` | always | Prefer `additional_context`; if Cursor rejects, also acceptable `agent_message` — **verify against current Cursor docs during implementation**; empty object if field unsupported. Text asserts our function `responseFor(event, input)` shape. |
| `beforeSubmitPrompt` | `promptMatches(prompt)` | `agent_message` or `additional_context` with specialist nudge |
| `stop` | `isSubstantial(input)` | `followup_message` |
| `subagentStop` | always (deduped) | `followup_message` |
| `preCompact` | always | `additional_context` |

`promptMatches`: case-insensitive regex for  
`second-brain|silverbullet|indexgraph|aprendizado|learning|preference|preferences|my way of working|jeito de|notas\b|notes about|sb\b`.

`isSubstantial`: `(toolCallCount ?? 0) >= 5 || (editCount ?? 0) >= 3` after reading both camelCase and snake_case keys.

Dedup: file `{tmpdir}/sb-index-graph-hook-dedup.json` mapping `eventName → lastTs`; skip if within `DEDUP_MS` (5 min) for `stop` / `subagentStop` only.

- [ ] **Step 1: Write the failing test**

```js
// tests/hooks/hook.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { responseFor, promptMatches, isSubstantial } from '../../hooks/sb-index-graph.mjs';

test('promptMatches notes signal', () => {
  assert.equal(promptMatches('what do my notes say about JWT'), true);
  assert.equal(promptMatches('rename the variable'), false);
});

test('isSubstantial uses thresholds', () => {
  assert.equal(isSubstantial({ toolCallCount: 5 }), true);
  assert.equal(isSubstantial({ editCount: 3 }), true);
  assert.equal(isSubstantial({ toolCallCount: 1, editCount: 1 }), false);
});

test('sessionStart returns context', () => {
  const out = responseFor('sessionStart', {});
  assert.ok(out.additional_context || out.agent_message);
  assert.match(String(out.additional_context || out.agent_message), /second-brain/i);
});

test('beforeSubmitPrompt no match returns empty', () => {
  assert.deepEqual(responseFor('beforeSubmitPrompt', { prompt: 'fix typo in README' }), {});
});

test('stop below threshold empty', () => {
  assert.deepEqual(responseFor('stop', { toolCallCount: 1, editCount: 0 }), {});
});

test('stop substantial returns followup', () => {
  const out = responseFor('stop', { toolCallCount: 9, editCount: 0, __skipDedup: true });
  assert.ok(out.followup_message);
});
```

Export pure functions from the hook module for testing; `main()` only when `import.meta.url === pathToFileURL(process.argv[1]).href`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/hooks/hook.test.mjs`  
Expected: FAIL

- [ ] **Step 3: Implement hook**

```js
// hooks/lib/messages.mjs
export const SESSION = `Second-brain skills may be installed (second-brain manager, second-brain-retrieval, setup-second-brain, managing-learnings). If this session involves notes, preferences, or learnings, route via second-brain. Setup is optional and never blocks retrieval.`;

export const PROMPT_MATCH = `This prompt looks note/preference/learning related. Prefer the second-brain manager handoff to the right specialist. For new learnings, cite candidates before persist.`;

export const STOP_FOLLOWUP = `If this turn produced a durable preference or lesson, offer managing-learnings cite-before-persist. If answers still depend on your notes, use second-brain-retrieval.`;

export const SUBAGENT_FOLLOWUP = `Subagent finished. If it surfaced a lesson worth keeping, cite via managing-learnings; if it needed SilverBullet context, consider second-brain-retrieval.`;

export const PRECOMPACT = `About to compact context. Preserve any second-brain anchors (page names, tags, open questions). After compact, re-run indexGraph digest if work still depends on notes.`;
```

Implement `promptMatches`, `isSubstantial`, `responseFor`, dedup helpers, and stdin main in `hooks/sb-index-graph.mjs` (full file ~120 lines). On unknown event → `{}`. Wrap `main` in try/catch → `{}`.

- [ ] **Step 4: Run tests**

Run: `npm test`  
Expected: all PASS

Re-copy hook via `node cli/bin.mjs update -y --scope=…` if testing live Cursor.

- [ ] **Step 5: Commit**

```bash
git add hooks/sb-index-graph.mjs hooks/lib tests/hooks
git commit -m "$(cat <<'EOF'
✨ feat: (hooks) nudge second-brain on Cursor lifecycle events

Fail-open sessionStart, prompt heuristic, substantial stop, subagentStop, preCompact.
EOF
)"
```

---

### Task 6: Docs + PROTOCOL/TESTING + README install path

**Files:**
- Modify: `README.md` (Agent skills / Install agents section)
- Modify: `agents/PROTOCOL.md`
- Modify: `agents/TESTING.md`
- Modify: `docs/superpowers/specs/2026-11-08-second-brain-install-hooks-design.md` — set Status to `approved`

**Interfaces:**
- Consumes: working CLI
- Produces: English docs with primary `npx sb-index-graph install`

- [ ] **Step 1: Update README Agent skills**

Replace the skills-only primary block with:

```markdown
## Agent skills and hooks

Primary install (skills + Cursor hooks):

```bash
npx sb-index-graph install -y --scope=global --providers=cursor,claude,codex
# project-scoped Copilot skills:
npx sb-index-graph install -y --scope=project --providers=copilot
npx sb-index-graph uninstall -y --scope=global
npx sb-index-graph update -y --scope=global
```

Providers: `cursor` (skills + hooks), `claude`, `codex` (`.agents`), `copilot` (project `.github/skills/` only). Hooks run on Cursor only (`sessionStart`, `beforeSubmitPrompt`, `stop`, `subagentStop`, `preCompact`).

Skills-only fallback (no hooks):

```bash
npx skills add . -g --skill '*' -a '*' -y
npx skills add abelroes/sb-index-graph -g --skill '*' -a '*' -y
```
```

Keep the skill table and Library install section unchanged above/below as appropriate.

- [ ] **Step 2: PROTOCOL + TESTING**

PROTOCOL — add paragraph:

```markdown
Installer: `npx sb-index-graph install` (see README). Cursor hooks are optional automation; skills remain the source of routing rules.
```

TESTING — append:

```markdown
## 2026-11-08 install + hooks

- CLI: `npm test` (paths, skills copy, hooks merge, install/uninstall, hook responseFor).
- Manual: `node cli/bin.mjs install -y --scope=project --providers=cursor` then check `.cursor/hooks.json` contains `sb-index-graph` and Hooks output channel shows sessionStart.
```

- [ ] **Step 3: Run full test suite**

Run: `npm test`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add README.md agents/PROTOCOL.md agents/TESTING.md docs/superpowers/specs/2026-11-08-second-brain-install-hooks-design.md
git commit -m "$(cat <<'EOF'
📝 docs: document sb-index-graph install uninstall and Cursor hooks

Primary path is the CLI; npx skills add stays skills-only fallback.
EOF
)"
```

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| `install\|uninstall\|update` CLI | 4 |
| Multi-provider skills | 1–2, 4 |
| Scope global default + flags | 4 |
| Cursor hooks five events | 3, 5 |
| Fail-open / no MCP in hook | 5 |
| Surgical uninstall + manifest | 1, 3, 4 |
| Copy not symlink | 2 |
| Docs primary path + skills fallback | 6 |
| No Lua/PLUG changes | (all tasks avoid) |
| stop threshold / copilot project-only | Locked defaults + Tasks 4–5 |

## Placeholder scan

None intentional. Hook stdout field names: implement against live Cursor docs if `additional_context` vs `agent_message` differs per event; tests accept either for `sessionStart`.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-11-08-second-brain-install-hooks.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration  

**2. Inline Execution** — execute tasks in this session with executing-plans and checkpoints  

Which approach?
