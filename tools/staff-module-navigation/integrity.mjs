// Preserve the original90 ->102 source comparison alongside the independently
// pinned Cycle8 current-build verifier. Historical manifests are not rewritten.
import assert from'node:assert/strict';import{execFileSync}from'node:child_process';import{createHash}from'node:crypto';
import{checkpointReader}from'../staff-host-cycle8/overrides.mjs';
import'../staff-host-cycle8/integrity.mjs';
const base='4f64fa14f03098e31ee8111c8ff1810fbc260542',sha=b=>createHash('sha256').update(b).digest('hex'),show=p=>execFileSync('git',['--no-replace-objects','show',base+':'+p],{maxBuffer:64*1024*1024}),checkpoint=checkpointReader();let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;console.log('PASS '+m)};
for(const p of['staff-home.html','staff-people.html','staff-outreach-registration.html','assets/js/staff-session.js','assets/js/champion-life-auth.js','assets/js/supabase-config.js','assets/js/outreach-registration-staff.js','assets/css/staff-workspace.css','assets/css/staff-portal.css','assets/css/outreach-campaigns.css','tools/site-build/public-files.json',...execFileSync('git',['ls-tree','-r','--name-only',base,'supabase/migrations'],{encoding:'utf8'}).trim().split('\n')])ok(checkpoint(p).equals(show(p)),'protected original102 checkpoint source unchanged '+p);
const paths=JSON.parse(checkpoint('tools/site-build/public-files.json')),changed=paths.filter(p=>sha(checkpoint(p))!==sha(show(p)));assert.deepEqual(changed.sort(),['assets/js/outreach-people.js','assets/js/staff-workspace.js']);ok(true,'original102 only two reviewed runtime changes remain bound');
console.log(JSON.stringify({checks,historicalPublicFiles:paths.length,changed,currentBuildVerifiedBy:'tools/staff-host-cycle8/integrity.mjs',providerAcceptance:false}));
