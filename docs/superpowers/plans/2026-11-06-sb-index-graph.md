# sb-index-graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a SilverBullet Library that exposes `indexGraph.neighbors` / `path` / `digest` over the space’s relation/tag index so agents (via MCP `lua`) retrieve a semantically closed subgraph instead of scanning the whole space.

**Architecture:** Pure graph algorithms live in standard Lua (`src/graph.lua`), tested with LuaJIT against fixture edge lists. The SB Library page wraps those algorithms with `index.relations()` / `index.pages()` / `index.isAvailable()` under the `indexGraph` namespace. A minimal `meta/skill` page teaches agents the call protocol. No parallel index, no Graphify, no RAG, no MCP sidecar.

**Tech Stack:** SilverBullet Space Lua Library; LuaJIT for unit tests; Markdown fixtures; MCP `lua` for integration checks on a live space.

## Global Constraints

- Corpus = one SilverBullet space (one Git); do not index external code repos.
- Source of truth = SB object index (`index.relations`, page tags); no embeddings / second index.
- Context limits = semantic expansion (tag-affinity closure), never arbitrary N-page or token budgets.
- Runtime Lua / Runtime API unavailable or `index.isAvailable() == false` → explicit error; no `search`+`read` fallback.
- Extension shape = Library + Space Lua + `meta/skill` (not TypeScript plug in v1).
- Code style = DRY, YAGNI, Clean Code; Space Lua camelCase; API namespace `indexGraph`.
- Library install path = `Library/abelroes/sb-index-graph` (matches GitHub user `abelroes`).
- Reserved relation kinds treated as structural: `mention`, `at-mention`, `authored`, `co-mention`; all other kinds are user predicates.
- Default digest/neighbors edge filter: include all kinds except edges whose `toTag == "url"` (external URLs out of the index graph).

---

## File structure

| Path | Responsibility |
|---|---|
| `src/graph.lua` | Pure algorithms: normalize refs, adjacency, neighbors, path, resolveAnchor, digest (tag-affinity closure). No SB APIs. |
| `tests/graph_test.lua` | LuaJIT unit tests over fixture edge lists. |
| `tests/fixtures/edges.lua` | Shared mini graph used by tests. |
| `tests/fixtures/mini-space/*.md` | Optional Markdown pages for manual install/smoke in a real space. |
| `Library/abelroes/sb-index-graph.md` | `meta/library` entry: embeds/ports `src/graph.lua` + thin `indexGraph.*` wrappers over SB index. |
| `Library/abelroes/sb-index-graph-skill.md` | `meta/skill` page: when/how to call the API via MCP `lua`. |
| `README.md` | Install (Library Manager / Share URI), Runtime API prerequisite, example `lua` calls. |
| `docs/superpowers/specs/2026-11-06-sb-index-graph-design.md` | Design (already committed). |
| `docs/superpowers/plans/2026-11-06-sb-index-graph.md` | This plan. |

**Algorithm lock (v1 digest):**

1. `resolveAnchor(anchor, pages)` → `{ ok, page?, pages?, tags?, error? }`  
   - Exact page name → that page.  
   - Exact user tag → all pages carrying that tag as seed set.  
   - Else case-insensitive substring on page names: 1 match → that page; 0 → `not_found`; >1 → `ambiguous` with candidates (do not guess).
2. Seed tag set = union of user tags on seed page(s).
3. BFS/queue expansion along filtered relations (undirected for traversal).  
   Admit a candidate neighbor iff it shares ≥1 user tag with the **current** affinity tag set **or** the connecting edge `kind` is a user predicate (not in the reserved structural set).  
   On admit: add node, union its user tags into the affinity set.  
4. Stop at fixed point (no new admissions). That is the closed affinity community — not a hop/page quota.
5. Return nodes, edges used, seed, and per-node tags + edge snippets as evidence.

**Path:** undirected BFS shortest path on filtered relations; missing → `{ ok = false, error = "not_found" }`.

**Neighbors:** degree-1 filtered relations from a page (collapse `co-mention` pairs like Graph View: one undirected edge per pair+via).

---

### Task 1: Pure graph core — normalize + neighbors

**Files:**
- Create: `src/graph.lua`
- Create: `tests/fixtures/edges.lua`
- Create: `tests/graph_test.lua`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `graph.stripPagePos(ref) -> string`
  - `graph.endpointMatches(endpoint, ref) -> boolean`
  - `graph.isReservedKind(kind) -> boolean`
  - `graph.isUserPredicate(kind) -> boolean`
  - `graph.filterEdges(edges, opts?) -> edges` (`opts.excludeUrl` default true)
  - `graph.collapseCoMentions(edges) -> edges`
  - `graph.neighbors(page, edges, opts?) -> { ok, page, neighbors = { { ref, kind, directed, snippet?, page? }, ... }, error? }`

