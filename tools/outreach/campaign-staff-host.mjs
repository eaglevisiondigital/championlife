// Nonproduction composition only. Does not write or alter public assets/build inputs.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(readFileSync(new URL('./campaign-staff-host-sources.json',import.meta.url)));
assert.equal(manifest.staffCommit,'95723fae9d4cbc16eb80e350191495b4d37d4498');
assert.equal(manifest.deskCommit,'8b9d6ae93737f87601a8486d5db8fc88ace2806b');
export function staffHostSource(path){
 const row=manifest.files.find(r=>r.path===path);assert(row,'Only reviewed host paths');
 const tree=execFileSync('git',['--no-replace-objects','ls-tree',manifest.staffCommit,'--',path],{cwd:root,encoding:'utf8'});assert(tree.startsWith('100644 blob '));
 const b=execFileSync('git',['--no-replace-objects','show',manifest.staffCommit+':'+path],{cwd:root,maxBuffer:8*1024*1024});assert.equal(sha(b),row.sha256,'Exact Staff126 '+path);return b;
}
export function composeCampaignStaffHost(projectRef){
 assert(typeof projectRef==='string'&&/^[a-z]{20}$/.test(projectRef)&&projectRef!=='exdocjbmylgxssanymjk','Explicit nonproduction project required');
 let shell=staffHostSource('assets/js/staff-workspace.js').toString();
 const replace=(old,next)=>{assert.equal(shell.split(old).length,2,'One exact reviewed insertion: '+old.slice(0,70));shell=shell.replace(old,next)};
 replace("const page=document.body.dataset.staffWorkspace,auth=window.ChampionLifeAuth;",`const page=document.body.dataset.staffWorkspace,auth=window.ChampionLifeAuth;
 const decisionProject=${JSON.stringify(projectRef)},decisionUrl='https://'+decisionProject+'.supabase.co';
 const decisionPin=()=>auth?.client===client&&auth.client.supabaseUrl===decisionUrl&&auth.client.auth.url===decisionUrl+'/auth/v1'&&auth.client.rest?.url===decisionUrl+'/rest/v1';
 let decisionView=null,decisionMissing=false;`);
 replace("window.dispatchEvent(new Event('staff-protected-clear'));","if(decisionView){decisionView.close();decisionView=null;}\n  window.dispatchEvent(new Event('staff-protected-clear'));");
 replace("nav.replaceChildren(link('Staff home','staff-home.html'));","nav.replaceChildren(link('Staff home',params.get('desk')==='decisions'?'staff-home.html?context=outreach&campaign='+encodeURIComponent(selected.id):'staff-home.html'));");
 replace("const communication=page==='communications';",`const communication=page==='communications';
  if(params.has('desk')&&(page!=='home'||params.getAll('desk').length!==1||params.get('desk')!=='decisions'||params.get('context')!=='outreach'||['org','organization','person'].some(k=>params.has(k))))throw Error('Invalid decision route');
  if(params.get('desk')==='decisions'&&decisionMissing){stop('Decision follow-up backend is not installed.');throw Error('Missing decision directory');}`);
 replace("page==='registration'?snapshot.registration:snapshot.campaigns;","page==='registration'?snapshot.registration:params.get('desk')==='decisions'?snapshot.decisions:snapshot.campaigns;");
 replace("route.searchParams.set(key,selected.id);history.replaceState", "route.searchParams.set(key,selected.id);if(params.get('desk')==='decisions')route.searchParams.set('desk','decisions');history.replaceState");
 replace("...communicationEntries(snapshot,selected.id,true)];","...communicationEntries(snapshot,selected.id,true),...(snapshot.decisions.some(row=>row.id===selected.id)?[['Decision follow-up','staff-home.html?context=outreach&campaign='+encodeURIComponent(selected.id)+'&desk=decisions']]:[])];");
 replace("'staff-home.html?context='+context+'&'+key+'='+encodeURIComponent(id):","'staff-home.html?context='+context+'&'+key+'='+encodeURIComponent(id)+(params.get('desk')==='decisions'?'&desk=decisions':''):");
 replace("const [staff,registration,forms,communications]=await Promise.all([discover('staff_workspace_context',{}),discover('outreach_registration_workspace',{p_action:'campaigns',p_campaign:null,p_payload:{}}),optionalForms(),optionalCommunications()]);",`const optionalDecisions=async()=>{
    if(!decisionPin())throw Error('Nonproduction decision project mismatch');
    const {projectCampaignDirectory}=await import('/tools/outreach/campaign-workspace-mount.mjs');
    if(stopped||generation!==epoch)return [];
    if(!decisionPin())throw Error('Nonproduction decision project changed');
    let response;try{response=await originalRpc('campaign_decision_directory')}catch(error){if(denied({error,status:error?.status})){stop('Access is no longer available.');throw error}throw Error('Decision discovery unavailable')}
    if(stopped||generation!==epoch)return [];
    if(!decisionPin())throw Error('Nonproduction decision project changed');
    if(denied(response)){stop('Access is no longer available.');throw Error('Decision access denied')}
    if(response?.error?.code==='PGRST202'){decisionMissing=true;return []}
    if(response?.error)throw Error('Decision discovery unavailable');
    decisionMissing=false;return projectCampaignDirectory(response?.data).map(row=>({id:row.campaignId,organization_id:row.organizationId,name:row.name}));
   };
   const [staff,registration,forms,communications,decisions]=await Promise.all([discover('staff_workspace_context',{}),discover('outreach_registration_workspace',{p_action:'campaigns',p_campaign:null,p_payload:{}}),optionalForms(),optionalCommunications(),optionalDecisions()]);`);
 replace("const snapshot={grants,forms,communications,registration:campaigns,campaigns:[...new Map([...campaigns,...communications.campaigns].map(c=>[c.id,c])).values()],organizations:[]};",`const scopes=[...campaigns,...communications.campaigns,...decisions];
   for(const d of decisions)if(scopes.some(c=>c.id===d.id&&c.organization_id!==d.organization_id))throw Error('Conflicting campaign owner');
   const snapshot={grants,forms,communications,decisions,registration:campaigns,campaigns:[...new Map(scopes.map(c=>[c.id,c])).values()],organizations:[]};
   if(params.get('desk')==='decisions'&&decisionMissing){stop('Decision follow-up backend is not installed.');return}`);
 replace("if(initial){show(snapshot);fingerprint=current;active=true;main.hidden=false;message.textContent='';",`if(initial){show(snapshot);fingerprint=current;active=true;main.hidden=false;message.textContent='';
    if(params.get('desk')==='decisions'){
     const {mountCampaignDecisionWorkspace}=await import('/tools/outreach/campaign-workspace-mount.mjs');
     if(stopped||generation!==epoch)return;
     if(!decisionPin())throw Error('Nonproduction decision project changed');
     const selected=decisions.find(row=>row.id===params.get('campaign'));if(!selected)throw Error('No assigned decision campaign');
     decisionView=mountCampaignDecisionWorkspace({root:document.getElementById('staff-home-links'),auth,workspace:window.StaffWorkspace,eventTarget:window,projectRef:decisionProject});
     await decisionView.refresh();if(stopped||generation!==epoch)return;
     await decisionView.select(selected.organization_id,selected.id);if(stopped||generation!==epoch)return;
    }`);
 return {home:staffHostSource('staff-home.html').toString(),shell,projectRef};
}
