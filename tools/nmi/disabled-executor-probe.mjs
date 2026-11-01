// Source-only proof of the existing executor's disabled boundary. Not an endpoint or payment service.
import { reviewFictionalPilot } from './fictional-pilot-review.mjs';
import { loadPinnedExecutor, loadPinnedGateway } from './pinned-executor.mjs';
import { prepareFourMidHandoff } from './boarding-handoff.mjs';

const keys = ['document', 'receipt', 'binding', 'authority', 'intent', 'journal', 'observations', 'now'];
const result = (reason, executorInvoked = false, calls = []) => Object.freeze({
  mode: 'disabled', canSubmit: false, canRetry: false, canPostLedger: false, providerVerified: false,
  reason, executorInvoked, simulatedRpcCalls: Object.freeze([...calls]),
});

/** Compose the complete boarding handoff with the existing closed pilot/gateway probe.
 * This is an optional offline full-boarding review, not a new prerequisite for a
 * separately reviewed single-route pilot. No receipt, source or config override.
 */
export async function probeFourMidGateway(input) {
  const handoffKeys = ['document', 'slotReviews', 'routeReceipts', 'binding', 'authority', 'intent', 'journal', 'observations', 'now'];
  try {
    // Capture once before asynchronous source loading. Never reuse a caller's
    // precomputed ready flag or independently supplied selected-route receipt.
    const f = structuredClone(input);
    if (!f || Array.isArray(f) || Object.keys(f).length !== handoffKeys.length || handoffKeys.some(k => !Object.hasOwn(f, k))) return result('INVALID_HANDOFF_PROBE_INPUT');
    const handoff = prepareFourMidHandoff(f.document, f.slotReviews, f.routeReceipts, f.now);
    if (!handoff.readyForPrivateReview) return result(handoff.reason);
    const receipt = f.routeReceipts.find(r => r.route === f.binding?.route);
    if (!receipt) return result('SELECTED_ROUTE_NOT_REVIEWED');
    return await probeDisabledGateway({document: f.document, receipt, binding: f.binding,
      authority: f.authority, intent: f.intent, journal: f.journal, observations: f.observations, now: f.now});
  } catch { return result('INVALID_HANDOFF_PROBE_INPUT'); }
}

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
    // The reviewed guard must reject before ANY durable operation or credential IO.
    // Keep all ports closed; this probe cannot be connected to a database service.
    const organization_id = '00000000-0000-4000-8000-000000000001';
    const session_id = 'synthetic-session', id = 'synthetic-operation';
    const rpc = async action => { calls.push(action); throw Error('FORBIDDEN_RPC'); };
    const rejectIO = () => { calls.push('FORBIDDEN_IO'); throw Error('DISCONNECTED_ONLY'); };
    executorInvoked = true;
    const output = await execute({
      config: Object.freeze({ enabled: false, recoveryEnabled: false, project: null, acceptance_pin: null }),
      organization_id, session_id, id, payment_token: undefined, rpc, fetcher: rejectIO, readSecret: rejectIO,
    });
    if (output.status !== 'held' || output.retry_automatically !== false || calls.length !== 0) return result('DISABLED_BOUNDARY_FAILED', true, calls);
    return result('EXISTING_EXECUTOR_HELD', true, calls);
  } catch { return result('EXECUTOR_PROBE_FAILED', executorInvoked, calls); }
}

/** Review the same plan through the actual pinned gateway; caller cannot arm it. */
export async function probeDisabledGateway(input) {
  const execution = await probeDisabledExecutor(input);
  if (execution.reason !== 'EXISTING_EXECUTOR_HELD') return execution;
  const calls=[];
  try {
    const createHandler=await loadPinnedGateway();
    const project='https://cccccccccccccccccccc.supabase.co';
    const origin='https://fictional--championlifechurch.netlify.app';
    const config=Object.freeze({enabled:false,recoveryEnabled:false,project,
      acceptance_pin:Object.freeze({name:'champion-life-nmi-giving-acceptance',project,origins:[origin]}),
      origins:[origin],serviceKey:'FICTIONAL_NOT_A_CREDENTIAL',publicKey:'FICTIONAL_NOT_A_CREDENTIAL'});
    const rejectIO=()=>{calls.push('FORBIDDEN_IO');throw Error('DISCONNECTED_ONLY');};
    const handler=createHandler(config,rejectIO,rejectIO);
    for(const action of ['create','execute','job']) {
      const response=await handler(new Request('https://fictional.invalid',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
        body:JSON.stringify({action,organization_id:'00000000-0000-4000-8000-000000000001',operation:'sale'})}));
      if(response.status!==503||(await response.json()).status!=='held'||calls.length) return result('GATEWAY_BOUNDARY_FAILED',true,calls);
    }
    return Object.freeze({...result('EXISTING_GATEWAY_HELD',true,calls),gatewayInvoked:true});
  } catch { return result('GATEWAY_PROBE_FAILED',true,calls); }
}
