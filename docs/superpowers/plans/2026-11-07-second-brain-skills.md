# Second-brain Skills Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split agent skills into thin manager `second-brain`, retrieval `second-brain-retrieval`, optional onboarding `setup-second-brain`, and capture `managing-learnings`, per the approved design spec.

**Architecture:** Thin router handoffs to specialist skills. Greenfield optionally offers setup (skippable). Setup runs a short interview plus optional codebase/docs/web inputs, then cite→select→persist for convention + topic skeleton + 3–5 seeds. Retrieval keeps fail-closed `indexGraph` behavior. No Library/`indexGraph` API changes.

**Tech Stack:** Agent Skills (`SKILL.md` under `skills/`), Cursor Task subagents for skill TDD pressure tests, optional `agents/*` mirrors, README/`agents/PROTOCOL.md` docs. SilverBullet MCP for discover-only checks (not required for skill file edits).

## Global Constraints

- Skill bodies and shipped docs in **English**; chat with the user may stay Portuguese.
- Description frontmatter: **Use when…** triggers only — no workflow summary (SDO).
- Canonical paths: `skills/<name>/SKILL.md`; mirrors under `agents/{cursor,claude,kimi,agents-skills}/` kept in sync after each skill task.
- Setup is **optional**; never block retrieval on skipped setup.
- No silent brownfield migration; no PARA/Zettel/`tag.define` by default.
- Do **not** change `PLUG.md` / `src/graph.lua` / Library Lua API.
- Skill TDD: RED baseline **without** skill text before writing/editing that skill; GREEN with skill; record in `agents/TESTING.md`.
- Cite-before-persist on every learning write (setup + managing).

## File map

| Path | Responsibility |
|------|----------------|
| `skills/second-brain-retrieval/SKILL.md` | Former retrieval protocol (rename from `skills/second-brain`) |
| `skills/second-brain/SKILL.md` | New thin manager / router |
| `skills/setup-second-brain/SKILL.md` | Greenfield interview + seed (new) |
| `skills/managing-learnings/SKILL.md` | Capture; trim greenfield to defer/minimal config |
| `agents/*/…` | Mirrors of the four skills |
| `agents/PROTOCOL.md`, `README.md`, `agents/TESTING.md` | Install map + test ledger |
| `docs/superpowers/specs/2026-11-07-second-brain-skills-design.md` | Spec (read-only reference) |

---

### Task 1: Rename retrieval skill (`second-brain` → `second-brain-retrieval`)

**Files:**
- Create: `skills/second-brain-retrieval/SKILL.md`
- Delete: old content role of `skills/second-brain/SKILL.md` (replaced in Task 2; this task moves retrieval out first)
- Modify: `agents/*/second-brain/` → add `second-brain-retrieval/` mirrors; remove obsolete retrieval-named-as-second-brain after Task 2
- Test: pressure prompts recorded in `agents/TESTING.md`

**Interfaces:**
- Consumes: current `skills/second-brain/SKILL.md` body
- Produces: skill `name: second-brain-retrieval`; persistence handoff text points to `managing-learnings`; manager name reserved for Task 2

- [ ] **Step 1: RED — retrieval regression without loading the skill file**

Dispatch a fresh Task subagent **without** pasting any skill. Scenarios (option letters):

1. `index_unavailable` + ship pressure → must choose stop / report (not search-as-digest).
2. Ambiguous digest + “don’t ask” → must refuse digest-all merge.
3. Explicit retrieval during pure refactor → must digest.

Record verbatim choices in `agents/TESTING.md` under `## 2026-11-07 retrieval rename RED`.

- [ ] **Step 2: Write `skills/second-brain-retrieval/SKILL.md`**

Copy current `skills/second-brain/SKILL.md`, then change:

```yaml
---
name: second-brain-retrieval
description: >-
  Use when retrieving a closed subgraph from SilverBullet via indexGraph
  (digest/path/neighbors); when answering from SB notes after the second-brain
  manager hands off; when finding how notes connect; or when tempted to
  approximate indexGraph with bulk search/read after it failed.
---
```

