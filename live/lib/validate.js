window.SL = window.SL || {};
// subject is a WARNING in Plan 1, promoted to ERROR after Plan 2 tagging.
SL.validateGlossary = function (glossary, maps) {
  var errors = [], warnings = [], seen = {};
  glossary.forEach(function (e, i) {
    var id = e.hebrew || ('#' + i);
    ['hebrew', 'english', 'definition', 'letter'].forEach(function (f) {
      if (!e[f]) errors.push('missing ' + f + ' on ' + id);
    });
    if (e.aliasOf && !maps.byHeb[e.aliasOf]) errors.push('orphan aliasOf on ' + id + ' -> ' + e.aliasOf);
    if (/[�]/.test((e.hebrew || '') + (e.english || '') + (e.definition || ''))) errors.push('replacement char in ' + id);
    var key = SL.normalize(e.hebrew) + '|' + SL.normalize(e.definition);
    if (seen[key] && !e.aliasOf) errors.push('true duplicate (term+def) ' + id);
    seen[key] = 1;
    if (!e.subject) errors.push('no subject on ' + id);
  });
  return { errors: errors, warnings: warnings };
};
