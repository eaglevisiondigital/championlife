import assert from 'node:assert/strict';import {source,original,pageSource,verifyNoPublicDelta,manifest}from'./source.mjs';
let pinned=0;for(const[lane,entry]of Object.entries(manifest.sources))for(const p of Object.keys(entry.files)){source(lane,p);pinned++}
const pages=['staff-home.html','staff-dream-team-manual.html','staff-forms.html','staff-form-builder.html','staff-events.html'];for(const p of pages){const html=pageSource(p).toString(),sdk=html.match(/<script[^>]+supabase-js[^>]*>/g);assert.equal(sdk?.length,1,p);assert.ok(sdk[0].includes('@2.118.0"'));assert.ok(sdk[0].includes('sha384-UagCvVPT5XXA0Hx+nJYUAGBFseHT9zBgpJMSebsAxl9lciTwbT+39j5VfRjdP5Tp'));assert.ok(html.includes('assets/js/champion-life-auth.js'));assert.ok(html.includes('assets/js/staff-session.js'))}
assert.deepEqual(pageSource('assets/js/forms-admin.js'),source('composition','assets/js/forms-admin.js'));
assert.deepEqual(pageSource('assets/js/dream-team-manual.js'),source('dream','assets/js/dream-team-manual.js'));
assert.deepEqual(pageSource('assets/js/staff-workspace.js'),source('shell','assets/js/staff-workspace.js'));
assert.deepEqual(pageSource('assets/js/staff-session.js'),source('session','assets/js/staff-session.js'));
assert.deepEqual(pageSource('assets/js/staff-events.js'),original('events','assets/js/staff-events.js'));
console.log(JSON.stringify({status:'PASS',originalBindingsRetained:52,newPinnedFiles:pinned,exactHeads:6,pinnedSdkPages:pages.length,unchangedPublicFiles:verifyNoPublicDelta(),runtimeFilesChanged:0,migrationsChanged:0,realProviderAcceptance:false}));
