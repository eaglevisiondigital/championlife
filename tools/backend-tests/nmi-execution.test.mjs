import assert from 'node:assert/strict';import {randomUUID as uid} from 'node:crypto';
import {database,seed,f,form,cap,network} from './nmi-execution-fixture.mjs';
const db=await database(),q=(s,p=[])=>db.query(s,p);let n=0;
const ok=(v,m)=>{assert.ok(v,m);n++;console.log('PASS '+m)};
const svc=(a,p,o=f.org)=>q('select nmi_giving_service($1,$2,$3)v',[a,o,p]).then(r=>r.rows[0].v);
const as=async(role='service_role',user=null)=>{await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[user||'']);await db.exec('set role '+role)};
const create=(extra={})=>({form_id:form,request_key:uid(),capability_hash:cap,network_hash:network,receipt_email:'synthetic@example.test',donor_name:'Synthetic',frequency:'once',lines:[{fund_id:f.mainFund,amount_minor:'2500'}],...extra});
const prepare=(s,op='sale',extra={})=>svc('prepare',{session_id:s.session_id,leg_id:s.legs[0].id,capability_hash:cap,operation:op,request_key:uid(),...extra});
const dispatch=async(s,op)=>{let c=await svc('claim',{session_id:s.session_id,id:op.id});await svc('handoff',{session_id:s.session_id,id:op.id,lease:c.lease});return c};
try{
 await as('anon');await assert.rejects(()=>svc('form',{form_id:form}));await as();ok(!(await svc('form',{form_id:form})).available,'default disabled public giving');
 await db.exec('reset role');await db.exec(seed);await as();ok((await svc('form',{form_id:form})).funds.length===1,'server configured public fund only');
 const p=create(),s=await svc('create',p);ok(s.legs.length===1,'anonymous canonical checkout prepared without Person creation');ok((await svc('create',p)).session_id===s.session_id,'same public request idempotent');await assert.rejects(()=>svc('create',{...p,receipt_email:'changed@example.test'}));
 await assert.rejects(()=>svc('status',{session_id:s.session_id,capability_hash:'c'.repeat(64)}));
 const op=await prepare(s);
 await db.exec('reset role');await q('update giving_gateway_accounts set revision=revision+1 where id=$1',[f.nmi]);await as();await assert.rejects(()=>svc('claim',{session_id:s.session_id,id:op.id}));
 await db.exec('reset role');await q('update giving_gateway_accounts set revision=revision-1 where id=$1',[f.nmi]);await as();ok(true,'changed gateway/destination/fund snapshot cannot hand off');
 await db.exec('reset role');await q("update private.nmi_giving_route_proofs set settlement_reference='synthetic-changed-settlement'where route_id=$1",[f.mainRoute]);await as();await assert.rejects(()=>svc('claim',{session_id:s.session_id,id:op.id}));
 await db.exec('reset role');await q("update private.nmi_giving_route_proofs set settlement_reference='synthetic-settlement'where route_id=$1",[f.mainRoute]);await as();ok(true,'private merchant/MID/settlement proof change stops prepared handoff');
 const claim=await dispatch(s,op);await assert.rejects(()=>svc('handoff',{session_id:s.session_id,id:op.id,lease:claim.lease}));
 const completed=await svc('complete',{session_id:s.session_id,id:op.id,lease:claim.lease,status:'captured',authoritative:true,provider_reference:'synthetic-sale-1',amount_minor:'2500',currency:'USD',processor_id:'synthetic-main'});
 ok(completed.status==='success'&&completed.receipt.sandbox===true,'authoritative sandbox success + held receipt');
 await db.exec('reset role');ok(Number((await q('select sum(amount_minor) n from giving_ledger where session_id=$1',[s.session_id])).rows[0].n)===2500,'successful canonical ledger posting');ok(Number((await q('select count(*) n from private.nmi_giving_receipt_outbox')).rows[0].n)===1,'one held receipt outbox item');
 await as();await assert.rejects(()=>svc('complete',{session_id:s.session_id,id:op.id,lease:claim.lease,status:'captured',authoritative:true}));await assert.rejects(()=>prepare(s));ok(true,'duplicate outcomes and new charge denied');
 const pending=await svc('create',create({receipt_email:'unknown@example.test'})),unknown=await prepare(pending),u=await dispatch(pending,unknown);
 await svc('complete',{session_id:pending.session_id,id:unknown.id,lease:u.lease,status:'review',authoritative:false,category:'unknown'});await assert.rejects(()=>prepare(pending));
 await db.exec('reset role');ok(Number((await q('select count(*) n from giving_ledger where session_id=$1',[pending.session_id])).rows[0].n)===0,'unknown result never posts ledger');await q("update private.nmi_giving_checkouts set created_at=now()-interval '1 day'where session_id=$1",[pending.session_id]);await as();await assert.rejects(()=>svc('create',create({receipt_email:'unknown@example.test'})));ok(true,'unknown original blocks fresh checkout even after duplicate-window expiry');await db.exec('reset role');
 await as();const mismatch=await svc('create',create({receipt_email:'mismatch@example.test'})),m=await prepare(mismatch),mc=await dispatch(mismatch,m);
 ok((await svc('complete',{session_id:mismatch.session_id,id:m.id,lease:mc.lease,status:'captured',authoritative:true,provider_reference:'synthetic-wrong',amount_minor:'2499',currency:'USD',processor_id:'synthetic-main'})).operation_status==='review','mismatched authoritative amount held');

 // Authoritative recovery of a previously unknown dispatched sale.
 const lookup=await prepare(pending,'transaction',{actor_id:f.admin,parent_attempt_id:unknown.id}),lc=await dispatch(pending,lookup);
 const recovered=await svc('complete',{session_id:pending.session_id,id:lookup.id,lease:lc.lease,status:'settled',authoritative:true,provider_reference:'synthetic-recovered',amount_minor:'2500',currency:'USD',processor_id:'synthetic-main'});
 ok(recovered.status==='success','authoritative original-attempt lookup resolves pending state');
 await db.exec('reset role');ok(Number((await q('select sum(amount_minor)n from giving_ledger where session_id=$1',[pending.session_id])).rows[0].n)===2500,'recovery posts once');
 await as();await assert.rejects(()=>svc('create',create({request_key:uid()})));ok(true,'new key cannot bypass duplicate guest fingerprint');
 await assert.rejects(()=>svc('create',create({lines:[{fund_id:f.anFund,amount_minor:'2500'}]})));await assert.rejects(()=>svc('create',{...create(),person_id:f.person}));await assert.rejects(()=>svc('create',{...create(),card_number:'never-accepted'}));ok(true,'foreign/unconfigured fund, identity and raw payment keys denied');
 await as('authenticated',f.ordinary);await assert.rejects(()=>svc('operations',{actor_id:f.admin}));ok(true,'browser cannot borrow service authority');
 await db.exec('reset role');await db.exec(`insert into organization_staff_permissions(organization_id,user_id,permission)values('${f.org}','${f.reader}','payments.refund.approve'),('${f.org}','${f.reader}','payments.void.approve')on conflict do nothing;`);await as();
 // Active recurring is canonical, with no gift until an actual verified charge.
 await db.exec('reset role');await q("insert into private.payments_nmi_plans(organization_id,gateway_id,plan_reference,frequency,amount_minor,currency,verified_at,proof_reference)values($1,$2,'synthetic-monthly','monthly',2500,'USD',now(),'SYNTHETIC plan verification')",[f.org,f.nmi]);await as();
 const rs=await svc('create',create({receipt_email:'recurring@example.test',frequency:'monthly',starts_on:'2027-01-15'}));
 await assert.rejects(()=>prepare(rs,'recurring_create'));
 const rp=await prepare(rs,'recurring_create',{save_method:true}),rc=await dispatch(rs,rp);
 const active=await svc('complete',{session_id:rs.session_id,id:rp.id,lease:rc.lease,status:'active',authoritative:true,provider_reference:'synthetic-subscription',amount_minor:'2500',currency:'USD',processor_id:'synthetic-main',customer_reference:'synthetic-vault'});
 ok(active.recurring[0].status==='active','verified recurring creation activates canonical instruction');const instruction=active.recurring[0].id;await db.exec('reset role');await q("update private.nmi_giving_checkouts set created_at=now()-interval '1 day'where session_id=$1",[rs.session_id]);await as();await assert.rejects(()=>svc('create',create({receipt_email:'recurring@example.test',frequency:'monthly',starts_on:'2027-01-15'})));ok(true,'active recurring schedule blocks duplicate creation beyond short replay window');
 await db.exec('reset role');ok(Number((await q('select count(*)n from giving_ledger where session_id=$1',[rs.session_id])).rows[0].n)===0,'subscription creation is not a gift');ok(Number((await q('select count(*)n from private.nmi_giving_vault_bindings where session_id=$1',[rs.session_id])).rows[0].n)===1,'explicit recurring vault consent is privately route-bound');await as();
 await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[f.admin]);await q('update giving_funds set tax_eligible=false where id=$1',[f.mainFund]);await as();
 const event={gateway_id:f.nmi,event_id:'synthetic-renewal-event',digest:'d'.repeat(64),merchant_reference:'synthetic-merchant',processor_id:'synthetic-main',provider_reference:'synthetic-recurring-charge',subscription_reference:'synthetic-subscription',kind:'transaction',status:'captured'};
 const renewal=await svc('webhook',event);ok(!!renewal.lookup_id,'signed recurring observation requests authoritative lookup');ok((await svc('webhook',event)).duplicate,'webhook replay deduped');await assert.rejects(()=>svc('webhook',{...event,digest:'e'.repeat(64)}));
 const renewSession={session_id:renewal.session_id},renewClaim=await dispatch(renewSession,{id:renewal.lookup_id});ok(renewClaim.expected_subscription==='synthetic-subscription','recurring query must independently bind subscription');
 await svc('complete',{session_id:renewal.session_id,id:renewal.lookup_id,lease:renewClaim.lease,status:'settled',authoritative:true,provider_reference:'synthetic-recurring-charge',amount_minor:'2500',currency:'USD',processor_id:'synthetic-main'});
 await db.exec('reset role');const renewedGift=(await q('select recurring_id,tax_eligible from giving_ledger where session_id=$1',[renewal.session_id])).rows[0];ok(renewedGift.recurring_id===instruction&&renewedGift.tax_eligible===true,'verified recurring gift preserves instruction linkage and original tax classification');await as();
 // Maker/checker requests feed the new executor; current revocation is rechecked.
 const finance=async(action,payload,user=f.admin)=>{await as('authenticated',user);const x=(await q('select payment_operations($1,$2,$3)v',[action,f.org,payload])).rows[0].v;await as();return x};

 const renewalLeg=(await svc('status',{session_id:renewal.session_id,actor_id:f.admin})).legs[0].id;
 const refund=await finance('refund_request',{request_key:uid(),leg_id:renewalLeg,amount_minor:'1000',reason:'SYNTHETIC approved refund'});
 await assert.rejects(()=>finance('refund_approve',{request_key:uid(),id:refund.id,reason:'SYNTHETIC invalid self approval'}));await as();
 await finance('refund_approve',{request_key:uid(),id:refund.id,reason:'SYNTHETIC second reviewer'},f.reader);
 const fp=await prepare({session_id:renewal.session_id,legs:[{id:renewalLeg}]},'refund',{actor_id:f.admin,refund_id:refund.id}),fc=await svc('claim',{session_id:renewal.session_id,id:fp.id});
 await db.exec('reset role');await q("update organization_staff_permissions set revoked_at=now()where user_id=$1 and permission='payments.refund.execute'",[f.admin]);await as();await assert.rejects(()=>svc('handoff',{session_id:renewal.session_id,id:fp.id,lease:fc.lease}));
 await db.exec('reset role');await q("update organization_staff_permissions set revoked_at=null where user_id=$1 and permission='payments.refund.execute'",[f.admin]);await as();await svc('handoff',{session_id:renewal.session_id,id:fp.id,lease:fc.lease});
 await svc('complete',{session_id:renewal.session_id,id:fp.id,lease:fc.lease,status:'refunded',authoritative:true,provider_reference:'synthetic-refund',amount_minor:'1000',currency:'USD',processor_id:'synthetic-main'});
 await db.exec('reset role');ok(Number((await q('select sum(amount_minor)n from giving_ledger where session_id=$1',[renewal.session_id])).rows[0].n)===1500,'approved partial refund appends exact negative principal');await as();
 // Authorize/void does not create gifts.
 const vs=await svc('create',create({receipt_email:'void@example.test'})),vp=await prepare(vs,'authorize'),vc=await dispatch(vs,vp);
 await svc('complete',{session_id:vs.session_id,id:vp.id,lease:vc.lease,status:'authorized',authoritative:true,provider_reference:'synthetic-auth',amount_minor:'2500',currency:'USD',processor_id:'synthetic-main'});
 const vr=await finance('void_request',{request_key:uid(),leg_id:vs.legs[0].id,amount_minor:'2500',reason:'SYNTHETIC authorization void'});await finance('void_approve',{request_key:uid(),id:vr.id,reason:'SYNTHETIC separate reviewer'},f.reader);
 const vo=await prepare(vs,'void',{actor_id:f.admin,refund_id:vr.id}),vclaim=await dispatch(vs,vo);await svc('complete',{session_id:vs.session_id,id:vo.id,lease:vclaim.lease,status:'voided',authoritative:true,provider_reference:'synthetic-auth',amount_minor:'2500',currency:'USD',processor_id:'synthetic-main'});
 await db.exec('reset role');ok(Number((await q('select count(*)n from giving_ledger where session_id=$1',[vs.session_id])).rows[0].n)===0,'authorization void has zero gift ledger');await as();
 // Batch facts are authoritative query projections, bank fee/net inputs remain explicit.
 const snapshot={batch_reference:'synthetic-batch',date:'2026-10-18',currency:'USD',processor_id:'synthetic-main',complete:true,items:[{provider_reference:'synthetic-sale-1',gross_minor:'2500',currency:'USD'}],gross_minor:'2500',fee_minor:null,net_minor:null};
 const batchArgs={actor_id:f.admin,gateway_id:f.nmi,route_id:f.mainRoute,snapshot};ok((await svc('batch_record',batchArgs)).state==='gross_matched_fees_unverified','batch matches gross without inventing fees/net');
 await assert.rejects(()=>svc('batch_record',{...batchArgs,snapshot:{...snapshot,gross_minor:'2499'}}));
 ok((await svc('batch_reconcile',{actor_id:f.admin,gateway_id:f.nmi,route_id:f.mainRoute,batch_reference:'synthetic-batch',fee_minor:'100',net_minor:'2400',deposit_minor:'2400',statement_reference:'SYNTHETIC bank statement'})).state==='balanced','explicit statement amounts reconcile with immutable batch');
 // A queued lookup uses the existing Operations job and cannot enqueue another sale.
 await db.exec('reset role');const jid=uid(),retryid=uid();await q("insert into private.payment_ops_jobs(id,organization_id,leg_id,kind,request_key,requested_by)values($1,$2,$3,'lookup',$4,$5),($6,$2,$3,'retry',$7,$5)",[jid,f.org,s.legs[0].id,uid(),f.admin,retryid,uid()]);await as();
 const job=await svc('operation_job',{actor_id:f.admin,job_id:jid});ok(job.claimed===true,'Payment Operations lookup job prepares canonical executor');
 ok(!(await svc('operation_job',{actor_id:f.admin,job_id:jid})).claimed,'leased Operations job cannot be executed twice');
 await svc('job_complete',{actor_id:f.admin,job_id:jid,lease:job.job_lease,state:'review'});
 ok((await svc('operation_job',{actor_id:f.admin,job_id:retryid})).automatic_charge===false,'Operations retry requires donor action without automatic charge');
 await db.exec('reset role');await q("insert into private.giving_donor_account_links(organization_id,person_id,user_id,active,verification_reference,verified_household_id)values($1,$2,$3,true,'SYNTHETIC reviewed ownership',$4)on conflict(organization_id,person_id,user_id)do update set active=true,verified_household_id=excluded.verified_household_id",[f.org,f.person,f.donor,f.household]);await as();
 const linked=await svc('create',create({receipt_email:'linked@example.test',actor_id:f.donor})),lp=await prepare(linked,'sale',{actor_id:f.donor});
 await db.exec('reset role');await q('update private.giving_donor_account_links set active=false where user_id=$1',[f.donor]);await as();await assert.rejects(()=>svc('claim',{session_id:linked.session_id,id:lp.id}));ok(true,'same-session donor/household linkage revocation stops dispatch');
 const staffSession=await svc('create',create({receipt_email:'staff-authority@example.test'})),staffOp=await prepare(staffSession,'sale',{actor_id:f.admin,capability_hash:null});
 await db.exec('reset role');await q("update organization_staff_permissions set revoked_at=now()where user_id=$1 and permission='payments.configure'",[f.admin]);await as();await assert.rejects(()=>svc('claim',{session_id:staffSession.session_id,id:staffOp.id}));
 await db.exec('reset role');await q("update organization_staff_permissions set revoked_at=null where user_id=$1 and permission='payments.configure'",[f.admin]);await as();ok(true,'staff-initiated sale rechecks current configure permission instead of borrowing donor capability');
 const expired=await svc('create',create({receipt_email:'expiry@example.test'})),expiredOp=await prepare(expired);await db.exec('reset role');await q("update private.nmi_giving_checkouts set expires_at=now()-interval '1 minute'where session_id=$1",[expired.session_id]);await as();await assert.rejects(()=>svc('claim',{session_id:expired.session_id,id:expiredOp.id}),/Checkout authority expired/);ok(true,'checkout capability expiry is rechecked at handoff');
 // Shutdown stops new money, but scoped cancellation and lookup remain operable.
 await svc('shutdown',{actor_id:f.admin,reason:'SYNTHETIC emergency stop'});await assert.rejects(()=>svc('create',create({receipt_email:'stopped@example.test'})));
 const pause=await prepare(rs,'recurring_pause',{actor_id:f.admin,instruction_id:instruction}),pc=await dispatch(rs,pause);await svc('complete',{session_id:rs.session_id,id:pause.id,lease:pc.lease,status:'paused',authoritative:true,provider_reference:'synthetic-subscription'});
 const cancel=await prepare(rs,'recurring_cancel',{instruction_id:instruction}),cc=await dispatch(rs,cancel);const cancelled=await svc('complete',{session_id:rs.session_id,id:cancel.id,lease:cc.lease,status:'cancelled',authoritative:true,provider_reference:'synthetic-subscription'});
 ok(cancelled.recurring[0].status==='cancelled','pause + cancellation remain safe after new-charge shutdown');
 await db.exec('reset role');await assert.rejects(()=>q('update giving_ledger set amount_minor=1'));await assert.rejects(()=>q('delete from giving_receipts'));ok(true,'posted gifts and receipts remain immutable');
 for(const role of ['anon','authenticated','service_role']){await as(role);await assert.rejects(()=>q('select * from private.nmi_giving_results'));}ok(true,'all raw result access revoked');
 console.log(n+' execution database checks passed');
}catch(e){console.error('EXECUTION FAILURE',e.message,e.where||'');process.exitCode=1}finally{await db.close()}
