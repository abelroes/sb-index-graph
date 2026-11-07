# Second-brain agent skills — Design

**Date:** 2026-11-07  
**Status:** draft for review  
**Repo:** `sb-index-graph`  
**Related:** `docs/superpowers/specs/2026-11-06-sb-index-graph-design.md` (Library / `indexGraph`)

## 1. Problem

Agent skills today mix concerns: `second-brain` is retrieval-only, `managing-learnings` covers convention + capture. Greenfield spaces get a thin “2–3 tag options” step — not enough to produce a useful starting set of learnings. Users need an optional guided interview (role, common work, tools, projects, topics) that can use codebase/docs/web inputs, then a cited seed (convention + topic skeleton + short opinion/direction notes) before any write.

## 2. Goals and non-goals

### Goals

- Split skills by job: **route**, **retrieve**, **setup (greenfield onboarding)**, **capture**.
- Manager skill named `second-brain`; current retrieval renamed `second-brain-retrieval`.
- New `setup-second-brain`: short interview (~5–8 questions) + optional external inputs + refine → outcome **C**: minimal convention + topic skeleton + 3–5 short seed learnings, **cite → user selection → persist**.
- Setup is **optional**; user may skip; manager must not block retrieval or capture.
- Keep SilverBullet-native storage (pages, tags, `[[links]]`); KISS / YAGNI / DRY; cite-before-persist on all learning writes.
- Ship under `skills/` for `npx skills add`; update PROTOCOL/README; no `indexGraph` API change.

### Non-goals

- Mandatory onboarding; mandatory `tag.define` / PARA / Zettel frameworks.
- Silent brownfield migration or mass rewrite of existing `#aprendizado` trees.
- Bundling MCP registration into an npm “setup” package (REA-style `rea-agents`); skills-only distribution.
- Changing the Space Lua Library / `PLUG.md` install path beyond docs cross-links.

## 3. Approach chosen

**Thin manager + explicit handoff** (approach 1).

Rejected: fat manager that embeds all protocols; setup-only-via-slash with no greenfield offer.

## 4. Skill map

| Skill | Invoke | Role |
|-------|--------|------|
| `second-brain` | `/second-brain` | Thin router: classify request; handoff. Offer optional setup on greenfield. No `indexGraph`, no learning writes. |
| `second-brain-retrieval` | (via manager or direct) | Former `second-brain` body: `indexGraph` digest/path/neighbors; fail-closed; manual invoke during codebase work. |
| `setup-second-brain` | `/setup-second-brain` or manager handoff | Greenfield (or explicit re-seed) interview + inputs + seed proposal; cite → select → persist. |
| `managing-learnings` | (via manager or when capturing) | Ongoing capture; cite-before-persist; minimal config if no convention and user skipped setup. |

**Handoffs:** manager loads/points to one specialist at a time. Retrieval never persists. Setup/managing never present search/read as an `indexGraph` digest.

## 5. Greenfield detection and skip

**Greenfield:** no agreed or dominant learnings convention in the space (no usable `#aprendizado`/config/home pattern). **Brownfield:** existing convention (e.g. `Software Engineer/AI/Aprendizados` + `#aprendizado`).

On greenfield, manager asks whether the user wants help creating a learnings starting point. Answers:

- **Yes** → `setup-second-brain`
- **Not now** / **Never this session** → do not re-offer this session; continue with retrieval and/or managing as needed
- User may invoke `/setup-second-brain` later anyway

Setup is never required to use retrieval.

## 6. `setup-second-brain` flow

1. Offer / explicit invoke.
2. Short interview (~5–8), one question at a time: most common work, role, tools, project types, topics that matter.
3. Optional inputs between questions: workspace codebase, user docs, web — propose definitions/topics; **refine with the user** (do not impose).
4. Chat proposal only: minimal convention (tag + home + note shape) + topic skeleton + **3–5** short seeds (opinions/directions), grouped by theme.
5. Cite-before-persist (same contract as managing-learnings): list → wait for selection → write only chosen items.
6. If SB/MCP unavailable for writes: leave the approved draft in chat; do not fake persistence.

**Re-seed:** explicit `/setup-second-brain` on brownfield may propose additional topics/seeds only; no silent migration or orphan parallel trees.

## 7. Manager routing

| User signal | Handoff |
|-------------|---------|
| Second-brain / notes / preferences / SB knowledge | Greenfield → optional setup ask; else or after skip → `second-brain-retrieval` |
| Save / organize a learning | `managing-learnings` (minimal config if no convention) |
| `/setup-second-brain` | `setup-second-brain` |
| Pure code, no invoke | Do not force manager |

## 8. Capture contract (setup + managing)

Before any learning `write`/`edit`:

1. List candidates by **session** and/or **theme/topic**.
2. Each item: short title + one-line rule + suggested home + tags.
3. Wait for explicit keep/drop/merge.
4. Persist only the selection in the agreed (or newly accepted) shape.

Do not persist in the same turn as the first citation list.

## 9. Packaging and docs

- Canonical: `skills/{second-brain,second-brain-retrieval,setup-second-brain,managing-learnings}/SKILL.md`
- Rename current `skills/second-brain` → `second-brain-retrieval`; add new manager + setup.
- Sync optional `agents/*` mirrors; agent store / `npx skills add`.
- Update `agents/PROTOCOL.md`, README agent section, `agents/TESTING.md`.
- Library `PLUG.md` / `indexGraph`: unchanged API; docs may mention skill names.

## 10. Testing (skill TDD)

Per skill, RED baseline without skill then GREEN with skill:

| Skill | Pressure / success |
|-------|-------------------|
| `second-brain` | Offers setup only on greenfield; respects skip; does not call digest/write itself |
| `setup-second-brain` | Stays ~5–8 questions; cites before persist; skip/decline writes nothing |
| `second-brain-retrieval` | Regression: fail-closed, no digest-all, honor manual invoke |
| `managing-learnings` | Cite-before-persist still holds under “just save it” pressure |

## 11. Implementation order (for the later plan)

1. Rename retrieval skill; add thin manager; wire PROTOCOL/README.
2. Add `setup-second-brain` (interview + inputs + seed + cite).
3. Trim `managing-learnings` greenfield to defer to setup offer / minimal config on skip.
4. RED/GREEN tests; sync stores; commit.

## 12. Open decisions (resolved in brainstorm)

| Topic | Decision |
|-------|----------|
| Seed richness | C — convention + skeleton + short seeds |
| Interview length | A — ~5–8 questions + external inputs + refine |
| Skill split | Manager `second-brain` + `second-brain-retrieval` + `setup-second-brain` + `managing-learnings` |
| Setup mandatory? | No — optional skip |
