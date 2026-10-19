import {reconcile} from '../platform/reconcile-manifests.mjs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';import {readFileSync,mkdtempSync,writeFileSync,rmSync,existsSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {buildSite} from '../site-build/build.mjs';import {compose,overlap} from '../platform/compose-gate0.mjs';import {read,pins,source,baseline,gatePath,registry} from './gate0.fixture.mjs';
let n=0;const ok=(v,m)=>{assert.ok(v,m);n++;console.log('PASS '+m);};
for(const f of baseline)assert.equal(read(f),source(pins.production,f));ok(true,'all 25 historical migrations byte-identical');
assert.equal(overlap.length,10);ok(true,'ten overlapping files explicitly owned');
const catalog=JSON.parse(read('config/platform/capabilities.json'));ok(catalog.organization.length===87&&catalog.campaign.length>30&&catalog.partner.length===5,'canonical scoped registry pinned');
for(const modules of [['nmi'],['outreach'],['nmi','outreach']]){
 const dir=path.join('/tmp','gate0-'+randomUUID());try{
 const result=compose(dir,modules);ok(result.modules.length===modules.length,'explicit '+modules.join('+')+' composition');
 const beforeManifest=readFileSync(path.join(dir,'tools/site-build/public-files.json'),'utf8');reconcile(dir,modules,fileURLToPath(new URL('../../',import.meta.url)));assert.equal(readFileSync(path.join(dir,'tools/site-build/public-files.json'),'utf8'),beforeManifest);ok(true,'adoption manifest reconciliation is idempotent');
 const pkg=JSON.parse(readFileSync(path.join(dir,'tools/backend-tests/package.json')));for(const m of modules)ok(!!pkg.scripts['test:frozen:'+m],m+' suite retained');
 const production=await buildSite({root:dir,env:{CONTEXT:'production'}});
 const config=readFileSync(path.join(dir,'dist/assets/js/supabase-config.js'),'utf8');assert.equal(config,read('assets/js/supabase-config.js'));ok(true,'production backend config unchanged');
 const manifest=JSON.parse(readFileSync(path.join(dir,'tools/site-build/public-files.json')));const shell=readFileSync(path.join(dir,'dist/assets/js/staff-workspace.js'),'utf8');ok(!shell.includes('/* GATE0_ROUTES */ []'),'routes injected from published artifact');
 ok(!manifest.some(p=>/^(docs|tools|audit|supabase|config)\//.test(p)),'private files excluded');
 for(const p of ['index.html','outreach-register.html','discipleship-login.html','assets/js/champion-life-auth.js'])assert.equal(readFileSync(path.join(dir,'dist',p),'utf8'),read(p));ok(true,'public home, Huntsville header and Auth unchanged');
 for(const branch of ['codex/shared-platform-gate0','codex/nmi-giving-friday-cutover','codex/unified-outreach-production-v1','codex/unified-outreach-gate0-reconciliation','codex/nmi-gate0-reconciliation','unregistered-candidate']){
 const preview=await buildSite({root:dir,env:{CONTEXT:'deploy-preview',BRANCH:branch,CHAMPION_PREVIEW_SUPABASE_URL:'https://bkbmjisprwmkptywtmih.supabase.co',CHAMPION_PREVIEW_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic_only',NMI_SANDBOX_COMPONENT_ENABLED:'true'}});ok(preview.backend==='blocked',branch+' refuses fallback shared/production target');}

 const fresh='zzzzzzzzzzzzzzzzzzzz',pinFile=path.join(dir,'config/platform/acceptance-targets.json'),targets=JSON.parse(readFileSync(pinFile));targets.branches['synthetic-review']='zzzzzzzzzzzzzzzzzzzz';writeFileSync(pinFile,JSON.stringify(targets));
 const approved={CONTEXT:'deploy-preview',HEAD:'synthetic-review',CHAMPION_PREVIEW_SUPABASE_URL:'https://'+fresh+'.supabase.co',CHAMPION_PREVIEW_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic_only'};
 ok((await buildSite({root:dir,env:approved})).backend==='isolated-preview','explicit fresh target pin supports isolated preview');
 ok((await buildSite({root:dir,env:{...approved,HEAD:'unknown',BRANCH:'synthetic-review'}})).backend==='blocked','unknown PR source cannot inherit pinned base branch');
 if(modules.includes('outreach')){
  const nested=path.join('/tmp','gate0-'+randomUUID());try{writeFileSync(path.join(dir,'untracked-child-only.txt'),'must not be copied');compose(nested,['nmi'],dir,fileURLToPath(new URL('../../',import.meta.url)));reconcile(nested,['nmi'],fileURLToPath(new URL('../../',import.meta.url)));ok(!existsSync(path.join(nested,'untracked-child-only.txt'))&&!existsSync(path.join(nested,'supabase/migrations/20261019004613_unified_outreach_operations.sql')),'adopted Outreach checkout cannot contaminate NMI-only composition');const np=JSON.parse(readFileSync(path.join(nested,'tools/backend-tests/package.json')));ok(!np.scripts['test:frozen:outreach']&&!!np.scripts['test:frozen:nmi'],'adopted composition excludes sibling test scripts');}finally{rmSync(nested,{recursive:true,force:true});}
 }
 const bad=[...manifest,'docs/SECURITY_MODEL.md'];writeFileSync(path.join(dir,'tools/site-build/public-files.json'),JSON.stringify(bad));await assert.rejects(()=>buildSite({root:dir,env:{CONTEXT:'production'}}));ok(true,'private-manifest poisoning rejected');
 }finally{rmSync(dir,{recursive:true,force:true});}
}
console.log(n+' Gate0 composition/build checks passed');
