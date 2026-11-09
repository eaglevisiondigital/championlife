// Reuse immutable accepted canonical fixtures. Never an installer.
import {execFileSync} from 'node:child_process';
const root=new URL('../../',import.meta.url);
export const pins={forms:'32605a00753c8c60076c5aa6742a770c710b0354',events:'e4058f70232f2adddd4328dd76aec47cef724c22'};
export const source=(lane,path)=>execFileSync('git',['--no-replace-objects','show',pins[lane]+':'+path],{cwd:root,maxBuffer:80*1024*1024});
const moduleUrl=text=>'data:text/javascript;base64,'+Buffer.from(text).toString('base64');
const order=moduleUrl(source('forms','tools/backend-tests/migration-order.mjs'));
let text=source('forms','tools/forms-core/fixture.mjs').toString()
 .replace("'../backend-tests/migration-order.mjs'",JSON.stringify(order))
 .replace("export const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');","export const read=p=>source('forms',p).toString();");
text="import {source} from "+JSON.stringify(import.meta.url)+";\n"+text;
// Avoid a circular top-level await: export source before fixture evaluation.
export async function fixture(){return import(moduleUrl(text));}
