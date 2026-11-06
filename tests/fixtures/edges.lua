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
