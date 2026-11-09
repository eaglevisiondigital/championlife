#!/usr/bin/env node
import {readFileSync,mkdirSync,writeFileSync,realpathSync,statSync} from 'node:fs';
import {resolve,relative,sep,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {dryRun} from './staging.mjs';
import {fixture,authority} from './fixture.mjs';
import {html} from './report.mjs';
const [mode,input,output,prior]=process.argv.slice(2);
if(!['demo','synthetic'].includes(mode)||!input||mode==='synthetic'&&!output)throw Error('Usage: cli.mjs demo /private/output OR cli.mjs synthetic bundle.json /private/output [prior-report.json]');
const repo=realpathSync(fileURLToPath(new URL('../../../',import.meta.url))),requested=resolve(mode==='demo'?input:output),out=resolve(realpathSync(dirname(requested)),basename(requested));
if(!relative(repo,out).startsWith('..'+sep))throw Error('Private reports must remain outside the repository');
const readJson=path=>{const stat=statSync(path);if(!stat.isFile()||stat.size>20_000_000)throw Error('BOUNDED_REGULAR_INPUT_REQUIRED');return JSON.parse(readFileSync(path,'utf8'))};
const bundle=mode==='demo'?fixture():readJson(input);
const previous=prior?readJson(prior).snapshot:null;
const report=dryRun(bundle,authority,previous),replay=dryRun(bundle,authority,report.snapshot);
if(replay.counts.added!==0)throw Error('REPLAY_CHANGED_STAGING');
mkdirSync(out,{recursive:false,mode:0o700});
for(const [name,data]of [['report.json',JSON.stringify(report,null,2)],['report.html',html(report)],['replay.json',JSON.stringify(replay,null,2)],['synthetic-input.json',JSON.stringify(bundle,null,2)]])writeFileSync(resolve(out,name),data,{mode:0o600,flag:'wx'});
console.log(JSON.stringify({report:resolve(out,'report.html'),local:report.localReconciliation,added:report.counts.added,replayAdded:replay.counts.added,release:'HOLD',providerCalls:0,ledgerWrites:0}));
