window.SL = window.SL || {};
// Precompute normalized fields ONCE (spec section 17), then rank: hebrew(0) < english(1) < definition(2).
SL.buildSearchIndex = function (glossary) {
  return glossary.map(function (e) {
    return { e: e, h: SL.normalize(e.hebrew), en: SL.normalize(e.english), d: SL.normalize(e.definition) };
  });
};
SL.search = function (index, query) {
  var q = SL.normalize(query);
  if (!q) return index.map(function (r) { return r.e; });
  var scored = [];
  for (var i = 0; i < index.length; i++) {
    var r = index[i], rank = -1;
    if (r.h.indexOf(q) !== -1) rank = 0;
    else if (r.en.indexOf(q) !== -1) rank = 1;
    else if (r.d.indexOf(q) !== -1) rank = 2;
    if (rank !== -1) scored.push({ e: r.e, rank: rank, i: i });
  }
  scored.sort(function (a, b) { return a.rank - b.rank || a.i - b.i; });
  return scored.map(function (s) { return s.e; });
};
