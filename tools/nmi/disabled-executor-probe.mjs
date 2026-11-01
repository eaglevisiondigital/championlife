// Source-only proof of the existing executor's disabled boundary. Not an endpoint or payment service.
import { reviewFictionalPilot } from './fictional-pilot-review.mjs';
import { loadPinnedExecutor } from './pinned-executor.mjs';

const keys = ['document', 'receipt', 'binding', 'authority', 'intent', 'journal', 'observations', 'now'];
const result = (reason, executorInvoked = false, calls = []) => Object.freeze({
  mode: 'disabled', canSubmit: false, canRetry: false, canPostLedger: false, providerVerified: false,
  reason, executorInvoked, simulatedRpcCalls: Object.freeze([...calls]),
});

/** Inputs are fictional review data only. No caller-provided RPC, transport, configuration or secret port. */
export async function probeDisabledExecutor(input) {
  let f;
  try {
    f = structuredClone(input);
    if (!f || Object.keys(f).length !== keys.length || keys.some(k => !Object.hasOwn(f, k))) return result('INVALID_PROBE_INPUT');
    const review = reviewFictionalPilot(...keys.map(k => f[k]));
    if (review.classification !== 'FICTIONAL_PLAN_REVIEWABLE') return result(review.reason);
  } catch { return result('INVALID_PROBE_INPUT'); }
  const calls = [];
  let executorInvoked = false;
  try {
    const execute = await loadPinnedExecutor();
    // The canonical claim path is exercised, but every RPC is CLOSED in-memory state.
    // Do not pass a runtime/client config or map synthetic MID aliases to real gateway IDs.
    const organization_id = '00000000-0000-4000-8000-000000000001';
    const gateway_id = '00000000-0000-4000-8000-000000000002';
    const session_id = 'synthetic-session', id = 'synthetic-operation', lease = 'synthetic-lease';
    const rpc = async (action, org, args) => {
      if (org !== organization_id || args.session_id !== session_id || args.id !== id) throw Error('SCOPE');
      if (action === 'claim' && calls.length === 0) {
        calls.push(action);
        return { claimed: true, operation: 'sale', lease, scope: { organization_id, gateway_id, provider: 'nmi', environment: 'sandbox', secret_version: 1 } };
      }
      if (action === 'release' && calls.join(',') === 'claim' && args.lease === lease) { calls.push(action); return {}; }
      throw Error('FORBIDDEN_RPC');
    };
    const rejectIO = () => { calls.push('FORBIDDEN_IO'); throw Error('DISCONNECTED_ONLY'); };
    executorInvoked = true;
    const output = await execute({
      config: Object.freeze({ enabled: false, recoveryEnabled: false, project: null, acceptance_pin: null }),
      organization_id, session_id, id, payment_token: undefined, rpc, fetcher: rejectIO, readSecret: rejectIO,
    });
    if (output.status !== 'held' || output.retry_automatically !== false || calls.join(',') !== 'claim,release') return result('DISABLED_BOUNDARY_FAILED', true, calls);
    return result('EXISTING_EXECUTOR_HELD', true, calls);
  } catch { return result('EXECUTOR_PROBE_FAILED', executorInvoked, calls); }
}
