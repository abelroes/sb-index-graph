#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { claimDedup } from './lib/dedup.mjs';
import { hasCountFields, isSubstantial, promptMatches } from './lib/heuristics.mjs';
import {
  PRECOMPACT,
  SESSION,
  STOP_FOLLOWUP,
  SUBAGENT_FOLLOWUP,
} from './lib/messages.mjs';

export { hasCountFields, isSubstantial, promptMatches };

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.on('error', reject);
  });
}

/**
 * Map Cursor hook events to documented output fields only
 * (https://cursor.com/docs/hooks):
 * - sessionStart → additional_context
 * - beforeSubmitPrompt → continue / user_message only (no context inject) → {}
 * - stop → followup_message; input is status + loop_count (no tool counts)
 * - subagentStop → followup_message when status is completed
 * - preCompact → user_message (observational)
 */
export function responseFor(event, input) {
  const src = input && typeof input === 'object' ? input : {};
  const eventName = event || src.hook_event_name || src.event || '';
  switch (eventName) {
    case 'sessionStart':
      return { additional_context: SESSION };
    case 'beforeSubmitPrompt':
      // Docs: only `continue` + `user_message` (when blocked). Soft agent
      // injection is not supported — keep registered, return {}.
      return {};
    case 'stop': {
      // Real payload: { status, loop_count }. Counts appear only in tests /
      // subagentStop. Fire on completed; if counts are present, also require
      // the substantial threshold.
      if (src.status && src.status !== 'completed') return {};
      if (hasCountFields(src)) {
        if (!isSubstantial(src)) return {};
      } else if (src.status !== 'completed') {
        return {};
      }
      if (!src.__skipDedup && !claimDedup('stop', Date.now(), src.__dedupFile)) return {};
      return { followup_message: STOP_FOLLOWUP };
    }
    case 'subagentStop': {
      if (src.status && src.status !== 'completed') return {};
      if (!src.__skipDedup && !claimDedup('subagentStop', Date.now(), src.__dedupFile)) return {};
      return { followup_message: SUBAGENT_FOLLOWUP };
    }
    case 'preCompact':
      return { user_message: PRECOMPACT };
    default:
      return {};
  }
}

export async function main() {
  try {
    const raw = (await readStdin()).trim();
    const input = raw ? JSON.parse(raw) : {};
    const eventName = input.hook_event_name || input.event || '';
    process.stdout.write(`${JSON.stringify(responseFor(eventName, input))}\n`);
  } catch {
    process.stdout.write('{}\n');
  }
}

function runningAsScript() {
  try {
    return Boolean(process.argv[1])
      && import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
}

if (runningAsScript()) {
  main()
    .then(() => process.exit(0))
    .catch(() => {
      process.stdout.write('{}\n');
      process.exit(0);
    });
}
