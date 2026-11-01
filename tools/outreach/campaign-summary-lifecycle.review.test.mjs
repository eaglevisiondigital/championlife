import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampaignSummaryLifecycle} from './campaign-summary-lifecycle.mjs';

const A='10000000-0000-4000-8000-000000000001';
const B='20000000-0000-4000-8000-000000000002';
const summary=id=>({
  campaignId:id,kind:'event-registration-summary',
  counts:{households:1,attendees:3,adults:2,minors:1,checked_in:0}
});

test('revoke nested inside clearing notification fails closed without recursive loop',()=>{
 let lifecycle,notifications=0;
 const reader={read:async id=>summary(id),invalidate(){}};
 lifecycle=createCampaignSummaryLifecycle({reader,onSnapshot:value=>{
  if(value===null && ++notifications===1) lifecycle.revoke();
 }});
 assert.throws(()=>lifecycle.select(A),{code:'STALE_SCOPE'});
 assert.equal(lifecycle.snapshot(),null);
 assert.equal(notifications,1);
 assert.doesNotThrow(()=>lifecycle.select(A)); // a later explicit trusted selection can recover
});

test('close in clearing callback is permanent and cannot reselect a campaign',async()=>{
 let lifecycle,once=true;
 const reader={read:async id=>summary(id),invalidate(){}};
 lifecycle=createCampaignSummaryLifecycle({reader,onSnapshot:value=>{
  if(value===null && once){once=false;lifecycle.close()}
 }});
 assert.throws(()=>lifecycle.select(A),{code:'STALE_SCOPE'});
 assert.equal(lifecycle.snapshot(),null);
 assert.throws(()=>lifecycle.select(B),{code:'WORKSPACE_CLOSED'});
 await assert.rejects(lifecycle.refresh(),{code:'WORKSPACE_CLOSED'});
});

test('nested selection during clear cannot override outer scope',()=>{
 let lifecycle,once=true;
 const reader={read:async id=>summary(id),invalidate(){}};
 lifecycle=createCampaignSummaryLifecycle({reader,onSnapshot:value=>{
  if(value===null && once){once=false;lifecycle.select(B)}
 }});
 assert.throws(()=>lifecycle.select(A),{code:'STALE_SCOPE'});
 assert.equal(lifecycle.snapshot(),null);
 assert.equal(once,false);
});

test('visible consumer data clears even if transport cancellation fails',async()=>{
 let failCancel=false;const changes=[];
 const reader={read:async id=>summary(id),invalidate(){if(failCancel)throw Error('private transport token')}};
 const lifecycle=createCampaignSummaryLifecycle({reader,onSnapshot:data=>changes.push(data)});
 lifecycle.select(A);await lifecycle.refresh();
 assert.equal(lifecycle.snapshot()?.campaignId,A);
 failCancel=true;
 assert.throws(()=>lifecycle.revoke(),/private transport token/);
 assert.equal(lifecycle.snapshot(),null);
 assert.equal(changes.at(-1),null);
});

test('revoke during refresh null-notification prevents old RPC from starting',async()=>{
 let lifecycle,callCount=0,seenNull=0;
 const reader={read:async id=>{callCount++;return summary(id)},invalidate(){}};
 lifecycle=createCampaignSummaryLifecycle({reader,onSnapshot:value=>{
  if(value===null && ++seenNull===2)lifecycle.revoke();
 }});
 lifecycle.select(A);
 await assert.rejects(lifecycle.refresh(),{code:'STALE_SCOPE'});
 assert.equal(callCount,0);
 assert.equal(lifecycle.snapshot(),null);
});

test('callback response-time scope change invalidates result on read',async()=>{
 let lifecycle,once=true;
 const reader={read:async id=>summary(id),invalidate(){}};
 lifecycle=createCampaignSummaryLifecycle({reader,onSnapshot:value=>{
  if(value && once){once=false;lifecycle.select(B)}
 }});
 lifecycle.select(A);
 await assert.rejects(lifecycle.refresh(),{code:'STALE_SCOPE'});
 assert.equal(lifecycle.snapshot(),null);
});
