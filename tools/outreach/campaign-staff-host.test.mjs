import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {composeCampaignStaffHost,staffHostSource} from './campaign-staff-host.mjs';
import {projectCampaignDirectory} from './campaign-workspace-mount.mjs';
let checks=0;const check=(v,label)=>{assert(v,label);checks++;console.log('PASS '+label)};
const base='8b9d6ae93737f87601a8486d5db8fc88ace2806b',root=new URL('../../',import.meta.url);
for(const value of [undefined,null,'','exdocjbmylgxssanymjk','https://abcdefghijklmnopqrst.supabase.co','ABCDEFGHIJKLMNOPQRST','abcdefghijklmnopqrst.evil']){assert.throws(()=>composeCampaignStaffHost(value));checks++}
assert.throws(()=>staffHostSource('assets/js/supabase-config.js'));checks++;
const a=composeCampaignStaffHost('abcdefghijklmnopqrst'),b=composeCampaignStaffHost('abcdefghijklmnopqrst');check(a.shell===b.shell&&a.home===b.home,'Deterministic exact-source composition');
check(a.home===staffHostSource('staff-home.html').toString(),'Actual126 HTML, scripts, SRI and branding unchanged');
check(!a.shell.includes('createClient('),'No second shared Auth client');
check(a.shell.includes("params.get('desk')==='decisions'")&&a.shell.includes('projectCampaignDirectory(response?.data)'),'Route uses canonical directory projection');
check(a.shell.includes("if(denied(response)){stop('Access is no longer available.');throw Error('Decision access denied')}"),'No directory-denial downgrade');
check(a.shell.includes("if(!decisionPin())throw Error('Nonproduction decision project changed');"),'Late module import cannot mount retired host');
for(const action of ['learner_status','people_workspace','followup_save'])check(!a.shell.includes(action),'Host adds no '+action+' action');
check(a.shell.includes("if(decisionView){decisionView.close();decisionView=null;}"),'Host retirement disposes existing view');
for(const bad of [null,{}, {kind:'assigned-decision-campaign-directory',campaigns:[{organization_id:'bad'}]}, {kind:'assigned-decision-campaign-directory',campaigns:[],grants:['people.read']}]){assert.throws(()=>projectCampaignDirectory(bad));checks++}
const paths=JSON.parse(readFileSync(new URL('../site-build/public-files.json',import.meta.url)));
for(const path of paths){const old=execFileSync('git',['--no-replace-objects','show',base+':'+path],{cwd:root,maxBuffer:20*1024*1024});assert.deepEqual(readFileSync(new URL(path,root)),old,path)}
check(paths.every(p=>!p.startsWith('tools/')),'Host/desk composition cannot enter public build');
console.log(JSON.stringify({passed:checks,publicUnchanged:paths.length,sourceOnly:true,release:'NO-GO'}));
