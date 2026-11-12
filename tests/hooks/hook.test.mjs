import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { responseFor } from '../../hooks/sb-index-graph.mjs';
import { SESSION, PRECOMPACT } from '../../hooks/lib/messages.mjs';

const script = fileURLToPath(new URL('../../hooks/sb-index-graph.mjs', import.meta.url));

test('sessionStart returns additional_context with mandatory boot', () => {
  const out = responseFor('sessionStart', {});
  const ctx = String(out.additional_context);
  assert.match(ctx, /second-brain-retrieval/i);
  assert.match(ctx, /boot/i);
  assert.match(ctx, /basename/i);
  assert.match(ctx, /ask the user/i);
  assert.match(ctx, /#superpowers/);
  assert.match(ctx, /#spec/);
  assert.match(ctx, /#plan/);
  assert.match(ctx, /#docs/);
  assert.match(ctx, /docs\/superpowers/);
  assert.doesNotMatch(ctx, /Software Engineer\/Projetos/);
  assert.equal(ctx, SESSION);
});

test('preCompact returns user_message requiring re-boot digest', () => {
  const out = responseFor('preCompact', {});
  const msg = String(out.user_message);
  assert.match(msg, /re-run/i);
  assert.match(msg, /boot/i);
  assert.match(msg, /second-brain/i);
  assert.equal(out.additional_context, undefined);
  assert.equal(msg, PRECOMPACT);
  assert.doesNotMatch(msg, /Software Engineer\/Projetos/);
});

test('retired events return empty', () => {
  assert.deepEqual(responseFor('beforeSubmitPrompt', { prompt: 'notes about JWT' }), {});
  assert.deepEqual(responseFor('stop', { status: 'completed' }), {});
  assert.deepEqual(responseFor('subagentStop', { status: 'completed' }), {});
  assert.deepEqual(responseFor('unknown', {}), {});
});

test('stdin fail-open prints empty object', () => {
  const bad = spawnSync(process.execPath, [script], { input: 'not-json', encoding: 'utf8' });
  assert.equal(bad.status, 0);
  assert.equal(bad.stdout, '{}\n');
  const ok = spawnSync(process.execPath, [script], {
    input: JSON.stringify({ hook_event_name: 'sessionStart' }),
    encoding: 'utf8',
  });
  assert.equal(ok.status, 0);
  assert.match(JSON.parse(ok.stdout).additional_context, /boot/i);
});
