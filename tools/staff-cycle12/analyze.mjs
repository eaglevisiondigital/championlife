import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
export function analyze(directory,mode,strictExitCode) {
 const read=name=>JSON.parse(readFileSync(resolve(directory,name),'utf8'));
 const intervention=read('intervention.json'),initiation=read('initiation-observations.json'),routes=read('legacy-observations.json');
 const e=intervention.events,issues=[];
 const check=(condition,label)=>{if(!condition)issues.push(label)};
 check(intervention.mode===mode,'arm matches');check(!intervention.overflow&&!initiation.overflow&&!routes.overflow,'bounded logs complete');
 check(intervention.selected&&intervention.completed,'intervention selected and completed');check(intervention.faults.length===0,'no intervention faults');
 check(!e.some(x=>x.kind==='gate-timeout'),'no gate timeout');
 check(e.filter(x=>x.kind==='leave-selected').length===1&&e.filter(x=>x.kind==='leave-release').length===1,'exactly one original leave gated and released');
 const selected=e.find(x=>x.kind==='leave-selected'),pagehide=e.find(x=>x.kind==='pagehide'&&x.documentId===selected?.documentId);
 check(!!pagehide?.trusted,'actual pagehide observed for selected document');
 check(selected?.formsConnected===false,'shared session retired root before selecting leave');
 const released=e.find(x=>x.kind==='leave-release');
 check(released?.documentId===selected?.documentId&&released?.sequence<pagehide?.sequence,'original leave release precedes same-document pagehide');
 if(mode!=='settled-before-pagehide'){
  const resumed=e.find(x=>x.kind===(mode==='auth-after-pagehide'?'release-auth-after-pagehide':'release-rpc-after-pagehide'));
  check(e.indexOf(resumed)>e.indexOf(pagehide)&&!!resumed,'held route resumes only after observed pagehide');
 }else{
  const settled=e.find(x=>x.kind==='refresh-settled');
  check(!!settled&&e.indexOf(settled)<e.indexOf(released),'refresh commit observed before leave release');
 }
 const phase=routes.events.filter(x=>x.phase==='account-replacement'),failures=phase.filter(x=>x.kind==='requestfailed'),pageerrors=routes.events.filter(x=>x.kind==='pageerror');
 const starts=initiation.events.filter(x=>x.kind==='fetch-start'&&x.phase==='account-replacement'&&x.principal==='account-B'&&!x.formsConnected);
 check(starts.some(x=>x.path==='/auth/v1/user'&&x.stack.some(s=>/identity.*forms-context\.js|forms-context\.js:11:/.test(s))&&x.stack.some(s=>/refresh.*forms-context\.js|forms-context\.js:31:/.test(s))),'detached Auth initiation includes original identity/refresh chain');
 const rpcStarts=starts.filter(x=>x.path==='/rest/v1/rpc/forms_workspace');
 const authFailures=failures.filter(x=>x.url.path==='/auth/v1/user'),rpcFailures=failures.filter(x=>x.url.path==='/rest/v1/rpc/forms_workspace');
 if(mode==='auth-after-pagehide') {
  check(rpcStarts.length===0&&!e.some(x=>x.kind==='target-rpc'),'Auth held through pagehide admits no Forms RPC');
  check(authFailures.length===1,'held Auth cancelled by navigation');
 }else if(mode==='rpc-across-pagehide'){
  check(rpcStarts.length===1&&e.filter(x=>x.kind==='target-rpc').length===1,'Auth completion admits exactly one Forms context RPC');
  check(rpcFailures.length===1,'held Forms RPC cancelled by navigation');
 }else{
  check(rpcStarts.length===1&&e.some(x=>x.kind==='refresh-settled'),'full detached refresh completes before navigation');
  check(failures.length===0,'settled negative control has no cancelled backend request');
 }
 check(strictExitCode===0,'unchanged strict driver passes (any failure retained)');
 const result={mode,strictExitCode,interventionAccepted:issues.length===0,issues,detachedAuthStarts:starts.filter(x=>x.path==='/auth/v1/user').length,detachedFormsRpcStarts:rpcStarts.length,failedRequests:failures.map(x=>({requestId:x.requestId,path:x.url.path,failure:x.failure})),pageerrors:pageerrors.map(x=>({message:x.message,stack:x.stack})),originalCause:'UNKNOWN',qualification:'Constructed timer/route intervention, not original incident reproduction or release acceptance'};
 writeFileSync(resolve(directory,'analysis.json'),JSON.stringify(result,null,2)+'\n');return result;
}
if(process.argv[1]===new URL(import.meta.url).pathname){const result=analyze(process.argv[2],process.argv[3],Number(process.argv[4]));console.log(JSON.stringify(result));assert(result.interventionAccepted,'bounded experiment acceptance failed; retain evidence');}
