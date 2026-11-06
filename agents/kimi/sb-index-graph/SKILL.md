---
name: sb-index-graph
description: >-
  Retrieves a semantically closed subgraph from the user's SilverBullet
  second-brain via MCP lua (indexGraph.digest/path/neighbors) before reading
  notes. Use when answering from SilverBullet knowledge, aprendizados,
  decisions, preferences, or note connections.
---

# sb-index-graph (Kimi)

Same protocol as Cursor. Place under the Agent Skills path your Kimi client reads (often `~/.agents/skills/sb-index-graph/` or project `.agents/skills/sb-index-graph/`). Requires SilverBullet MCP + Runtime API + library installed in the space.

## Protocol

1. SilverBullet MCP connected.
2. Prefer `indexGraph.digest(anchor)` via MCP `lua`; use `path` / `neighbors` when appropriate.
3. `ambiguous` → clarify; `index_unavailable` / lua fail → stop (no bulk search+read fallback).
4. Evidence = digest nodes/edges/snippets; `read` only for one node when snippets are insufficient.
5. Write-back only if the user asks.

```lua
indexGraph.digest("aprendizado")
```

See `agents/PROTOCOL.md` in the sb-index-graph repo for the full shared protocol.
