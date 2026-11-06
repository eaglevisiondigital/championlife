import {spawn} from 'node:child_process';
import {mkdirSync,openSync,closeSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {analyze} from './analyze.mjs';
const directory=resolve(process.env.DIAGNOSTIC_DIR||'/tmp/staff-cycle12-experiment');
mkdirSync(directory,{recursive:true});
// Never overwrite an execution, including one that failed or was interrupted.
closeSync(openSync(resolve(directory,'RUN-ONCE.lock'),'wx'));
const results=[];
for(const mode of ['auth-after-pagehide','rpc-across-pagehide','settled-before-pagehide']){
 const out=resolve(directory,mode);mkdirSync(out);const log=openSync(resolve(out,'strict-result.log'),'wx');
 const result=await new Promise(resolveResult=>{
  const child=spawn(process.execPath,[fileURLToPath(new URL('./legacy.browser.mjs',import.meta.url))],{env:{...process.env,CYCLE12_ARM:mode,DIAGNOSTIC_DIR:out,DIAGNOSTIC_OBSERVATIONS:'1'},stdio:['ignore',log,log]});
  const timer=setTimeout(()=>child.kill('SIGTERM'),45000);
  child.once('error',error=>{clearTimeout(timer);resolveResult({code:null,error:error.message})});
  child.once('exit',(code,signal)=>{clearTimeout(timer);resolveResult({code,signal})});
 });closeSync(log);
 writeFileSync(resolve(out,'process-result.json'),JSON.stringify(result,null,2)+'\n');
 try{results.push(analyze(out,mode,result.code))}catch(error){results.push({mode,...result,interventionAccepted:false,analysisError:error.message,originalCause:'UNKNOWN'})}
 console.log(JSON.stringify(results.at(-1)));
}
writeFileSync(resolve(directory,'RESULTS.json'),JSON.stringify({hypothesis:'H1 Auth completion before pagehide admits subsequent Forms RPC',results,originalCause:'UNKNOWN',retries:0},null,2)+'\n');
if(results.some(x=>!x.interventionAccepted))process.exitCode=1;
