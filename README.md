# sb-index-graph

SilverBullet Library: structured retrieval over the **relation/tag index** for AI agents (MCP `lua`).

Not Graphify. Not the Graph View UI. Not a vector RAG stack.

## Requirements

- SilverBullet with **Runtime API** enabled on the space (required for MCP `lua`)
- MCP connected (Desktop or multi-space `/.mcp`)

## Install

1. Publish/install this library to `Library/abelroes/sb-index-graph` (Library Manager / Share from this repo’s `Library/abelroes/` pages).
2. Ensure `Library/abelroes/sb-index-graph-skill.md` is present (`files` in the library frontmatter).
3. Run **System: Reload**.

## Agent usage

```lua
indexGraph.digest("YourPageOrTag")
indexGraph.path("PageA", "PageB")
indexGraph.neighbors("YourPage")
```

If lua/runtime/index is unavailable, treat the tool as down — do not improvise with full-space reads.

### Always-on agent skills (English)

Shared notes: [`agents/PROTOCOL.md`](agents/PROTOCOL.md). Testing: [`agents/TESTING.md`](agents/TESTING.md).

| Skill | Purpose |
|-------|---------|
| `sb-index-graph` | Closed-subgraph retrieval; fail closed; honor manual invoke during codebase work |
| `managing-learnings` | Configure/capture learnings and types; greenfield/brownfield; non-opinionated |

| Client | Templates | Typical install |
|--------|-----------|-----------------|
| Cursor | `agents/cursor/<skill>/` (versioned) | Runtime: agent store `skills/<skill>/SKILL.md` (alongside `commit/`, etc.) |
| Claude Code | `agents/claude/<skill>/` | `~/.claude/skills/<skill>/` |
| Kimi / Agent Skills | `agents/kimi/…` or `agents/agents-skills/…` | `~/.agents/skills/<skill>/` |

In-space `Library/abelroes/sb-index-graph-skill` (`tags: meta/skill`) is for agents already inside SilverBullet. Always-on copies make Cursor/Claude/Kimi invoke MCP `lua` before bulk reads and configure learnings without imposing a taxonomy.

## Develop

```bash
luajit -e 'package.path = "./?.lua;./?/init.lua;" .. package.path; dofile("tests/graph_test.lua")'
```

Pure algorithms: `src/graph.lua`. Keep Space Lua copies in sync when changing behavior.

## Design

See `docs/superpowers/specs/2026-11-06-sb-index-graph-design.md`.
