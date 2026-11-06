// Test-only additive CSS inputs. Original76 pins and loader are unchanged.
import {loadSource as originalLoad} from '../staff-cycle7/source.mjs';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const css=Object.freeze({
  "formsCss": {
    "commit": "32605a00753c8c60076c5aa6742a770c710b0354",
    "path": "assets/css/forms.css",
    "sha256": "d51179feca384acca12f1c46df791744d9ce064eadf461b71e33bca27f1cd3c5"
  },
  "eventsCss": {
    "commit": "e4058f70232f2adddd4328dd76aec47cef724c22",
    "path": "assets/css/events.css",
    "sha256": "77c10ba67bc65b9a1168640e25f25ce75161ef02dd97256520a49fe1ead6c1e2"
  }
});
export function loadSource(id){
 if(process.env.HOST_SOURCE_ROOT&&id==='shell'){
  const host=pathToFileURL(process.env.HOST_SOURCE_ROOT.replace(/\/$/,'')+'/');
  if(readFileSync(new URL('assets/js/staff-session.js',host),'utf8')!==originalLoad('sharedSession'))throw Error('CANDIDATE_SESSION_NOT_EXACT97');
  return readFileSync(new URL('assets/js/staff-workspace.js',host),'utf8');
 }
 if(!Object.hasOwn(css,id))return originalLoad(id);
 const row=css[id],root=new URL('../../',import.meta.url);
 const mode=execFileSync('git',['--no-replace-objects','ls-tree',row.commit,'--',row.path],{cwd:root,encoding:'utf8'});
 if(!/^100644 blob [0-9a-f]{40}\t/.test(mode)||mode.trim().split('\t')[1]!==row.path)throw Error('CSS_NOT_REGULAR_BLOB');
 const bytes=execFileSync('git',['--no-replace-objects','show',row.commit+':'+row.path],{cwd:root});
 if(createHash('sha256').update(bytes).digest('hex')!==row.sha256)throw Error('CSS_HASH_MISMATCH');
 return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
