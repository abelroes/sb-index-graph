import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const DEDUP_MS = 5 * 60 * 1000;

const DEDUP_EVENTS = new Set(['stop', 'subagentStop']);

export function dedupPath() {
  return path.join(os.tmpdir(), 'sb-index-graph-hook-dedup.json');
}

function readStore(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** @returns {boolean} true when the nudge should be emitted */
export function claimDedup(eventName, now = Date.now(), file = dedupPath()) {
  if (!DEDUP_EVENTS.has(eventName)) return true;
  const store = readStore(file);
  const last = Number(store[eventName] ?? 0);
  if (Number.isFinite(last) && now - last < DEDUP_MS) return false;
  store[eventName] = now;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(store));
  } catch {
    // Fail-open: a broken dedup store must not swallow the nudge.
  }
  return true;
}
