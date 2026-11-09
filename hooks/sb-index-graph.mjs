#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { PRECOMPACT, SESSION } from './lib/messages.mjs';

/**
 * Map Cursor hook events to documented output fields only
 * (https://cursor.com/docs/hooks):
 * - sessionStart → additional_context
 * - preCompact → user_message (observational)
 *
 * Intentionally no stop / subagentStop followups (visible auto-submit spam)
 * and no beforeSubmitPrompt (cannot soft-inject context).
 */
export function responseFor(event, input) {
  const src = input && typeof input === 'object' ? input : {};
  const eventName = event || src.hook_event_name || src.event || '';
  switch (eventName) {
    case 'sessionStart':
      return { additional_context: SESSION };
    case 'preCompact':
      return { user_message: PRECOMPACT };
    default:
      return {};
  }
}

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.on('error', reject);
  });
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
