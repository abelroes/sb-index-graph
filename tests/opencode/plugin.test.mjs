import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import {
  createHandlers,
  extractAnchors,
  routeSkill,
} from '../../plugins/opencode/sb-index-graph.js';
import {
  SESSION,
  PRECOMPACT,
  BOOT_SKILL,
  ANCHOR_CAP,
  compileRoutes,
  extractAnchors as extractAnchorsCanonical,
} from '../../hooks/lib/messages.mjs';
import { buildTriggers } from '../../cli/opencode-plugin.mjs';
import { OPENCODE_PLUGIN_FILE, OPENCODE_TRIGGERS_FILE } from '../../cli/constants.mjs';

const AVAILABLE = [
  'second-brain',
  'second-brain-retrieval',
  'setup-second-brain',
  'managing-learnings',
];

function fakeCtx({ skills = AVAILABLE, throwOnPut = false } = {}) {
  const entries = new Map();
  const hooks = new Map();
  const disposals = [];
  const state = { skills: [...skills] };
  return {
    entries,
    hooks,
    disposals,
    skills: state,
    // Matches what OpenCode 2.3.2 actually returns: `{ location, data: [...] }`.
    skill: {
      list: async () => ({
        location: { directory: '/tmp' },
        data: state.skills.map((id) => ({ id, name: id })),
      }),
    },
    session: {
      hook: async (name, handler) => {
        hooks.set(name, handler);
        const registration = {
          dispose: async () => {
            hooks.delete(name);
            disposals.push(name);
          },
        };
        return registration;
      },
      instructions: {
        entry: {
          put: async ({ sessionID, key, value }) => {
            if (throwOnPut) throw new Error('entry rejected');
            assert.match(key, /^[a-z0-9][a-z0-9._-]*$/);
            entries.set(`${sessionID}/${key}`, value);
          },
        },
      },
    },
  };
}

function handlersFor(options) {
  const ctx = fakeCtx(options);
  const triggers = JSON.parse(buildTriggers({ version: 'test' }));
  const handlers = createHandlers(ctx, triggers);
  return { ctx, triggers, handlers };
}

test('first prompt of a session seeds the second-brain instruction entry', async () => {
  const { ctx, handlers } = handlersFor();
  await handlers.onPrompt({ sessionID: 's1', prompt: { text: 'refactor da função parse' } });
  const value = ctx.entries.get('s1/second-brain');
  assert.equal(value.text, SESSION);
  assert.match(String(value.text), /second-brain/i);
  await handlers.onPrompt({ sessionID: 's1', prompt: { text: 'outra coisa' } });
  assert.equal([...ctx.entries.keys()].filter((k) => k === 's1/second-brain').length, 1);
  await handlers.onPrompt({ sessionID: 's2', prompt: { text: 'outra coisa' } });
  assert.ok(ctx.entries.get('s2/second-brain'));
});

test('routes one skill per prompt, highest priority first', async () => {
  const { handlers } = handlersFor();
  const cases = [
    ['guarda um aprendizado sobre retries', 'managing-learnings'],
    ['faz digest de error-handling', 'second-brain-retrieval'],
    ['o que dizem minhas notas sobre retries', 'second-brain-retrieval'],
    ['quero setup-second-brain neste espaço', 'setup-second-brain'],
    ['[[Notes/Jwt]] existe?', 'second-brain'],
    ['renomeia a função parse', null],
  ];
  for (const [index, [text, expected]] of cases.entries()) {
    // A fresh session per case, so the first-prompt boot attach (see the boot
    // tests) cannot show up in a routing expectation.
    const sessionID = `route-${index}`;
    await handlers.onPrompt({ sessionID, prompt: { text: 'refactor' } });
    const event = { sessionID, prompt: { text } };
    await handlers.onPrompt(event);
    const attached = (event.prompt.skills ?? []).map((entry) => entry.id);
    assert.deepEqual(attached, expected ? [expected] : [], text);
  }
});

test('first prompt of a session also attaches the boot skill, even for pure code', async () => {
  const { handlers } = handlersFor();
  const first = { sessionID: 'boot1', prompt: { text: 'renomeia a função parse' } };
  await handlers.onPrompt(first);
  assert.deepEqual(first.prompt.skills.map((entry) => entry.id), ['second-brain-retrieval']);

  const second = { sessionID: 'boot1', prompt: { text: 'renomeia outra função' } };
  await handlers.onPrompt(second);
  assert.equal((second.prompt.skills ?? []).length, 0, 'boot attach happens once per session');
});