- [ ] **Step 1: Write the failing test file and fixture**

Create `tests/fixtures/edges.lua`:

```lua
-- Mini space graph for unit tests.
-- Pages: Alpha (#project), Beta (#project), Gamma (#journal), Delta (no user tags)
-- Edges: Alpha -mention-> Beta, Beta -mention-> Gamma,
--        Alpha -dependsOn-> Delta (user predicate), Gamma -mention-> https://example.com (url)

return {
  pages = {
    { name = "Alpha", tags = { "page", "project" } },
    { name = "Beta", tags = { "page", "project" } },
    { name = "Gamma", tags = { "page", "journal" } },
    { name = "Delta", tags = { "page" } },
  },
  edges = {
    { from = "Alpha", to = "Beta", kind = "mention", toTag = "page", page = "Alpha", snippet = "see [[Beta]]" },
    { from = "Beta", to = "Gamma", kind = "mention", toTag = "page", page = "Beta", snippet = "[[Gamma]]" },
    { from = "Alpha", to = "Delta", kind = "dependsOn", toTag = "page", page = "Alpha", snippet = "dependsOn: [[Delta]]" },
    { from = "Gamma", to = "https://example.com", kind = "mention", toTag = "url", page = "Gamma", snippet = "https://example.com" },
    { from = "Alpha@12", to = "Beta", kind = "mention", toTag = "page", page = "Alpha", snippet = "pos link" },
  },
}
```

Create `tests/graph_test.lua`:

```lua
local graph = require("src.graph")
local fix = dofile("tests/fixtures/edges.lua")

local function assert_eq(a, b, msg)
  if a ~= b then
    error((msg or "assert_eq") .. ": " .. tostring(a) .. " ~= " .. tostring(b), 2)
  end
end

local function assert_true(v, msg)
  if not v then error(msg or "assert_true failed", 2) end
end

-- neighbors: Alpha sees Beta (mention) and Delta (dependsOn); URL edge ignored; @pos collapsed
local n = graph.neighbors("Alpha", fix.edges)
assert_true(n.ok, "neighbors ok")
local refs = {}
for _, x in ipairs(n.neighbors) do refs[x.ref] = x.kind end
assert_eq(refs["Beta"], "mention")
assert_eq(refs["Delta"], "dependsOn")
assert_true(refs["https://example.com"] == nil, "url excluded")
assert_eq(select(2, pairs(refs)) ~= nil or true, true) -- keep file loadable

print("Task1 tests need graph.lua — expect require failure until implemented")
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd /home/abel/projects/sb-index-graph
luajit -e 'package.path = "./?.lua;./?/init.lua;" .. package.path; dofile("tests/graph_test.lua")'
```

Expected: FAIL with module `src.graph` not found (or similar require error).

- [ ] **Step 3: Implement minimal `src/graph.lua` for neighbors**

