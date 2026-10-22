// Local static review only. Serves the public build without a backend.
import http from 'node:http';import {readFile,stat} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../dist/',import.meta.url));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.m4a':'audio/mp4','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{
 try{
  let url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(['/outreach/theme-song','/outreach/theme-song/'].includes(url))url='/outreach-theme-song.html';
  const file=path.resolve(root,'.'+url);if(!file.startsWith(root)||!(await stat(file)).isFile())throw Error();
  const bytes=await readFile(file),headers={'content-type':types[path.extname(file)]||'application/octet-stream','accept-ranges':'bytes'};
  const range=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range||'');
  if(range){const start=Number(range[1]),end=Math.min(range[2]?Number(range[2]):bytes.length-1,bytes.length-1);if(start>end){res.writeHead(416);res.end();return;}res.writeHead(206,{...headers,'content-range':`bytes ${start}-${end}/${bytes.length}`,'content-length':end-start+1});res.end(bytes.subarray(start,end+1));}
  else{res.writeHead(200,headers);res.end(bytes);}
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(Number(process.env.PORT||4179),'127.0.0.1',()=>console.log('Local review: http://127.0.0.1:'+ (process.env.PORT||4179) +'/outreach/theme-song'));
