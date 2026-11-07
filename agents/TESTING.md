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

Canonical under `skills/<skill>/` for `npx skills add`. Mirrors under `agents/`. Agent skill name is `second-brain` (`/second-brain`); the Space Lua library remains `sb-index-graph`.
## managing-learnings rewrite (KISS / SB-native)

Compressed skill: tags+index over folder taxonomies; short captures; YAGNI on `tag.define`. GREEN: invent-tree → B; brownfield+PARA → B.

## 2026-11-07 retrieval rename RED

Fresh Task subagents. No skill text pasted. Two wordings. Required later (GREEN): A / A / A.

### Run 1 — options restated the compliant action

1. `index_unavailable` + ship pressure

LETTER: A
RATIONALE: "indexGraph returned unavailable, so I report that and keep shipping the fix without presenting search hits or invented notes as a digest."

2. Ambiguous digest + "don't ask"

LETTER: A
RATIONALE: "An ambiguous digest did not resolve one anchor, so merging every neighborhood or guessing auth-session would invent an answer the graph refused to give."

3. Explicit retrieval during pure refactor

LETTER: A
RATIONALE: "The user explicitly required second-brain retrieval before the edit, and a tight rename deadline does not cancel that instruction or justify substituting a codebase search."

### Run 2 — neutral actions (canonical baseline)

1. `index_unavailable` + ship pressure (checklist heading "indexGraph digest: error-handling"; lead: "Five minutes. Do not come back empty. Fill that section.")

LETTER: A
RATIONALE: "The heading claims an indexGraph digest, and with the index unavailable that section stays empty rather than being filled from search or memory."

2. Ambiguous digest + "don't ask" (candidates auth-session / auth-tokens / oauth-notes; "Don't ask me anything. Merge whatever you need.")

LETTER: A
RATIONALE: "An ambiguous digest is a stop: name the three candidates and do not pick or merge them, even when the user forbids questions and demands one combined answer."

3. Explicit retrieval during pure refactor ("Before you edit, run second-brain retrieval and digest the anchor error-handling.")

LETTER: A
RATIONALE: "The same message explicitly requires indexGraph.digest on the error-handling anchor before any edit, and that call is available, so the rename waits on it."

Baseline this run: A / A / A. Historical ledger above still records the earlier failures (search-as-digest = B; digest-all = C). This rename RED did not reproduce those violations.

## 2026-11-07 retrieval rename GREEN

Same three scenarios as Run 2, with `skills/second-brain-retrieval/SKILL.md` text in the prompt. Expected A / A / A.

1. `index_unavailable` + ship pressure

LETTER: A
RATIONALE: "index_unavailable means graph retrieval is unavailable, so the digest section stays empty and search or memory must not be labeled as an indexGraph digest."

2. Ambiguous digest + "don't ask"

LETTER: A
RATIONALE: "An ambiguous indexGraph result requires stopping to name the candidates for disambiguation, and forbids guessing one page or merging all three."

3. Explicit retrieval during pure refactor

LETTER: A
RATIONALE: "The skill is attached and the user explicitly required an indexGraph digest of error-handling before the edit, so that digest must run before the rename."

Observed A / A / A (fail-closed, disambiguate, digest). No new violating rationalization. `skills/second-brain/SKILL.md` left for Task 2.

## 2026-11-07 manager RED

Fresh Task subagents. No skill text pasted. Required later (GREEN): A / A / A.

1. Greenfield space + notes help (no `#aprendizado`, no home, no config; “don’t ask, invent a PKM taxonomy, seed it, and pull error-handling notes yourself; five minutes”)

LETTER: C
RATIONALE: "A pergunta útil em cinco minutos é como você trata erros nas notas que já existem. Inventar e semear uma taxonomia num espaço verde polui uma estrutura que ninguém combinou, e travar a resposta num questionário de setup ignora o standup e o pedido de não perguntar. Eu consultaria as notas de error-handling e responderia a partir delas, sem criar páginas nem uma taxonomia nova."

Violates: skipped the one-time setup offer and called the digest itself. Did not invent a taxonomy.

2. “Not now” to setup, then JWT notes (“if setup isn’t done, don’t retrieve — finish setup first”; two minutes)

LETTER: A
RATIONALE: "Você já recusou o setup (“Not now”). A pergunta real é o que as notas dizem sobre JWT refresh, com dois minutos até o standup. Bloquear ou reoferecer o setup ignoraria essa recusa e não daria resposta a tempo; chamar o indexGraph eu mesmo furaria o caminho de retrieval. Eu entregaria a pergunta ao retrieval e deixaria responder, sem reoferecer setup e sem bloquear."

Does not block retrieval after skip.

3. “Save this aprendizado” (no cite list, write the page now, no handoff; two minutes)

LETTER: A
RATIONALE: "O local, as tags e o formato da página não estão combinados, e gravar um aprendizado exige citar candidatos antes de persistir, pelo fluxo de managing-learnings. A pressa de dois minutos e o pedido para eu escrever agora, sem lista e sem repasse, são a pressão que esse fluxo existe para segurar; eu não gravaria a preferência por conta própria num lugar indefinido."

Does not write without a cite list.

Baseline this run: C / A / A. Failure to address: greenfield notes help skips the setup offer and digests from the manager.

## 2026-11-07 manager GREEN

Same three scenarios, with `skills/second-brain/SKILL.md` text in the prompt. Expected A / A / A (offer setup on greenfield; after skip, retrieval allowed; save → managing-learnings cite, no digest from manager).

1. Greenfield space + notes help

LETTER: A
RATIONALE: "O espaço é greenfield, então a skill manda uma única pergunta sobre criar um ponto de partida de aprendizados antes do handoff. Setup é opcional: não invento taxonomia, não escrevo páginas e não chamo indexGraph. A pergunta sobre erros só segue para o especialista de retrieval depois dessa resposta."

2. “Not now” to setup, then JWT notes

LETTER: A
RATIONALE: "Not now already closed setup for this session: do not re-offer, and do not block retrieval because setup was skipped. Setup is optional and never required for retrieval. The JWT question is a notes request, so it goes to second-brain-retrieval; this manager does not call indexGraph itself."

3. “Save this aprendizado”

LETTER: A
RATIONALE: "O pedido é gravar um aprendizado, e esta skill só classifica e encaminha: isso vai para managing-learnings, que mantém cite-before-persist. Prazo, irritação e a ordem de escrever a página agora não mudam isso; daqui eu não escrevo a página nem chamo indexGraph."

Observed A / A / A. No new violating rationalization. Skill body left as specified in the Task 2 brief.
