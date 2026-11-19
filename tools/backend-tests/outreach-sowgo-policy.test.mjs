// Synthetic HTTP only; never call a provider or database.
import assert from 'node:assert/strict';
import {partnerSitePolicy} from '../../supabase/functions/outreach-partner-submit/site-policy.mjs';
import {createHandler} from '../../supabase/functions/outreach-partner-submit/gateway.mjs';
const url='https://exdocjbmylgxssanymjk.supabase.co',origins=['https://championlifefwb.com','https://retained.example'],hostnames=['championlifefwb.com','retained.example'];
const added=partnerSitePolicy({url,origins,hostnames});
assert.deepEqual(added.origins,[...origins,'https://sowgo.org']);assert.deepEqual(added.hostnames,[...hostnames,'sowgo.org']);
assert.equal(origins.length,2);assert.equal(hostnames.length,2);
for(const other of ['https://bkbmjisprwmkptywtmih.supabase.co','https://evil.example',''])assert.deepEqual(partnerSitePolicy({url:other,origins,hostnames}),{origins,hostnames});
assert.equal(partnerSitePolicy({url,origins:[...origins,'https://sowgo.org'],hostnames:[...hostnames,'sowgo.org']}).origins.length,3);
let calls=[],proof={success:true,action:'outreach_partner',hostname:'sowgo.org'};
const fetcher=async(endpoint,init)=>{calls.push({endpoint,init});return Response.json(endpoint.includes('siteverify')?proof:{accepted:true});};
const handler=createHandler({url,serviceKey:'fictional-server-key',pepper:'fictional-pepper-not-a-server-secret-over32chars',turnstileSecret:'fictional-turnstile-secret',action:'outreach_partner',...added},fetcher);
const request=(origin,method='OPTIONS')=>new Request(url+'/functions/v1/outreach-partner-submit',{method,headers:{Origin:origin,'Content-Type':'application/json','cf-connecting-ip':'192.0.2.1'},...(method==='POST'?{body:JSON.stringify({payload:{brand:'sowgo',source_path:'/partner/',request_key:crypto.randomUUID(),fields:{}},turnstile_token:'fictional-challenge'})}:{})});
for(const origin of added.origins){const r=await handler(request(origin));assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-origin'),origin);}
for(const origin of ['https://www.sowgo.org','https://sowgo.org.evil.example','http://sowgo.org','null']){assert.equal((await handler(request(origin))).status,403);assert.equal(calls.length,0);}
assert.equal((await handler(request('https://sowgo.org','POST'))).status,200);assert.equal(calls.length,2);assert.equal(calls[1].endpoint,url+'/rest/v1/rpc/outreach_partner_gateway');
for(const changed of [{...proof,hostname:'evil.example'},{...proof,action:'minden_volunteer'},{...proof,success:false}]){proof=changed;const before=calls.filter(x=>x.endpoint.includes('/rpc/')).length;assert.equal((await handler(request('https://sowgo.org','POST'))).status,400);assert.equal(calls.filter(x=>x.endpoint.includes('/rpc/')).length,before);}
console.log('PASS exact partner-only SowGo policy, retained configuration, CORS negatives and bounded shared gateway');
