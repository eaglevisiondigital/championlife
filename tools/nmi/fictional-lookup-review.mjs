// Disconnected, fictional evidence reducer ONLY. No provider client, executor or ledger writer.
// This deliberately cannot authorize a retry, payment or accounting entry.
const identifier = value => typeof value === 'string' && value.length >= 3 && value.length <= 80 && !/[^A-Za-z0-9_-]/u.test(value);
const timestamp = value => typeof value === 'string' && value.length === 20 && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value.replace('Z', '.000Z');
const bindingKeys = ['attemptRef', 'orderRef', 'organization', 'midSlot', 'gatewayAlias', 'amountMinor', 'currency', 'bindingRevision'];
const exactKeys = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const attemptKeys = [...bindingKeys, 'fictional', 'uncertainAt'];
const observationKeys = [...bindingKeys, 'fictional', 'observationRef', 'source', 'authoritative', 'status', 'transactionRef', 'startedAt', 'completedAt', 'validUntil'];
const result = (classification, reason) => Object.freeze({
  mode: 'disabled', canSubmit: false, canRetry: false, canPostLedger: false,
  providerVerified: false, classification, reason
});

export function reviewFictionalLookup(attempt, observations, now) {
  const held = reason => result('UNKNOWN', reason);
  if (!timestamp(now)) return held('INVALID_REVIEW_TIME');
  if (!exactKeys(attempt, attemptKeys) || attempt.fictional !== true ||
      !identifier(attempt.attemptRef) || !identifier(attempt.orderRef) ||
      !['Champion Life', 'SowGo'].includes(attempt.organization) ||
      !['MID-01', 'MID-02', 'MID-03', 'MID-04'].includes(attempt.midSlot) ||
      !identifier(attempt.gatewayAlias) || !Number.isSafeInteger(attempt.amountMinor) || attempt.amountMinor <= 0 ||
      attempt.currency !== 'USD' || !Number.isSafeInteger(attempt.bindingRevision) || attempt.bindingRevision < 1 ||
      !timestamp(attempt.uncertainAt) || attempt.uncertainAt > now) return held('INVALID_FICTIONAL_ATTEMPT');
  if (!Array.isArray(observations) || observations.length === 0 || observations.length > 100) return held('LOOKUP_NOT_CONCLUSIVE');
  const seen = new Map();
  let conclusion = null;
  for (const observation of observations) {
    if (!exactKeys(observation, observationKeys) || observation.fictional !== true ||
        observation.source !== 'fictional-provider-query' || !identifier(observation.observationRef) ||
        observation.authoritative !== true || !['accepted', 'rejected', 'unknown'].includes(observation.status) ||
        !timestamp(observation.startedAt) || !timestamp(observation.completedAt) || !timestamp(observation.validUntil)) return held('UNTRUSTED_OR_MALFORMED_FIXTURE');
    if (bindingKeys.some(key => observation[key] !== attempt[key])) return held('EVIDENCE_BINDING_MISMATCH');
    if (observation.startedAt < attempt.uncertainAt || observation.completedAt < observation.startedAt ||
        observation.completedAt > now || observation.validUntil <= now || observation.validUntil <= observation.completedAt) return held('STALE_OR_DELAYED_EVIDENCE');
    if (observation.status === 'unknown') return held('LOOKUP_NOT_CONCLUSIVE');
    if (observation.status === 'accepted' ? !identifier(observation.transactionRef) : observation.transactionRef !== null) return held('INVALID_TRANSACTION_REFERENCE');
    // Explicit field projection makes replay comparison independent of JSON property ordering.
    const fingerprint = JSON.stringify(observationKeys.map(key => observation[key]));
    if (seen.has(observation.observationRef) && seen.get(observation.observationRef) !== fingerprint) return held('CONFLICTING_REPLAY');
    seen.set(observation.observationRef, fingerprint);
    const current = JSON.stringify([observation.status, observation.transactionRef]);
    if (conclusion !== null && conclusion !== current) return held('CONFLICTING_OUTCOMES');
    conclusion = current;
  }
  return result(JSON.parse(conclusion)[0] === 'accepted' ? 'FICTIONAL_ACCEPTED' : 'FICTIONAL_REJECTED', 'OFFLINE_REVIEW_ONLY');
}
