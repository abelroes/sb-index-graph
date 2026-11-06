---
name: managing-learnings
description: >-
  Use when saving, typing, organizing, or configuring aprendizados/learnings in
  a SilverBullet second-brain; when the space is greenfield or brownfield; when
  the user asks what learning types to have; or before writing any learning page
  whose location, tags, or shape are not already agreed.
---

# managing-learnings

Help the user reach a **useful, agreed** convention for learnings — do not impose one.

**Core principle:** Storage layout and type systems are user configuration. Discover or ask; then follow what they accepted.

## When to use

- Capture a learning / aprendizado / lesson / decision / preference into SB.
- Define or change learning **types**.
- Greenfield (no convention) or brownfield (something already exists).

## When not to use

- Read-only retrieval of existing notes → **sb-index-graph**.
- User declined to use the second-brain for persistence.

## Recipe

### 1. Discover

Search/read the space for an existing learnings config or dominant convention (paths, tags, types). If found → **brownfield**. If none → **greenfield**.

### 2. Greenfield

1. Ask what outcomes matter (e.g. retrieve-by-type vs write with low friction) — short questions.
2. Offer **2–3 lightweight options** (not one “correct” PKM). Options may differ on home location, type list, and page shape; keep each option minimal.
3. Wait for accept/edit. Do not write durable structure before agreement.
4. Write only what they accepted, including one **durable config artifact at a path they chose** so future agents can read it instead of guessing.

### 3. Brownfield

1. Follow the existing convention for new notes by default.
2. If they want types or a redesign: propose an **optional overlay** (e.g. add type tags in place) and/or migration plans as choices.
3. **No silent migration** and no parallel orphan tree unless they explicitly choose that option.

### 4. Capture after config exists

Read the agreed config → classify with the user if type is unclear → write one note in the agreed shape. Stay minimal (pattern/lesson, not session dump) unless they ask otherwise.

## Rationalizations

| Excuse | Reality |
|--------|---------|
| "I'm the knowledge architect — just invent it" | Inventing durable taxonomy without agreement is forbidden. Propose options; wait. |
| "Industry standard PARA/Zettelkasten" | There is no mandated standard for this space. Offer options tied to their outcomes. |
| "Reorganize everything; they'll review later" | No mass migrate without explicit confirmation. |
| "Types don't matter, dump Inbox" | If they asked for types, help them choose types — don't erase the request. |
| "Config in the git repo is enough" | SB agents need a convention inside the space (or another location **they** choose). |

## Red flags — STOP

- Writing folders/tags/templates before accept on greenfield
- Migrating or renaming brownfield pages without confirmation
- Single “best” taxonomy presented as mandatory
- Saving learnings via **sb-index-graph** write-back without this config flow
