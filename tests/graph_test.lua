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

print("OK digest")
