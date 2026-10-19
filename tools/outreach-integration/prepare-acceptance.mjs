// Read-only package builder: never connects to Supabase, repairs a ledger or applies SQL.
import {readFileSync,readdirSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),out=process.argv[2];
if(!out||!path.isAbsolute(out)||existsSync(out))throw Error('Supply a new absolute disposable output directory.');
const manifest=JSON.parse(readFileSync(path.join(root,'docs/UNIFIED-OUTREACH-PRODUCTION-BASELINE.json'),'utf8'));
const migrations=path.join(root,'supabase/migrations'),staged=[];
for(const item of manifest.migrations){let sql=readFileSync(path.join(migrations,item.sourceFile),'utf8');if(item.sourceNormalization==='trim-final-newline')sql=sql.replace(/\n$/,'');if(createHash('md5').update(sql).digest('hex')!==item.sql_md5)throw Error('Production baseline SQL mismatch '+item.sourceFile);staged.push({file:item.version+'_'+item.name+'.sql',sql,source:item.sourceFile});}
const last=manifest.migrations.at(-1).version;
for(const file of readdirSync(migrations).filter(f=>/^20261019\d{6}_unified_outreach_.*\.sql$/.test(f)).sort()){if(file.slice(0,14)<=last)throw Error('Candidate is not forward-only');staged.push({file,sql:readFileSync(path.join(migrations,file),'utf8'),source:file});}
if(staged.length!==29)throw Error('Expected 25 exact production versions + four reviewed forward migrations');
const dest=path.join(out,'supabase/migrations');mkdirSync(dest,{recursive:true});for(const f of staged)writeFileSync(path.join(dest,f.file),f.sql);
writeFileSync(path.join(out,'PACKAGE.json'),JSON.stringify({productionCommit:manifest.productionCommit,files:staged.map(f=>({file:f.file,source:f.source,sha256:createHash('sha256').update(f.sql).digest('hex')})),warning:'ISOLATED ACCEPTANCE ONLY. No credentials or customer data. No automatic application.'},null,2)+'\n');
console.log(JSON.stringify({output:out,migrations:staged.length,productionVersions:25,forwardVersions:4,applied:false}));
