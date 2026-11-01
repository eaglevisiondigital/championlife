/** Nonpublic Partner P2 candidate. No transport, RPC, storage, identity creation or writes.
 * Ports are trusted server/test dependencies, never client-submitted authorization.
 * Proposed capability below is NOT an installed permission or existing RPC.
 */
export const READ_CAPABILITY = 'proposed.partner.assigned-relationship.read';
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const instant = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value));
const active = (value, now) => value?.active === true && value.revoked === false && instant(value.effectiveAt) && instant(value.expiresAt) && Date.parse(value.effectiveAt) <= now && now < Date.parse(value.expiresAt);
const principalValid = (p, now) => uuid(p?.userId) && uuid(p.sessionId) && Number.isSafeInteger(p.epoch) && p.epoch >= 0 && p.verified === true && active(p, now);
const scopeValid = s => ['organizationId', 'campaignId', 'intakeId'].every(key => uuid(s?.[key]));
const samePrincipal = (a, b) => ['userId', 'sessionId', 'epoch'].every(key => a?.[key] === b?.[key]);
const sameScope = (a, b) => ['organizationId', 'campaignId', 'intakeId'].every(key => a?.[key] === b?.[key]);
const scopeKeys = ['organizationId', 'campaignId', 'intakeId'];
const bindingKeys = ['assignmentId', 'assignmentRevision', 'personId', 'relationshipId', 'identityEvidenceId', 'householdId'];
const detached = value => structuredClone(value);
function allowed(a, p, scope, now) {
  return a?.allowed === true && a.capability === READ_CAPABILITY && a.userId === p.userId && a.sessionId === p.sessionId &&
    sameScope(a, scope) && active(a, now) && uuid(a.assignmentId) && Number.isSafeInteger(a.assignmentRevision) && a.assignmentRevision > 0 &&
    a.identityStatus === 'verified' && uuid(a.identityEvidenceId) && uuid(a.personId) && uuid(a.relationshipId) &&
    (a.householdId === null || uuid(a.householdId));
}
function project(row, grant) {
  if (!sameScope(row, grant) || row.personId !== grant.personId || row.relationshipId !== grant.relationshipId ||
      row.householdId !== grant.householdId || row.status !== 'linked' || !Number.isSafeInteger(row.revision) || row.revision < 1 ||
      !instant(row.submittedAt) || !['champion_life', 'sowgo'].includes(row.sourceSite)) throw new Error('Unavailable');
  // Exact allowlist: no names, contacts, financial commitments, task titles/notes,
  // household members, pastoral data, private lessons, raw forms or arbitrary labels.
  return Object.freeze(Object.fromEntries([...scopeKeys, 'personId', 'relationshipId', 'householdId', 'status', 'revision', 'submittedAt', 'sourceSite'].map(k => [k, row[k]])));
}
export function createPartnerRelationshipReader({getPrincipal, authorize, readProjection, now = Date.now}) {
  if ([getPrincipal, authorize, readProjection, now].some(fn => typeof fn !== 'function')) throw new TypeError('Trusted ports required');
  let generation = 0, controller, state = Object.freeze({status: 'empty'}), owner, validUntil = 0;
  function invalidate() {
    generation += 1;
    controller?.abort();
    controller = undefined;
    owner = undefined;
    validUntil = 0;
    state = Object.freeze({status: 'unavailable'});
  }
  function current(g, p) {
    try { const time = now(), next = getPrincipal(); return g === generation && principalValid(next, time) && samePrincipal(p, next); }
    catch { return false; }
  }
  function getState() {
    if (owner && (!current(generation, owner) || now() >= validUntil)) invalidate();
    return state;
  }
  async function open(request) {
    invalidate();
    const g = generation;
    let p, scope;
    try {
      // Copy caller data before first await. A caller cannot mutate an in-flight scope.
      scope = Object.freeze(Object.fromEntries(scopeKeys.map(k => [k, request?.[k]])));
      p = detached(getPrincipal());
      if (!scopeValid(scope) || !principalValid(p, now())) return getState();
      controller = new AbortController();
      const signal = controller.signal;
      owner = p;
      validUntil = Date.parse(p.expiresAt);
      state = Object.freeze({status: 'loading'});
      const args = Object.freeze({...scope, userId: p.userId, sessionId: p.sessionId});
      const grant = detached(await authorize(args, {signal}));
      if (!current(g, p) || !allowed(grant, p, scope, now())) throw new Error('Unavailable');
      const row = detached(await readProjection(args, {signal}));
      if (!current(g, p)) throw new Error('Unavailable');
      // Fresh authoritative read after data retrieval; no cached permit may publish data.
      const finalGrant = detached(await authorize(args, {signal}));
      if (!current(g, p) || !allowed(finalGrant, p, scope, now()) ||
          !bindingKeys.every(k => grant[k] === finalGrant[k])) throw new Error('Unavailable');
      const record = project(row, finalGrant);
      validUntil = Math.min(Date.parse(finalGrant.expiresAt), Date.parse(p.expiresAt));
      state = Object.freeze({status: 'ready', record});
      return state;
    } catch {
      // Never return another selection's data from a stale completion.
      if (g === generation) invalidate();
      return Object.freeze({status: 'unavailable'});
    }
  }
  // Shell must call invalidate synchronously on sign-out, account/context changes,
  // explicit denial/revocation and pagehide. No DOM/UI is installed by this package.
  return Object.freeze({open, getState, invalidate});
}
