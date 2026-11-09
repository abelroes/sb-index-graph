# Second-brain install + Cursor hooks — Design

**Date:** 2026-11-08  
**Status:** approved  
**Repo:** `sb-index-graph`  
**Related:** `docs/superpowers/specs/2026-11-07-second-brain-skills-design.md`

## 1. Problem

Skills install via `npx skills add` only. That does not register Cursor hooks, so second-brain stays easy to skip unless the user types `/second-brain` or the agent happens to match a description. We want near-automatic routing/capture nudges, with a real installer and uninstaller across several IDEs (impeccable-style), without changing the Library/`indexGraph` API.

## 2. Goals and non-goals

### Goals

- Ship `npx sb-index-graph install|uninstall|update` (small Node CLI in-repo).
- Install the four skills into multiple providers (v1 list below); ask which providers and **scope** (`global` default vs `project`).
- On **Cursor only** (v1): merge hooks for `sessionStart`, `beforeSubmitPrompt`, `stop` (substantial turns), `subagentStop`, and `preCompact`.
- Uninstall removes only artifacts this installer wrote (stable `sb-index-graph` markers + install manifest).
- Keep skill bodies as source of truth under `skills/`; hooks nudge—they do not call MCP/`indexGraph`.
- Document primary path as this CLI; keep `npx skills add` as skills-only fallback.

### Non-goals (v1)

- Cursor marketplace plugin packaging.
- Claude Code (or other) hooks.
- Installing SilverBullet Library (`PLUG.md`) or MCP client config.
- Calling SilverBullet from the hook process.
- Any `PLUG.md` / `src/graph.lua` / Library Lua API change.

## 3. Approach

**A — Lean in-repo CLI + Cursor hooks** (approved).

Rejected: Cursor-plugin-only distribution; hooks-documented-but-manual (skills-add only).

## 4. Providers (v1)

| Provider | Skills target (project / global) | Hooks |
|----------|----------------------------------|-------|
| Cursor | `.cursor/skills/` / `~/.cursor/skills/` | Yes |
| Claude Code | `.claude/skills/` / `~/.claude/skills/` | No |
| Codex / agents | `.agents/skills/` / `~/.agents/skills/` | No |
| VS Code / Copilot | `.github/skills/` (project); document global Copilot path if applicable | No |

Install detects present tools, checklist which to install, scope prompt (default **global**). Flags: `--providers=cursor,claude,codex,copilot`, `--scope=global|project`, `-y`.

## 5. CLI

| Command | Behavior |
|---------|----------|
| `install` | Idempotent copy/link of the four skills; Cursor: merge hook fragment + copy hook script; write manifest. |
| `uninstall` | Delete only marked skills dirs, hook entries/scripts, and our manifest keys. Leave foreign hooks/skills alone. |
| `update` | Re-sync skills (+ Cursor hooks) for scope/providers from manifest or flags. |

**Manifest** (per scope, e.g. `~/.cursor/sb-index-graph-install.json` and project `.cursor/sb-index-graph-install.json`): providers, paths, version, installed_at. Uninstall reads it; missing manifest → best-effort remove by `sb-index-graph*` path/name conventions and warn.

**Package:** `package.json` name `sb-index-graph`, `bin` → CLI entry. Canonical skills remain under `skills/`.

## 6. Cursor hooks

Single script (e.g. `hooks/sb-index-graph.mjs`) + mergeable `hooks.json` fragment. **Fail-open.** English short payloads. No MCP.

| Event | Gate | Output |
|-------|------|--------|
| `sessionStart` | Always once per session | Short `additional_context`: second-brain skills available; route via manager when notes/prefs/learnings apply; setup optional. |
| `beforeSubmitPrompt` | Heuristic match (notes, SB, aprendizado, preferences, “way of working”, SilverBullet, indexGraph, …) | Nudge toward `second-brain` → specialist; cite-before-persist on saves. |
| `stop` | Substantial turn only (configurable threshold: tool-call / edit count from payload) | Optional `followup_message`: capture via `managing-learnings` and/or SB consult if decisions were made. |
| `subagentStop` | On Task/subagent completion | Light `followup_message`: cite-list if a lesson appeared; retrieval if notes were needed. |
| `preCompact` | Always | `additional_context`: preserve SB anchors across compact; re-digest after if still note-dependent. |

Dedup: at most one nudge of a given kind per time window so short turns are not spammed. Thresholds/heuristics live as constants; optional overrides in the manifest.

## 7. Repo layout

```
cli/                         # install | uninstall | update
hooks/sb-index-graph.mjs
hooks/hooks.json.fragment
skills/…                     # unchanged source
package.json                 # bin + package metadata
```

## 8. Docs and tests

- README: primary `npx sb-index-graph install`; skills-only fallback; uninstall; providers; Cursor-only hooks.
- PROTOCOL / TESTING: install map + hook ledger notes as needed.

**Tests:** CLI unit tests (hooks.json merge/uninstall fixtures; skill copy; manifest); hook unit tests with synthetic stdin per event (match / no-match / below-threshold stop). No Library Lua changes. Skill pressure TDD only if descriptions change.

## 9. Success criteria

- Fresh machine: `npx sb-index-graph install -y --scope=global --providers=cursor` installs four skills + Cursor hooks; reload Cursor → sessionStart context appears.
- `uninstall` leaves unrelated hooks/skills intact.
- Non-Cursor providers get skills only; install does not claim hooks there.
- Existing `npx skills add` path still works without hooks.

## 10. Open for implementation plan (not blocking design)

- Exact substantial-turn threshold defaults.
- Symlink vs copy for skills.
- Whether Codex/Copilot global paths need a small lookup table beyond the table above.
