# Agent protocols (shared)

English always-on skills for MCP clients talking to a SilverBullet space with the `sb-index-graph` library installed (`indexGraph.*`).

| Skill | Role |
|-------|------|
| `second-brain` (`/second-brain`) | Thin manager: route to setup / retrieval / capture |
| `second-brain-retrieval` | `indexGraph` closed-subgraph retrieval |
| `setup-second-brain` | Optional greenfield interview + cited seed |
| `managing-learnings` | Capture with cite-before-persist |

Canonical for `npx skills add`: `skills/<skill>/SKILL.md`. Mirrors: `agents/cursor/` (and claude/kimi/agents-skills).

Installer: `npx sb-index-graph install` (see README). Cursor hooks are optional automation; skills remain the source of routing rules.

Testing notes: `agents/TESTING.md`.