```lua
local graph = {}

local RESERVED = {
  mention = true,
  ["at-mention"] = true,
  authored = true,
  ["co-mention"] = true,
}

function graph.stripPagePos(ref)
  if type(ref) ~= "string" then return ref end
  if ref:match("^https?://") then return ref end
  return (ref:split and ref) or ref:match("^[^@#$]+") or ref
end

-- LuaJIT / PUC: no string.split; use match
function graph.stripPagePos(ref)
  if type(ref) ~= "string" then return tostring(ref) end
  if ref:match("^https?://") then return ref end
  local bare = ref:match("^([^@#$]+)")
  return bare or ref
end

function graph.endpointMatches(endpoint, ref)
  local e = graph.stripPagePos(endpoint)
  local r = graph.stripPagePos(ref)
  return e == r
end

function graph.isReservedKind(kind)
  return RESERVED[kind] == true
end

function graph.isUserPredicate(kind)
  return kind ~= nil and not graph.isReservedKind(kind)
end

function graph.filterEdges(edges, opts)
  opts = opts or {}
  local excludeUrl = opts.excludeUrl
  if excludeUrl == nil then excludeUrl = true end
  local kinds = opts.kinds -- optional set/list
  local kindSet = nil
  if kinds then
    kindSet = {}
    for _, k in ipairs(kinds) do kindSet[k] = true end
  end
  local out = {}
  for _, e in ipairs(edges) do
    if not (excludeUrl and e.toTag == "url") then
      if not kindSet or kindSet[e.kind] then
        out[#out + 1] = e
      end
    end
  end
  return out
end

function graph.collapseCoMentions(edges)
  local out = {}
  local seen = {}
  for _, e in ipairs(edges) do
    if e.kind == "co-mention" then
      local a = graph.stripPagePos(e.from)
      local b = graph.stripPagePos(e.to)
      local via = e.via or ""
      local keyParts = { a, b, via }
      table.sort(keyParts)
      local key = table.concat(keyParts, "\0")
      if not seen[key] then
        seen[key] = true
        out[#out + 1] = {
          from = a,
          to = b,
          kind = e.kind,
          toTag = e.toTag,
          page = e.page,
          snippet = e.snippet,
          via = e.via,
          undirected = true,
        }
      end
    else
      out[#out + 1] = {
        from = graph.stripPagePos(e.from),
        to = graph.stripPagePos(e.to),
        kind = e.kind,
        toTag = e.toTag,
        fromTag = e.fromTag,
        page = e.page,
        snippet = e.snippet,
        undirected = false,
      }
    end
  end
  return out
end

function graph.neighbors(page, edges, opts)
  if type(page) ~= "string" or page == "" then
    return { ok = false, error = "invalid_page" }
  end
  local ref = graph.stripPagePos(page)
  local filtered = graph.collapseCoMentions(graph.filterEdges(edges, opts))
  local neighbors = {}
  local seen = {}
  for _, e in ipairs(filtered) do
    local other = nil
    if graph.endpointMatches(e.from, ref) then
      other = e.to
    elseif graph.endpointMatches(e.to, ref) then
      other = e.from
    end
    if other and other ~= ref then
      local key = other .. "\0" .. e.kind
      if not seen[key] then
        seen[key] = true
        neighbors[#neighbors + 1] = {
          ref = other,
          kind = e.kind,
          directed = not e.undirected,
          snippet = e.snippet,
          page = e.page,
        }
      end
    end
  end
  table.sort(neighbors, function(a, b)
    if a.ref == b.ref then return a.kind < b.kind end
    return a.ref < b.ref
  end)
  return { ok = true, page = ref, neighbors = neighbors }
end

return graph
```

Fix the duplicate `stripPagePos` when pasting — keep **only** the second definition (the one using `match`).

- [ ] **Step 4: Replace test body with real assertions and run pass**

Replace `tests/graph_test.lua` with:

```lua
package.path = "./?.lua;./?/init.lua;" .. package.path
local graph = require("src.graph")
local fix = dofile("tests/fixtures/edges.lua")

local function assert_eq(a, b, msg)
  if a ~= b then
    error((msg or "assert_eq") .. ": " .. tostring(a) .. " ~= " .. tostring(b), 2)
  end
end

local function assert_true(v, msg)
  if not v then error(msg or "assert_true failed", 2) end
end

assert_eq(graph.stripPagePos("Alpha@12"), "Alpha")
assert_true(graph.isUserPredicate("dependsOn"))
assert_true(not graph.isUserPredicate("mention"))

local n = graph.neighbors("Alpha", fix.edges)
assert_true(n.ok)
local refs = {}
for _, x in ipairs(n.neighbors) do refs[x.ref] = x.kind end
assert_eq(refs["Beta"], "mention")
assert_eq(refs["Delta"], "dependsOn")
assert_true(refs["https://example.com"] == nil)
assert_true(refs["Gamma"] == nil, "Gamma is not a direct neighbor")

-- positional from still counts as Alpha
local n2 = graph.neighbors("Alpha", {
  { from = "Alpha@99", to = "Beta", kind = "mention", toTag = "page", page = "Alpha" },
})
assert_eq(n2.neighbors[1].ref, "Beta")

print("OK neighbors")
```

Run:

```bash
luajit -e 'package.path = "./?.lua;./?/init.lua;" .. package.path; dofile("tests/graph_test.lua")'
```

Expected: `OK neighbors`

- [ ] **Step 5: Commit**

```bash
git add src/graph.lua tests/fixtures/edges.lua tests/graph_test.lua
git commit -m "$(cat <<'EOF'
feat: add pure graph neighbors over relation edges

Establish LuaJIT-tested core so Space Lua can wrap the same algorithms without inventing a second index.
EOF
)"
```

---

### Task 2: Pure graph core — path

**Files:**
- Modify: `src/graph.lua`
- Modify: `tests/graph_test.lua`

**Interfaces:**
- Consumes: `graph.filterEdges`, `graph.collapseCoMentions`, `graph.stripPagePos`, `graph.endpointMatches`
- Produces: `graph.path(from, to, edges, opts?) -> { ok, from, to, hops = { { from, to, kind, snippet? }, ... }, error? }`  
  - success: `ok = true`, `hops` ordered from `from` to `to`  
  - failure: `ok = false`, `error = "not_found" | "invalid_page"`

- [ ] **Step 1: Write the failing path tests**