- Title `# second-brain-retrieval`.
- State that `/second-brain` is the **manager**; this skill is the retrieval specialist (may still be attached directly).
- Replace red-flag “Ignoring an explicit `/second-brain` invoke” with “Ignoring an explicit retrieval handoff or direct attach of this skill during coding”.
- Keep fail-closed / scope / rationalization table; persistence → `managing-learnings`.

- [ ] **Step 3: GREEN — same three scenarios with skill text in the prompt**

Expect A / A / A (fail-closed, disambiguate, digest). Append results to `agents/TESTING.md`.

- [ ] **Step 4: Mirror to agents/**

```bash
for c in cursor claude kimi agents-skills; do
  mkdir -p "agents/$c/second-brain-retrieval"
  cp skills/second-brain-retrieval/SKILL.md "agents/$c/second-brain-retrieval/SKILL.md"
done
```

- [ ] **Step 5: Commit**

```bash
git add skills/second-brain-retrieval agents/*/second-brain-retrieval agents/TESTING.md
git commit -m "$(cat <<'EOF'
📝 docs: (skills) add second-brain-retrieval from former second-brain

Keep fail-closed indexGraph protocol under the retrieval specialist name.
EOF
)"
```

---

### Task 2: Thin manager skill `second-brain`

**Files:**
- Replace: `skills/second-brain/SKILL.md` (manager body)
- Modify: `agents/*/second-brain/SKILL.md` mirrors
- Modify: `agents/TESTING.md`

**Interfaces:**
- Consumes: Task 1 `second-brain-retrieval`; existing `managing-learnings`; upcoming `setup-second-brain` (name only — handoff string OK before Task 3 file exists)
- Produces: router contract — greenfield offer; skip; handoffs; no digest/write

- [ ] **Step 1: RED — manager behaviors without skill**

Subagent scenarios (no skill text):

1. Greenfield space + user asks for notes help → does agent invent taxonomy / skip asking about setup / call digest itself?
2. User says “Not now” to setup, then asks for JWT notes → does agent block retrieval?
3. User says “save this aprendizado” → does agent write without cite list?

Record in `agents/TESTING.md` under `## 2026-11-07 manager RED`.

- [ ] **Step 2: Write manager `skills/second-brain/SKILL.md`**

Use this body (adjust only if GREEN fails):

```markdown
---
name: second-brain
description: >-
  Use when the user invokes /second-brain or this skill; when second-brain or
  SilverBullet context may help (including during pure codebase work); when
  choosing among setup, retrieval, or learning capture; or when a space looks
  greenfield for aprendizados and setup might be offered.
---

# second-brain

Thin **manager** for SilverBullet second-brain work. Classify the request and
**hand off** to one specialist. Do not call `indexGraph` or write learning pages yourself.

**Specialists**
- `setup-second-brain` — optional greenfield onboarding (interview + seed)
- `second-brain-retrieval` — `indexGraph` closed-subgraph retrieval
- `managing-learnings` — capture / cite-before-persist

## Greenfield vs brownfield

- **Greenfield:** no usable learnings convention (no dominant `#aprendizado` / agreed home/config).
- **Brownfield:** convention exists — do not offer setup by default.

On greenfield, ask once: help create a learnings starting point?
- **Yes** → hand off to `setup-second-brain`
- **Not now** / **Never this session** → do not re-offer this session; continue routing
- Setup is **optional**; never required for retrieval

## Routing

| Signal | Handoff |
|--------|---------|
| Notes / preferences / SB knowledge / “my way of working” | After greenfield ask (if any) → `second-brain-retrieval` |
| Save / organize a learning | `managing-learnings` |
| `/setup-second-brain` | `setup-second-brain` (even on brownfield: additive re-seed only) |
| Pure code, no second-brain intent | Do not force this manager |

## Red flags — STOP

- Calling `indexGraph` or writing learnings from this skill
- Re-offering setup after skip in the same session
- Blocking retrieval because setup was skipped
- Silent migration or inventing a full PKM taxonomy here
```

- [ ] **Step 3: GREEN — same three manager scenarios with skill in prompt**

Expect: offer setup on greenfield; after skip, retrieval allowed; save → managing (cite), no digest from manager.

- [ ] **Step 4: Sync mirrors + commit**

```bash
for c in cursor claude kimi agents-skills; do
  cp skills/second-brain/SKILL.md "agents/$c/second-brain/SKILL.md"
done
git add skills/second-brain agents/*/second-brain agents/TESTING.md
git commit -m "$(cat <<'EOF'
📝 docs: (skills) make second-brain a thin manager

