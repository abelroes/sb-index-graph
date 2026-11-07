# sb-index-graph

Lets AI agents pull a small, linked slice of your SilverBullet notes (via tags and page links) instead of scanning the whole space.

Needs Runtime API on the space and an MCP connection to SilverBullet. This is not the Graph View UI.

## Install

1. In SilverBullet, run **`Library: Install`** (or open the Libraries manager → **Install**).
2. Paste this URI:

```text
github:abelroes/sb-index-graph/PLUG.md
```

3. Run **System: Reload**.
4. Confirm your agent can reach the space over MCP.

Same pattern as other SB plugs/libraries (`Library: Install` + `github:…/PLUG.md`).

## Agent skills

Canonical copies live under [`skills/`](skills/): `second-brain`, `second-brain-retrieval`, `setup-second-brain`, `managing-learnings`.

Library install is unchanged (`github:abelroes/sb-index-graph/PLUG.md`).

```bash
# from a clone of this repo
npx skills add . -g --skill '*' -a '*' -y

# or from GitHub (needs clone access to the repo)
npx skills add abelroes/sb-index-graph -g --skill '*' -a '*' -y
```

| Skill | When you use it |
|-------|-----------------|
| `second-brain` (`/second-brain`) | Thin manager: route to setup, retrieval, or capture |
| `second-brain-retrieval` | `indexGraph` closed-subgraph retrieval |
| `setup-second-brain` | Optional greenfield interview and cited seed |
| `managing-learnings` | Capture with cite-before-persist |

Mirrors under `agents/` are optional. In SilverBullet, agents can also follow `Library/abelroes/sb-index-graph-skill`.

### What to say (examples)

Your notes stay normal SilverBullet pages: `[[wiki links]]`, tags in frontmatter, short linked learnings.

| You want… | Example prompt |
|-----------|----------------|
| Context from a topic | “`/second-brain` — what do my notes say about error handling?” |
| Coding with your preferences | “`/second-brain` — use my way of working while we refactor this” |
| How two ideas connect | “How are page A and page B connected in my notes?” |
| Save a lesson | “Save this as an aprendizado” (skill will ask how you store learnings if that isn’t set yet) |

The agent should load a tight neighborhood of related pages first, then open only what it still needs. If the index/runtime is down, it should say so — not pretend a full-space search was that retrieval.

### Learnings (optional)

Keep learnings short and tagged so the index can find them (e.g. `#aprendizado`). Prefer a few tags and links over deep folder trees. `setup-second-brain` is optional on a new space. `managing-learnings` cites candidates, then writes one short note at a time.

## Develop

Canonical library page for Share/Install: [`PLUG.md`](PLUG.md) (mirrored under `Library/abelroes/` for local paths). Keep Space Lua in sync with `src/graph.lua`.

```bash
luajit -e 'package.path = "./?.lua;./?/init.lua;" .. package.path; dofile("tests/graph_test.lua")'
```
