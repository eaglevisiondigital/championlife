/** Server-only binding candidate, not an installed RPC or a database adapter.
 * repository.withCurrentSnapshot must serialize ALL dependencies (including session
 * and association replacement/revocation) through completion of the synchronous
 * callback. No client may construct this repository or its snapshots.
 */
import {READ_CAPABILITY} from './relationship-reader.mjs';
const keys = ['organizationId', 'campaignId', 'intakeId'];
const uuid = x => typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(x);
const revision = x => Number.isSafeInteger(x) && x > 0;
const time = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(x) ? Date.parse(x) : NaN;
const active = (x, now) => x?.active === true && x.revoked === false && time(x.effectiveAt) <= now && now < time(x.expiresAt);
const same = (a, b, fields) => fields.every(k => a?.[k] === b?.[k]);
const identity = ['userId', 'sessionId', 'epoch'];
const principal = (p, now) => uuid(p?.userId) && uuid(p.sessionId) && Number.isSafeInteger(p.epoch) && p.epoch >= 0 && p.verified === true && active(p, now);
const deny = () => Object.freeze({status: 'unavailable'});
function requireValue(condition) { if (!condition) throw new Error('Unavailable'); }

function projection(s, request, caller, now) {
  const {session, assignment: a, association: e, campaign, person, relationship: r, intake: i, household: h, membership: m} = s;
  requireValue(revision(s.authorityRevision) && principal(session, now) && same(session, caller, identity));
  requireValue(campaign?.id === request.campaignId && campaign.organizationId === request.organizationId && active(campaign, now));
  requireValue(active(a, now) && revision(a.revision) && uuid(a.id) && a.capability === READ_CAPABILITY &&
    same(a, request, keys) && a.userId === caller.userId && a.sessionId === caller.sessionId && a.sessionEpoch === caller.epoch);
  // Association is a separate, centrally reviewed binding; intake/category is never evidence.
  requireValue(active(e, now) && uuid(e.id) && revision(e.revision) && same(e, request, keys) &&
    e.status === 'verified' && e.current === true && e.conflicted === false &&
    uuid(e.identityEvidenceId) && uuid(e.reviewAuditId) && uuid(e.verifiedBy) &&
    e.method === 'reviewed-canonical-binding' && time(e.verifiedAt) <= now &&
    a.associationId === e.id && a.associationRevision === e.revision &&
    uuid(e.personId) && uuid(e.relationshipId) && (e.householdId === null || uuid(e.householdId)) &&
    a.personId === e.personId && a.relationshipId === e.relationshipId && a.householdId === e.householdId);
  requireValue(person?.id === e.personId && person.organizationId === request.organizationId && uuid(person.humanId) &&
    person.humanId === e.humanId && person.active === true);
  requireValue(r?.id === e.relationshipId && r.personId === person.id && r.organizationId === request.organizationId && active(r, now));
  requireValue(i?.id === request.intakeId && i.organizationId === request.organizationId && i.personId === person.id &&
    i.status === 'linked' && revision(i.revision) && Number.isFinite(time(i.submittedAt)) && time(i.submittedAt) <= now &&
    ['sowgo', 'champion_life'].includes(i.sourceSite));
  if (e.householdId !== null) {
    requireValue(h?.id === e.householdId && h.organizationId === request.organizationId && h.status === 'active' &&
      m?.organizationId === request.organizationId && m.householdId === h.id && m.personId === person.id && m.active === true);
  } else requireValue(h === null && m === null);
  // No global human ID, evidence/audit IDs, names, contacts, raw intake, finance,
  // household members, pastoral notes, lessons or guardian inference are returned.
  return Object.freeze({...request, personId: person.id, relationshipId: r.id, householdId: e.householdId,
    status: i.status, revision: i.revision, submittedAt: i.submittedAt, sourceSite: i.sourceSite});
}

export function createSerializedPartnerReader({getPrincipal, repository, now = Date.now}) {
  if (typeof getPrincipal !== 'function' || typeof repository?.withCurrentSnapshot !== 'function' || typeof now !== 'function') throw new TypeError('Trusted server bindings required');
  let generation = 0;
  return Object.freeze({
    invalidate() { generation += 1; },
    async read(selection, {signal} = {}) {
      const epoch = ++generation;
      let record, validUntil, used = false;
      try {
        // Exact input contract rejects identity, grant, tag and client evidence injection.
        requireValue(selection && Object.keys(selection).length === keys.length && keys.every(k => uuid(selection[k])));
        const request = Object.freeze(Object.fromEntries(keys.map(k => [k, selection[k]])));
        const caller = structuredClone(getPrincipal());
        const current = () => epoch === generation && !signal?.aborted && principal(getPrincipal(), now()) && same(caller, getPrincipal(), identity);
        requireValue(principal(caller, now()) && current());
        // Repository result is intentionally ignored: only this callback can produce output.
        await repository.withCurrentSnapshot(Object.freeze({...request, userId: caller.userId, sessionId: caller.sessionId, sessionEpoch: caller.epoch}), raw => {
          requireValue(!used && current());
          used = true;
          const snapshot = structuredClone(raw);
          record = projection(snapshot, request, caller, now());
          validUntil = Math.min(...[caller, snapshot.session, snapshot.campaign, snapshot.assignment, snapshot.association, snapshot.relationship].map(x => time(x.expiresAt)));
          requireValue(current() && now() < validUntil);
        }, {signal});
        requireValue(used && record && current() && now() < validUntil);
        return Object.freeze({status: 'ready', record});
      } catch { return deny(); }
    }
  });
}
