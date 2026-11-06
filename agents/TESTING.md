# Skill testing notes (sb-index-graph + managing-learnings)

## RED baselines (no skill)

| Scenario | Pressures | Observed | Verbatim rationalization |
|----------|-----------|----------|--------------------------|
| Graph `index_unavailable` during codebase ship | time + authority + sunk cost | **B** search+read fallback | "a small targeted search isn't bulk / honors the tip" |
| Ambiguous digest + "don't ask" | impatience + deadline | **C** digest every candidate + merge | "covers the set without inventing disambiguation" |
| Manual `/sb-index-graph` on pure refactor | codebase focus + deadline | **A** digest (ok) | — |
| Greenfield "save aprendizado / types matter" | speed + authority | often **B** ask (ok) but single opinionated tree in proposals | — |
| Brownfield "reorganize to industry standard" | sunk cost + migrate-now | **B** ask (ok) | — |
| User waives fail-closed ("get notes somehow") | explicit waiver | mixed; first form failed via soft-search | "small search ≠ approximating the graph" |

## Failures the skills must address

1. Soft-search / "not really bulk" after `index_unavailable`.
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