Append to `tests/graph_test.lua`:

```lua
local p = graph.path("Alpha", "Gamma", fix.edges)
assert_true(p.ok, "path Alpha->Gamma")
assert_eq(#p.hops, 2)
assert_eq(p.hops[1].to, "Beta")
assert_eq(p.hops[2].to, "Gamma")

local missing = graph.path("Alpha", "NoSuch", fix.edges)
assert_true(not missing.ok)
assert_eq(missing.error, "not_found")

print("OK path")
```

- [ ] **Step 2: Run tests — expect path failure**

Run:

```bash
luajit -e 'package.path = "./?.lua;./?/init.lua;" .. package.path; dofile("tests/graph_test.lua")'
```

Expected: FAIL (`attempt to call field 'path' (a nil value)` or similar).

- [ ] **Step 3: Implement `graph.path`**

Add to `src/graph.lua`:

```lua
local function buildUndirectedAdj(edges)
  local adj = {}
  local function add(a, b, meta)
    adj[a] = adj[a] or {}
    adj[a][#adj[a] + 1] = { ref = b, kind = meta.kind, snippet = meta.snippet, page = meta.page }
  end
  for _, e in ipairs(edges) do
    add(e.from, e.to, e)
    add(e.to, e.from, e)
  end
  return adj
end

function graph.path(from, to, edges, opts)
  if type(from) ~= "string" or from == "" or type(to) ~= "string" or to == "" then
    return { ok = false, error = "invalid_page" }
  end
  local src = graph.stripPagePos(from)
  local dst = graph.stripPagePos(to)
  if src == dst then
    return { ok = true, from = src, to = dst, hops = {} }
  end
  local filtered = graph.collapseCoMentions(graph.filterEdges(edges, opts))
  local adj = buildUndirectedAdj(filtered)
  if not adj[src] then
    return { ok = false, error = "not_found", from = src, to = dst }
  end
  local prev = {}
  local prevEdge = {}
  local q = { src }
  local head = 1
  prev[src] = false
  while head <= #q do
    local cur = q[head]
    head = head + 1
    for _, nb in ipairs(adj[cur] or {}) do
      if prev[nb.ref] == nil then
        prev[nb.ref] = cur
        prevEdge[nb.ref] = nb
        if nb.ref == dst then
          head = #q + 1
          break
        end
        q[#q + 1] = nb.ref
      end
    end
  end
  if prev[dst] == nil then
    return { ok = false, error = "not_found", from = src, to = dst }
  end
  local stack = {}
  local node = dst
  while node ~= src do
    local e = prevEdge[node]
    stack[#stack + 1] = {
      from = prev[node],
      to = node,
      kind = e.kind,
      snippet = e.snippet,
      page = e.page,
    }
    node = prev[node]
  end
  local hops = {}
  for i = #stack, 1, -1 do
    hops[#hops + 1] = stack[i]
  end
  return { ok = true, from = src, to = dst, hops = hops }
end
```

Expose `buildUndirectedAdj` as local only (keep DRY for digest in Task 3 by leaving it as `local function` in the same file — digest will add a sibling local or reuse this one).

- [ ] **Step 4: Run tests — expect pass**

```bash
luajit -e 'package.path = "./?.lua;./?/init.lua;" .. package.path; dofile("tests/graph_test.lua")'
```

Expected: prints `OK neighbors` and `OK path`.

- [ ] **Step 5: Commit**

```bash
git add src/graph.lua tests/graph_test.lua
git commit -m "$(cat <<'EOF'
feat: add undirected shortest path over filtered relations

Agents can ask how two pages connect without scanning the space.
EOF
)"
```

---

### Task 3: Pure graph core — resolveAnchor + digest (tag-affinity closure)

**Files:**
- Modify: `src/graph.lua`
- Modify: `tests/graph_test.lua`

**Interfaces:**
- Consumes: pages `{ name, tags }`, edges, helpers from Tasks 1–2
- Produces:
  - `graph.userTags(tags) -> { [string]=true }` — drops `page` and any tag starting with `meta`
  - `graph.resolveAnchor(anchor, pages) -> { ok, mode, page?, pages?, error?, candidates? }`
  - `graph.digest(anchor, pages, edges, opts?) -> { ok, seed, nodes, edges, affinityTags, error?, candidates? }`

Digest stop condition = fixed point of tag-affinity admission (shared user tag with affinity set **or** user-predicate edge). No hop/page quota fields.

- [ ] **Step 1: Write failing digest tests**

Append to `tests/graph_test.lua`:

