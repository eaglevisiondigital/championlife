// Disconnected review contract. Only a trusted server port may supply evidence.
export const COURSE = 'getting-a-grip-on-the-basics';
const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);

// Only the serialized server ledger may supply this binding. The public worksheet
// RPC response intentionally omits ownership and is insufficient on its own.
function ownedWorksheetComplete(a, s, target) {
  const r = a.receipt;
  return a.userId === target.userId && a.sessionId === target.sessionId &&
    id(s.enrollmentId) && a.enrollmentId === s.enrollmentId &&
    uuid(s.worksheetRevision) && r?.revision === s.worksheetRevision &&
    r.status === 'available' && r.course === COURSE && r.lesson === target.lesson &&
    r.requiredQuestions === 20 && r.savedNonblankAnswers === 20 &&
    r.allRequiredAnswersSaved === true && r.canComplete === false && r.canCommit === false;
}
const denied = reason => Object.freeze({reason, watchThresholdMet:false, answerRequirementMet:false, advanceEvidence:false, completionEvidence:false, canCommit:false});

/** Port must serialize its snapshot with enrollment, session and evidence changes.
 * It must verify signed/provider watch receipts and durable answer ownership before
 * projecting data here. This module cannot authenticate client telemetry. It never
 * writes progress and its result is not a transferable authorization token.
 */
export async function reviewProgression(request, port, {signal} = {}) {
  const target = Object.freeze({...request});
  if (!id(target.userId) || !id(target.sessionId) || target.course !== COURSE || !Number.isInteger(target.lesson) || target.lesson < 1 || target.lesson > 13) return denied('invalid_target');
  if (signal?.aborted || typeof port?.withCurrentEvidence !== 'function') return denied('unavailable');
  try {
    let called = false;
    const result = await port.withCurrentEvidence(target, snapshot => {
      if (called) throw Error('Snapshot callback repeated');
      called = true;
      if (signal?.aborted) return denied('cancelled');
      const s = snapshot;
      if (!s || s.userId !== target.userId || s.sessionId !== target.sessionId || s.course !== target.course || s.lesson !== target.lesson || s.sessionActive !== true || s.enrolled !== true || !integer(s.revision)) return denied('binding');
      // Lessons 6/8/9 have multiple videos; this single-media contract cannot
      // establish their required complete set, order or durations. Hold review
      // until that binding is approved and implemented. Media 11–13 is absent.
      if ([6,8,9].includes(target.lesson) || target.lesson > 10 || s.videoApproved !== true || !id(s.videoRevision) || !integer(s.durationMs) || s.durationMs === 0) return denied('media_unavailable');
      if (!Array.isArray(s.watchReceipts) || s.watchReceipts.length > 10000) return denied('invalid_receipts');
      const intervals = [], seen = new Map();
      for (const r of s.watchReceipts) {
        if (!r || !id(r.id) || r.userId !== target.userId || r.course !== COURSE || r.lesson !== target.lesson || r.videoRevision !== s.videoRevision || r.providerValidated !== true || r.eligiblePlayback !== true || !integer(r.startMs) || !integer(r.endMs) || !integer(r.elapsedMs) || r.startMs >= r.endMs || r.endMs > s.durationMs || r.endMs - r.startMs > r.elapsedMs) return denied('invalid_receipts');
        const key = JSON.stringify([r.startMs,r.endMs,r.elapsedMs]);
        if (seen.has(r.id) && seen.get(r.id) !== key) return denied('receipt_conflict');
        if (!seen.has(r.id)) intervals.push([r.startMs,r.endMs]);
        seen.set(r.id,key);
      }
      intervals.sort((a,b) => a[0]-b[0]);
      let watched = 0, end = 0;
      for (const [start, stop] of intervals) { watched += Math.max(0,stop-Math.max(start,end)); end = Math.max(end,stop); }
      const watch = BigInt(watched) * 100n >= BigInt(s.durationMs) * 95n;
      const a = s.answerReceipt;
      // Lessons 5–13 device notes are not durable cloud worksheet evidence.
      const answers = target.lesson <= 4 && (a?.source === 'owned_worksheet_transaction_v1'
        ? ownedWorksheetComplete(a, s, target)
        // Preserve the older disconnected review contract, but never downgrade a
        // malformed or unknown discriminated receipt to that legacy shape.
        : a && !Object.hasOwn(a, 'source') && a.durable === true && a.complete === true && id(a.id) && a.userId === target.userId && a.course === COURSE && a.lesson === target.lesson && integer(a.revision));
      return Object.freeze({reason:'reviewed',watchThresholdMet:watch,answerRequirementMet:!!answers,advanceEvidence:watch,completionEvidence:watch && !!answers,canCommit:false});
    });
    if (!called || signal?.aborted) return denied('unavailable');
    return result;
  } catch { return denied('unavailable'); }
}
