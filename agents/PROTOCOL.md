# sb-index-graph — agent protocol

Shared protocol for Cursor, Claude Code, Kimi, and other MCP clients talking to a SilverBullet space that has the `sb-index-graph` library installed.

## When to use

- Answering from the user’s SilverBullet second-brain (notes, aprendizados, decisions, preferences).
- Finding how two notes connect.
- Choosing which pages matter without listing or reading the whole space.

## When not to use

- MCP `lua` / Runtime API unavailable → **stop** and report the tool unavailable. Do **not** fall back to bulk `search`+`read` to approximate graph retrieval.
- Pure codebase questions with no SB context → use normal code tools; do not force `indexGraph`.

## Protocol

1. Ensure SilverBullet MCP is connected; prefer the space that holds the second-brain.
2. Call via MCP `lua`:
   - `indexGraph.digest(anchor)` — default entry (page name, user tag, or disambiguating substring).
   - `indexGraph.path(a, b)` — when the question is specifically about a connection.
   - `indexGraph.neighbors(page)` — local context around one page.
3. If `ok == false` and `error == "ambiguous"` → ask the user or pick a clearer anchor from `candidates`; do not guess.
4. If `ok == false` and `error == "index_unavailable"` (or lua/runtime failed) → report unavailable; stop.
5. Treat `nodes`, `edges`, `affinityTags`, and snippets as primary evidence.
6. MCP `read` only for a **specific** node when snippets are insufficient — driven by the digest, not by reading everything.
7. Optional write-back: MCP `write`/`edit` a lessons page only when the user asks to persist; keep format minimal (pattern, not project dump).

## Example lua

```lua
indexGraph.digest("aprendizado")
```

```lua
indexGraph.path("Software Engineer/AI/Aprendizados", "Software Engineer/AI/AGENTS")
```

```lua
indexGraph.neighbors("Software Engineer/AI/Aprendizados")
```
