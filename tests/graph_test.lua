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
