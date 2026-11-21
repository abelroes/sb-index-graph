import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SESSION,
  PRECOMPACT,
  ROUTES,
  compileRoutes,
  routeSkill,
  extractAnchors,
  anchorValue,
  ANCHOR_CAP,
} from '../../hooks/lib/messages.mjs';
import { SKILL_NAMES } from '../../cli/constants.mjs';

test('trigger text stays second-brain specific', () => {
  assert.match(SESSION, /second-brain/i);
  assert.match(PRECOMPACT, /second-brain anchors/i);
});

test('every route targets an installed skill id', () => {
  const allowed = new Set(SKILL_NAMES);
  for (const route of ROUTES) {
    assert.ok(allowed.has(route.skill), `unknown skill in routes: ${route.skill}`);
    assert.equal(typeof route.pattern, 'string');
    assert.ok(route.test === undefined, 'routes stay JSON-safe (no RegExp literals)');
  }
});

test('routeSkill picks one skill, priority order, null when nothing matches', () => {
  const cases = [
    ['grava este aprendizado sobre locks', 'managing-learnings'],
    ['indexGraph.digest("jwt-refresh")', 'second-brain-retrieval'],
    ['preciso de um ponto de partida para aprendizados', 'setup-second-brain'],
    ['[[Software Engineer/AI/Aprendizados]] diz algo sobre isto?', 'second-brain'],
    ['renomeia a variável foo', null],
    ['', null],
  ];
  for (const [text, expected] of cases) assert.equal(routeSkill(text), expected, text);
});

test('capture beats retrieval when both match', () => {
  assert.equal(
    routeSkill('o que dizem as minhas notas? guardar como aprendizado'),
    'managing-learnings',
  );
});

test('compileRoutes drops malformed entries without throwing', () => {
  const routes = compileRoutes([
    { skill: 'broken', pattern: '(', flags: 'i' },
    { pattern: 'notes' },
    { skill: 'second-brain', pattern: 'notes', flags: 'i' },
  ]);
  assert.deepEqual(routes.map((route) => route.skill), ['second-brain']);
});

test('extractAnchors collects page links, tags, and digest anchors', () => {
  const anchors = extractAnchors([
    { text: '[[Notes/Jwt]] e [[Notes/Jwt]] e [[Notes/Empty]]' },
    { text: 'tags #aprendizado e #second-brain' },
    { text: 'indexGraph.neighbors("error-handling")' },
  ]);
  assert.deepEqual(anchors, ['Notes/Jwt', 'Notes/Empty', '#aprendizado', '#second-brain', 'error-handling']);
});

test('anchor scan skips injected skill bodies and the trigger text itself', () => {
  const noise = [SESSION, PRECOMPACT];
  const anchors = extractAnchors(
    [
      { text: '<skill_content name="managing-learnings">usar [[wiki links]] e tags #exemplo</skill_content>' },
      { text: `lembrete injectado: ${SESSION}` },
      { text: 'a nota real é [[Notes/Jwt]] e a tag #aprendizado' },
    ],
    ANCHOR_CAP,
    200_000,
    noise,
  );
  assert.deepEqual(anchors, ['Notes/Jwt', '#aprendizado']);
});

test('anchorValue trims until the entry fits the size cap', () => {
  const anchors = Array.from({ length: 12 }, (_, i) => `pagina com algum texto de âncora ${i}`);
  const value = anchorValue(PRECOMPACT, anchors, 400);
  assert.ok(JSON.stringify(value).length <= 400);
  assert.ok(value.anchors.length < anchors.length);
  assert.equal(value.text, PRECOMPACT);
  assert.equal(anchorValue(PRECOMPACT, [], 400).anchors.length, 0);
});

test('anchor cap is shared by both trigger layers', () => {
  const noise = Array.from({ length: 40 }, (_, i) => `[[P${i}]]`).join(' ');
  assert.equal(extractAnchors(noise).length, ANCHOR_CAP);
});