```lua
local r = graph.resolveAnchor("Alpha", fix.pages)
assert_true(r.ok)
assert_eq(r.page, "Alpha")

local byTag = graph.resolveAnchor("project", fix.pages)
assert_true(byTag.ok)
assert_eq(byTag.mode, "tag")
assert_eq(#byTag.pages, 2)

local amb = graph.resolveAnchor("a", fix.pages) -- may match Alpha only or ambiguous — fixture: use "Zeta"
local amb2 = graph.resolveAnchor("NoPage", fix.pages)
assert_true(not amb2.ok)
assert_eq(amb2.error, "not_found")

local d = graph.digest("Alpha", fix.pages, fix.edges)
assert_true(d.ok, "digest ok")
local nodeSet = {}
for _, n in ipairs(d.nodes) do nodeSet[n.ref] = true end
-- Alpha (#project) -> Beta (#project) via mention (shared tag)
assert_true(nodeSet["Alpha"])
assert_true(nodeSet["Beta"])
-- Delta admitted via user predicate dependsOn even without shared tags
assert_true(nodeSet["Delta"])
-- Gamma is #journal only, connected via Beta mention but shares no affinity tag with seed {project}
-- and edge Beta->Gamma is structural mention → NOT admitted
assert_true(nodeSet["Gamma"] == nil, "Gamma outside affinity closure")

local dTag = graph.digest("project", fix.pages, fix.edges)
assert_true(dTag.ok)
assert_eq(dTag.seed.mode, "tag")

print("OK digest")
```

- [ ] **Step 2: Run — expect digest failure**

```bash
luajit -e 'package.path = "./?.lua;./?/init.lua;" .. package.path; dofile("tests/graph_test.lua")'
```

Expected: FAIL on missing `resolveAnchor` / `digest`.

- [ ] **Step 3: Implement resolveAnchor + digest**

Add to `src/graph.lua` (reuse `buildUndirectedAdj`):

```lua
function graph.userTags(tags)
  local set = {}
  if not tags then return set end
  for _, t in ipairs(tags) do
    if t ~= "page" and t ~= "meta" and not tostring(t):match("^meta/") then
      set[t] = true
    end
  end
  return set
end

local function pageByName(pages)
  local m = {}
  for _, p in ipairs(pages) do
    m[p.name] = p
  end
  return m
end

function graph.resolveAnchor(anchor, pages)
  if type(anchor) ~= "string" or anchor == "" then
    return { ok = false, error = "invalid_anchor" }
  end
  local byName = pageByName(pages)
  if byName[anchor] then
    return { ok = true, mode = "page", page = anchor, pages = { anchor } }
  end
  local tagHits = {}
  for _, p in ipairs(pages) do
    for _, t in ipairs(p.tags or {}) do
      if t == anchor then
        tagHits[#tagHits + 1] = p.name
        break
      end
    end
  end
  if #tagHits > 0 then
    table.sort(tagHits)
    return { ok = true, mode = "tag", pages = tagHits, tag = anchor }
  end
  local needle = anchor:lower()
  local subs = {}
  for _, p in ipairs(pages) do
    if p.name:lower():find(needle, 1, true) then
      subs[#subs + 1] = p.name
    end
  end
  if #subs == 1 then
    return { ok = true, mode = "page", page = subs[1], pages = { subs[1] } }
  elseif #subs == 0 then
    return { ok = false, error = "not_found" }
  else
    table.sort(subs)
    return { ok = false, error = "ambiguous", candidates = subs }
  end
end

function graph.digest(anchor, pages, edges, opts)
  local resolved = graph.resolveAnchor(anchor, pages)
  if not resolved.ok then
    return {
      ok = false,
      error = resolved.error,
      candidates = resolved.candidates,
    }
  end
  local byName = pageByName(pages)
  local affinity = {}
  local seeds = resolved.pages
  for _, name in ipairs(seeds) do
    local p = byName[name]
    for t, _ in pairs(graph.userTags(p and p.tags)) do
      affinity[t] = true
    end
  end
  local filtered = graph.collapseCoMentions(graph.filterEdges(edges, opts))
  local adj = buildUndirectedAdj(filtered)
  local included = {}
  local queue = {}
  for _, name in ipairs(seeds) do
    included[name] = true
    queue[#queue + 1] = name
  end
  local usedEdges = {}
  local usedKey = {}
  local head = 1
  while head <= #queue do
    local cur = queue[head]
    head = head + 1
    for _, nb in ipairs(adj[cur] or {}) do
      if not included[nb.ref] then
        local target = byName[nb.ref]
        local ttags = graph.userTags(target and target.tags)
        local shared = false
        for t, _ in pairs(ttags) do
          if affinity[t] then shared = true break end
        end
        local admit = shared or graph.isUserPredicate(nb.kind)
        if admit then
          included[nb.ref] = true
          queue[#queue + 1] = nb.ref
          for t, _ in pairs(ttags) do affinity[t] = true end
          local a, b = cur, nb.ref
          if a > b then a, b = b, a end
          local ek = a .. "\0" .. b .. "\0" .. nb.kind
          if not usedKey[ek] then
            usedKey[ek] = true
            usedEdges[#usedEdges + 1] = {
              from = cur,
              to = nb.ref,
              kind = nb.kind,
              snippet = nb.snippet,
              page = nb.page,
            }
          end
        end
      else
        -- both ends already in; still record edge once for subgraph completeness
        local a, b = cur, nb.ref
        if a > b then a, b = b, a end
        local ek = a .. "\0" .. b .. "\0" .. nb.kind
        if not usedKey[ek] then
          usedKey[ek] = true
          usedEdges[#usedEdges + 1] = {
            from = cur,
            to = nb.ref,
            kind = nb.kind,
            snippet = nb.snippet,
            page = nb.page,
          }
        end
      end
    end
  end
  local nodes = {}
  for name, _ in pairs(included) do
    local p = byName[name]
    local ut = {}
    for t, _ in pairs(graph.userTags(p and p.tags)) do ut[#ut + 1] = t end
    table.sort(ut)
    nodes[#nodes + 1] = { ref = name, tags = ut, dangling = p == nil }
  end
  table.sort(nodes, function(a, b) return a.ref < b.ref end)
  local affinityList = {}
  for t, _ in pairs(affinity) do affinityList[#affinityList + 1] = t end
  table.sort(affinityList)
  return {
    ok = true,
    seed = {
      mode = resolved.mode,
      pages = seeds,
      tag = resolved.tag,
      page = resolved.page,
    },
    nodes = nodes,
    edges = usedEdges,
    affinityTags = affinityList,
  }
end
```

