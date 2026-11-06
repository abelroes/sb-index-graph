---
name: Library/abelroes/sb-index-graph-skill
tags: meta/skill
description: >-
  Use when answering from this space’s knowledge, finding how notes connect,
  choosing which pages matter, or when tempted to bulk search/read because
  indexGraph failed.
---

# Skill: Index graph retrieval

Retrieve a semantically closed subgraph via `indexGraph` before reading pages.

## When to use

- Answering from this space’s knowledge.
- Finding how two notes connect.
- Deciding which pages matter without listing or reading the whole space.

## When not to use

- MCP `lua` / Runtime API unavailable → **stop** and report unavailable. Do **not** fall back to `search`+`read` (including a “small” search) to approximate this skill.
- Do not use Graphify or external repo indexing for this space.

## Protocol

1. Call `indexGraph.digest(anchor)` (page name, user tag, or substring).
2. `ambiguous` → clarify with the user or a clearer anchor; do **not** guess; do **not** digest every candidate and merge.
3. `index_unavailable` or runtime failed → report unavailable; stop.
4. Use `nodes`, `edges`, `affinityTags`, and snippets as primary evidence.
5. `indexGraph.path(a, b)` for connection questions; `indexGraph.neighbors(page)` for local context.
6. MCP `read` only for a specific node when snippets are insufficient.
7. Persisting new learnings is **not** defined here — agree storage/types with the user (always-on skill `managing-learnings` outside SB) before writing.

```lua
indexGraph.digest("project")
```

```lua
indexGraph.path("Alpha", "Beta")
```
