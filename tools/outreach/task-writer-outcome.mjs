// Classification only: no transport, authority, mutation port, or retry function.
export function taskWriterOutcome(result) {
  if (result?.state === 'HELD' && result.can_authorize === false && result.can_commit === false && result.automatic_retry === false) {
    return Object.freeze({state: 'HELD', automaticRetry: false});
  }
  // Even a claimed success is untrusted: this increment cannot commit a write.
  return Object.freeze({state: 'UNKNOWN', automaticRetry: false});
}
