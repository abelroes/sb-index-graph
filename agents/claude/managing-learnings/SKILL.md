---
name: managing-learnings
description: >-
  Use when saving, typing, organizing, or configuring aprendizados/learnings in
  a SilverBullet second-brain; when the space is greenfield or brownfield; when
  the user asks what learning types to have; or before writing any learning page
  whose location, tags, or shape are not already agreed.
---

# managing-learnings

Agree a **minimal** learnings convention — then write short notes the SB index can find.

**Principles:** KISS, YAGNI, DRY, direct. Prefer SilverBullet primitives over invented systems.

## SilverBullet-native (do this)

- **Pages** are markdown files; the **index** (tags, attributes, `[[wiki links]]`, relations) is how agents retrieve them — design for that, not for folder theater.
- **One tag is enough** to query (`tags: aprendizado`). Add `tag.define` / schemas only if the user wants validation or decorations — not by default (YAGNI).
- **Types** = a few tags or one attribute (e.g. `type: pitfall`), not parallel trees or PKM frameworks.
- **Links** (`[[…]]`, `related`) beat copy-paste and duplicate pages (DRY).
- **Capture shape:** title + one rule/lesson + when it applies + tags + links. No session dumps, no essays, no “industry standard” ontologies.

## Recipe

1. **Discover** — query/search existing tags/paths/config. Convention found → **brownfield**. Else → **greenfield**.
2. **Greenfield** — ask outcomes in one short pass; offer **2–3 tiny options** (mostly tags + one home page, not folder taxonomies). Wait for accept. Write only what they chose, including one short config page **at a path they pick**.
3. **Brownfield** — follow what exists. New types = optional tags/attributes in place. **No silent migrate**, no orphan parallel tree unless they choose it.
4. **Capture** — read agreed config (or dominant tag) → one short page → stop.

Read-only retrieval → **second-brain**. Persistence without agreement → stop and configure first.

## Red flags — STOP

- Deep folder/type trees, PARA/Zettel “standards”, or `tag.define` sprawl without ask
- Long notes, transcript dumps, or duplicate content instead of links
- Migrating brownfield or writing before accept on greenfield
- Bypassing this skill via **second-brain** write-back
