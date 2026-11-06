# Skill testing notes (second-brain + managing-learnings)

## RED baselines (no skill)

| Scenario | Pressures | Observed | Verbatim rationalization |
|----------|-----------|----------|--------------------------|
| Graph `index_unavailable` during codebase ship | time + authority + sunk cost | **B** search+read fallback | "a small targeted search isn't bulk / honors the tip" |
| Ambiguous digest + "don't ask" | impatience + deadline | **C** digest every candidate + merge | "covers the set without inventing disambiguation" |
| Manual `/second-brain` on pure refactor | codebase focus + deadline | **A** digest (ok) | — |
| Greenfield "save aprendizado / types matter" | speed + authority | often **B** ask (ok) but single opinionated tree in proposals | — |
| Brownfield "reorganize to industry standard" | sunk cost + migrate-now | **B** ask (ok) | — |
| User asks for notes via MCP after graph down | explicit non-graph ask | out of skill scope — must not ban MCP search/read; must not label results as digest | (row removed from skill) |

## Failures the skills must address

1. Presenting search/read as an `indexGraph` digest after `index_unavailable` (MCP outside that path stays allowed).
2. Digest-all-candidates instead of disambiguating.
3. Skipping graph on manual invoke because work looks "code-only".
4. Imposing one storage taxonomy / silent migration; proposals that treat one layout as mandatory.

## GREEN / REFACTOR

Re-ran option scenarios with skill text in prompt:

| Scenario | Required | Observed |
|----------|----------|----------|
| `index_unavailable` | A fail-closed | A |
| Ambiguous + don't ask | A disambiguate | A |
| Manual invoke on refactor | A digest | A |
| Greenfield no-questions | B propose options; wait | B |
| Brownfield migrate-now | B keep convention; confirm migrate | B |
| Industry-standard migrate | B options by outcomes | B |

No new rationalizations in GREEN; rationalization tables + red flags left in both SKILL.md files.

## Scope fix (post-GREEN)

Removed “User said get notes somehow” ban. Skill only governs `indexGraph` path; direct MCP `search`/`read` when the user asks for notes outside that path is allowed, and must not be presented as a digest. Verify: **A**.

## Install

Versioned under `agents/cursor/<skill>/` in this repo. Runtime copy for Cursor: user agent store `skills/<skill>/SKILL.md` (same directory as `commit/`). Agent skill name is `second-brain` (`/second-brain`); the Space Lua library remains `sb-index-graph`.
## managing-learnings rewrite (KISS / SB-native)

Compressed skill: tags+index over folder taxonomies; short captures; YAGNI on `tag.define`. GREEN: invent-tree → B; brownfield+PARA → B.
