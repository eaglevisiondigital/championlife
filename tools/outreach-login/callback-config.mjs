// Pure review/preflight tooling. No network, credentials, provider client or mutation.
import {isDeepStrictEqual} from 'node:util';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export const target=Object.freeze({
 projectRef:'exdocjbmylgxssanymjk',
 siteUrl:'https://championlifefwb.com',
 existingCallback:'https://championlifefwb.com/discipleship-login.html',
 outreachCallback:'https://championlifefwb.com/outreach-login.html'
});
const beforeList=target.existingCallback;
const afterList=beforeList+','+target.outreachCallback;
function refuse(code){const e=new Error('Auth callback configuration review refused.');e.code=code;throw e}
function record(value){return value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value))}
function baselineGuard(projectRef,baseline){
 if(projectRef!==target.projectRef)refuse('TARGET');
 if(!record(baseline)||baseline.site_url!==target.siteUrl||baseline.uri_allow_list!==beforeList)refuse('BASELINE_DRIFT');
}
function exactSnapshot(actual,expected){
 // Includes every caller-supplied field, even unknown future settings. Never print
 // either snapshot or raw comparison diagnostics, which might contain credentials.
 if(!record(actual)||!isDeepStrictEqual(actual,expected))refuse('CONFIG_DRIFT');
}
export function prepareCallbackChange({projectRef,baseline}){
 baselineGuard(projectRef,baseline);
 return Object.freeze({
  status:'PROPOSAL_ONLY',projectRef,
  endpoint:'/v1/projects/'+projectRef+'/config/auth',
  preconditions:Object.freeze({site_url:target.siteUrl,uri_allow_list:beforeList}),
  patch:Object.freeze({uri_allow_list:afterList}),
  rollbackPatch:Object.freeze({uri_allow_list:beforeList}),
  changedFields:Object.freeze(['uri_allow_list']),
  providerWritePerformed:false
 });
}
export function assertCallbackAdded({projectRef,baseline,current}){
 baselineGuard(projectRef,baseline);
 exactSnapshot(current,{...baseline,uri_allow_list:afterList});
 return true;
}
export function prepareCallbackRollback(input){
 // Rollback requires the exact recorded baseline plus our sole addition. Abort
 // after any later drift; never replay a stale full configuration snapshot.
 assertCallbackAdded(input);
 return Object.freeze({uri_allow_list:beforeList});
}
export function assertCallbackRestored({projectRef,baseline,current}){
 baselineGuard(projectRef,baseline);exactSnapshot(current,baseline);return true;
}
export const proposal=prepareCallbackChange({projectRef:target.projectRef,baseline:{site_url:target.siteUrl,uri_allow_list:beforeList}});

async function main(args){
 if(args.length===1&&args[0]==='--plan'){console.log(JSON.stringify(proposal,null,2));return}
 if(args.length!==2||args[0]!=='--check')refuse('USAGE');
 const input=JSON.parse(await readFile(args[1],'utf8'));
 if(!record(input))refuse('INPUT');
 const {mode,...snapshot}=input;
 if(mode==='before')prepareCallbackChange({projectRef:snapshot.projectRef,baseline:snapshot.baseline});
 else if(mode==='after')assertCallbackAdded(snapshot);
 else if(mode==='rollback')prepareCallbackRollback(snapshot);
 else if(mode==='restored')assertCallbackRestored(snapshot);
 else refuse('MODE');
 console.log(JSON.stringify({status:'PASS',mode,projectRef:target.projectRef,providerWritePerformed:false}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main(process.argv.slice(2)).catch(e=>{
  const code=['TARGET','BASELINE_DRIFT','CONFIG_DRIFT','USAGE','INPUT','MODE'].includes(e?.code)?e.code:'INPUT';
  console.error('REFUSED '+code+'; no provider write performed.');process.exitCode=1;
 });
}
