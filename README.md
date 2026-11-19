# sb-index-graph

SilverBullet `indexGraph` library plus a CLI that installs second-brain agent skills (and Cursor hooks).

## Install

```bash
npx sb-index-graph install -y
```

Defaults: `--scope=global`, providers `cursor,claude,codex` (Cursor also gets hooks; `opencode` gets skills into `~/.config/opencode/skill`). Copilot skills need project scope:

```bash
npx sb-index-graph install -y --scope=project --providers=copilot
```

```bash
npx sb-index-graph uninstall -y --scope=global
npx sb-index-graph update -y --scope=global
```

SilverBullet library (Runtime API / MCP on the space):

1. In SilverBullet: **Ctrl + /** → **Library: Install**
2. URI: `github:abelroes/sb-index-graph/PLUG.md`
3. **System: Reload**

## Usage

```text
/second-brain — what do my notes say about error handling?
```

| Skill | Role |
|-------|------|
| `second-brain` | Thin manager: setup, retrieval, or capture |
| `second-brain-retrieval` | Closed-subgraph via `indexGraph` |
| `setup-second-brain` | Optional greenfield seed |
| `managing-learnings` | Cite-before-persist capture |

Canonical skill copies: [`skills/`](skills/).

## Behavior

- Retrieval walks levels: `digest` (closed, budgeted subgraph) → `manifest` (section outline of one page) → full `read`. `digest` budgets: `maxNodes` (default 40), `maxTokens` (approximate, chars/4), `snippetCap` (160); when cut it reports `truncated` + `dropped` — refine the anchor or raise the budget consciously.
- Hub `related:` families join digests as hierarchy evidence (full family) but never widen tag affinity; hierarchy nodes promote to full affinity when an affinity node reaches them.
- Cursor hooks (`sessionStart`, `preCompact`): `sessionStart` mandates second-brain session boot (contract + workspace basename) and space preferences for artifact paths (e.g. Superpowers + `#superpowers`/`#spec`/`#docs`/`#plan`); `preCompact` may show `user_message` to re-run boot. No `stop` / `subagentStop` followups (avoids auto-submitted chat spam).
- Skills-only (no hooks): `npx skills add abelroes/sb-index-graph -g --skill '*' -a '*' -y`
- Needs Runtime API on the space and MCP to SilverBullet. Not the Graph View UI.
- If index/runtime is down, say so — do not fake full-space search as retrieval.

## Develop

Canonical library page: [`PLUG.md`](PLUG.md). Keep Space Lua in sync with `src/graph.lua`.

```bash
npm test
luajit -e 'package.path = "./?.lua;./?/init.lua;" .. package.path; dofile("tests/graph_test.lua")'
```
