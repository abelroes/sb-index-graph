---
name: sb-index-graph
description: >-
  Retrieves a semantically closed subgraph from the user's SilverBullet
  second-brain via MCP lua (indexGraph.digest/path/neighbors) before reading
  notes. Use when answering from SilverBullet knowledge, aprendizados,
  decisions, preferences, or note connections. Cross-framework Agent Skills
  install path (~/.agents/skills or ./.agents/skills).
---

# sb-index-graph (Agent Skills)

Generic Agent Skills package for clients that load `~/.agents/skills/` or `./.agents/skills/` (Codex-compatible layouts, some DSH/CLI harnesses, etc.).

## Protocol

1. SilverBullet MCP connected.
2. Prefer `indexGraph.digest(anchor)` via MCP `lua`; use `path` / `neighbors` when appropriate.
3. `ambiguous` → clarify; `index_unavailable` / lua fail → stop (no bulk search+read fallback).
4. Evidence = digest nodes/edges/snippets; `read` only for one node when snippets are insufficient.
5. Write-back only if the user asks.

```lua
indexGraph.digest("aprendizado")
```

Full shared text: `agents/PROTOCOL.md`.
