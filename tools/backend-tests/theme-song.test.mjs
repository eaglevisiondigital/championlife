import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';
let checks=0;const check=(v,l)=>{assert.ok(v,l);checks++};
const base=new URL('../../',import.meta.url), read=p=>readFileSync(new URL(p,base)), hash=b=>createHash('sha256').update(b).digest('hex');
check(hash(read('assets/images/theme-song/approved-artwork.png'))==='78bb4bc738205f0498a4dff4a2614c2eb595d745766bd11062f05d7458ffc89d','final owner artwork exact bytes');
const a=new JSDOM(read('outreach.html').toString()),b=new JSDOM(read('outreach-theme-song.html').toString());
check(a.window.document.querySelector('[data-theme-song]').outerHTML===b.window.document.querySelector('[data-theme-song]').outerHTML,'identical feature on both pages');
check(a.window.document.querySelector('.outreach-hero').nextElementSibling.matches('[data-theme-song]'),'feature follows intro');
check(!a.window.document.querySelector('.nav-links').textContent.includes('Theme'),'no new primary nav');
check(b.window.document.querySelector('link[rel=canonical]').href==='https://championlifefwb.com/outreach/theme-song','canonical');
check(b.window.document.querySelector('meta[property="og:image:width"]').content==='1200'&&b.window.document.querySelector('meta[property="og:image:height"]').content==='630','social dimensions');
check(b.window.document.querySelector('meta[name="twitter:card"]').content==='summary_large_image','Twitter card');
check(b.window.document.querySelector('audio').getAttribute('autoplay')===null,'no autoplay');
check(b.window.document.querySelector('[data-download]').href.endsWith('.m4a'),'honest original format');
for(const l of b.window.document.querySelectorAll('[data-give]'))check(l.getAttribute('href')==='/outreach-giving.html','unchanged giving route');
for(const selector of ['[data-play]','[data-seek]','[data-mute]','[data-volume]','[data-download]','[data-share]','[data-give]']){
 check(b.window.document.querySelectorAll(selector).length===1,'one accessible control '+selector);
 check(b.window.document.querySelector('.theme-song-artwork '+selector).getAttribute('aria-label'),'artwork control labeled '+selector);
}
check(!b.window.document.querySelector('.theme-song-player,.theme-song-actions,.theme-song-meta,.theme-song-fuel a'),'no duplicate visible or hidden controls');
check(read('outreach-giving.html').toString().includes('https://www.community.givehub.com/forms/outreach-main-giving'),'existing outreach form');

check(hash(read('assets/audio/gospel-in-the-streets.m4a'))==='b844032d80a66f41743df01b22c2a7ab4f07d5dcd571467e34c4bbf2e2249c60','original audio exact bytes');
check(b.window.document.querySelector('.fuel-name').textContent==='SOUL FUEL','campaign name preserved');
check(b.window.document.querySelector('[data-give]').getAttribute('aria-label')==='Give to Outreach','giving action wording preserved');
for (const doc of [a,b]) {
 check(!doc.window.document.querySelector('[data-counter],[data-total],.song-art-total'),'no counter display');
 check(!/Plays unavailable|qualified plays/.test(doc.window.document.body.textContent),'no counter placeholder');
}
const script=read('assets/js/theme-song.js').toString();
check(!/fetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|document\.cookie|localStorage|sessionStorage|setInterval|PlaybackMeter|THEME_SONG_/.test(script),'static player has no tracking, storage or counter requests');
for (const path of ['assets/js/theme-song-meter.js','netlify/functions/theme-song.mjs','netlify/lib/theme-song-store.mjs','tools/theme-song/schema.sql','tools/backend-tests/theme-song-native.test.mjs','package.json','package-lock.json']) check(!existsSync(new URL(path,base)),'removed counter-only artifact '+path);
const manifest=JSON.parse(read('tools/site-build/public-files.json'));
check(!manifest.includes('assets/js/theme-song-meter.js'),'no removed script in public build');
check(!read('tools/theme-song/preview.mjs').toString().includes('/.netlify/functions/theme-song'),'preview does not emulate counter API');
console.log(`PASS ${checks} theme-song asset, markup, static-only and privacy checks`);
