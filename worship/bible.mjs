// Public text only. No account, note, completion, HTML or cross-origin provider authority.
export function mountBible(root){
 const by=id=>root.querySelector('#'+id),book=by('bible-book'),chapter=by('bible-chapter'),status=by('bible-status'),passage=by('bible-passage'),previous=by('bible-previous'),next=by('bible-next');
 let index=null,current=null,generation=0,active=true,controller=new AbortController();const cache=new Map();
 // The fixed same-origin asset path may require the host's session; never add app tokens or follow redirects.
 async function json(path,signal){const r=await fetch('/worship/scripture/'+path,{credentials:'same-origin',redirect:'error',referrerPolicy:'no-referrer',signal});if(!r.ok||Number(r.headers.get('content-length')||0)>1000000)throw Error();const text=await r.text();if(text.length>1000000)throw Error();return JSON.parse(text);}
 function updateBounds(){const selected=index?.books.find(b=>b.id===book.value);if(selected)chapter.max=String(selected.chapters);}
 async function read(){
  if(!active||!index)return;updateBounds();const selected=index.books.find(b=>b.id===book.value),n=Number(chapter.value);if(!selected||!Number.isInteger(n)||n<1||n>selected.chapters){status.textContent='Choose a chapter in this book.';return;}
  const g=++generation;controller.abort();controller=new AbortController();status.textContent='Opening '+selected.name+' '+n+'…';
  try{let data=cache.get(selected.id);if(!data){data=await json(selected.id+'.json',controller.signal);if(!active||g!==generation)return;if(data.book!==selected.id||data.name!==selected.name||!Array.isArray(data.chapters)||data.chapters.length!==selected.chapters)throw Error();cache.set(selected.id,data);if(cache.size>6)cache.delete(cache.keys().next().value);}
   const verses=data.chapters[n-1];if(!Array.isArray(verses)||!verses.length||verses.length>200||verses.some((v,i)=>v.verse!==i+1||typeof v.text!=='string'||v.text.length>10000))throw Error();if(!active||g!==generation)return;
   const heading=document.createElement('h4');heading.textContent=selected.name+' '+n;const nodes=[heading];for(const verse of verses){if(!verse.text)continue;const p=document.createElement('p'),number=document.createElement('sup');number.textContent=verse.verse+' ';p.append(number,document.createTextNode(verse.text));nodes.push(p);}passage.replaceChildren(...nodes);passage.scrollTop=0;current={id:selected.id,n};previous.disabled=n===1;next.disabled=n===selected.chapters;status.textContent=selected.name+' '+n+' · World English Bible';
  }catch{if(active&&g===generation)status.textContent='Scripture is unavailable right now. The last opened passage remains below; try again when connected.';}
 }
 by('bible-form').onsubmit=e=>{e.preventDefault();void read();};book.onchange=()=>{chapter.value='1';updateBounds();};
 for(const [button,step]of [[previous,-1],[next,1]])button.onclick=()=>{if(!current)return;book.value=current.id;chapter.value=String(current.n+step);void read();};
 void(async()=>{try{index=await json('index.json',controller.signal);if(!active)return;if(index.id!=='engwebp'||!Array.isArray(index.books)||index.books.length!==66||new Set(index.books.map(b=>b.id)).size!==66||index.books.some(b=>!/^\w{3}$/.test(b.id)||typeof b.name!=='string'||b.name.length>50||!Number.isInteger(b.chapters)||b.chapters<1||b.chapters>150))throw Error();for(const b of index.books){const o=document.createElement('option');o.value=b.id;o.textContent=b.name;book.append(o);}book.value='JOH';book.disabled=false;by('bible-read').disabled=false;await read();}catch{if(active)status.textContent='Scripture reader unavailable. Please try again when connected.';}})();
 window.addEventListener('pagehide',()=>{active=false;generation++;controller.abort();cache.clear();});
}
