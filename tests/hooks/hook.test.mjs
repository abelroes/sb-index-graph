import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { responseFor } from '../../hooks/sb-index-graph.mjs';

const script = fileURLToPath(new URL('../../hooks/sb-index-graph.mjs', import.meta.url));

test('sessionStart returns additional_context', () => {
  const out = responseFor('sessionStart', {});
  assert.match(String(out.additional_context), /second-brain/i);
});

test('preCompact returns user_message', () => {
  const out = responseFor('preCompact', {});
  assert.match(String(out.user_message), /second-brain/i);
  assert.equal(out.additional_context, undefined);
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
  assert.match(JSON.parse(ok.stdout).additional_context, /second-brain/i);
});
