window.SL = window.SL || {};
SL.buildAliasMaps = function (glossary) {
  var byHeb = {}, aliasOf = {}, synonyms = {};
  glossary.forEach(function (e) {
    byHeb[e.hebrew] = e;
    if (e.aliasOf) aliasOf[e.hebrew] = e.aliasOf;
    synonyms[e.hebrew] = (e.synonyms || []).slice();
  });
  return { byHeb: byHeb, aliasOf: aliasOf, synonyms: synonyms };
};
SL.isAlias = function (hebrew, maps) { return !!maps.aliasOf[hebrew]; };
SL.resolveEntry = function (hebrew, maps) {
  var canon = maps.aliasOf[hebrew] || hebrew;
  return maps.byHeb[canon] || maps.byHeb[hebrew] || null;
};
// Returns the full equivalence group (canonical + its synonyms + aliases pointing to it),
// minus the queried term itself. Symmetric for any member, including alias stubs.
SL.synonymsOf = function (hebrew, maps) {
  var canon = maps.aliasOf[hebrew] || hebrew;
  var set = {}, out = [];
  function add(h) { if (h && h !== hebrew && !set[h]) { set[h] = 1; out.push(h); } }
  add(canon);
  (maps.synonyms[canon] || []).forEach(add);
  Object.keys(maps.aliasOf).forEach(function (a) { if (maps.aliasOf[a] === canon) add(a); });
  return out;
};
