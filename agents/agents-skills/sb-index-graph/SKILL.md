---
name: sb-index-graph
description: >-
  Use when the user invokes this skill or second-brain/SilverBullet context may
  help (including during pure codebase work); when answering from SB notes,
  aprendizados, decisions, or preferences; when finding how notes connect; or
  when tempted to bulk search/read the space because indexGraph failed.
---

# sb-index-graph

Retrieve a semantically closed subgraph from SilverBullet via `indexGraph` before reading notes.

**Core principle:** Graph/runtime down means stop — do not approximate with search+read. Manual invoke still applies during codebase work.

## When to use

- User attaches/invokes this skill, `/sb-index-graph`, or asks to use the second-brain — even if the main task is code.
- Questions answered from SB knowledge, connections between notes, or picking which pages matter.

## When not to use

- No SB context and user did not invoke this skill → normal code tools only.
- MCP `lua` / Runtime API unavailable → report unavailable and stop graph retrieval.

## Protocol

1. Prefer the MCP space that holds the second-brain.
2. Default: `indexGraph.digest(anchor)` (page name, tag, or substring). Use `path(a,b)` for connections; `neighbors(page)` for local context.
3. `ok == false` + `ambiguous` → disambiguate with the user (or a clearer anchor). **Do not** guess one candidate. **Do not** digest every candidate and merge to avoid asking.
4. `ok == false` + `index_unavailable` (or lua/runtime failed) → report unavailable; continue non-SB work if any. **Stop.**
5. Evidence = `nodes` / `edges` / `affinityTags` / snippets. MCP `read` only for a specific node when snippets are insufficient.
6. Persistence of new learnings → use **managing-learnings** (do not invent storage here).

```lua
indexGraph.digest("error-handling")
```

## Rationalizations

| Excuse | Reality |
|--------|---------|
| "Small search isn't bulk" | Any search+read stand-in for a closed subgraph is forbidden when graph/runtime failed. |
| "User said get notes somehow" | Waiver does not recreate the index. Report down; retry later. |
| "Don't ask — digest all candidates" | That skips disambiguation and mixes unrelated neighborhoods. |
| "Pure codebase — skip manual invoke" | User invoke means run digest (or report unavailable). |
| "Skill not loaded so search instead" | Missing skill ≠ permission to approximate. |

## Red flags — STOP

- `search`/`read` loops after `index_unavailable`
- Picking or merging ambiguous candidates silently
- Ignoring an explicit second-brain invoke during coding
- Writing aprendizados pages without **managing-learnings** config
