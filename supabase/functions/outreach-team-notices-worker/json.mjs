// Detect duplicate/prototype keys before interpreting a signed JSON envelope.
export function strictJson(text){
 let p=0,nodes=0;const space=()=>{while(/\s/.test(text[p]||'')&&p<text.length)p++};
 function string(){const start=p++;for(;;){if(p>=text.length)throw Error('JSON string');if(text[p]==='\\'){p+=2;continue}if(text[p++]==='"')break}return JSON.parse(text.slice(start,p))}
 function value(depth=0){
  if(depth>20||++nodes>2000)throw Error('JSON bound');space();
  if(text[p]==='{'){p++;space();const keys=new Set();if(text[p]==='}'){p++;return}for(;;){space();if(text[p]!=='"')throw Error('JSON key');const k=string();if(keys.has(k)||['__proto__','constructor','prototype'].includes(k))throw Error('Duplicate key');keys.add(k);space();if(text[p++]!==':')throw Error('JSON colon');value(depth+1);space();if(text[p]==='}'){p++;return}if(text[p++]!==',')throw Error('JSON comma')}}
  if(text[p]==='['){p++;space();if(text[p]===']'){p++;return}for(;;){value(depth+1);space();if(text[p]===']'){p++;return}if(text[p++]!==',')throw Error('JSON comma')}}
  if(text[p]==='"'){string();return}
  const m=text.slice(p).match(/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/);if(!m)throw Error('JSON value');p+=m[0].length;
 }
 value();space();if(p!==text.length)throw Error('JSON trailing');return JSON.parse(text);
}
