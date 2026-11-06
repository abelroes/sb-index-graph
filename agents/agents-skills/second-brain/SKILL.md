---
name: second-brain
description: >-
  Use when the user invokes /second-brain or this skill; when second-brain or
  SilverBullet context may help (including during pure codebase work); when
  answering from SB notes, aprendizados, decisions, or preferences; when finding
  how notes connect; or when tempted to approximate indexGraph with bulk
  search/read after it failed.
---

# second-brain

Retrieve a semantically closed subgraph from SilverBullet via `indexGraph` before reading notes.

The Space Lua library remains `sb-index-graph` (`indexGraph.*`). This skill is the agent-facing name and invoke (`/second-brain`).

**Core principle:** When following this skill’s retrieval path, graph/runtime down means stop approximating that path with search+read. Manual invoke still applies during codebase work.

**Scope:** This skill only governs `indexGraph` closed-subgraph retrieval. It does **not** forbid other MCP tools (`search`, `read`, etc.) when the user asks for notes outside that path — that is out of scope here.

## When to use

- User attaches/invokes this skill, `/second-brain`, or asks to use the second-brain — even if the main task is code.
- Questions answered from SB knowledge, connections between notes, or picking which pages matter.

## When not to use

- No SB context and user did not invoke this skill → normal code tools only.
- MCP `lua` / Runtime API unavailable → report unavailable and stop **this** retrieval path (do not pretend search+read produced an `indexGraph` digest).

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
| "Pure codebase — skip manual invoke" | User invoke means run digest (or report graph retrieval unavailable). |
| "Skill not loaded so search instead" | Missing skill ≠ permission to present search hits as `indexGraph` output. |

## Red flags — STOP

- Presenting search/read as an `indexGraph` digest after `index_unavailable`
- Picking or merging ambiguous candidates silently
- Ignoring an explicit `/second-brain` invoke during coding
- Writing aprendizados pages without **managing-learnings** config
