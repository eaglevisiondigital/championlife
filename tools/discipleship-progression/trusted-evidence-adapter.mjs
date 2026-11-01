import { createHash } from 'node:crypto';
import { COURSE, reviewProgression } from './evidence-review.mjs';
const id = x => typeof x === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(x);
const int = x => Number.isSafeInteger(x) && x >= 0;
const deny = () => Object.freeze({reason:'trusted_evidence_unavailable',advanceEvidence:false,completionEvidence:false,canCommit:false});
const copy = value => JSON.parse(JSON.stringify(value));
const digest = value => createHash('sha256').update(value).digest('hex');
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);

/** Server-only composition, never a browser authentication API.
 * authenticate() must verify the live session at the provider. loadLedger() reads
 * learner-owned durable source records. verifyPlayback() validates a reviewed
 * provider's independent observation, NOT a signature over client telemetry.
 * withCurrentLedger() reauthenticates and serializes its one callback with every
 * session/enrollment/media/receipt/answer AND observer-key/policy change; revisions
 * must be monotonic. Observer verification and ledger locks must share a reviewed
 * ordering; rechecking alone does not replace provider/database serialization.
 * No production implementations of those ports or progress writes are included.
 */
export async function reviewTrustedProgression(input, ports, {signal, now = Date.now} = {}) {
  try {
    const request = copy(input);
    if (request?.course !== COURSE || !int(request.lesson) || request.lesson < 1 || request.lesson > 10 || 'userId' in request || 'sessionId' in request || signal?.aborted) return deny();
    for (const method of ['authenticate','loadLedger','verifyPlayback','withCurrentLedger']) if (typeof ports?.[method] !== 'function') return deny();
    const principal = copy(await ports.authenticate({signal}));
    if (!id(principal.userId) || !id(principal.sessionId) || principal.active !== true || principal.verified !== true || signal?.aborted) return deny();
    const target = Object.freeze({userId:principal.userId,sessionId:principal.sessionId,course:COURSE,lesson:request.lesson});
    const ledger = copy(await ports.loadLedger(target,{signal}));
    if (ledger.userId !== target.userId || ledger.sessionId !== target.sessionId || ledger.course !== target.course || ledger.lesson !== target.lesson || !int(ledger.revision) || !Array.isArray(ledger.receipts) || ledger.receipts.length > 10000 || !id(ledger.mediaId) || !id(ledger.videoRevision)) return deny();
    const checked = [];
    for (const receipt of ledger.receipts) {
      if (signal?.aborted || !id(receipt.id) || typeof receipt.envelope !== 'string' || receipt.envelope.length > 65536) return deny();
      const proof = copy(await ports.verifyPlayback(receipt.envelope,{signal}));
      const t = now();
      if (proof.source !== 'independent_provider_observation' || proof.eligiblePlayback !== true || proof.id !== receipt.id || proof.envelopeSha256 !== digest(receipt.envelope) || proof.userId !== target.userId || proof.sessionId !== target.sessionId || proof.course !== COURSE || proof.lesson !== target.lesson || proof.mediaId !== ledger.mediaId || proof.videoRevision !== ledger.videoRevision || !id(proof.provider) || !id(proof.policyVersion) || proof.policyVersion !== ledger.policyVersion || !int(t) || !int(proof.observedAt) || !int(proof.validUntil) || proof.observedAt > t || proof.validUntil <= t || !int(proof.elapsedMs) || proof.elapsedMs > t - proof.observedAt || signal?.aborted) return deny();
      checked.push({...proof,providerValidated:true});
    }
    let count = 0, result;
    await ports.withCurrentLedger(target, async current => {
      if (++count !== 1) throw Error('repeated callback');
      if (!equal(ledger,copy(current)) || signal?.aborted || checked.some(p => p.validUntil <= now())) { result = deny(); return; }
      // Revalidate observer authority under the ledger's required serialization,
      // not just before waiting for it. A key/policy downgrade invalidates proof.
      for (let i=0;i<current.receipts.length;i++) {
        const fresh=copy(await ports.verifyPlayback(current.receipts[i].envelope,{signal}));
        if (!equal(ledger,copy(current)) || !equal({...fresh,providerValidated:true},checked[i]) || signal?.aborted || checked[i].validUntil<=now()) {result=deny();return;}
      }
      // Build only from the freshly serialized durable ledger. Raw answers never leave it.
      result = await reviewProgression(target,{withCurrentEvidence:async(_,read)=>read({
        ...target, revision:current.revision, sessionActive:current.sessionActive,
        enrolled:current.enrolled, videoApproved:current.videoApproved,
        videoRevision:current.videoRevision, durationMs:current.durationMs,
        watchReceipts:checked, answerReceipt:current.answerReceipt
      })},{signal});
      if (signal?.aborted || checked.some(p => p.validUntil <= now())) result = deny();
    },{signal});
    if (count !== 1 || signal?.aborted || checked.some(p => p.validUntil <= now())) return deny();
    return result ?? deny();
  } catch { return deny(); }
}
