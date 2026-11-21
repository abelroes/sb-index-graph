# sb-index-graph

SilverBullet `indexGraph` library plus a CLI that installs second-brain agent skills, Cursor hooks, and an OpenCode plugin (triggers).

## Install

```bash
npx sb-index-graph install -y
```

Defaults: `--scope=global`, providers `cursor,claude,codex,opencode`. Trigger layer per provider:

| Provider | Skills land in | Triggers |
|----------|----------------|----------|
| Cursor | `~/.cursor/skills` | `hooks.json`: `sessionStart` (+`additional_context`), `preCompact` (+`user_message`) |
| OpenCode | `~/.config/opencode/skills` | plugin `plugins/sb-index-graph.js` + `plugins/sb-index-graph.triggers.json` |
| Codex | `~/.agents/skills` | skills only |
| Claude | `~/.claude/skills` | skills only |
| Copilot | `.github/skills` (project scope only) | skills only |

OpenCode skills are the V2 **plural** directory. Copies left in the V1 singular `~/.config/opencode/skill` are removed on install and uninstall:

```bash
npx sb-index-graph install -y --scope=project --providers=copilot
npx sb-index-graph uninstall -y --scope=global
npx sb-index-graph update -y --scope=global
```

OpenCode trigger debugging: run the server with `OPENCODE_SB_DEBUG=1` to log routing decisions and skipped hooks.

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
- OpenCode plugin (`plugins/opencode/sb-index-graph.js`): `session.hook("prompt")` seeds the keyed session instruction entry `second-brain` on the first prompt of a session — the `sessionStart` equivalent, and it survives compaction and `session_move` because entries live outside the transcript. That entry carries the same mandatory-boot text the Cursor hook prints, and the plugin also **attaches** the boot skill (`second-brain-retrieval`) to that first prompt, so boot is not prose-only. The same hook routes **one** further skill per prompt by editing the prompt draft (`prompt.skills`), only when the agent may load it. `session.hook("compaction")` refreshes `second-brain-anchors` with the `[[page links]]`, `#tags`, and `indexGraph.*` anchors still in the transcript (max 12). Triggers fail open: a missing data file or an unknown payload shape leaves OpenCode untouched.
- Routing priority (one skill per prompt): capture → retrieval → setup → manager. Capture needs a write verb near a learning noun, so a page name like `[[.../Aprendizados]]` in a reading question does not pull the capture skill. Patterns live in `hooks/lib/messages.mjs`; the installer writes them into the plugin's JSON data file, and a test guards the two copies against drift. To drop the first-prompt boot attach, set `"boot": null` in `plugins/sb-index-graph.triggers.json` (it comes back on the next install/update).
- Skills-only (no hooks): `npx skills add abelroes/sb-index-graph -g --skill '*' -a '*' -y`
- Needs Runtime API on the space and MCP to SilverBullet. Not the Graph View UI.
- If index/runtime is down, say so — do not fake full-space search as retrieval.

## Develop

Canonical library page: [`PLUG.md`](PLUG.md). Keep Space Lua in sync with `src/graph.lua`.

Trigger sources: `hooks/` (Cursor, a stdin/stdout hook) and `plugins/opencode/` (OpenCode, one flat `.js` file that imports node builtins only — OpenCode treats every `.js`/`.ts` under `plugins/` as a plugin, so the plugin keeps its data in `sb-index-graph.triggers.json` instead of a sibling module). Shared text and route table: `hooks/lib/messages.mjs`.

```bash
npm test
luajit -e 'package.path = "./?.lua;./?/init.lua;" .. package.path; dofile("tests/graph_test.lua")'
```

Live trigger check (throwaway server, isolated config, no need to touch the real one):

```bash
mkdir -p /tmp/sbig-live/{plugins,skills,work}
cp plugins/opencode/sb-index-graph.js /tmp/sbig-live/plugins/
node --input-type=module -e "import { buildTriggers } from './cli/opencode-plugin.mjs'; import fs from 'node:fs'; fs.writeFileSync('/tmp/sbig-live/plugins/sb-index-graph.triggers.json', buildTriggers({ version: 'live' }))"
cp -r skills/* /tmp/sbig-live/skills/
cd /tmp/sbig-live/work && OPENCODE_CONFIG_DIR=/tmp/sbig-live OPENCODE_PASSWORD=x OPENCODE_SB_DEBUG=1 opencode serve --port 4199
# in another shell: create a session, send a capture-phrased prompt, then read the entries
curl -s -u opencode:x -X POST localhost:4199/api/session -H 'content-type: application/json' -d '{}'
curl -s -u opencode:x -X POST localhost:4199/api/session/<id>/prompt -H 'content-type: application/json' -d '{"text":"guarda este aprendizado sobre retries","delivery":"queue"}'
curl -s -u opencode:x localhost:4199/api/experimental/session/<id>/instructions/entries
```

Expected: one `second-brain` entry, and a server log line `attached managing-learnings to the prompt in <id>`.
