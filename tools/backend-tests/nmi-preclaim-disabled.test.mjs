// Source-only regression: no durable NMI operation claim if checkout is disabled.
import test from 'node:test';
import assert from 'node:assert/strict';
import {executeNmiGiving} from '../../supabase/functions/_shared/payments/nmi-executor.mjs';

const held = {status:'held',retry_automatically:false};
const settings = [
  ['undefined configuration',undefined],
  ['null configuration',null],
  ['empty configuration',{}],
  ['literal disabled',{enabled:false,recoveryEnabled:false}],
  ['string true not boolean approval',{enabled:'true',recoveryEnabled:false}],
  ['missing active flag',{recoveryEnabled:false}],
  ['unapproved recovery',{enabled:false,recoveryEnabled:true}],
  ['unbound recovery without project',{enabled:false,recoveryEnabled:true,acceptance_pin:{name:'champion-life-nmi-giving-acceptance'}}],
  ['unrecognized recovery pin',{enabled:false,recoveryEnabled:true,project:'https://cccccccccccccccccccc.supabase.co',acceptance_pin:{name:'unapproved',project:'https://cccccccccccccccccccc.supabase.co'}}],
];
for(const [label,config] of settings) test(label+' never touches a durable operation claim',async()=>{
  const actions=[];
  const forbidden=()=>{actions.push('UNAUTHORIZED_IO');throw Error('Should not be called')};
  const output=await executeNmiGiving({
    config,organization_id:'00000000-0000-4000-8000-000000000001',
    session_id:'synthetic-session',id:'synthetic-operation',
    rpc:async()=>forbidden(),fetcher:forbidden,readSecret:forbidden
  });
  assert.deepEqual(output,held);
  assert.deepEqual(actions,[]);
});
test('separately pinned recovery mode preserves claim and release under invalid credentials, no provider IO',async()=>{
  const project='https://cccccccccccccccccccc.supabase.co';
  const config={enabled:false,recoveryEnabled:true,project,acceptance_pin:{name:'champion-life-nmi-giving-acceptance',project}};
  const org='00000000-0000-4000-8000-000000000001';
  const gateway='00000000-0000-4000-8000-000000000002';
  const actions=[];
  const output=await executeNmiGiving({
    config,organization_id:org,session_id:'synthetic-session',id:'synthetic-operation',
    rpc:async(action)=>{
      actions.push(action);
      if(action==='claim')return {claimed:true,operation:'transaction',lease:'synthetic-lease',scope:{organization_id:org,gateway_id:gateway,provider:'nmi',environment:'sandbox',secret_version:1}};
      if(action==='release')return {};
      throw Error('Unexpected RPC: '+action);
    },
    readSecret:()=>{actions.push('TEST_SECRET_REJECTED');throw Error('No credentials');},
    fetcher:()=>{actions.push('FORBIDDEN_PROVIDER_IO');throw Error('No network');}
  });
  assert.deepEqual(output,held);
  assert.deepEqual(actions,['claim','TEST_SECRET_REJECTED','release']);
});
test('eligible recovery configuration with no claimed operation preserves pending and no automatic retry',async()=>{
  const project='https://cccccccccccccccccccc.supabase.co';
  const actions=[];
  const output=await executeNmiGiving({
    config:{enabled:false,recoveryEnabled:true,project,acceptance_pin:{name:'champion-life-nmi-giving-acceptance',project}},
    organization_id:'00000000-0000-4000-8000-000000000001',session_id:'synthetic-session',id:'synthetic-operation',
    rpc:async action=>{actions.push(action);if(action==='claim')return {claimed:false};throw Error('Forbidden RPC');},
    fetcher:()=>assert.fail('provider IO'),readSecret:()=>assert.fail('secret IO')
  });
  assert.deepEqual(output,{status:'pending',retry_automatically:false});
  assert.deepEqual(actions,['claim']);
});
test('a disabled executor cannot obtain operation state, even with an injected claim callback',async()=>{
  const actions=[];
  const output=await executeNmiGiving({
    config:{enabled:false,recoveryEnabled:false},organization_id:'synthetic',session_id:'synthetic',id:'synthetic',
    rpc:async()=>{actions.push('claim');return {claimed:true,operation:'sale'};},
    readSecret:()=>{actions.push('secret');return 'SYNTHETIC_CREDENTIAL';},
    fetcher:()=>{actions.push('network');return {}}
  });
  assert.deepEqual(output,held);
  assert.deepEqual(actions,[]);
});
