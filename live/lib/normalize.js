window.SL = window.SL || {};
// Comparison key: drop nikud (U+0591-U+05C7), quotes/gershayim, dashes, parens; collapse spaces; lowercase.
SL.normalize = function (s) {
  return (s || '')
    .toLowerCase()
    .replace(/[֑-ׇ"'׳״\-–—()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};
