---
name: Library/abelroes/sb-index-graph
tags: meta/library
description: Structured retrieval over the SilverBullet relation/tag index for AI agents (neighbors, path, digest).
files:
- sb-index-graph-skill.md
share.uri: "github:abelroes/sb-index-graph/PLUG.md"
---

# sb-index-graph

Second-brain retrieval for agents: query the **index graph** (relations + tags), not the Graph View UI.

Requires Runtime API (MCP `lua`). If the runtime or index is unavailable, calls fail explicitly.

## Install

1. Run **`Library: Install`** (or Libraries manager → Install).
2. URI: `github:abelroes/sb-index-graph/PLUG.md`
3. **System: Reload**.

## API

- `indexGraph.neighbors(page, opts?)`
- `indexGraph.path(from, to, opts?)`
- `indexGraph.digest(anchor, opts?)` — closed subgraph; budgets `maxNodes` (default 40), `maxTokens` (approximate), `snippetCap` (160); reports `truncated` + `dropped` when cut
- `indexGraph.manifest(page)` — section outline + per-section excerpt; cheaper than a full read on large pages

`opts.kinds` optional list of relation kinds to keep. URLs excluded by default. Hub `related:` families join the digest as hierarchy evidence but never widen tag affinity; hierarchy nodes are promoted to full affinity when an affinity node reaches them.