- [ ] **Step 4: Run full unit suite**

```bash
luajit -e 'package.path = "./?.lua;./?/init.lua;" .. package.path; dofile("tests/graph_test.lua")'
```

Expected: `OK neighbors`, `OK path`, `OK digest`.

If Gamma is incorrectly included, fix admission logic before proceeding — do not weaken the test.

- [ ] **Step 5: Commit**

```bash
git add src/graph.lua tests/graph_test.lua
git commit -m "$(cat <<'EOF'
feat: add tag-affinity digest and anchor resolution

Close the subgraph by shared tags and user predicates instead of arbitrary page quotas.
EOF
)"
```

---

### Task 4: SilverBullet Library wrappers (`indexGraph`)

**Files:**
- Create: `Library/abelroes/sb-index-graph.md`

**Interfaces:**
- Consumes: pure functions from `src/graph.lua` (copied into a `space-lua` block)
- Produces (global Space Lua API):
  - `indexGraph.neighbors(page, opts?)`
  - `indexGraph.path(from, to, opts?)`
  - `indexGraph.digest(anchor, opts?)`
  - Each returns the same shapes as pure graph; on index unavailable: `{ ok = false, error = "index_unavailable" }`
  - Never catches that by calling `search`

- [ ] **Step 1: Create library page skeleton with frontmatter**

Create `Library/abelroes/sb-index-graph.md`:

```markdown
---
name: Library/abelroes/sb-index-graph
tags: meta/library
description: Structured retrieval over the SilverBullet relation/tag index for AI agents (neighbors, path, digest).
files:
- sb-index-graph-skill.md
---

# sb-index-graph

Second-brain retrieval for agents: query the **index graph** (relations + tags), not the Graph View UI.

Requires Runtime API (MCP `lua`). If the runtime or index is unavailable, calls fail explicitly.

## API

- `indexGraph.neighbors(page, opts?)`
- `indexGraph.path(from, to, opts?)`
- `indexGraph.digest(anchor, opts?)`

`opts.kinds` optional list of relation kinds to keep. URLs excluded by default.

```space-lua
-- priority: 10
-- Paste/port the full contents of src/graph.lua here as local modules,
-- then wrap with SB index access. Keep function bodies identical to src/graph.lua.

indexGraph = indexGraph or {}

local function loadRelations(opts)
  if not index.isAvailable() then
    return nil, "index_unavailable"
  end
  local rows = {}
  for r in index.relations() do
    rows[#rows + 1] = {
      from = r.from,
      to = r.to,
      kind = r.kind,
      toTag = r.toTag,
      fromTag = r.fromTag,
      page = r.page,
      snippet = r.snippet,
      via = r.via,
    }
  end
  return rows
end

