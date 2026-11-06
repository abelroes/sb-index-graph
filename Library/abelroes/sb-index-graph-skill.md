---
name: Library/abelroes/sb-index-graph-skill
tags: meta/skill
description: Retrieve a semantically closed subgraph from the SilverBullet index before reading pages. Use indexGraph.digest/path/neighbors via MCP lua.
---

# Skill: Index graph retrieval

## When to use

- Answering questions from this SilverBullet space’s knowledge.
- Finding how two notes connect.
- Deciding which pages matter without listing or reading the whole space.

## When not to use

- If MCP `lua` / Runtime API is unavailable: **stop** and report the tool unavailable. Do not fall back to bulk `search`+`read` to approximate this skill.
- Do not use Graphify or external repo indexing for this space.

## Protocol

1. Call `indexGraph.digest(anchor)` via MCP `lua`, where `anchor` is a page name, a user tag, or a disambiguating substring.
2. If `ok` is false and `error` is `ambiguous`, pick from `candidates` with the user or a clearer anchor; do not guess.
3. If `ok` is false and `error` is `index_unavailable` or runtime failed: report unavailable.
4. Use the returned `nodes`, `edges`, `affinityTags`, and snippets as primary evidence.
5. Call `indexGraph.path(a, b)` when the question is specifically about a connection.
6. Call `indexGraph.neighbors(page)` for local context around one page.
7. Use MCP `read` only for a specific node when indexed snippets are insufficient for that node — driven by the digest, not by reading everything.
8. Optional write-back: MCP `write`/`edit` a lessons page only when the user wants persistence; keep format minimal.

## Example lua

```lua
indexGraph.digest("project")
```

```lua
indexGraph.path("Alpha", "Beta")
```
