// sb-index-graph — OpenCode triggers for the second-brain skills.
//
// OpenCode equivalent of the Cursor hooks in `hooks/hooks.json.fragment`:
//   sessionStart -> keyed session instruction entry (`second-brain`) + attaches
//                   the boot skill (`second-brain-retrieval`) to the first prompt
//   preCompact   -> keyed entry refreshed with the transcript's anchors
// plus what Cursor's hooks could not do: edit the incoming prompt itself
// (`session.hook("prompt")` -> `prompt.skills`), so a trigger can attach a skill
// instead of only printing prose.
//
// Installed by `sb-index-graph install` as `plugins/sb-index-graph.js` plus its
// data file `sb-index-graph.triggers.json` (generated from hooks/lib/messages.mjs
// so the trigger text stays single-sourced). OpenCode auto-loads plugins from
// `~/.config/opencode/plugins/` and `.opencode/plugins/`; entries are plain
// `.js`/`.ts`, so this file keeps a flat name and no sibling `.js` neighbours.
//
// Shape: a plain `{ id, setup }` default export loads on OpenCode 2.x without a
// runtime dependency on `@opencode/plugin` (verified against the flat plugins
// already used in this environment). Keep it dependency-free: node builtins only.
//
// Fail-open like the Cursor hook: any missing file, unknown payload shape, or
// API error leaves OpenCode running exactly as it would without this plugin.
// OPENCODE_SB_DEBUG=1 logs what was skipped to the server log.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ENTRY_KEY = 'second-brain';
const ANCHORS_KEY = 'second-brain-anchors';
const ANCHOR_CAP = 12;
const ANCHOR_VALUE_MAX = 6000;

function debug(...args) {
  if (process.env.OPENCODE_SB_DEBUG === '1') console.log('[sb-index-graph]', ...args);
}

function loadTriggers() {
  const file = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'sb-index-graph.triggers.json',
  );
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!raw || typeof raw.session !== 'string') return null;
    return raw;
  } catch {
    return null;
  }
}