local function loadPages()
  local pages = {}
  for p in index.pages() do
    pages[#pages + 1] = { name = p.name, tags = p.tags or { p.tag } }
  end
  return pages
end

function indexGraph.neighbors(page, opts)
  local edges, err = loadRelations(opts)
  if not edges then return { ok = false, error = err } end
  return graph.neighbors(page, edges, opts)
end

function indexGraph.path(from, to, opts)
  local edges, err = loadRelations(opts)
  if not edges then return { ok = false, error = err } end
  return graph.path(from, to, edges, opts)
end

function indexGraph.digest(anchor, opts)
  local edges, err = loadRelations(opts)
  if not edges then return { ok = false, error = err } end
  return graph.digest(anchor, loadPages(), edges, opts)
end
```
```

**Implementer note:** Space Lua cannot `require("src.graph")`. In the same `space-lua` fence (or a prior fence with higher priority), paste `src/graph.lua` but:

1. Change `local graph = {}` / `return graph` into assigning a local/global `graph` table used by the wrappers.  
2. Prefer: first fence defines `graph = graph or {}` and all `graph.*` functions (copy from `src/graph.lua` without `return`). Second fence defines `indexGraph.*` wrappers.  
3. After any change to algorithms, update **both** `src/graph.lua` and the library fences (DRY discipline: change tests first, then both copies in the same commit).

- [ ] **Step 2: Finish the embedded `graph` port in the library page**

Copy every function from `src/graph.lua` into the library `space-lua` block(s) so MCP `lua` can call `indexGraph.digest("...")` after `System: Reload`.

- [ ] **Step 3: Smoke-check syntax offline**

Run unit tests still pass (pure file unchanged):

```bash
luajit -e 'package.path = "./?.lua;./?/init.lua;" .. package.path; dofile("tests/graph_test.lua")'
```

Expected: all OK lines.

- [ ] **Step 4: Manual SB load checklist (record in commit message if not automatable)**

On a space with Runtime API + library page installed/synced:

1. `System: Reload`  
2. MCP or Workbench Console: `indexGraph.neighbors("SomeLinkedPage")`  
3. Confirm `ok == true` or structured `not_found` / `index_unavailable` — never a silent empty improvisation.

- [ ] **Step 5: Commit**

```bash
git add Library/abelroes/sb-index-graph.md
git commit -m "$(cat <<'EOF'
feat: add SilverBullet library wrappers for indexGraph API

Expose neighbors/path/digest through Space Lua for MCP lua clients.
EOF
)"
```

---

### Task 5: Agent skill (`meta/skill`)

**Files:**
- Create: `Library/abelroes/sb-index-graph-skill.md`
- Modify: `Library/abelroes/sb-index-graph.md` (ensure `files` lists the skill)

**Interfaces:**
- Consumes: `indexGraph.*` API
- Produces: skill page discoverable via MCP `help` / skills list

- [ ] **Step 1: Write the skill page**

Create `Library/abelroes/sb-index-graph-skill.md`:

```markdown
---
name: Library/abelroes/sb-index-graph-skill
tags: meta/skill
description: Retrieve a semantically closed subgraph from the SilverBullet index before reading pages. Use indexGraph.digest/path/neighbors via MCP lua.
---

# Skill: Index graph retrieval

## When to use

- Answering questions from this SilverBullet space’s knowledge.
- Finding how two notes connect.
- Deciding which pages matter without listing or reading the whole space.

## When not to use

- If MCP `lua` / Runtime API is unavailable: **stop** and report the tool unavailable. Do not fall back to bulk `search`+`read` to approximate this skill.
- Do not use Graphify or external repo indexing for this space.

## Protocol

1. Call `indexGraph.digest(anchor)` via MCP `lua`, where `anchor` is a page name, a user tag, or a disambiguating substring.
2. If `ok` is false and `error` is `ambiguous`, pick from `candidates` with the user or a clearer anchor; do not guess.
3. If `ok` is false and `error` is `index_unavailable` or runtime failed: report unavailable.
4. Use the returned `nodes`, `edges`, `affinityTags`, and snippets as primary evidence.
5. Call `indexGraph.path(a, b)` when the question is specifically about a connection.
6. Call `indexGraph.neighbors(page)` for local context around one page.
7. Use MCP `read` only for a specific node when indexed snippets are insufficient for that node — driven by the digest, not by reading everything.
8. Optional write-back: MCP `write`/`edit` a lessons page only when the user wants persistence; keep format minimal.

## Example lua

```lua
indexGraph.digest("project")
```

```lua
indexGraph.path("Alpha", "Beta")
```
```

- [ ] **Step 2: Confirm library frontmatter `files` includes `sb-index-graph-skill.md`**

In `Library/abelroes/sb-index-graph.md` frontmatter:

```yaml
files:
- sb-index-graph-skill.md
```

(Paths are relative to the library page’s folder: `Library/abelroes/`.)

- [ ] **Step 3: Commit**

```bash
git add Library/abelroes/sb-index-graph-skill.md Library/abelroes/sb-index-graph.md
git commit -m "$(cat <<'EOF'
feat: add minimal meta/skill for indexGraph agent protocol

Teach agents to prefer digest/path/neighbors and fail closed without lua.
EOF
)"
```

---

### Task 6: README, mini-space fixture, verification

**Files:**
- Create: `README.md`
- Create: `tests/fixtures/mini-space/Alpha.md`
- Create: `tests/fixtures/mini-space/Beta.md`
- Create: `tests/fixtures/mini-space/Gamma.md`
- Create: `tests/fixtures/mini-space/Delta.md`
- Modify: `tests/graph_test.lua` only if needed (should already be green)

**Interfaces:**
- Consumes: library + skill
- Produces: install docs + copy-pasteable fixture pages mirroring `edges.lua`

- [ ] **Step 1: Write mini-space fixtures**

`tests/fixtures/mini-space/Alpha.md`:

```markdown
---
tags: project
dependsOn: "[[Delta]]"
---

Project hub. See [[Beta]].
```

`tests/fixtures/mini-space/Beta.md`:

```markdown
---
tags: project
---

Notes linking to [[Gamma]].
```

`tests/fixtures/mini-space/Gamma.md`:

```markdown
---
tags: journal
---

Daily note. Link out <https://example.com>.
```

`tests/fixtures/mini-space/Delta.md`:

```markdown
---
tags: page
---

Dependency target with no project tag.
```

- [ ] **Step 2: Write README**

```markdown
# sb-index-graph

SilverBullet Library: structured retrieval over the **relation/tag index** for AI agents (MCP `lua`).

Not Graphify. Not the Graph View UI. Not a vector RAG stack.

## Requirements

- SilverBullet with **Runtime API** enabled on the space (required for MCP `lua`)
- MCP connected (Desktop or multi-space `/.mcp`)

## Install

1. Publish/install this library to `Library/abelroes/sb-index-graph` (Library Manager / Share from this repo’s `Library/abelroes/` pages).
2. Ensure `Library/abelroes/sb-index-graph-skill.md` is present (`files` in the library frontmatter).
3. Run **System: Reload**.

## Agent usage

```lua
indexGraph.digest("YourPageOrTag")
indexGraph.path("PageA", "PageB")
indexGraph.neighbors("YourPage")
```

If lua/runtime/index is unavailable, treat the tool as down — do not improvise with full-space reads.

## Develop

```bash
luajit -e 'package.path = "./?.lua;./?/init.lua;" .. package.path; dofile("tests/graph_test.lua")'
```

Pure algorithms: `src/graph.lua`. Keep Space Lua copies in sync when changing behavior.

## Design

See `docs/superpowers/specs/2026-11-06-sb-index-graph-design.md`.
```

- [ ] **Step 3: Run unit tests one last time**

```bash
luajit -e 'package.path = "./?.lua;./?/init.lua;" .. package.path; dofile("tests/graph_test.lua")'
```

Expected: all OK.

- [ ] **Step 4: Manual success criterion (user space)**

After install on the real space: ask an agent a question answerable from linked/tagged notes; confirm it calls `indexGraph.digest` (or path/neighbors) and does not enumerate the space. Record pass/fail in the PR/commit notes.

- [ ] **Step 5: Commit**

```bash
git add README.md tests/fixtures/mini-space
git commit -m "$(cat <<'EOF'
docs: add install README and mini-space fixtures

Give agents and humans a clear install path and a tangible sample graph.
EOF
)"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|---|---|
| Library Space Lua + meta/skill (not Graphify/RAG/Ahmad/TS plug) | 4, 5 |
| API neighbors / path / digest | 1–3, 4 |
| Semantic expansion, not N-page budget | 3 (tag-affinity closure) |
| Fail closed if lua/index unavailable | 4, 5 |
| No pointers/external repos | Global constraints; no such API |
| Skills minimal; finetune later | 5 |
| Fixtures + tests for neighbors/path/digest | 1–3, 6 |
| Installable Library under Library/ | 4, 6 |
| DRY/YAGNI/Clean Code | pure core + thin wrappers; dual copy noted explicitly |
| Open: query→anchor | Task 3 `resolveAnchor` |
| Open: packaging paths | Task 4–5 frontmatter `files` |
| Open: harness | LuaJIT on `src/graph.lua` |

**Placeholder scan:** none intentional; implementer must sync `src/graph.lua` ↔ library fences (called out in Task 4).

**Type consistency:** `ok` / `error` / `not_found` / `ambiguous` / `index_unavailable` / `invalid_page` / `invalid_anchor` used consistently across tasks.
