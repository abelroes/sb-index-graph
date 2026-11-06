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

## Develop

```bash
luajit -e 'package.path = "./?.lua;./?/init.lua;" .. package.path; dofile("tests/graph_test.lua")'
```

Pure algorithms: `src/graph.lua`. Keep Space Lua copies in sync when changing behavior.

## Design

See `docs/superpowers/specs/2026-11-06-sb-index-graph-design.md`.
