/* Bounded question controls shared by native registration and authorized staff edits. */
(() => {
 'use strict';const T=window.PropelEvents;if(!T)return;const {el,field,select}=T;
 function question(parent,q,value){
  const box=el('div',null,{class:'registration-question'});parent.append(box);let input;
  if(q.kind==='select'||q.kind==='multi_select')input=select(box,q.label,q.id,q.kind==='select'?[['','Choose…'],...q.options.map(x=>[x,x])]:q.options.map(x=>[x,x]),value||'',q.kind==='multi_select');
  else if(q.kind==='yes_no')input=select(box,q.label,q.id,[['','Choose…'],['true','Yes'],['false','No']],value===undefined?'':String(value));
  else input=field(box,q.label,q.id,{long_text:'textarea',short_text:'text',email:'email',phone:'tel',number:'number',consent:'checkbox',date:'date'}[q.kind]||'text',value);
  input.required=!!q.required;input.dataset.kind=q.kind;
  if(q.kind==='short_text')input.maxLength=500;if(q.kind==='long_text')input.maxLength=8000;
  if(q.kind==='number'){input.min=-1e9;input.max=1e9;input.step='any';}if(q.kind==='date'){input.min='1900-01-01';input.max='2100-12-31';}
  if(q.help_text)box.append(el('small',q.help_text));
  return ()=>{if(q.kind==='consent')return input.checked;if(q.kind==='multi_select')return [...input.selectedOptions].map(x=>x.value);if(q.kind==='yes_no')return input.value===''?null:input.value==='true';if(q.kind==='number')return input.value===''?null:Number(input.value);return input.value;};
 }
 function contact(form,data={},contactRequired=true){const inputs={};for(const [key,label,type] of [['first_name','First name','text'],['last_name','Last name','text'],['email',contactRequired?'Email (email or phone required)':'Email (optional)','email'],['phone','Phone','tel']]){inputs[key]=field(form,label,key,type,data[key]||'');inputs[key].maxLength=key==='email'?254:key==='phone'?40:100;inputs[key].required=key.endsWith('name');}return ()=>Object.fromEntries(Object.entries(inputs).map(([k,i])=>[k,i.value.trim()]));}
 window.PropelRegistration={question,contact};
})();
