export const SESSION = `Second-brain session boot (mandatory, including pure code work): hand off to second-brain-retrieval. Digest the space agent contract (e.g. AGENTS) and the project anchor = workspace basename. Preferences from that digest override third-party defaults (including Superpowers plan/spec paths). If the project page/home is missing, digest is not_found/ambiguous, or artifact location is unclear — ask the user; do not invent paths. If indexGraph/runtime is down — say so; do not present search/read as a digest. When the space prefers SB over the repo, do not create docs/superpowers/ in the project git and do not commit those artifacts there. Tag Superpowers pages with #superpowers plus #spec, #docs, or #plan as appropriate. Setup-second-brain remains optional and never blocks retrieval.`;

export const PRECOMPACT = `About to compact context. Preserve second-brain anchors (pages, tags, open questions). After compact, re-run session boot digest (contract + workspace basename) if work still depends on notes or preferences.`;

/**
 * Skill the OpenCode plugin attaches to the **first** prompt of a session, so
 * the mandatory session boot in `SESSION` is an actual skill attach and not only
 * prose in an injected entry. Cursor's `sessionStart` can only print the prose.
 */
export const BOOT_SKILL = 'second-brain-retrieval';

/**
 * Trigger table for per-message routing. One skill per prompt, first match wins.
 * Priority is deliberate:
 *   capture first  — a persist ask outranks reading notes, even when both appear;
 *   retrieval next — an explicit `indexGraph`/notes-reading ask;
 *   setup next     — onboarding words, but only before the generic manager route;
 *   manager last   — any other sign of notes work, so one entry point stays the rule.
 *
 * The capture route needs a write verb within reach of a learning noun: page
 * names like `[[.../Aprendizados]]` show up in plain reading questions and must
 * not pull the capture skill.
 *
 * Patterns are kept as source strings, not RegExp literals: the installer writes
 * this array straight into the OpenCode plugin's JSON data file, which cannot
 * carry RegExp.
 */
const CAPTURE_VERB = 'guard\\w*|grav\\w*|salv\\w*|regist\\w*|captur\\w*|anot\\w*|persist\\w*';
const LEARNING_NOUN = 'aprendizad\\w*|aprendizagem|learnings?';

export const ROUTES = [
  {
    skill: 'managing-learnings',
    pattern:
      `(${CAPTURE_VERB})[^.!?]{0,30}(${LEARNING_NOUN})|(${LEARNING_NOUN})[^.!?]{0,30}(${CAPTURE_VERB})|(organi[sz]\\w*|reorgani[sz]\\w*|tipos? de|que tipo de)[^.!?]{0,20}(${LEARNING_NOUN})`,
    flags: 'i',
  },
  {
    skill: 'second-brain-retrieval',
    pattern:
      'index ?graph|digest|neighbors|manifest|subgraph|vizinho|nas minhas notas|procur\\w* nas notas|o que [^.!?]{0,25}notas|como [^.!?]{0,25}(relacion|ligam|conecta)\\w*[^.!?]{0,25}notas',
    flags: 'i',
  },
  {
    skill: 'setup-second-brain',
    pattern:
      'setup-second-brain|configur\\w* (o |um |meu )?second|ponto de partida|greenfield|come[çc]ar (o second|do zero)',
    flags: 'i',
  },
  {
    skill: 'second-brain',
    pattern: 'second[- ]brain|silver ?bullet|silverbullet|\\[\\[|minhas notas|as notas|notas sobre|#aprendizado',
    flags: 'i',
  },
];

export function compileRoutes(routes = ROUTES) {
  const out = [];
  for (const route of routes) {
    if (!route?.skill || typeof route.pattern !== 'string') continue;
    try {
      out.push({ skill: route.skill, test: new RegExp(route.pattern, route.flags || 'i') });
    } catch {
      // a bad pattern in the table must not take the trigger layer down
    }
  }
  return out;
}

/** Highest-priority skill id for this prompt text, or null. */
export function routeSkill(text, routes = compileRoutes()) {
  const value = typeof text === 'string' ? text : '';
  if (!value) return null;
  for (const route of routes) {
    if (route.test.test(value)) return route.skill;
  }
  return null;
}

export const ANCHOR_CAP = 12;

/**
 * Second-brain anchors worth keeping across compaction: `[[page links]]`,
 * `#tags`, and the string arguments of `indexGraph.*` calls.
 *
 * Scans the JSON form of the transcript instead of walking message shapes: the
 * hook payload is OpenCode-internal and changes between versions, so a shape
 * walk would silently stop collecting. Injected skill and instruction blocks are
 * dropped first — their own `[[wiki links]]` examples are not anchors. Bounded
 * by `haystackCap` characters.
 */
export function extractAnchors(messages, cap = ANCHOR_CAP, haystackCap = 200_000, noise = []) {
  const haystack =
    typeof messages === 'string' ? messages : safeStringify(messages);
  const cleaned = stripNoise(haystack, noise);
  const tail = cleaned.length > haystackCap ? cleaned.slice(-haystackCap) : cleaned;
  const found = [];
  const push = (raw) => {
    const value = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!value) return;
    if (found.length >= cap) return;
    if (value.length < 2) return;
    if (found.includes(value)) return;
    found.push(value);
  };
  for (const match of tail.matchAll(/\[\[([^\]\n|#]{2,120})/g)) push(match[1]);
  for (const match of tail.matchAll(/(?:^|[\s(,>])#([a-z][\w-]{1,40})/gi)) push(`#${match[1]}`);
  // `\\?` because the scan runs over the JSON form, where quotes appear escaped.
  for (const match of tail.matchAll(/indexGraph\.[a-zA-Z]+\(\s*\\?["']([^"'\n\\]{2,120})\\?["']/g)) push(match[1]);
  return found;
}

function safeStringify(value) {
  try {
    return JSON.stringify(value ?? '');
  } catch {
    return '';
  }
}

/** Drops injected skill/instruction blocks and the trigger texts themselves. */
export function stripNoise(haystack, noise = []) {
  let out = String(haystack).replace(/<skill_content[\s\S]*?<\/skill_content>|<context[\s\S]*?<\/context>/gi, ' ');
  for (const text of noise) {
    if (typeof text !== 'string' || text.length < 8) continue;
    out = out.split(text).join(' ');
  }
  return out;
}

/**
 * Compact value for the session's instruction entry. Entries live outside the
 * transcript, so they survive summarization; cap the JSON size to stay under
 * OpenCode's instruction-entry limit.
 */
export function anchorValue(preCompact, anchors, maxChars = 6000) {
  let kept = anchors.slice();
  let value = { text: preCompact, anchors: kept };
  while (kept.length > 0 && JSON.stringify(value).length > maxChars) {
    kept = kept.slice(0, -1);
    value = { text: preCompact, anchors: kept };
  }
  return value;
}