test('boot attach is skipped when that skill is not loadable', async () => {
  const { ctx, handlers } = handlersFor({ skills: [] });
  const first = { sessionID: 'boot2', prompt: { text: 'renomeia a função parse' } };
  await handlers.onPrompt(first);
  assert.equal((first.prompt.skills ?? []).length, 0);
  assert.ok(ctx.entries.get('boot2/second-brain'), 'the entry is still seeded');
});

test('boot attach can be turned off in the sidecar', async () => {
  const ctx = fakeCtx();
  const triggers = JSON.parse(buildTriggers({ version: 'test', boot: null }));
  assert.equal(triggers.boot, null);
  const handlers = createHandlers(ctx, triggers);
  const first = { sessionID: 'boot3', prompt: { text: 'renomeia a função parse' } };
  await handlers.onPrompt(first);
  assert.equal((first.prompt.skills ?? []).length, 0);
  assert.ok(ctx.entries.get('boot3/second-brain'));
});

test('does not attach a skill the agent cannot load, and never duplicates', async () => {
  const { ctx, handlers } = handlersFor({ skills: ['second-brain'] });
  const capture = { sessionID: 's1', prompt: { text: 'guardar aprendizado' } };
  await handlers.onPrompt(capture);
  assert.equal((capture.prompt.skills ?? []).length, 0);

  const notes = { sessionID: 's1', prompt: { text: 'minhas notas sobre JWT' } };
  await handlers.onPrompt(notes);
  assert.deepEqual(notes.prompt.skills.map((entry) => entry.id), ['second-brain']);
  await handlers.onPrompt(notes);
  assert.equal(notes.prompt.skills.length, 1);
  assert.ok(ctx.entries.get('s1/second-brain'));
});

test('accepts the skill.list shapes OpenCode has used', async () => {
  const shapes = [
    { location: { directory: '/x' }, data: [{ id: 'second-brain' }] },
    [{ id: 'second-brain' }],
    { skills: [{ id: 'second-brain' }] },
    { data: [{ name: 'second-brain' }] },
  ];
  for (const shape of shapes) {
    const ctx = fakeCtx({ skills: [] });
    ctx.skill.list = async () => shape;
    const handlers = createHandlers(ctx, JSON.parse(buildTriggers({ version: 'test' })));
    const event = { sessionID: 's1', prompt: { text: 'minhas notas sobre caching' } };
    await handlers.onPrompt(event);
    assert.deepEqual(
      (event.prompt.skills ?? []).map((entry) => entry.id),
      ['second-brain'],
      JSON.stringify(shape).slice(0, 60),
    );
  }
});

test('picks up a skill installed after the session started', async () => {
  const { ctx, handlers } = handlersFor({ skills: [] });
  // Warm the session (boot attach, nothing loadable yet) and settle the
  // skill.list cache before the capture route runs.
  await handlers.onPrompt({ sessionID: 's1', prompt: { text: 'refactor' } });
  const first = { sessionID: 's1', prompt: { text: 'guardar aprendizado sobre locks' } };
  await handlers.onPrompt(first);
  assert.equal((first.prompt.skills ?? []).length, 0);
  ctx.skills.skills.push('managing-learnings');
  const second = { sessionID: 's1', prompt: { text: 'guardar aprendizado sobre locks' } };
  await handlers.onPrompt(second);
  assert.deepEqual(second.prompt.skills.map((entry) => entry.id), ['managing-learnings']);
});

test('compaction refreshes the anchors entry with links, tags, and digest anchors', async () => {
  const { ctx, handlers } = handlersFor();
  const messages = [
    { parts: [{ text: 'Ler [[Software Engineer/AI/Aprendizados]] e [[Notes/Jwt]]' }] },
    { parts: [{ text: 'tag #aprendizado e #second-brain' }] },
    { parts: [{ text: 'indexGraph.digest("error-handling") devolveu 40 nós' }] },
  ];
  await handlers.onCompaction({ sessionID: 's1', messages });
  const value = ctx.entries.get('s1/second-brain-anchors');
  assert.equal(value.text, PRECOMPACT);
  assert.deepEqual(value.anchors, [
    'Software Engineer/AI/Aprendizados',
    'Notes/Jwt',
    '#aprendizado',
    '#second-brain',
    'error-handling',
  ]);
});

test('anchor scan is capped and bounded', async () => {
  const { ctx, handlers } = handlersFor();
  const noise = Array.from({ length: 40 }, (_, i) => `[[Pagina ${i}]]`).join(' ');
  await handlers.onCompaction({ sessionID: 's1', messages: [{ text: noise }] });
  assert.equal(ctx.entries.get('s1/second-brain-anchors').anchors.length, 12);
  const huge = { text: 'x'.repeat(400_000) + ' [[Cauda]]' };
  await handlers.onCompaction({ sessionID: 's2', messages: [huge] });
  assert.deepEqual(ctx.entries.get('s2/second-brain-anchors').anchors, ['Cauda']);
});

