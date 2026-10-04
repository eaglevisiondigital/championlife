import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const read=f=>fs.readFileSync(new URL('../../'+f,import.meta.url),'utf8');
const base='https://deploy-preview-2--championlifechurch.netlify.app/discipleship-login.html';
// These templates intentionally use only exact RedirectTo equality conditionals.
// Native Go-engine execution is also supplied in dream-email-templates.go.
function render(source,redirect){
 const stack=[];let active=true,result='';
 for(const part of source.split(/({{[\s\S]*?}})/)){
  const command=part.match(/^{{\s*(.*?)\s*}}$/)?.[1];
  if(command===undefined){if(active)result+=part;continue;}
  const condition=command.match(/^(if|else if) eq \.RedirectTo "([^"]+)"$/);
  if(condition){if(condition[1]==='if')stack.push({parent:active,matched:false});const frame=stack.at(-1);active=frame.parent&&!frame.matched&&redirect===condition[2];frame.matched ||= active;}
  else if(command==='else'){const frame=stack.at(-1);active=frame.parent&&!frame.matched;frame.matched=true;}
  else if(command==='end'){active=stack.pop().parent;}
  else if(active){assert(['.Token','.ConfirmationURL','.RedirectTo'].includes(command));result+=command==='.RedirectTo'?redirect:command==='.Token'?'12345678':'https://acceptance.example/verify?synthetic=true';}
 }
 assert.equal(stack.length,0);return result;
}
const baseline=JSON.parse(fs.readFileSync(new URL('fixtures/dream-team-auth-fallback.json',import.meta.url)));
let count=0;
for(const kind of ['confirmation','magic-link'])for(const suffix of ['.html','.subject.txt']){
 const file=kind+suffix,source=read('supabase/templates/'+file);
 for(const context of ['online','invitation']){
  const result=render(source,base+'?next=%2Fdream-team-application.html&source='+context);
  assert.match(result,/Champion Life/);assert.match(result,/Dream Team/);
  if(suffix==='.html'){assert.match(result,/START DREAM TEAM APPLICATION/);assert.match(result,/https:\/\/championlifefwb.com\/assets\/images\/logo-gold.png/);assert.match(result,/12345678/);assert.match(result,/https:\/\/acceptance.example\/verify/);}
  count++;
 }
 for(const redirect of [base,'https://evil.example',base+'?next=%2Fdream-team-application.html&source=online&extra=1']){
  const rawFallback=source.split('{{ else }}').at(-1).replace(/{{ end }}{{ end }}$/, '');assert.equal(createHash('sha256').update(rawFallback).digest('hex'),baseline[file]);assert(!render(source,redirect).includes('Dream Team'));count++;
 }
 assert.match(render(source,base+'?next=%2Fdream-track-invite.html'),/Dream Track/);
}
const login=read('discipleship-login.html'),ctx={URL,location:{origin:'https://preview.example'}};vm.createContext(ctx);
vm.runInContext(login.slice(login.indexOf('  function safeNext(value)'),login.indexOf('  const next = safeNext')),ctx);
for(const route of ['/dream-team-application.html','/staff-dream-team.html']){
 assert.equal(ctx.safeNext(route+'?next=//evil.example'),route);
 assert.equal(ctx.safeNext('https://evil.example'+route),'/my-discipleship.html');
 assert.equal(ctx.safeNext('//evil.example'+route),'/my-discipleship.html');count++;
}
console.log(`PASS ${count} application email scope, original Auth fallback, approved logo and safe redirect checks`);
