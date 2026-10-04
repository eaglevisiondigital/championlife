const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const script=read('assets/js/christmas-dinner-2026.js');
const core=require(path.join(root,'assets/js/christmas-dinner-2026.js'));
let checks=0;const check=(a,b,label)=>{assert.deepEqual(a,b,label);checks++};
for(const [date,tier]of [
 ['2026-10-04T04:59:59Z','upcoming'],['2026-10-04T05:00:00Z','early'],
 ['2026-11-08T18:00:00Z','early'],['2026-11-09T05:59:59Z','early'],['2026-11-09T06:00:00Z','regular'],
 ['2026-11-29T18:00:00Z','regular'],['2026-11-30T05:59:59Z','regular'],['2026-11-30T06:00:00Z','closed']])check(core.tierAt(new Date(date)),tier,date);
for(const tier of ['early','regular'])for(const [age,cents]of [[0,0],[5,0],[6,500],[12,500],[13,tier==='early'?1000:1500],[120,tier==='early'?1000:1500]])check(core.ageRate(String(age),tier),cents,`${age}/${tier}`);
for(const age of ['','-1','1.5','121','Infinity','abc','2e1']){assert.throws(()=>core.ageRate(age,'early'));checks++}
const household={primary_first_name:'John',primary_last_name:'Smith',spouse_selected:true,spouse_first_name:'Jane',spouse_last_name:'Smith',family:[{first_name:'Sarah',last_name:'Smith',age:'8'},{first_name:'Luke',last_name:'Smith',age:'3'}]};
check(core.calculate(household,new Date('2026-10-04T18:00Z')).cents,2500,'example family early');
check(core.calculate(household,new Date('2026-11-09T18:00Z')).cents,3500,'example family regular');
assert.throws(()=>core.calculate(household,new Date('2026-11-30T06:00Z')),/closed/);checks++;
function setup(date='2026-10-04T18:00:00Z',response={ok:true}){
 const virtualConsole=new VirtualConsole();const dom=new JSDOM(read('christmas-dinner-2026.html'),{url:'https://preview.example/christmas-dinner-2026.html?ignored=private',runScripts:'outside-only',virtualConsole});
 const w=dom.window;let now=date;const NativeDate=w.Date;
 w.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[now]))}static now(){return new NativeDate(now).getTime()}};
 let requests=[],redirects=[];let impl=()=>Promise.resolve(response);
 w.fetch=async(url,options)=>{requests.push({url,options});return impl()};
 // The one explicit test substitution observes navigation without initiating an external payment page.
 w.__navigate=url=>redirects.push(url);w.eval(script.replace('window.location.assign(PAYMENT_URL);','window.__navigate(PAYMENT_URL);'));
 const form=w.document.querySelector('form'),tick=()=>new Promise(r=>setTimeout(r,0));
 function fill(name,value){form.elements.namedItem(name).value=value;form.dispatchEvent(new w.Event('input',{bubbles:true}))}
 function contact(){for(const[k,v]of Object.entries({primary_first_name:'John',primary_last_name:'Smith',email:'christmas-test@example.test',phone:'5555550199'}))fill(k,v)}
 function spouse(on){form.elements.spouse_selected.checked=on;form.elements.spouse_selected.dispatchEvent(new w.Event('change',{bubbles:true}));if(on){fill('spouse_first_name','Jane');fill('spouse_last_name','Smith')}}
 function add(age,first='Child'){w.document.querySelector('#christmas-add').click();const row=[...form.querySelectorAll('[data-family-row]')].at(-1);row.querySelector('[data-first]').value=first;row.querySelector('[data-last]').value='Smith';row.querySelector('[data-age]').value=age;form.dispatchEvent(new w.Event('input',{bubbles:true}));return row}
 function submit(){form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}))}
 return{dom,w,form,fill,contact,spouse,add,submit,tick,requests,redirects,setDate:d=>now=d,setResponse:f=>impl=f};
}
(async()=>{
 let s=setup();s.contact();s.submit();await s.tick();check(s.requests.length,1,'individual');check(s.redirects,[core.PAYMENT_URL],'exact payment redirect');let data=new URLSearchParams(s.requests[0].options.body);check(data.get('calculated_total'),'10.00');check(data.get('attendee_count'),'1');check(data.get('source_page'),'https://preview.example/christmas-dinner-2026.html','query data excluded');check(s.form.elements.calculated_total.value,'10.00');s.dom.window.close();
 s=setup();s.contact();s.spouse(true);check(s.w.document.querySelector('[data-total]').textContent,'$20.00');s.add('8','Sarah');s.add('3','Luke');check(s.w.document.querySelector('[data-total]').textContent,'$25.00');
 s.form.elements.calculated_total.value='0.01';s.form.elements.pricing_tier.value='forged';s.form.elements.attendees_json.value='[]';
 s.submit();s.submit();await s.tick();check(s.requests.length,1,'double-click guarded');data=new URLSearchParams(s.requests[0].options.body);check(data.get('calculated_total'),'25.00','hidden total regenerated');check(data.get('pricing_tier'),'early');check(JSON.parse(data.get('attendees_json')).map(p=>p.price_cents),[1000,1000,500,0]);check(data.get('attendee_count'),'4');check(data.get('spouse_selected'),'true');check(s.w.document.querySelectorAll('[data-total]')[1].textContent,'$25.00','payment display agrees with payload');s.dom.window.close();
 s=setup();s.contact();s.spouse(true);s.spouse(false);check(s.form.elements.spouse_first_name.required,false);check(s.w.document.querySelector('[data-total]').textContent,'$10.00');const row=s.add('5');check(s.w.document.querySelector('[data-total]').textContent,'$10.00');row.querySelector('[data-age]').value='13';s.form.dispatchEvent(new s.w.Event('input'));check(s.w.document.querySelector('[data-total]').textContent,'$20.00');row.querySelector('button').click();check(s.w.document.querySelector('[data-total]').textContent,'$10.00');for(let n=0;n<25;n++)s.add('6');check(s.form.querySelectorAll('[data-family-row]').length,25,'no small fixed family cap');check(s.w.document.querySelector('[data-total]').textContent,'$135.00');s.dom.window.close();
 s=setup();s.contact();s.add('8','<img src=x onerror=alert(1)>');check(s.w.document.querySelector('#christmas-summary img'),null,'names rendered as text');s.submit();await s.tick();check(s.requests.length,1);check(JSON.parse(new URLSearchParams(s.requests[0].options.body).get('attendees_json'))[1].first_name,'<img src=x onerror=alert(1)>');s.dom.window.close();
 for(const age of ['-1','1.5','121','']){s=setup();s.contact();s.add(age);s.submit();await s.tick();check(s.requests.length,0,`invalid age ${age}`);check(s.redirects.length,0);s.dom.window.close()}
 s=setup();s.contact();s.fill('primary_first_name',' '.repeat(4));s.submit();await s.tick();check(s.requests.length,0,'whitespace name');s.dom.window.close();
 s=setup();s.contact();s.fill('primary_first_name','x'.repeat(101));s.submit();await s.tick();check(s.requests.length,0,'overlong name');s.dom.window.close();
 for(const reject of [false,true]){s=setup();s.contact();s.add('12');s.setResponse(()=>reject?Promise.reject(new TypeError('network')):Promise.resolve({ok:false}));s.submit();await s.tick();check(s.redirects.length,0,'failure no redirect');check(s.form.elements.primary_first_name.value,'John','failed submit preserves data');check(s.w.document.querySelector('#christmas-submit').disabled,false,'retry available');check(s.w.document.querySelector('#christmas-status').classList.contains('is-error'),true);s.setResponse(()=>Promise.resolve({ok:true}));s.submit();await s.tick();check(s.redirects.length,1);s.dom.window.close()}
 s=setup('2026-11-09T05:59:59Z');s.contact();s.setDate('2026-11-09T06:00:00Z');s.submit();await s.tick();check(s.requests.length,0,'tier increase requires review');check(s.w.document.querySelector('[data-total]').textContent,'$15.00');s.submit();await s.tick();check(new URLSearchParams(s.requests[0].options.body).get('calculated_total'),'15.00');s.dom.window.close();
 s=setup('2026-11-30T05:59:59Z');s.contact();s.setDate('2026-11-30T06:00:00Z');s.submit();await s.tick();check(s.requests.length,0,'midnight closure');check(s.redirects.length,0);check(s.w.document.querySelector('#christmas-submit').disabled,true);check(s.w.document.querySelector('#christmas-availability').textContent,'Online registration for the 2026 Champion Life Christmas Dinner is now closed.');s.dom.window.close();
 s=setup('2026-11-30T18:00:00Z');check(s.w.document.querySelector('#christmas-fields').disabled,true);s.dom.window.close();
 s=setup();s.contact();let finish;s.setResponse(()=>new Promise(resolve=>finish=resolve));s.submit();s.setDate('2026-11-30T06:00:00Z');finish({ok:true});await s.tick();check(s.redirects.length,0,'capture completing after closure never redirects');s.dom.window.close();
 const page=new JSDOM(read('christmas-dinner-2026.html')),events=new JSDOM(read('events.html')),manifest=new JSDOM(read('netlify-forms.html'));
 check(events.window.document.querySelectorAll('.grid.three .card').length,3,'weekly cards retained');for(const title of ['Sunday Worship','Wednesday Night','6 AM Prayer'])assert(events.window.document.body.textContent.includes(title));checks+=3;
 check(events.window.document.querySelector('[data-registration-cta]').getAttribute('href'),'/christmas-dinner-2026.html');check(events.window.document.body.textContent.includes('Expanded Event Calendar Coming This Week'),false);
 const expected=['form-name','bot-field','primary_first_name','primary_last_name','email','phone','spouse_selected','spouse_first_name','spouse_last_name','attendees_json','attendee_count','pricing_tier','calculated_total','submitted_at','source_page'].sort();
 check([...manifest.window.document.querySelector('form[name="christmas-dinner-2026"]').elements].map(e=>e.name).sort(),expected,'static capture manifest');
 check([...page.window.document.querySelectorAll('#christmas-registration [name]')].map(e=>e.name).sort(),expected,'visible form and manifest fields agree');
 check(page.window.document.querySelectorAll('script[src="assets/js/site.js"]').length,1);check(events.window.document.querySelectorAll('script[src="assets/js/site.js"]').length,1);
 page.window.close();events.window.close();manifest.window.close();
 console.log(`PASS ${checks} Christmas pricing, Chicago boundaries, family, validation, totals, escaping, capture/failure, closure and site integration checks`);
})().catch(error=>{console.error(error);process.exitCode=1});
