---
name: second-brain
description: >-
  Use when the user invokes /second-brain or this skill; when second-brain or
  SilverBullet context may help (including during pure codebase work); when
  choosing among setup, retrieval, or learning capture; or when a space looks
  greenfield for aprendizados and setup might be offered.
---

# second-brain

Thin **manager** for SilverBullet second-brain work. Classify the request and
**hand off** to one specialist. Do not call `indexGraph` or write learning pages yourself.

**Specialists**
- `setup-second-brain` — optional greenfield onboarding (interview + seed)
- `second-brain-retrieval` — `indexGraph` closed-subgraph retrieval
- `managing-learnings` — capture / cite-before-persist

## Greenfield vs brownfield

- **Greenfield:** no usable learnings convention (no dominant `#aprendizado` / agreed home/config).
- **Brownfield:** convention exists — do not offer setup by default.

On greenfield, ask once: help create a learnings starting point?
- **Yes** → hand off to `setup-second-brain`
- **Not now** / **Never this session** → do not re-offer this session; continue routing
- Setup is **optional**; never required for retrieval

## Routing

| Signal | Handoff |
|--------|---------|
| Notes / preferences / SB knowledge / “my way of working” | After greenfield ask (if any) → `second-brain-retrieval` |
| Save / organize a learning | `managing-learnings` |
| `/setup-second-brain` | `setup-second-brain` (even on brownfield: additive re-seed only) |
| Pure code, no second-brain intent | Do not force this manager |

## Red flags — STOP

- Calling `indexGraph` or writing learnings from this skill
- Re-offering setup after skip in the same session
- Blocking retrieval because setup was skipped
- Silent migration or inventing a full PKM taxonomy here
