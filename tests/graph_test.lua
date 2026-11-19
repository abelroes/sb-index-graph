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

local p = graph.path("Alpha", "Gamma", fix.edges)
assert_true(p.ok, "path Alpha->Gamma")
assert_eq(#p.hops, 2)
assert_eq(p.hops[1].to, "Beta")
assert_eq(p.hops[2].to, "Gamma")

local missing = graph.path("Alpha", "NoSuch", fix.edges)
assert_true(not missing.ok)
assert_eq(missing.error, "not_found")

print("OK path")

-- userTags drops structural tags
local ut = graph.userTags({ "page", "meta", "meta/label", "project" })
assert_true(ut["project"])
assert_true(ut["page"] == nil)
assert_true(ut["meta"] == nil)
assert_true(ut["meta/label"] == nil)
assert_eq(next(graph.userTags(nil)), nil)

-- resolveAnchor
local r = graph.resolveAnchor("Alpha", fix.pages)
assert_true(r.ok)
assert_eq(r.mode, "page")
assert_eq(r.page, "Alpha")

local byTag = graph.resolveAnchor("project", fix.pages)
assert_true(byTag.ok)
assert_eq(byTag.mode, "tag")
assert_eq(#byTag.pages, 2)
assert_eq(byTag.tag, "project")
assert_eq(byTag.pages[1], "Alpha")
assert_eq(byTag.pages[2], "Beta")

local bySubstring = graph.resolveAnchor("Bet", fix.pages)
assert_true(bySubstring.ok)
assert_eq(bySubstring.mode, "page")
assert_eq(bySubstring.page, "Beta")

-- "Al" matches Alpha and Alpine (deterministic fixture collision)
local amb = graph.resolveAnchor("Al", fix.pages)
assert_true(not amb.ok)
assert_eq(amb.error, "ambiguous")
assert_eq(#amb.candidates, 2)
assert_eq(amb.candidates[1], "Alpha")
assert_eq(amb.candidates[2], "Alpine")

local dAmb = graph.digest("Al", fix.pages, fix.edges)
assert_true(not dAmb.ok)
assert_eq(dAmb.error, "ambiguous")
assert_eq(#dAmb.candidates, 2)
assert_eq(dAmb.candidates[1], "Alpha")
assert_eq(dAmb.candidates[2], "Alpine")

local missingAnchor = graph.resolveAnchor("NoPage", fix.pages)
assert_true(not missingAnchor.ok)
assert_eq(missingAnchor.error, "not_found")

local badAnchor = graph.resolveAnchor("", fix.pages)
assert_true(not badAnchor.ok)
assert_eq(badAnchor.error, "invalid_anchor")

-- digest from a page anchor
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
assert_eq(d.seed.mode, "page")
assert_eq(d.seed.page, "Alpha")
assert_eq(#d.nodes, 3)
assert_eq(#d.affinityTags, 1)
assert_eq(d.affinityTags[1], "project")

-- digest from a tag anchor seeds every page carrying it
local dTag = graph.digest("project", fix.pages, fix.edges)
assert_true(dTag.ok)
assert_eq(dTag.seed.mode, "tag")
assert_eq(#dTag.seed.pages, 2)

local dMissing = graph.digest("NoPage", fix.pages, fix.edges)
assert_true(not dMissing.ok)
assert_eq(dMissing.error, "not_found")

-- fixed point: Late is only admissible once Bridge widened the affinity set
local fixPoint = {
  pages = {
    { name = "Root", tags = { "page", "x" } },
    { name = "Late", tags = { "page", "y" } },
    { name = "Bridge", tags = { "page", "y" } },
  },
  edges = {
    { from = "Root", to = "Late", kind = "mention", toTag = "page", page = "Root" },
    { from = "Root", to = "Bridge", kind = "dependsOn", toTag = "page", page = "Root" },
  },
}
local dFixed = graph.digest("Root", fixPoint.pages, fixPoint.edges)
assert_true(dFixed.ok)
local fixedSet = {}
for _, n in ipairs(dFixed.nodes) do fixedSet[n.ref] = true end
assert_true(fixedSet["Bridge"], "Bridge admitted by user predicate")
assert_true(fixedSet["Late"], "Late admitted after affinity grew to y")
assert_eq(#dFixed.affinityTags, 2)

-- Opposite directed user-predicate edges must both survive digest evidence
local bothWays = {
  pages = {
    { name = "A", tags = { "page", "t" } },
    { name = "B", tags = { "page", "t" } },
  },
  edges = {
    { from = "A", to = "B", kind = "dependsOn", toTag = "page", page = "A", snippet = "A→B" },
    { from = "B", to = "A", kind = "dependsOn", toTag = "page", page = "B", snippet = "B→A" },
  },
}
local dBoth = graph.digest("A", bothWays.pages, bothWays.edges)
assert_true(dBoth.ok)
assert_eq(#dBoth.edges, 2, "both directed dependsOn edges kept")
local dirs = {}
for _, e in ipairs(dBoth.edges) do
  dirs[e.from .. "->" .. e.to] = e.kind
end
assert_eq(dirs["A->B"], "dependsOn")
assert_eq(dirs["B->A"], "dependsOn")

-- `related` is structural hierarchy, not a user predicate
assert_true(graph.isReservedKind("related"))
assert_true(not graph.isUserPredicate("related"))

-- Hub hierarchy: related chain joins (family closure) but never widens
-- affinity nor expands non-related edges; related stays visible as evidence.
local hub = {
  pages = {
    { name = "Hub", tags = { "page", "guide" } },
    { name = "Child1", tags = { "page", "secret" } },
    { name = "Child2", tags = { "page", "secret" } },
    { name = "Outsider", tags = { "page", "guide" } }, -- shares hub tag but only attached to a hierarchy node
    { name = "Deep", tags = { "page" } },
  },
  edges = {
    { from = "Hub", to = "Child1", kind = "related", toTag = "page", page = "Hub", snippet = "related: [[Child1]]" },
    { from = "Child1", to = "Child2", kind = "related", toTag = "page", page = "Child1", snippet = "related: [[Child2]]" },
    { from = "Child1", to = "Outsider", kind = "mention", toTag = "page", page = "Child1", snippet = "[[Outsider]]" },
    { from = "Child2", to = "Deep", kind = "dependsOn", toTag = "page", page = "Child2", snippet = "dependsOn: [[Deep]]" },
  },
}
local dh = graph.digest("Hub", hub.pages, hub.edges)
assert_true(dh.ok)
local hubRoles = {}
for _, n in ipairs(dh.nodes) do hubRoles[n.ref] = n.role end
assert_eq(hubRoles["Hub"], "seed")
assert_eq(hubRoles["Child1"], "hierarchy", "related child joins as hierarchy")
assert_eq(hubRoles["Child2"], "hierarchy", "related chain propagates (full family)")
assert_true(hubRoles["Outsider"] == nil, "hierarchy nodes never expand non-related edges")
assert_true(hubRoles["Deep"] == nil, "user predicates from hierarchy nodes do not admit")
local relSeen = false
for _, e in ipairs(dh.edges) do
  if e.kind == "related" then relSeen = true end
end
assert_true(relSeen, "related edges kept as evidence")
assert_eq(#dh.affinityTags, 1, "hierarchy tags never widen affinity")
assert_eq(dh.affinityTags[1], "guide")

-- Discrimination regression: different anchors must yield different closures
local function nodeSet(d)
  local out = {}
  for _, n in ipairs(d.nodes) do out[n.ref] = true end
  return out
end
local dg = graph.digest("guide", hub.pages, hub.edges)
local ds = graph.digest("secret", hub.pages, hub.edges)
local gSet, sSet = nodeSet(dg), nodeSet(ds)
assert_true(gSet["Outsider"] and gSet["Hub"], "guide closure: hub + outsider seeds")
assert_true(gSet["Deep"] == nil, "guide closure excludes Deep")
assert_true(sSet["Deep"], "secret closure reaches Deep via seed child predicate")
assert_true(sSet["Outsider"] == nil, "secret closure excludes Outsider")

-- Promotion: a hierarchy node reached by an affinity node (shared tag)
-- becomes affinity and may then expand user predicates normally.
local promo = {
  pages = {
    { name = "S", tags = { "page", "a" } },
    { name = "A", tags = { "page", "a", "b" } },
    { name = "C", tags = { "page", "b" } },
    { name = "E", tags = { "page", "z" } },
  },
  edges = {
    { from = "S", to = "C", kind = "related", toTag = "page", page = "S", snippet = "related: [[C]]" },
    { from = "S", to = "A", kind = "mention", toTag = "page", page = "S", snippet = "[[A]]" },
    { from = "A", to = "C", kind = "mention", toTag = "page", page = "A", snippet = "[[C]]" },
    { from = "C", to = "E", kind = "dependsOn", toTag = "page", page = "C", snippet = "dependsOn: [[E]]" },
  },
}
local dp = graph.digest("S", promo.pages, promo.edges)
assert_true(dp.ok)
local promoRoles = {}
for _, n in ipairs(dp.nodes) do promoRoles[n.ref] = n.role end
assert_eq(promoRoles["A"], "affinity")
assert_eq(promoRoles["C"], "affinity", "hierarchy node promoted via shared tag")
assert_true(promoRoles["E"] ~= nil, "promoted node expands user predicates")

print("OK digest")