Route to setup, retrieval, or managing-learnings; setup offer optional on greenfield.
EOF
)"
```

---

### Task 3: Add `setup-second-brain`

**Files:**
- Create: `skills/setup-second-brain/SKILL.md`
- Create: `agents/*/setup-second-brain/SKILL.md`
- Modify: `agents/TESTING.md`

**Interfaces:**
- Consumes: cite-before-persist contract (same as managing); manager handoff; SB pages/tags
- Produces: interview → proposal (convention + skeleton + 3–5 seeds) → selection → persist

- [ ] **Step 1: RED — onboarding without skill**

Subagent scenarios:

1. Greenfield + “set up aprendizados NOW don’t ask” → invents full tree / writes immediately?
2. After 2 questions, agent dumps 20 seed pages without cite list?
3. Brownfield + `/setup-second-brain` → silent migrate existing tree?

Record under `## 2026-11-07 setup RED`.

- [ ] **Step 2: Write `skills/setup-second-brain/SKILL.md`**

```markdown
---
name: setup-second-brain
description: >-
  Use when the user invokes /setup-second-brain; when the second-brain manager
  hands off greenfield onboarding; or when helping create a minimal learnings
  starting point (interview, topic skeleton, seed notes) before first capture.
---

# setup-second-brain

Optional **greenfield onboarding** for SilverBullet learnings. Produce a basic
starting point — not a full PKM system.

**Outcome (after user selection):** minimal convention (tag + home + note shape)
+ topic skeleton + **3–5** short seed learnings (opinions/directions).

## Interview (~5–8 questions, one at a time)

Cover: most common work, role, tools, project types, topics that matter.
Optional inputs between questions: workspace codebase, user docs, web — propose
definitions/topics and **refine with the user** (never impose).

## Propose then cite (required)

1. In chat only: convention + skeleton + 3–5 seeds, grouped by theme.
2. Cite-before-persist: list candidates (title, one-line rule, home, tags) → wait
   for keep/drop/merge → write **only** the selection.
3. Do not persist in the same turn as the first citation list.
4. If SB/MCP cannot write: leave the approved draft in chat; do not fake saves.

## Brownfield / re-seed

On explicit invoke with an existing convention: propose **additive** topics/seeds
only. No silent migration; no parallel orphan tree unless the user chooses it.

## SilverBullet-native

Pages + tags + `[[wiki links]]`. One tag is enough to query. No `tag.define` /
folder taxonomies unless the user asks.

## Red flags — STOP

- Writing before cited selection
- Interview longer than ~8 without a checkpoint / user “continue”
- Imposing PARA/Zettel or inventing schemas by default
- Blocking the user who skipped setup earlier (that is the manager’s concern)
```

- [ ] **Step 3: GREEN — same three setup scenarios with skill**

Expect: refuse instant invent; cite before write; additive-only on brownfield.

- [ ] **Step 4: Mirrors + commit**

```bash
for c in cursor claude kimi agents-skills; do
  mkdir -p "agents/$c/setup-second-brain"
  cp skills/setup-second-brain/SKILL.md "agents/$c/setup-second-brain/SKILL.md"
done
git add skills/setup-second-brain agents/*/setup-second-brain agents/TESTING.md
git commit -m "$(cat <<'EOF'
📝 docs: (skills) add setup-second-brain onboarding

