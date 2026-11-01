import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewFictionalLookup} from './fictional-lookup-review.mjs';
const NOW = '2026-11-01T12:01:00Z';
function fixture(status = 'accepted') {
  const attempt = {fictional: true, attemptRef: 'FixtureAttempt', orderRef: 'FixtureOrder', organization: 'SowGo', midSlot: 'MID-02', gatewayAlias: 'FixtureGateway', amountMinor: 2500, currency: 'USD', bindingRevision: 2, uncertainAt: '2026-11-01T12:00:00Z'};
  const {uncertainAt, ...binding} = attempt;
  const observation = {...binding, observationRef: 'FixtureObservation', source: 'fictional-provider-query', authoritative: true, status, transactionRef: status === 'accepted' ? 'FixtureTransaction' : null, startedAt: '2026-11-01T12:00:01Z', completedAt: '2026-11-01T12:00:02Z', validUntil: '2026-11-01T12:02:00Z'};
  return {attempt, observation};
}
function check(attempt, observations, expected = 'UNKNOWN', now = NOW) {
  const value = reviewFictionalLookup(attempt, observations, now);
  assert.equal(value.classification, expected);
  for (const field of ['canSubmit', 'canRetry', 'canPostLedger', 'providerVerified']) assert.equal(value[field], false);
  assert.equal(value.mode, 'disabled'); assert.equal(Object.isFrozen(value), true);
  return value;
}
for (const status of ['accepted', 'rejected']) test(`fictional ${status} can be reviewed but never authorizes retry or money movement`, () => {
  const {attempt, observation} = fixture(status);
  check(attempt, [observation], `FICTIONAL_${status.toUpperCase()}`);
});
test('empty/no-match lookup never proves a payment did not happen', () => {const {attempt}=fixture();check(attempt, []);});
test('unknown or timed-out/delayed result does not authorize duplicate submission', () => {
  const {attempt, observation}=fixture('unknown'); check(attempt, [observation]);
  observation.completedAt='2026-11-01T12:01:01Z'; check(attempt,[observation]);
});
test('exact replay, including reordered JSON keys, remains idempotent', () => {
  const {attempt, observation}=fixture();
  check(attempt, [observation, {...observation}, Object.fromEntries(Object.entries(observation).reverse())], 'FICTIONAL_ACCEPTED');
});
test('an observation identifier reused with changed evidence holds', () => {
  const {attempt,observation}=fixture();
  const changed={...observation, completedAt:'2026-11-01T12:00:03Z'};
  assert.equal(check(attempt,[observation,changed]).reason,'CONFLICTING_REPLAY');
});
test('different observation identifiers cannot conceal conflicting provider transactions', () => {
  const {attempt,observation}=fixture();
  assert.equal(check(attempt,[observation,{...observation,observationRef:'OtherObservation',transactionRef:'OtherTransaction'}]).reason,'CONFLICTING_OUTCOMES');
});
test('accepted/rejected or accepted/UNKNOWN conflicts hold in either arrival order', () => {
  const {attempt,observation}=fixture();
  for (const status of ['rejected','unknown']) {
    const other={...fixture(status).observation,observationRef:'OtherObservation'};
    check(attempt,[observation,other]);check(attempt,[other,observation]);
  }
});
for (const [key,value] of Object.entries({attemptRef:'OtherAttempt',orderRef:'OtherOrder',organization:'Champion Life',midSlot:'MID-01',gatewayAlias:'OtherGateway',amountMinor:2501,currency:'EUR',bindingRevision:1})) test(`exact ${key} binding rejects replay across attempt/merchant/revision`,()=>{
 const {attempt,observation}=fixture();observation[key]=value;assert.equal(check(attempt,[observation]).reason,'EVIDENCE_BINDING_MISMATCH');
});
for (const [key,value] of [['startedAt','2026-11-01T11:59:59Z'],['completedAt','2026-11-01T11:59:59Z'],['completedAt','2026-11-01T12:01:01Z'],['validUntil',NOW],['validUntil','2026-11-01T12:00:01Z']]) test(`stale evidence ${key}=${value} holds`,()=>{
 const {attempt,observation}=fixture();observation[key]=value;assert.equal(check(attempt,[observation]).reason,'STALE_OR_DELAYED_EVIDENCE');
});
for(const bad of [false,'true','false',0,1,null,'',[],{},undefined]) test(`fixture authority must be exact true: ${JSON.stringify(bad)}`,()=>{
 const {attempt,observation}=fixture();observation.authoritative=bad;check(attempt,[observation]);
});
for(const key of ['fictional','observationRef','source','authoritative','status','transactionRef','startedAt','completedAt','validUntil']) test(`missing observation ${key} holds`,()=>{
 const {attempt,observation}=fixture();delete observation[key];check(attempt,[observation]);
});
for(const key of Object.keys(fixture().attempt)) test(`missing attempt ${key} holds`,()=>{
 const {attempt,observation}=fixture();delete attempt[key];check(attempt,[observation]);
});
test('real/webhook/browser provenance is not accepted as fictional query evidence',()=>{
 for(const source of ['provider-query','webhook','browser-return','fictional-provider-query\n']){const {attempt,observation}=fixture();observation.source=source;check(attempt,[observation]);}
});
test('no silent transaction identity inference',()=>{
 for(const value of [null,'',1,'FixtureTransaction\n']){const {attempt,observation}=fixture();observation.transactionRef=value;check(attempt,[observation]);}
 const {attempt,observation}=fixture('rejected');observation.transactionRef='FixtureTransaction';check(attempt,[observation]);
});
test('invalid amount, time, revision and newline IDs fail closed',()=>{
 for(const [key,value] of [['amountMinor',0],['amountMinor',-1],['amountMinor',1.5],['amountMinor',Number.MAX_SAFE_INTEGER+1],['bindingRevision',0],['bindingRevision','2'],['attemptRef','FixtureAttempt\n'],['uncertainAt','2026-02-30T12:00:00Z'],['fictional',false]]){const {attempt,observation}=fixture();attempt[key]=value;check(attempt,[observation]);}
 const {attempt,observation}=fixture();check(attempt,[observation],'UNKNOWN','2026-02-30T12:00:00Z');
});
test('schema rejects extra raw/private data instead of echoing it',()=>{
 const {attempt,observation}=fixture();observation.rawResponse='FICTIONAL_PRIVATE_PAYLOAD';
 const value=check(attempt,[observation]);assert.equal(JSON.stringify(value).includes('FICTIONAL_PRIVATE_PAYLOAD'),false);
});
test('bounded lookup size and malformed containers hold',()=>{
 const {attempt,observation}=fixture();for(const value of [undefined,null,{},'accepted',Array(101).fill(observation),[null],[[]]])check(attempt,value);
});
test('same immutable fixtures produce stable results without mutating caller state',()=>{
 const {attempt,observation}=fixture();Object.freeze(attempt);Object.freeze(observation);
 const result=check(attempt,Object.freeze([observation]),'FICTIONAL_ACCEPTED');
 for(let i=0;i<100;i++)assert.deepEqual(check(attempt,[observation],'FICTIONAL_ACCEPTED'),result);
});
test('module has no import, transport, persistence or executor',()=>{
 const source=readFileSync(new URL('./fictional-lookup-review.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\b(?:import|fetch|XMLHttpRequest|require|process|eval|Function)\s*[(.{]/u);
});
