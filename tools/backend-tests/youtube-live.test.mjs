import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../../netlify/functions/youtube-live.js',import.meta.url),'utf8');
const video='Abc123XYZ_0',channel='UCG7j8eiL-qW8nzr2Sg7o2oA';
const playerBody=videoDetails=>'var ytInitialPlayerResponse = '+JSON.stringify({videoDetails})+';';
const liveBody=playerBody({videoId:video,channelId:channel,isLive:true,isLiveContent:true});
const waitingBody=playerBody({videoId:video,channelId:channel,isLive:false,isLiveContent:true});
const wrongBody=playerBody({videoId:video,channelId:'UCAAAAAAAAAAAAAAAAAAAAAA',isLive:true});
// Actual public YouTube response shape observed during the November 22 service.
const overlay='var ytInitialData = '+JSON.stringify({playerOverlays:{playerOverlayRenderer:{videoDetails:{playerOverlayVideoDetailsRenderer:{title:{simpleText:'Pastor Roddy Shaffer - Light Be Part 2'},subtitle:{runs:[{text:'Champion Life'},{text:' watching now'}]}}},liveIndicatorText:{simpleText:'Live'}}}})+';';
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

cases.push(
 ['neighboring live:true after inactive videoDetails cannot promote',async()=>response(200,null,waitingBody+'{"recommendation":{"isLive":true}}'),{live:false,videoId:null,candidateVideoId:video}],
 ['neighboring live:true before inactive videoDetails cannot promote',async()=>response(200,null,'{"suggestion":{"isLive":true}}'+waitingBody),{live:false,videoId:null,candidateVideoId:video}],
 ['nested live:true does not override inactive target',async()=>response(200,null,playerBody({videoId:video,channelId:channel,isLive:false,recommendation:{isLive:true}})),{live:false,videoId:null,candidateVideoId:video}],
 ['escaped metadata text does not override inactive target',async()=>response(200,null,playerBody({videoId:video,channelId:channel,isLive:false,title:'{"isLive":true}'})),{live:false,videoId:null,candidateVideoId:video}],
 ['inactive target plus second contradictory videoDetails fails closed',async()=>response(200,null,waitingBody+liveBody),{live:false,videoId:null,error:'provider-not-verified'}],
 ['duplicate identical videoDetails remains verifiable',async()=>response(200,null,liveBody+liveBody),{live:true,videoId:video}],
 ['whitespace within canonical player JSON remains verifiable',async()=>response(200,null,'var ytInitialPlayerResponse = { "videoDetails" : '+JSON.stringify({videoId:video,channelId:channel,isLive:true})+' };'),{live:true,videoId:video}],
 ['external neighboring approved channel never repairs wrong videoDetails channel',async()=>response(200,null,wrongBody+JSON.stringify({channelId:channel,isLive:true})),{live:false,videoId:null,error:'provider-not-verified'}],
 ['redirecting nonlive target with neighboring live signal yields candidate only',async url=>url.includes('/watch?v=')?response(200,null,waitingBody+'{"neighbor":{"isLive":true}}'):response(302,'https://www.youtube.com/watch?v='+video),{live:false,videoId:null,candidateVideoId:video}],
 ['live broadcast survives unrelated player overlay videoDetails',async()=>response(200,null,liveBody+overlay),{live:true,videoId:video}],
 ['overlay before canonical player cannot hide live broadcast',async()=>response(200,null,overlay+liveBody),{live:true,videoId:video}],
 ['today exact video is detected despite overlay metadata',async()=>response(200,null,playerBody({videoId:'RMSPr30f6W8',channelId:channel,isLive:true,isLiveContent:true})+overlay),{live:true,videoId:'RMSPr30f6W8'}],
 ['overlay LIVE text cannot promote inactive canonical broadcast',async()=>response(200,null,waitingBody+overlay),{live:false,videoId:null,candidateVideoId:video}],
 ['overlay without canonical player fails closed',async()=>response(200,null,overlay),{live:false,videoId:null,error:'provider-not-verified'}],
 ['noncanonical live videoDetails cannot claim LIVE',async()=>response(200,null,JSON.stringify({videoDetails:{videoId:video,channelId:channel,isLive:true}})),{live:false,videoId:null,error:'provider-not-verified'}],
 ['nested live details cannot replace missing top-level player details',async()=>response(200,null,'var ytInitialPlayerResponse = '+JSON.stringify({recommendation:{videoDetails:{videoId:video,channelId:channel,isLive:true}}})+';'),{live:false,videoId:null,error:'provider-not-verified'}],
 ['window-assigned canonical player is supported',async()=>response(200,null,liveBody.replace('var ytInitialPlayerResponse','window["ytInitialPlayerResponse"]')),{live:true,videoId:video}],
 ['malformed canonical player fails closed',async()=>response(200,null,'var ytInitialPlayerResponse = {"videoDetails":'+JSON.stringify({videoId:video,channelId:channel,isLive:true})),{live:false,videoId:null,error:'provider-not-verified'}]
);

let count=0;
for(const [name,fetch,expected]of cases){
 const actual=await call(fetch);
 for(const [key,value]of Object.entries(expected))assert.equal(actual[key],value,name+': '+key);
 console.log('PASS youtube-live '+name);count++;
}
console.log('PASS '+count+' explicit public YouTube live-detection negative/positive tests');
