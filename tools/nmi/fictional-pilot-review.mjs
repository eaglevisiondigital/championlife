// Offline composition only. Never register as a payment endpoint, executor or ledger writer.
import { prepareDisabledRoute } from './disabled-routing.mjs';
import { reviewFictionalLookup } from './fictional-lookup-review.mjs';

const ref = v => typeof v === 'string' && /^[A-Za-z][A-Za-z0-9_-]{2,79}$/.test(v);
const time = v => typeof v === 'string' && v.length === 20 && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v.replace('Z', '.000Z');
const exact = (v, keys) => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const bindingKeys = ['fictional','pilotRef','bindingRevision','route','fundRef','organization','purpose','midSlot','gatewayAlias','legalMerchantAlias','settlementOwnerAlias','receiptOwnerAlias','evidenceRef','verifiedBy','independentReviewer','validFrom','expiresAt','revoked'];
const authorityKeys = ['fictional','principalRef','verified','permission','organization','pilotRef','bindingRevision','validFrom','expiresAt','revoked'];
const intentKeys = ['fictional','pilotRef','bindingRevision','idempotencyRef','orderRef','route','fundRef','organization','midSlot','gatewayAlias','amountMinor','currency','kind'];
const journalKeys = ['fictional','pilotRef','bindingRevision','idempotencyRef','orderRef','attemptRef','organization','midSlot','gatewayAlias','amountMinor','currency','uncertainAt'];
const current = (v, now) => time(v.validFrom) && time(v.expiresAt) && v.validFrom <= now && now < v.expiresAt && v.revoked === false;
const output = (classification, reason) => Object.freeze({mode:'disabled',canSubmit:false,canRetry:false,canPostLedger:false,providerVerified:false,classification,reason});

/** All inputs are fictional assertions, not trusted authority. No side effects or durable state. */
export function reviewFictionalPilot(document, receipt, binding, authority, intent, journal, observations, now) {
  const hold = reason => output('HOLD', reason);
  if (!time(now)) return hold('INVALID_REVIEW_TIME');
  if (!Array.isArray(document?.checkout_routes) || document.checkout_routes.some(r => r?.enabled !== false)) return hold('ALL_CHECKOUT_MUST_REMAIN_DISABLED');
  if (!exact(binding,bindingKeys) || binding.fictional !== true || !Number.isSafeInteger(binding.bindingRevision) || binding.bindingRevision < 1 ||
      !['Champion Life','SowGo'].includes(binding.organization) ||
      ['pilotRef','fundRef','gatewayAlias','legalMerchantAlias','settlementOwnerAlias','receiptOwnerAlias','evidenceRef','verifiedBy','independentReviewer'].some(k => !ref(binding[k])) ||
      binding.verifiedBy === binding.independentReviewer || !current(binding,now)) return hold('INVALID_OR_REVOKED_BINDING');
  const route = prepareDisabledRoute(document,binding.route,receipt,now);
  if (!route.readyForReview) return hold(route.reason);
  for (const key of ['route','organization','purpose','midSlot','evidenceRef']) if (route[key] !== binding[key]) return hold('MERCHANT_BINDING_MISMATCH');
  if (route.gatewayGroupAlias !== binding.gatewayAlias || receipt.verifiedAt !== binding.validFrom || receipt.expiresAt !== binding.expiresAt ||
      ['legalMerchantAlias','settlementOwnerAlias','receiptOwnerAlias','verifiedBy','independentReviewer'].some(k => receipt[k] !== binding[k])) return hold('MERCHANT_BINDING_MISMATCH');
  if (!exact(authority,authorityKeys) || authority.fictional !== true || authority.verified !== true || !ref(authority.principalRef) ||
      authority.permission !== 'finance.pilot.review' || authority.organization !== binding.organization || authority.pilotRef !== binding.pilotRef ||
      authority.bindingRevision !== binding.bindingRevision || !current(authority,now)) return hold('FINANCE_REVIEW_NOT_AUTHORIZED');
  if (!exact(intent,intentKeys) || intent.fictional !== true || intent.kind !== 'one-time' || !ref(intent.idempotencyRef) || !ref(intent.orderRef) ||
      !Number.isSafeInteger(intent.amountMinor) || intent.amountMinor <= 0 || intent.currency !== 'USD' ||
      ['pilotRef','bindingRevision','route','fundRef','organization','midSlot','gatewayAlias'].some(k => intent[k] !== binding[k])) return hold('INTENT_BINDING_MISMATCH');
  if (!Array.isArray(journal) || journal.length > 100 || !Array.isArray(observations)) return hold('INVALID_JOURNAL');
  const attempts = new Map();
  for (const entry of journal) {
    if (!exact(entry,journalKeys) || entry.fictional !== true || !ref(entry.attemptRef) || !time(entry.uncertainAt) || entry.uncertainAt > now ||
        ['pilotRef','bindingRevision','idempotencyRef','orderRef','organization','midSlot','gatewayAlias','amountMinor','currency'].some(k => entry[k] !== intent[k])) return hold('JOURNAL_BINDING_MISMATCH');
    const fingerprint = JSON.stringify(journalKeys.map(k => entry[k]));
    if (attempts.has(entry.attemptRef) && attempts.get(entry.attemptRef).fingerprint !== fingerprint) return hold('CONFLICTING_REPLAY');
    attempts.set(entry.attemptRef,{fingerprint,entry});
  }
  if (attempts.size > 1) return hold('MULTIPLE_ATTEMPTS_REQUIRE_REVIEW');
  if (!attempts.size) return observations.length ? hold('ORPHAN_LOOKUP') : output('FICTIONAL_PLAN_REVIEWABLE','NO_EXECUTION_AUTHORITY');
  const { entry } = attempts.values().next().value;
  // Project only the accepted lookup contract, never raw provider/customer fields.
  const attempt = Object.fromEntries(['attemptRef','orderRef','organization','midSlot','gatewayAlias','amountMinor','currency','bindingRevision','fictional','uncertainAt'].map(k => [k,entry[k]]));
  const lookup = reviewFictionalLookup(attempt,observations,now);
  return output(lookup.classification,lookup.classification === 'UNKNOWN' ? lookup.reason : 'PRIOR_ATTEMPT_REQUIRES_MANUAL_REVIEW');
}