```space-lua
-- priority: 10
graph = graph or {}

local RESERVED = {
  mention = true,
  ["at-mention"] = true,
  authored = true,
  ["co-mention"] = true,
  -- `related` is hub frontmatter hierarchy: it admits the hub family as
  -- evidence but never widens tag affinity (see graph.digest).
  related = true,
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

-- Undirected kinds (co-mention) collapse endpoint order; directed kinds keep
-- both A→B and B→A when both exist for the same predicate.
local function evidenceKey(e)
  if e.undirected then
    local a, b = e.from, e.to
    if a > b then a, b = b, a end
    return a .. "\0" .. b .. "\0" .. e.kind
  end
  return e.from .. "\0" .. e.to .. "\0" .. e.kind
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

-- Codepoint-safe truncation (LuaJIT-safe: no utf8 lib; never splits UTF-8).
function graph.truncateUtf8(s, maxChars)
  if type(s) ~= "string" then return s end
  if not maxChars or maxChars <= 0 then return s end
  local n = #s
  local i, count = 1, 0
  while i <= n and count < maxChars do
    local b = s:byte(i)
    if b < 0x80 then i = i + 1
    elseif b < 0xE0 then i = i + 2
    elseif b < 0xF0 then i = i + 3
    else i = i + 4 end
    count = count + 1
  end
  if i > n then return s end
  return s:sub(1, i - 1) .. "…"
end

-- Digest = fixed point of affinity admission from the resolved anchor(s).
-- Affinity nodes contribute their user tags and widen the affinity set.
-- `related` edges (hub frontmatter hierarchy) admit the other endpoint as a
-- hierarchy node: it joins the closure (full hub family, chain included) and
-- appears as edge evidence, but contributes no tags and never expands
-- non-related edges. A hierarchy node is promoted to affinity once an
-- affinity node reaches it via a shared user tag or a user predicate.
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
  local included = {} -- name -> true
  local role = {} -- name -> "seed" | "affinity" | "hierarchy"
  local relDist = {} -- hierarchy nodes: depth of the related chain
  local affQueue = {} -- scanned for predicate/tag admission + promotion
  local relQueue = {} -- scanned for related-chain propagation
  for _, name in ipairs(seeds) do
    included[name] = true
    role[name] = "seed"
    affQueue[#affQueue + 1] = name
    relQueue[#relQueue + 1] = name
  end

  -- Fixed point: a node rejected now may become admissible once another
  -- admission widens the affinity set, so keep rescanning until stable.
  local changed = true
  while changed do
    changed = false
    local head = 1
    while head <= #affQueue do
      local cur = affQueue[head]
      head = head + 1
      for _, nb in ipairs(adj[cur] or {}) do
        if nb.kind ~= "related" then
          local target = byName[nb.ref]
          local ttags = graph.userTags(target and target.tags)
          local qualifies = graph.isUserPredicate(nb.kind) or sharesAny(ttags, affinity)
          if qualifies and not included[nb.ref] then
            included[nb.ref] = true
            role[nb.ref] = "affinity"
            for t in pairs(ttags) do affinity[t] = true end
            affQueue[#affQueue + 1] = nb.ref
            relQueue[#relQueue + 1] = nb.ref
            changed = true
          elseif qualifies and role[nb.ref] == "hierarchy" then
            role[nb.ref] = "affinity"
            for t in pairs(ttags) do affinity[t] = true end
            affQueue[#affQueue + 1] = nb.ref
            changed = true
          end
        end
      end
    end
    head = 1
    while head <= #relQueue do
      local cur = relQueue[head]
      head = head + 1
      for _, nb in ipairs(adj[cur] or {}) do
        if nb.kind == "related" and not included[nb.ref] then
          included[nb.ref] = true
          role[nb.ref] = "hierarchy"
          relDist[nb.ref] = (role[cur] == "hierarchy") and (relDist[cur] + 1) or 1
          relQueue[#relQueue + 1] = nb.ref
          changed = true
        end
      end
    end
  end

  -- Budget (strata-style slices): rank nodes, keep seeds always, then
  -- affinity (overlap with seed tags, degree), then hierarchy (related depth,
  -- degree). maxNodes default 40; maxTokens is an approximation (chars/4),
  -- never an exact count. Truncation is explicit: truncated + dropped.
  opts = opts or {}
  local maxNodes = opts.maxNodes
  if maxNodes == nil then maxNodes = 40 end
  local maxTokens = opts.maxTokens
  local snippetCap = opts.snippetCap
  if snippetCap == nil then snippetCap = 160 end

  local seedTags = {}
  for _, name in ipairs(seeds) do
    local p = byName[name]
    if p then mergeTags(seedTags, p.tags) end
  end
  local degree = {}
  for _, e in ipairs(filtered) do
    if e.from ~= e.to and included[e.from] and included[e.to] then
      degree[e.from] = (degree[e.from] or 0) + 1
      degree[e.to] = (degree[e.to] or 0) + 1
    end
  end
  local function tierOf(name)
    local r = role[name]
    if r == "seed" then return 0 end
    if r == "affinity" then return 1 end
    return 2
  end
  local function overlapWithSeeds(name)
    local n = 0
    for t in pairs(graph.userTags(byName[name] and byName[name].tags)) do
      if seedTags[t] then n = n + 1 end
    end
    return n
  end
  local ranked = {}
  for name in pairs(included) do ranked[#ranked + 1] = name end
  table.sort(ranked, function(a, b)
    local ta, tb = tierOf(a), tierOf(b)
    if ta ~= tb then return ta < tb end
    if ta == 1 then
      local oa, ob = overlapWithSeeds(a), overlapWithSeeds(b)
      if oa ~= ob then return oa > ob end
    elseif ta == 2 then
      local da, db = relDist[a] or 0, relDist[b] or 0
      if da ~= db then return da < db end
    end
    local ga, gb = degree[a] or 0, degree[b] or 0
    if ga ~= gb then return ga > gb end
    return a < b
  end)

  local kept = {}
  local keptCount = 0
  local dropped = {}
  for _, name in ipairs(ranked) do
    if tierOf(name) == 0 then
      kept[name] = true
      keptCount = keptCount + 1
    elseif keptCount >= maxNodes then
      dropped[#dropped + 1] = { ref = name, reason = "node_budget" }
    else
      kept[name] = true
      keptCount = keptCount + 1
    end
  end

  local function nodeChars(name)
    local p = byName[name]
    local c = #name + 8
    for t in pairs(graph.userTags(p and p.tags)) do c = c + #t + 2 end
    return c
  end
  local function approxTokens()
    local chars = 0
    for name in pairs(kept) do chars = chars + nodeChars(name) end
    local seenT = {}
    for _, e in ipairs(filtered) do
      if e.from ~= e.to and kept[e.from] and kept[e.to] then
        local key = evidenceKey(e)
        if not seenT[key] then
          seenT[key] = true
          chars = chars + #e.from + #e.to + #tostring(e.kind) + #tostring(e.snippet) + 12
        end
      end
    end
    return math.ceil(chars / 4)
  end
  if maxTokens then
    while approxTokens() > maxTokens do
      local victim = nil
      for i = #ranked, 1, -1 do
        local name = ranked[i]
        if kept[name] and tierOf(name) > 0 then victim = name break end
      end
      if not victim then break end
      kept[victim] = nil
      dropped[#dropped + 1] = { ref = victim, reason = "token_budget" }
    end
  end

  -- Evidence = induced subgraph edges over kept nodes; undirected kinds dedupe
  -- by unordered endpoints+kind, directed kinds by ordered from→to+kind.
  local usedEdges = {}
  local seen = {}
  for _, e in ipairs(filtered) do
    if e.from ~= e.to and kept[e.from] and kept[e.to] then
      local key = evidenceKey(e)
      if not seen[key] then
        seen[key] = true
        usedEdges[#usedEdges + 1] = {
          from = e.from,
          to = e.to,
          kind = e.kind,
          snippet = graph.truncateUtf8(e.snippet, snippetCap),
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
  for name in pairs(kept) do
    local p = byName[name]
    local tags = {}
    for t in pairs(graph.userTags(p and p.tags)) do tags[#tags + 1] = t end
    table.sort(tags)
    nodes[#nodes + 1] = { ref = name, tags = tags, role = role[name], dangling = p == nil }
  end
  table.sort(nodes, function(a, b) return a.ref < b.ref end)

  -- Admission set, not union of kept tags: hierarchy tags never widened it,
  -- so it stays the explanation of *why* the closure looks like this.
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
    truncated = #dropped > 0 or nil,
    dropped = #dropped > 0 and dropped or nil,
  }
end

local function stripInlineMd(s)
  s = s:gsub("%[%[([^%|%]]-)%|.-]]", "%1")
  s = s:gsub("%[%[([^%]]-)%]%]", "%1")
  s = s:gsub("%[([^%]]-)%]%([^)]*%)", "%1")
  s = s:gsub("^[%-%*+#>]%s+", "")
  s = s:gsub("`", "")
  return (s:gsub("^%s+", ""):gsub("%s+$", ""))