Short interview plus cited seed convention/skeleton/learnings; setup remains optional.
EOF
)"
```

---

### Task 4: Trim `managing-learnings` greenfield path

**Files:**
- Modify: `skills/managing-learnings/SKILL.md`
- Modify: `agents/*/managing-learnings/SKILL.md`
- Modify: `agents/TESTING.md`

**Interfaces:**
- Consumes: `setup-second-brain` (defer offer); cite-before-persist
- Produces: capture-only focus; minimal config if user skipped setup

- [ ] **Step 1: RED — “just save this learning” on greenfield without skill edit**

Confirm current failure modes still need: cite list; no full onboarding interview inside managing.

- [ ] **Step 2: Edit greenfield section**

Replace recipe step 2 (long greenfield options) with:

```markdown
2. **Greenfield** — Prefer offering **`setup-second-brain`** (optional). If the user
   skips setup but still wants to save one learning: ask only the minimal
   convention needed (tag + home + shape), cite the note, wait, then write.
   Do not run the full onboarding interview inside this skill.
```

Add red flag: `Running full setup-second-brain interview inside managing-learnings`.

Keep cite-before-persist section unchanged.

- [ ] **Step 3: GREEN — save pressure + skip-setup path**

Expect: cite list; optional pointer to setup; no 15-question interview in managing.

- [ ] **Step 4: Sync mirrors + commit**

```bash
for c in cursor claude kimi agents-skills; do
  cp skills/managing-learnings/SKILL.md "agents/$c/managing-learnings/SKILL.md"
done
git add skills/managing-learnings agents/*/managing-learnings agents/TESTING.md
git commit -m "$(cat <<'EOF'
📝 docs: (managing-learnings) defer greenfield onboarding to setup-second-brain

Keep capture + cite-before-persist; minimal config only when setup was skipped.
EOF
)"
```

---

### Task 5: Docs, install paths, store sync

**Files:**
- Modify: `agents/PROTOCOL.md`
- Modify: `README.md` (Agent skills section)
- Modify: `agents/TESTING.md` (Install blurb + skill map)
- Optional runtime: user agent store `skills/` (copy four skills; remove stale name if needed)

**Interfaces:**
- Consumes: all four skills on disk
- Produces: accurate `npx skills add` discovery list

- [ ] **Step 1: Update PROTOCOL table**

```markdown
| Skill | Role |
|-------|------|
| `second-brain` (`/second-brain`) | Thin manager: route to setup / retrieval / capture |
| `second-brain-retrieval` | `indexGraph` closed-subgraph retrieval |
| `setup-second-brain` | Optional greenfield interview + cited seed |
| `managing-learnings` | Capture with cite-before-persist |
```

- [ ] **Step 2: Update README Agent skills**

List all four; keep install commands:

```bash
npx skills add . -g --skill '*' -a '*' -y
npx skills add abelroes/sb-index-graph -g --skill '*' -a '*' -y
```

Note Library install unchanged (`github:abelroes/sb-index-graph/PLUG.md`).

- [ ] **Step 3: Verify local discovery**

```bash
npx skills add . -l -y
```

Expected: lists `second-brain`, `second-brain-retrieval`, `setup-second-brain`, `managing-learnings`.

- [ ] **Step 4: Sync Cursor user store (if available)**

Copy the four `skills/*/SKILL.md` into the personal agent store `skills/` directories; remove obsolete retrieval content living only under old names if any.

- [ ] **Step 5: Commit**

```bash
git add agents/PROTOCOL.md README.md agents/TESTING.md
git commit -m "$(cat <<'EOF'
📝 docs: document second-brain skill map for npx install

PROTOCOL and README list manager, retrieval, setup, and managing-learnings.
EOF
)"
```

- [ ] **Step 6: Push branch (if updating the open PR)**

```bash
git push -u origin HEAD
```

---

## Spec coverage checklist

| Spec section | Task |
|--------------|------|
| §4 Skill map / rename | 1–2 |
| §5 Greenfield offer + skip | 2 |
| §6 setup flow + cite + re-seed | 3 |
| §7 Manager routing | 2 |
| §8 Capture contract | 3–4 |
| §9 Packaging / docs | 5 |
| §10 Skill TDD | 1–4 RED/GREEN steps |
| §11 Order | Tasks 1→5 |
| Non-goals (no Lua API / no mandatory setup) | Global constraints + Tasks 2–3 |

## Placeholder / consistency self-review

- No TBD steps; skill bodies inlined for Tasks 2–3; Task 1 specifies rename edits.
- Specialist names consistent: `second-brain-retrieval`, `setup-second-brain`, `managing-learnings`.
- Manager must not call `indexGraph` (Task 2 red flags).
