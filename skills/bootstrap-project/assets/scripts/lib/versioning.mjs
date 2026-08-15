// Shared by scripts/bump-version.mjs (applies versioning.targets) and scripts/validate.mjs
// (validates the versioning.targets shape) so the two can never silently accept a shape one
// of them would reject or mis-handle.
export const SEMVER_RE = /^([0-9]+)\.([0-9]+)\.([0-9]+)(-[0-9A-Za-z.-]+)?$/;
export const VERSIONING_SCHEMES = ['semver'];
export const VERSIONING_BUMPS = ['manual', 'conventional-commits', 'epic-driven'];

// Reports every shape problem found (via `report(message)`) rather than stopping at the
// first one, so validate.mjs can collect a full error list; bump-version.mjs's `report`
// simply exits on the first call, so only the first message is ever seen there.
export function checkTargetShape(t, at, report) {
  if (!t || typeof t !== 'object' || Array.isArray(t)) { report(at + ' must be an object'); return false; }
  let ok = true;
  if (!t.path || typeof t.path !== 'string' || !t.path.trim()) { report(at + '.path is required and must be a non-empty string'); ok = false; }
  else if (t.path.split(/[\\/]/).includes('..')) { report(at + ".path '" + t.path + "' must not resolve outside the repo (no '..' segments)"); ok = false; }
  if (t.kind !== 'json' && t.kind !== 'text') { report(at + ".kind must be 'json' or 'text' (got " + JSON.stringify(t.kind) + ')'); ok = false; }
  if (t.kind === 'json' && (!t.jsonPath || typeof t.jsonPath !== 'string' || !t.jsonPath.trim())) { report(at + '.jsonPath is required when kind is json'); ok = false; }
  if (t.kind === 'text' && (!t.pattern || typeof t.pattern !== 'string' || !t.pattern.trim())) { report(at + '.pattern is required when kind is text'); ok = false; }
  return ok;
}

export function parseSemver(v) {
  const m = SEMVER_RE.exec(v);
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), prerelease: m[4] ? m[4].slice(1) : null };
}

// Semver precedence for the prerelease field: no prerelease outranks any prerelease of the
// same major.minor.patch; otherwise compare dot-separated identifiers left to right (numeric
// identifiers compare numerically and always rank below alphanumeric ones, per semver.org).
function comparePrerelease(a, b) {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const as = a.split('.'), bs = b.split('.');
  const len = Math.max(as.length, bs.length);
  for (let i = 0; i < len; i++) {
    const ai = as[i], bi = bs[i];
    if (ai === undefined) return -1;
    if (bi === undefined) return 1;
    const an = /^[0-9]+$/.test(ai), bn = /^[0-9]+$/.test(bi);
    if (an && bn) {
      const diff = Number(ai) - Number(bi);
      if (diff !== 0) return diff;
    } else if (an !== bn) {
      return an ? -1 : 1;
    } else if (ai !== bi) {
      return ai < bi ? -1 : 1;
    }
  }
  return 0;
}

export function compareVersions(a, b) {
  const pa = parseSemver(a), pb = parseSemver(b);
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  if (pa.patch !== pb.patch) return pa.patch - pb.patch;
  return comparePrerelease(pa.prerelease, pb.prerelease);
}
