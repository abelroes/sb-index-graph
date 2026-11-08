import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { responseFor, promptMatches, isSubstantial } from '../../hooks/sb-index-graph.mjs';

const script = fileURLToPath(new URL('../../hooks/sb-index-graph.mjs', import.meta.url));

test('promptMatches notes signal', () => {
  assert.equal(promptMatches('what do my notes say about JWT'), true);
  assert.equal(promptMatches('rename the variable'), false);
});

test('isSubstantial uses thresholds', () => {
  assert.equal(isSubstantial({ toolCallCount: 5 }), true);
  assert.equal(isSubstantial({ editCount: 3 }), true);
  assert.equal(isSubstantial({ tool_call_count: 5 }), true);
  assert.equal(isSubstantial({ edit_count: 3 }), true);
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

test('stop dedup skips a second nudge inside the window', () => {
  const file = path.join(os.tmpdir(), `sbig-dedup-${process.pid}-${Date.now()}.json`);
  fs.rmSync(file, { force: true });
  const input = { toolCallCount: 9, __dedupFile: file };
  assert.ok(responseFor('stop', input).followup_message);
  assert.deepEqual(responseFor('stop', input), {});
  fs.rmSync(file, { force: true });
});

test('subagentStop and preCompact return nudges', () => {
  assert.ok(responseFor('subagentStop', { __skipDedup: true }).followup_message);
  assert.match(String(responseFor('preCompact', {}).additional_context), /second-brain/i);
  assert.deepEqual(responseFor('unknown', {}), {});
});

test('stdin fail-open prints empty object', () => {
  const bad = spawnSync(process.execPath, [script], { input: 'not-json', encoding: 'utf8' });
  assert.equal(bad.status, 0);
  assert.equal(bad.stdout, '{}\n');
  const ok = spawnSync(process.execPath, [script], {
    input: JSON.stringify({ event: 'sessionStart' }),
    encoding: 'utf8',
  });
  assert.equal(ok.status, 0);
  assert.match(JSON.parse(ok.stdout).additional_context, /second-brain/i);
});
