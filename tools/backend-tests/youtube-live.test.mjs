import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../../netlify/functions/youtube-live.js',import.meta.url),'utf8');
const video='Abc123XYZ_0',channel='UCG7j8eiL-qW8nzr2Sg7o2oA';
const liveBody=JSON.stringify({videoDetails:{videoId:video,channelId:channel,isLive:true,isLiveContent:true}});
const waitingBody=JSON.stringify({videoDetails:{videoId:video,channelId:channel,isLive:false,isLiveContent:true}});
const wrongBody=JSON.stringify({videoDetails:{videoId:video,channelId:'UCAAAAAAAAAAAAAAAAAAAAAA',isLive:true}});
function response(status,location,body=''){
 return {status,ok:status>=200&&status<300,headers:{get:k=>k==='location'?location:null},text:async()=>body};
}
async function call(fetch){
 const scope={exports:{},URL,fetch,AbortSignal:{timeout:()=>({})}};
 vm.runInNewContext(source,scope,{timeout:1000});
 const result=await scope.exports.handler();
 assert.equal(result.statusCode,200);
 assert.match(result.headers['content-type'],/application\/json/);
 return JSON.parse(result.body);
}
const cases=[
 ['verified current live',async url=>url.includes('/watch?v=')?response(200,null,liveBody):response(302,'https://www.youtube.com/watch?v='+video),{live:true,videoId:video}],
 ['upcoming candidate not labeled LIVE',async url=>url.includes('/watch?v=')?response(200,null,waitingBody):response(302,'https://www.youtube.com/watch?v='+video),{live:false,videoId:null,candidateVideoId:video}],
 ['live metadata embedded directly',async()=>response(200,null,liveBody),{live:true,videoId:video}],
 ['reject wrong channel identity',async url=>url.includes('/watch?v=')?response(200,null,wrongBody):response(302,'https://www.youtube.com/watch?v='+video),{live:false,videoId:null}],
 ['reject untrusted redirect',async()=>response(302,'https://evil.example/watch?v='+video),{live:false,videoId:null}],
 ['reject invalid redirect video ID',async()=>response(302,'https://www.youtube.com/watch?v=TOO_LONG_123456'),{live:false,videoId:null}],
 ['rate limit never silently means offline',async()=>response(429),{live:false,videoId:null,error:'provider-not-verified'}],
 ['network error never silently means offline',async()=>{throw Error('provider unreachable')},{live:false,videoId:null,error:'provider-not-verified'}],
 ['alternate channel identity route works',async url=>url.includes('@ChampionLifeFWB')?response(302,'https://www.youtube.com/@ChampionLifeFWB'):url.includes('/watch?v=')?response(200,null,liveBody):response(302,'https://www.youtube.com/live/'+video),{live:true,videoId:video}]
];
let count=0;
for(const [name,fetch,expected]of cases){
 const actual=await call(fetch);
 for(const [key,value]of Object.entries(expected))assert.equal(actual[key],value,name+': '+key);
 console.log('PASS youtube-live '+name);count++;
}
console.log('PASS '+count+' explicit public YouTube live-detection negative/positive tests');
