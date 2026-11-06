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
graph = graph or {}

local RESERVED = {
  mention = true,
  ["at-mention"] = true,
  authored = true,
  ["co-mention"] = true,
}

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

-- Structural tags never define affinity: `#page` is implied and `#meta`/`#meta/*`
-- describe the page itself rather than its subject.
function graph.userTags(tags)
  local set = {}
  if not tags then return set end
  for _, t in ipairs(tags) do
    local name = tostring(t)
    if name ~= "page" and name ~= "meta" and not name:match("^meta/") then
      set[name] = true
    end
  end
  return set
end

local function mergeTags(into, tags)
  for t in pairs(graph.userTags(tags)) do
    into[t] = true
  end
end

local function sharesAny(a, b)
  for t in pairs(a) do
    if b[t] then return true end
  end
  return false
end

local function pageByName(pages)
  local m = {}
  for _, p in ipairs(pages or {}) do
    m[p.name] = p
  end
  return m
end

local function pairKey(a, b, kind)
  if a > b then a, b = b, a end
  return a .. "\0" .. b .. "\0" .. kind
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
  for _, p in ipairs(pages or {}) do
    if graph.userTags(p.tags)[anchor] then
      tagHits[#tagHits + 1] = p.name
    end
  end
  if #tagHits > 0 then
    table.sort(tagHits)
    return { ok = true, mode = "tag", pages = tagHits, tag = anchor }
  end
  local needle = anchor:lower()
  local subs = {}
  for _, p in ipairs(pages or {}) do
    if p.name:lower():find(needle, 1, true) then
      subs[#subs + 1] = p.name
    end
  end
  if #subs == 1 then
    return { ok = true, mode = "page", page = subs[1], pages = { subs[1] } }
  elseif #subs == 0 then
    return { ok = false, error = "not_found" }
  end
  table.sort(subs)
  return { ok = false, error = "ambiguous", candidates = subs }
end

-- Digest = fixed point of tag-affinity admission from the resolved anchor(s).
-- A neighbor joins when it shares a user tag with the affinity set or when the
-- connecting edge is a user predicate; admitted tags widen the affinity set.
-- No hop or page quotas: closure ends when nothing new is admissible.
function graph.digest(anchor, pages, edges, opts)
  local resolved = graph.resolveAnchor(anchor, pages)
  if not resolved.ok then
    return { ok = false, error = resolved.error, candidates = resolved.candidates }
  end
  local byName = pageByName(pages)
  local seeds = resolved.pages
  local affinity = {}
  for _, name in ipairs(seeds) do
    local p = byName[name]
    if p then mergeTags(affinity, p.tags) end
  end

  local filtered = graph.collapseCoMentions(graph.filterEdges(edges, opts))
  local adj = buildUndirectedAdj(filtered)
  local included = {}
  local queue = {}
  for _, name in ipairs(seeds) do
    included[name] = true
    queue[#queue + 1] = name
  end

  local head = 1
  -- Fixed point: a node rejected now may become admissible once another
  -- admission widens the affinity set, so keep rescanning until stable.
  local changed = true
  while changed do
    changed = false
    while head <= #queue do
      local cur = queue[head]
      head = head + 1
      for _, nb in ipairs(adj[cur] or {}) do
        if not included[nb.ref] then
          local target = byName[nb.ref]
          local ttags = graph.userTags(target and target.tags)
          if sharesAny(ttags, affinity) or graph.isUserPredicate(nb.kind) then
            included[nb.ref] = true
            queue[#queue + 1] = nb.ref
            for t in pairs(ttags) do affinity[t] = true end
            changed = true
          end
        end
      end
    end
    head = 1
  end

  -- Evidence = induced subgraph edges, deduped by endpoints+kind.
  local usedEdges = {}
  local seen = {}
  for _, e in ipairs(filtered) do
    if e.from ~= e.to and included[e.from] and included[e.to] then
      local key = pairKey(e.from, e.to, e.kind)
      if not seen[key] then
        seen[key] = true
        usedEdges[#usedEdges + 1] = {
          from = e.from,
          to = e.to,
          kind = e.kind,
          snippet = e.snippet,
          page = e.page,
        }
      end
    end
  end
  table.sort(usedEdges, function(a, b)
    if a.from == b.from then
      if a.to == b.to then return a.kind < b.kind end
      return a.to < b.to
    end
    return a.from < b.from
  end)

  local nodes = {}
  for name in pairs(included) do
    local p = byName[name]
    local tags = {}
    for t in pairs(graph.userTags(p and p.tags)) do tags[#tags + 1] = t end
    table.sort(tags)
    nodes[#nodes + 1] = { ref = name, tags = tags, dangling = p == nil }
  end
  table.sort(nodes, function(a, b) return a.ref < b.ref end)

  local affinityTags = {}
  for t in pairs(affinity) do affinityTags[#affinityTags + 1] = t end
  table.sort(affinityTags)

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
    affinityTags = affinityTags,
  }
end
```

```space-lua
-- priority: 20
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
