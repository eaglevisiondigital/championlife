// Independent client-boundary checks. No HTTP, credentials or provider calls.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const source = readFileSync(new URL('../../assets/js/nmi-giving-client.js', import.meta.url), 'utf8');
let checks = 0;
function fixture({status = 200, json, enabled = true} = {}) {
  let actor = 'fictional-A', expires = Math.floor(Date.now() / 1000) + 600;
  const counters = {fetch: 0, json: 0};
  const context = {URL, Date, console, location: {origin: 'https://fictional.test'}, document: {createElement: () => ({setAttribute() {}})}};
  context.window = context;
  context.CHAMPION_NMI_GIVING = {enabled, project: 'https://cccccccccccccccccccc.supabase.co', origin: context.location.origin};
  context.CHAMPION_LIFE_SUPABASE = {url: context.CHAMPION_NMI_GIVING.project, publishableKey: 'fictional-public'};
  context.ChampionLifeAuth = {client: {auth: {getSession: async () => ({data: {session: actor === null ? null : {user: {id: actor}, access_token: 'fictional-token', expires_at: expires}}}), onAuthStateChange: callback => {context.callback = callback;}}}};
  context.fetch = async () => {counters.fetch++; return {status, ok: status >= 200 && status < 300, json: async () => {counters.json++; return json ? json(context) : {status: 'success'};}};};
  vm.runInNewContext(source, context);
  return {context, counters, call: p => context.NmiGivingClient.call(p), actor: value => {actor = value;}, expire: () => {expires = 0;}};
}
async function denied(promise, label) {
  await assert.rejects(promise, error => error.code === 'SESSION_CHANGED', label); checks++;
}
for (const status of [401, 403]) for (const action of ['form', 'create', 'execute', 'status', 'recurring']) for (const body of ['invalid', 'pending']) {
  const f = fixture({status, json: () => body === 'pending' ? new Promise(() => {}) : Promise.reject(new SyntaxError('fictional invalid body'))});
  let timer;
  try {await denied(Promise.race([f.call({action}), new Promise((_, reject) => {timer = setTimeout(() => reject(Error('Denial waited for body')), 500);})]), `${status} ${action} ${body}`);} finally {clearTimeout(timer);}
  assert.equal(f.counters.json, 0); checks++;
  assert.equal(f.counters.fetch, 1); checks++;
}
for (const status of [200, 503]) {
  const failure = new SyntaxError('fictional uncertain response');
  const f = fixture({status, json: () => {throw failure;}});
  await assert.rejects(f.call({action: 'status'}), e => e === failure); checks++;
  assert.equal(f.counters.fetch, 1); checks++;
}
for (const change of ['account', 'logout', 'expired', 'client', 'scope']) {
  const f = fixture({json: () => {
    if (change === 'account') f.actor('fictional-B');
    if (change === 'logout') f.actor(null);
    if (change === 'expired') f.expire();
    if (change === 'client') f.context.ChampionLifeAuth.client = {auth: {}};
    if (change === 'scope') f.context.CHAMPION_NMI_GIVING.project = 'https://dddddddddddddddddddd.supabase.co';
    return {status: 'success', receipt: 'fictional-private-A'};
  }});
  await denied(f.call({action: 'status'}), 'Late ' + change + ' cannot publish success');
  assert.equal(f.counters.fetch, 1); checks++;
}
{
  const f = fixture(); const value = await f.call({action: 'status'});
  assert.equal(value.status, 'success'); checks++;
}
{
  const f = fixture({enabled: false}); await assert.rejects(f.call({action: 'create'}), /unavailable/); checks++;
  assert.equal(f.counters.fetch, 0); checks++;
}
console.log(JSON.stringify({status: 'PASS', checks, clientSHA256: createHash('sha256').update(source).digest('hex'), networkRequests: 0, syntheticOnly: true, releaseAuthorized: false}));
