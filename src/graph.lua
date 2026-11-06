local graph = {}

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

return graph