test('plugin fails open on unknown payloads and API errors', async () => {
  const { handlers } = handlersFor();
  await handlers.onPrompt({ prompt: { text: 'minhas notas' } });
  await handlers.onCompaction({ messages: [] });
  await handlers.onPrompt(undefined);
  await handlers.onCompaction(undefined);
  const broken = handlersFor();
  broken.ctx.session.instructions.entry.put = async () => {
    throw new Error('boom');
  };
  await broken.handlers.onPrompt({ sessionID: 's1', prompt: { text: 'minhas notas' } });
  await broken.handlers.onCompaction({ sessionID: 's1', messages: [{ text: '[[A]]' }] });
});

test('plugin and hook lib share anchors behaviour and trigger text (no drift)', () => {
  const fixture = [
    { text: 'liga [[Alpha]] a [[Beta]] com #aprendizado' },
    { text: 'indexGraph.neighbors("Gamma")' },
    { text: `<skill_content>x [[Delta]] #noise</skill_content> e ${SESSION}` },
  ];
  const noise = [SESSION, PRECOMPACT];
  assert.deepEqual(
    extractAnchors(fixture, ANCHOR_CAP, noise),
    extractAnchorsCanonical(fixture, ANCHOR_CAP, 200_000, noise),
  );
  const triggers = JSON.parse(buildTriggers({ version: 'test' }));
  assert.equal(triggers.session, SESSION);
  assert.equal(triggers.preCompact, PRECOMPACT);
  assert.equal(triggers.boot, BOOT_SKILL);
  assert.deepEqual(
    compileRoutes().map((route) => route.test.source),
    compileRoutes(triggers.routes).map((route) => route.test.source),
  );
});

test('setup registers both hooks from the flat plugin plus sidecar, and disposes them', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbig-oc-'));
  fs.copyFileSync(
    path.join(
      path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))),
      'plugins',
      'opencode',
      OPENCODE_PLUGIN_FILE,
    ),
    path.join(dir, OPENCODE_PLUGIN_FILE),
  );
  fs.writeFileSync(path.join(dir, OPENCODE_TRIGGERS_FILE), buildTriggers({ version: 'test' }));
  const module = await import(`${pathToFileURL(path.join(dir, OPENCODE_PLUGIN_FILE)).href}?v=${Date.now()}`);
  assert.equal(module.default.id, 'sb-index-graph');
  assert.equal(typeof module.default.setup, 'function');

  const ctx = fakeCtx();
  const cleanup = await module.default.setup(ctx);
  assert.deepEqual([...ctx.hooks.keys()].sort(), ['compaction', 'prompt']);
  const event = { sessionID: 's9', prompt: { text: 'minhas notas sobre caching' } };
  await ctx.hooks.get('prompt')(event);
  assert.ok(ctx.entries.get('s9/second-brain'));
  assert.deepEqual(event.prompt.skills.map((entry) => entry.id), [
    'second-brain',
    'second-brain-retrieval',
  ]);
  await cleanup();
  assert.deepEqual(ctx.disposals.sort(), ['compaction', 'prompt']);
});

test('setup without the sidecar loads but registers no triggers', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbig-oc-empty-'));
  fs.copyFileSync(
    path.join(
      path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))),
      'plugins',
      'opencode',
      OPENCODE_PLUGIN_FILE,
    ),
    path.join(dir, OPENCODE_PLUGIN_FILE),
  );
  const module = await import(`${pathToFileURL(path.join(dir, OPENCODE_PLUGIN_FILE)).href}?v=${Date.now()}`);
  const ctx = fakeCtx();
  const cleanup = await module.default.setup(ctx);
  assert.equal(cleanup, undefined);
  assert.equal(ctx.hooks.size, 0);
});

test('routeSkill takes compiled sidecar routes and ignores malformed ones', () => {
  const triggers = JSON.parse(buildTriggers({ version: 'test' }));
  const routes = compileRoutes(
    triggers.routes.concat([{ skill: 'broken', pattern: '(', flags: 'i' }, { pattern: 'second-brain' }]),
  );
  assert.equal(routeSkill('guardar aprendizado', routes), 'managing-learnings');
  assert.equal(routeSkill('', routes), null);
  assert.equal(routeSkill(undefined, routes), null);
  assert.ok(!routes.some((route) => route.skill === 'broken'));
});
