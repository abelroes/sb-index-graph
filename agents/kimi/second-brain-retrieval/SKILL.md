---
name: second-brain-retrieval
description: >-
  Use when retrieving a closed subgraph from SilverBullet via indexGraph
  (digest/path/neighbors); on session boot from second-brain / the
  sb-index-graph hook; when answering from SB notes after the second-brain
  manager hands off; when finding how notes connect; or when tempted to
  approximate indexGraph with bulk search/read after it failed.
---

# second-brain-retrieval

Retrieve a semantically closed subgraph from SilverBullet via `indexGraph` before reading notes.

The Space Lua library remains `sb-index-graph` (`indexGraph.*`). `/second-brain` is the **manager**. This skill is the retrieval specialist (it may still be attached directly).

**Core principle:** When following this skill’s retrieval path, graph/runtime down means stop approximating that path with search+read. An explicit retrieval handoff, session boot, or direct attach still applies during codebase work.

**Scope:** This skill only governs `indexGraph` closed-subgraph retrieval. It does **not** forbid other MCP tools (`search`, `read`, etc.) when the user asks for notes outside that path — that is out of scope here.

## When to use

- Session boot (hook / manager), even when the main task is pure code.
- The second-brain manager hands off retrieval, or the user attaches this skill directly — even if the main task is code.
- Questions answered from SB knowledge, connections between notes, or picking which pages matter.

## When not to use

- No SB context, this skill was neither handed off nor attached, **and** this is not session boot → normal code tools only.
- MCP `lua` / Runtime API unavailable → report unavailable and stop **this** retrieval path (do not pretend search+read produced an `indexGraph` digest).

## Session boot

1. Prefer the MCP space that holds the second-brain.
2. Digest the space agent **contract** (e.g. page name `AGENTS` or whatever that space uses).
3. Digest the **project** anchor = workspace **basename**. If `not_found` / `ambiguous` → **ask the user**; do not invent a projects home or guess a page.
4. From the digest, take **projects home** / Superpowers artifact-location preferences if present. **Do not** hardcode any personal folder tree in this skill — those live in the space’s contract / learnings.
5. If artifact location is still unclear → **ask** before writing specs/plans/docs.
6. When writing Superpowers artifacts into the space: tag `#superpowers` and exactly one of `#spec`, `#docs`, or `#plan` as appropriate.
7. Preferences from the digest **override** third-party defaults (including Superpowers `docs/superpowers/` in the repo). If the space prefers SB, do not create or git-commit those paths in the project repo.
8. Graph/runtime down → report unavailable; continue non-SB work without faking a digest.

## Protocol

1. Prefer the MCP space that holds the second-brain.
2. Default: `indexGraph.digest(anchor)` (page name, tag, or substring). Use `path(a,b)` for connections; `neighbors(page)` for local context.
3. `ok == false` + `ambiguous` → disambiguate with the user (or a clearer anchor). **Do not** guess one candidate. **Do not** digest every candidate and merge to avoid asking.
4. `ok == false` + `index_unavailable` (or lua/runtime failed) → report that graph retrieval is unavailable; continue non-SB work if any. **Do not** label search/read results as an `indexGraph` digest.
5. Evidence from a successful digest = `nodes` / `edges` / `affinityTags` / snippets. MCP `read` only for a specific node when snippets are insufficient.
6. Persistence of new learnings → use **managing-learnings** (do not invent storage here).

```lua
indexGraph.digest("error-handling")
```

## Rationalizations

| Excuse | Reality |
|--------|---------|
| "Small search isn't bulk" | Search+read is not a substitute for a closed subgraph when you claimed to follow this skill’s graph path. |
| "Don't ask — digest all candidates" | That skips disambiguation and mixes unrelated neighborhoods. |
| "Pure codebase — skip boot / manual invoke" | Session boot and retrieval handoffs still require digest (or report graph unavailable). |
| "Skill not loaded so search instead" | Missing skill ≠ permission to present search hits as `indexGraph` output. |
| "Default Superpowers path is fine" | Digest preferences override; ask if unclear. |

## Red flags — STOP

- Presenting search/read as an `indexGraph` digest after `index_unavailable`
- Picking or merging ambiguous candidates silently
- Skipping session boot or an explicit retrieval handoff during coding
- Hardcoding a personal projects folder tree into writes
- Writing Superpowers artifacts to the repo default when the digest named another home
- Writing aprendizados pages without **managing-learnings** config