end

local function excerptFrom(line)
  local s = stripInlineMd(line)
  if s == "" then return nil end
  local cut = s:find("[.!?]%s") or s:find("[.!?]$")
  if cut then s = s:sub(1, cut) end
  local words, capped = {}, false
  for w in s:gmatch("%S+") do
    if #words >= 25 then capped = true break end
    words[#words + 1] = w
  end
  local joined = table.concat(words, " ")
  if joined == "" then return nil end
  if capped then joined = joined .. "…" end
  return joined
end

-- L1 manifest: deterministic outline of a page body — ATX headings (fences
-- respected), chars per section, first-sentence excerpt capped at 25 words.
-- No summarization: this is cheap extraction, not a persisted artifact.
function graph.manifest(page, text)
  if type(page) ~= "string" or page == "" then
    return { ok = false, error = "invalid_page" }
  end
  if type(text) ~= "string" then
    return { ok = false, error = "no_text", page = page }
  end
  local sections = {}
  local cur = nil
  local inFront = false
  local frontDone = false
  local inFence = false
  local fenceMark = nil
  local totalChars = 0
  local lineNo = 0
  for raw in (text .. "\n"):gmatch("([^\n]*)\n") do
    lineNo = lineNo + 1
    local line = raw:gsub("\r$", "")
    if not frontDone and lineNo == 1 and line == "---" then
      inFront = true
    elseif inFront and line == "---" and lineNo > 1 then
      inFront = false
      frontDone = true
    elseif not inFront then
      -- no (A|B) alternation: portable across PUC/LuaJIT and Space Lua
      local fm = line:match("^%s*```+") or line:match("^%s*~~~+")
      if fm and not inFence then
        inFence = true
        fenceMark = fm:sub(1, 3)
        if cur then cur.chars = cur.chars + #line + 1 end
        totalChars = totalChars + #line + 1
      elseif inFence then
        if line:match("^%s*" .. fenceMark) then inFence = false end
        if cur then cur.chars = cur.chars + #line + 1 end
        totalChars = totalChars + #line + 1
      else
        local hashes, title = line:match("^(#+)%s+(.-)%s*$")
        if hashes and #hashes <= 6 and title ~= "" then
          totalChars = totalChars + #line + 1
          cur = { level = #hashes, heading = stripInlineMd(title), chars = 0, excerpt = nil }
          sections[#sections + 1] = cur
        else
          totalChars = totalChars + #line + 1
          if cur then
            cur.chars = cur.chars + #line + 1
            if cur.excerpt == nil and line:match("%S") then
              cur.excerpt = excerptFrom(line)
            end
          end
        end
      end
    end
  end
  return { ok = true, page = page, totalChars = totalChars, sections = sections }
end

return graph
```

```space-lua
-- priority: 20
indexGraph = indexGraph or {}

local function loadRelations(opts)
  if not index.isAvailable() then
    return nil, "index_unavailable"
  end
  -- opts reserved for graph.filterEdges; load all then let graph filter
  local rows = query[[
    from r = index.relations()
    select {
      from = r.from,
      to = r.to,
      kind = r.kind,
      toTag = r.toTag,
      fromTag = r.fromTag,
      page = r.page,
      snippet = r.snippet,
      via = r.via,
    }
  ]]
  return rows
end

local function loadPages()
  local rows = query[[
    from p = index.pages()
    select { name = p.name, tags = p.tags, tag = p.tag }
  ]]
  local pages = {}
  for _, p in ipairs(rows or {}) do
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

function indexGraph.manifest(page)
  local pages = loadPages()
  local resolved = graph.resolveAnchor(page, pages)
  if not resolved.ok then
    return { ok = false, error = resolved.error, candidates = resolved.candidates }
  end
  if resolved.mode ~= "page" then
    return { ok = false, error = "ambiguous", candidates = resolved.pages }
  end
  local ok, text = pcall(function() return space.readPage(resolved.page) end)
  if not ok or type(text) ~= "string" then
    return { ok = false, error = "read_failed", page = resolved.page }
  end
  return graph.manifest(resolved.page, text)
end
```
