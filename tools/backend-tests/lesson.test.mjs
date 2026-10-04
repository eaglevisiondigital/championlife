import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const code=readFileSync(new URL('../../assets/js/champion-life-auth.js',import.meta.url),'utf8');
let active={id:'alice',email:'alice@example.test'}, writes=[], switchOnCourse=false;
const client={auth:{getSession:async()=>({data:{session:{user:active}}})},from(table){
  const q={select(){return q},eq(){return q},order(){return q},upsert(row){writes.push({table,row});return q},
    single(){return q},maybeSingle(){return q},then(resolve){
      let data=table==='courses'?{id:1}:table==='lesson_progress'?{status:'completed',completed_at:'2026-01-01'}:{};
      if(table==='courses'&&switchOnCourse) active={id:'bob',email:'bob@example.test'};
      return Promise.resolve({data,error:null}).then(resolve);
    }};return q;
}};
const window={CHAMPION_LIFE_SUPABASE:{url:'test',publishableKey:'test'},supabase:{createClient:()=>client}};
vm.runInNewContext(code,{window,console});
const auth=window.ChampionLifeAuth;
await auth.saveLesson({expectedUserId:'alice',lessonNumber:1,answers:{1:'',2:'hello'},notes:''});
assert.equal(writes.find(w=>w.table==='lesson_answers').row[0].answer,'');
assert.equal(writes.find(w=>w.table==='lesson_progress').row.notes,'');
assert.equal(writes.find(w=>w.table==='lesson_progress').row.status,'completed');
writes=[];
await assert.rejects(auth.saveLesson({expectedUserId:'bob',lessonNumber:1,answers:{1:'private'}}));
assert.equal(writes.length,0);
writes=[];
await auth.saveLesson({expectedUserId:'alice',lessonNumber:1,answers:{}});
assert.equal('notes' in writes.find(w=>w.table==='lesson_progress').row,false);
// New instance to clear cached course; account changes after the first identity read.
vm.runInNewContext(code,{window,console});writes=[];switchOnCourse=true;
await window.ChampionLifeAuth.saveLesson({expectedUserId:'alice',lessonNumber:1,answers:{1:'Alice answer'},profile:{firstName:'Alice'}});
assert.ok(writes.every(w=>(Array.isArray(w.row)?w.row:[w.row]).every(r=>r.user_id==='alice')));
console.log('PASS blank answers, blank notes, completion preservation, expected-account rejection, legacy notes preservation, fixed identity through asynchronous writes');
