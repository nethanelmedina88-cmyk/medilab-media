window.SL = window.SL || {};

SL.TIER = { FREE: 'free', REGISTERED: 'registered', PAID: 'paid' };
SL.FREE_TOPIC = 'מאפייני חיים';

// An entitlement record grants paid access. `until` (optional) may be a ms number,
// a Firestore Timestamp (has toMillis), or a parseable date string. No `until` = no expiry.
// A present-but-unparseable `until` fails CLOSED (treated as not valid).
SL.entitlementValid = function (ent, nowMs) {
  if (!ent) return false;
  if (ent.until == null) return true;
  var until;
  if (typeof ent.until === 'number') until = ent.until;
  else if (typeof ent.until.toMillis === 'function') until = ent.until.toMillis();
  else until = Date.parse(ent.until);
  if (!isFinite(until)) return false; // corrupt expiry -> not valid
  return nowMs <= until;
};

SL.tierOf = function (user, ent, nowMs) {
  if (!user) return SL.TIER.FREE;
  if (SL.entitlementValid(ent, nowMs)) return SL.TIER.PAID;
  return SL.TIER.REGISTERED;
};

SL.tierRank = function (tier) {
  return tier === SL.TIER.PAID ? 2 : tier === SL.TIER.REGISTERED ? 1 : 0;
};

// Minimum tier rank required per capability. Anything not listed is open (rank 0).
SL.FEATURE_MIN = {
  'glossary': 0,
  'practice-free': 0,
  'practice-all': 1,
  'audio': 1,
  'stats': 1,
  'sync': 1,
  'achievements': 1,
  'crossword': 2,
  'exam': 2,
  'weakspots': 2
};

SL.canAccess = function (feature, tier) {
  var need = SL.FEATURE_MIN[feature];
  if (need == null) return true;
  return SL.tierRank(tier) >= need;
};