function compiledRoutes(triggers) {
  const routes = Array.isArray(triggers.routes) ? triggers.routes : [];
  return routes
    .filter((route) => route && typeof route.skill === 'string' && typeof route.pattern === 'string')
    .map((route) => {
      try {
        return { skill: route.skill, test: new RegExp(route.pattern, route.flags || 'i') };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/** Highest-priority skill id for this prompt text, or null. */
export function routeSkill(text, routes) {
  if (typeof text !== 'string' || !text) return null;
  for (const route of routes) if (route.test.test(text)) return route.skill;
  return null;
}

/**
 * Anchors worth keeping across compaction: `[[page links]]`, `#tags`, and the
 * string arguments of `indexGraph.*` calls. Scans the JSON form of the transcript
 * because the hook payload shape is OpenCode-internal; a shape walk would stop
 * collecting silently when it changes. Injected skill/instruction blocks and the
 * trigger texts are dropped first: their own `[[wiki links]]` examples are noise.
 */
export function extractAnchors(messages, cap = ANCHOR_CAP, noise = []) {
  let haystack;
  try {
    haystack = typeof messages === 'string' ? messages : JSON.stringify(messages ?? '');
  } catch {
    haystack = '';
  }
  haystack = stripNoise(haystack, noise);
  if (haystack.length > 200_000) haystack = haystack.slice(-200_000);
  const found = [];
  const push = (raw) => {
    if (found.length >= cap) return;
    const value = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (value.length < 2 || found.includes(value)) return;
    found.push(value);
  };
  for (const match of haystack.matchAll(/\[\[([^\]\n|#]{2,120})/g)) push(match[1]);
  for (const match of haystack.matchAll(/(?:^|[\s(,>])#([a-z][\w-]{1,40})/gi)) push(`#${match[1]}`);
  // `\\?` because the scan runs over the JSON form, where quotes appear escaped.
  for (const match of haystack.matchAll(/indexGraph\.[a-zA-Z]+\(\s*\\?["']([^"'\n\\]{2,120})\\?["']/g)) push(match[1]);
  return found;
}

/**
 * Drops regions that echo documentation instead of the user's notes: injected
 * skill bodies, keyed context blocks, and the trigger texts themselves.
 */
function stripNoise(haystack, noise = []) {
  let out = String(haystack).replace(
    /<skill_content[\s\S]*?<\/skill_content>|<context[\s\S]*?<\/context>/gi,
    ' ',
  );
  for (const text of noise) {
    if (typeof text !== 'string' || text.length < 8) continue;
    out = out.split(text).join(' ');
  }
  return out;
}

function anchorValue(preCompact, anchors, maxChars = ANCHOR_VALUE_MAX) {
  let kept = anchors.slice();
  let value = { text: preCompact, anchors: kept };
  while (kept.length > 0 && JSON.stringify(value).length > maxChars) {
    kept = kept.slice(0, -1);
    value = { text: preCompact, anchors: kept };
  }
  return value;
}

function sessionIDOf(event) {
  const source = event?.data && typeof event.data === 'object' ? event.data : event;
  return (
    event?.sessionID ??
    source?.sessionID ??
    event?.inbox?.sessionID ??
    event?.message?.sessionID
  );
}

function messagesOf(event) {
  if (event?.messages) return event.messages;
  if (event?.data && typeof event.data === 'object' && event.data.messages) return event.data.messages;
  return [];
}

function promptOf(event) {
  for (const candidate of [event?.prompt, event?.data?.prompt]) {
    if (candidate && typeof candidate === 'object') return candidate;
  }
  return null;
}

/** Skill ids the agent may load. Cached per session, refreshed when it misses. */
async function availableSkillIDs(ctx, state, sessionID, refresh = false) {
  if (!refresh && state.available.has(sessionID)) return state.available.get(sessionID);
  try {
    const listed = await ctx.skill.list();
    // The server list is `{ location, data: [...] }`; older shapes used a bare
    // array or `skills`. Accept all three so a renamed envelope cannot disable
    // routing silently.
    const rows = Array.isArray(listed)
      ? listed
      : (listed?.data ?? listed?.skills ?? []);
    const ids = new Set(
      Array.from(rows).map((row) => String(row?.id ?? row?.name ?? '')).filter(Boolean),
    );
    state.available.set(sessionID, ids);
    debug(`skill.list for ${sessionID}: ${ids.size} skills`);
    return ids;
  } catch (err) {
    debug(`skill.list failed for ${sessionID}: ${err?.message || err}`);
    return state.available.get(sessionID) ?? new Set();
  }
}

/** Testable seam: `setup` wires these to OpenCode hooks. */
export function createHandlers(ctx, triggers, state = { primed: new Set(), available: new Map() }) {
  const routes = compiledRoutes(triggers);
  if (!state.available) state.available = new Map();

  async function canLoad(skill, sessionID) {
    if ((await availableSkillIDs(ctx, state, sessionID)).has(skill)) return true;
    // The skill may have been installed after this session started.
    return (await availableSkillIDs(ctx, state, sessionID, true)).has(skill);
  }

  async function onPrompt(event) {
    const sessionID = sessionIDOf(event);
    if (!sessionID) return debug('prompt hook: no sessionID in payload');
    const prompt = promptOf(event);
    const booted = !state.primed.has(sessionID);
    try {
      if (booted) {
        state.primed.add(sessionID);
        await ctx.session.instructions.entry.put({
          sessionID,
          key: ENTRY_KEY,
          value: { text: triggers.session, routing: routes.length > 0 },
        });
      }
      if (!prompt) return debug('prompt hook: no prompt draft in payload');
      // Routed skill for this prompt, plus the boot skill on the session's
      // first prompt: the shared trigger text makes session boot mandatory
      // (contract + project anchor), and a rule in injected prose is soft —
      // attaching the retrieval specialist is what boot means operationally.
      // Cursor's `sessionStart` could only print the prose.
      const wanted = [routeSkill(prompt.text ?? '', routes), booted ? triggers.boot : null].filter(
        Boolean,
      );
      if (wanted.length === 0) return;
      const skills = (prompt.skills ??= []);
      for (const skill of wanted) {
        if (!(await canLoad(skill, sessionID))) {
          debug(`skill not available: ${skill}`);
          continue;
        }
        if (skills.some((entry) => entry?.id === skill)) continue;
        skills.push({ id: skill });
        debug(`attached ${skill} to the prompt in ${sessionID}`);
      }
    } catch (err) {
      debug(`prompt hook skipped: ${err?.message || err}`);
    }
  }

  async function onCompaction(event) {
    const sessionID = sessionIDOf(event);
    if (!sessionID) return debug('compaction hook: no sessionID in payload');
    try {
      const anchors = extractAnchors(messagesOf(event), ANCHOR_CAP, [
        triggers.session,
        triggers.preCompact,
      ]);
      await ctx.session.instructions.entry.put({
        sessionID,
        key: ANCHORS_KEY,
        value: anchorValue(triggers.preCompact ?? triggers.session, anchors),
      });
      debug(`kept ${anchors.length} second-brain anchors for ${sessionID}`);
    } catch (err) {
      debug(`compaction hook skipped: ${err?.message || err}`);
    }
  }

  return { onPrompt, onCompaction };
}

export default {
  id: 'sb-index-graph',
  async setup(ctx) {
    const triggers = loadTriggers();
    if (!triggers) {
      console.log('[sb-index-graph] triggers file missing; second-brain triggers disabled');
      return;
    }
    const state = { primed: new Set() };
    const handlers = createHandlers(ctx, triggers, state);
    const registrations = [];
    registrations.push(await ctx.session.hook('prompt', handlers.onPrompt));
    registrations.push(await ctx.session.hook('compaction', handlers.onCompaction));
    return async () => {
      for (const registration of registrations) {
        try {
          await registration?.dispose?.();
        } catch {
          // already gone
        }
      }
    };
  },
};
