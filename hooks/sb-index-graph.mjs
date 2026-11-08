#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { claimDedup } from './lib/dedup.mjs';
import { isSubstantial, promptMatches } from './lib/heuristics.mjs';
import {
  PRECOMPACT,
  PROMPT_MATCH,
  SESSION,
  STOP_FOLLOWUP,
  SUBAGENT_FOLLOWUP,
} from './lib/messages.mjs';

export { isSubstantial, promptMatches };

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.on('error', reject);
  });
}

export function responseFor(event, input) {
  const src = input && typeof input === 'object' ? input : {};
  const eventName = event || src.hook_event_name || src.event || '';
  switch (eventName) {
    case 'sessionStart':
      return { additional_context: SESSION };
    case 'beforeSubmitPrompt':
      return promptMatches(src.prompt) ? { additional_context: PROMPT_MATCH } : {};
    case 'stop': {
      if (!isSubstantial(src)) return {};
      if (!src.__skipDedup && !claimDedup('stop', Date.now(), src.__dedupFile)) return {};
      return { followup_message: STOP_FOLLOWUP };
    }
    case 'subagentStop': {
      if (!src.__skipDedup && !claimDedup('subagentStop', Date.now(), src.__dedupFile)) return {};
      return { followup_message: SUBAGENT_FOLLOWUP };
    }
    case 'preCompact':
      return { additional_context: PRECOMPACT };
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
