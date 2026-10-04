import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=readFileSync(new URL('../../discipleship-login.html',import.meta.url),'utf8');
for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
const fn=html.slice(html.indexOf('  function safeNext(value)'),html.indexOf('  const next = safeNext'));
const context={URL,location:{origin:'https://championlifefwb.com'}};
vm.createContext(context);vm.runInContext(fn,context);
for(const [input,expected] of [
 ['getting-a-grip-1.html','/getting-a-grip-1.html'],
 ['/getting-a-grip-13.html','/getting-a-grip-13.html'],
 ['/staff-people.html','/staff-people.html'],
 ['/my-ministry.html','/my-ministry.html'],
 ['/my-discipleship.html','/my-discipleship.html'],
 ['/my-ministry.html?area=11111111-1111-4111-8111-111111111111&resource=22222222-2222-4222-8222-222222222222&next=//evil.example#token','/my-ministry.html?area=11111111-1111-4111-8111-111111111111&resource=22222222-2222-4222-8222-222222222222'],
 ['/my-ministry.html?area=bad&resource=22222222-2222-4222-8222-222222222222','/my-ministry.html'],
 ['/my-ministry.html?area=11111111-1111-4111-8111-111111111111','/my-ministry.html'],
 ['https://evil.example/my-ministry.html?area=11111111-1111-4111-8111-111111111111&resource=22222222-2222-4222-8222-222222222222','/my-discipleship.html'],
 ['https://evil.example','/my-discipleship.html'],
 ['//evil.example','/my-discipleship.html'],
 ['javascript:alert(1)','/my-discipleship.html'],
 ['/getting-a-grip-14.html','/my-discipleship.html'],
 ['/discipleship-login.html','/my-discipleship.html'],
 ['/getting-a-grip-2.html?next=//evil.example#token','/getting-a-grip-2.html'],
 ['\\\\evil.example','/my-discipleship.html']
]) assert.equal(context.safeNext(input),expected,input);
console.log('16 redirect cases passed; inline scripts parse');
