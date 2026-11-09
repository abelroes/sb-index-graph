# sb-index-graph

SilverBullet `indexGraph` library plus a CLI that installs second-brain agent skills (and Cursor hooks).

## Install

```bash
npx sb-index-graph install -y
```

Defaults: `--scope=global`, providers `cursor,claude,codex` (Cursor also gets hooks). Copilot skills need project scope:

```bash
npx sb-index-graph install -y --scope=project --providers=copilot
```

```bash
npx sb-index-graph uninstall -y --scope=global
npx sb-index-graph update -y --scope=global
```

SilverBullet library (Runtime API / MCP on the space):

1. In SilverBullet: **Library: Install**
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

- Cursor hooks (`sessionStart`, `preCompact`): `sessionStart` injects context; `preCompact` may show `user_message`. No `stop` / `subagentStop` followups (avoids auto-submitted chat spam).
- Skills-only (no hooks): `npx skills add abelroes/sb-index-graph -g --skill '*' -a '*' -y`
- Needs Runtime API on the space and MCP to SilverBullet. Not the Graph View UI.
- If index/runtime is down, say so — do not fake full-space search as retrieval.

## Develop

Canonical library page: [`PLUG.md`](PLUG.md). Keep Space Lua in sync with `src/graph.lua`.

```bash
npm test
luajit -e 'package.path = "./?.lua;./?/init.lua;" .. package.path; dofile("tests/graph_test.lua")'
```
