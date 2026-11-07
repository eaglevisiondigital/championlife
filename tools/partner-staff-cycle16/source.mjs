// Exact-source test composition; runtime adoption is verified separately.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
export const base='7fde897cdbb6ae423cfdeec434a3b548fbc5aa4d';
export const partner='4cf2328caeec341b904a60bdd8c0889f66f77d55';
export const root=new URL('../../',import.meta.url);
export const paths=['staff-outreach-partners.html','assets/js/staff-outreach-partners.js','assets/js/staff-session.js'];
export const sdkURL='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0';
export const sdkSHA='bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af';
export const hash=b=>createHash('sha256').update(b).digest('hex');
const cache=new Map();
export function original(path,ref=base){const key=ref+':'+path;if(!cache.has(key))cache.set(key,execFileSync('git',['--no-replace-objects','show',key],{cwd:root,maxBuffer:64*1024*1024}));return Buffer.from(cache.get(key))}
export function expected(path){
 if(!paths.includes(path))return original(path);
 if(path===paths[2]){const text=original(path).toString(),marker="    '/staff-events.html':['/staff-events.html','org'],";assert.equal(text.split(marker).length,2);return Buffer.from(text.replace(marker,"    '/staff-outreach-partners.html':['/staff-outreach-partners.html','org'],\n"+marker))}
 const bytes=original(path,partner);
 assert.equal(hash(bytes),path===paths[0]?'4c348261b8e3df59339ae9f35455ce052ffae9910c2796ce80e504129e12380f':'882353144889d444f3bf146980a3faf2c43a760c5c1012738d972597f6adb897');
 if(path===paths[1]){
  const old=" const signIn=()=>el('a','Sign in to your workspace',{href:'discipleship-login.html?next=%2Fstaff-outreach-partners.html'});";
  const replacement=" const signIn=()=>{const values=new URLSearchParams(location.search).getAll('org');let next='/staff-outreach-partners.html';if(values.length){const hint=values.length===1&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(values[0])?values[0]:'unavailable';next+='?org='+encodeURIComponent(hint);}return el('a','Sign in to your workspace',{href:'discipleship-login.html?next='+encodeURIComponent(next)});};";
  let text=bytes.toString();
  const changes=[
   [old,replacement],
   ["removedNodes.add(node);if(node===root","removedNodes.add(node);for(const control of node.querySelectorAll?.('button,select,a')||[])removedNodes.add(control);if(node===root"],
   ["const latest=await rpc('staff_workspace_context',{});","const latest=await rpc('staff_workspace_context',{},link);"],
   ["if(!live()||g!==generation||org!==organization)return;","if(!live()||g!==generation||org!==organization||!currentControl(link))return;"],
   ["async function rpc(name,args){","async function rpc(name,args,control=null){"],
   ["const g=generation;try{\n  const session=await auth.getSession();","const g=generation,guard=()=>{if(control&&!currentControl(control))throw Error('Action retired.');};try{guard();\n  const session=await auth.getSession();"],
   ["throw Object.assign(Error('Session expired.'),{status:401});\n  const {data,error,status:code}=await client.rpc(name,args);","throw Object.assign(Error('Session expired.'),{status:401});\n  guard();const {data,error,status:code}=await client.rpc(name,args);"],
   ["  const finalSession=await auth.getSession();","  guard();const finalSession=await auth.getSession();"],
   ["throw Object.assign(Error('Session changed.'),{status:401});return data;","throw Object.assign(Error('Session changed.'),{status:401});guard();return data;"],
   ["if(g===generation)failure(error.status,error.reason);throw error;","if(g===generation&&([401,403].includes(error.status)||!control||currentControl(control)))failure(error.status,error.reason);throw error;"],
   ["const intake=(action,data={})=>rpc('outreach_partner_workspace',{p_org:org,p_action:action,p_data:data});","const intake=(action,data={},control=null)=>rpc('outreach_partner_workspace',{p_org:org,p_action:action,p_data:data},control);"],
   ["try{await action()}catch","try{await action(b)}catch"],
   ["const act=async(action,data={})=>{await intake(action,{id,revision:r.revision,...data});await detail(id)};","const act=async(action,data={},control=null)=>{await intake(action,{id,revision:r.revision,...data},control);if(control&&!currentControl(control))return;await detail(id)};"],
   ["button('Mark reviewed',()=>act('review'))","button('Mark reviewed',control=>act('review',{},control))"],
   ["button('Create follow-up task',()=>act('followup'))","button('Create follow-up task',control=>act('followup',{},control))"],
   ["button('Search People',async()=>{","button('Search People',async control=>{"],
   ["p_payload:{search:find.i.value,offset:0}});if(g!==generation)return;","p_payload:{search:find.i.value,offset:0}},control);if(g!==generation||!currentControl(control))return;"],
   ["button('Link reviewed contact',async()=>{","button('Link reviewed contact',async control=>{"],
   ["await act('link',{person_id:p.id})","await act('link',{person_id:p.id},control)"],
   ["button('Create contact after review',async()=>{","button('Create contact after review',async control=>{"],
   ["await act('create_contact')","await act('create_contact',{},control)"]
  ];
  for(const[before,after]of changes){assert.equal(text.split(before).length,2,'Exact Partner transformation '+before);text=text.replace(before,after)}
  return Buffer.from(text);
 }
 const text=bytes.toString(),old=sdkURL+'/dist/umd/supabase.js';assert.equal(text.split(old).length,2);
 // Existing Nov3 accepted artifact is package-root bytes, not direct-file CDN bytes.
 return Buffer.from(text.replace(old,sdkURL));
}
export function readSelected(path){return process.env.PARTNER_TEST_COMPOSITION==='1'?expected(path):readFileSync(new URL(path,root))}
export function verifyRuntimeAdoption(){for(const path of paths)assert.deepEqual(readFileSync(new URL(path,root)),expected(path),'Exact bounded Partner adoption '+path);return {base,partner,derivedHTML:hash(expected(paths[0])),runtime:hash(expected(paths[1])),hostedAcceptance:false}}
