(() => {
 const A={id:'76000000-0000-4000-8000-000000000001',email:'fictional-a@example.test'},B={id:'76000000-0000-4000-8000-000000000002',email:'fictional-b@example.test'};
 const org='76000000-0000-4000-8000-000000000010', fid='76000000-0000-4000-8000-000000000020';
 const caps={profile:'private_draft_v1',actions:['context','list','create','get','draft','save'],publication:false,submissions:false,financial:false};
 let current=A,revoked=false,held=null,failAction=null,holdAction=sessionStorage.getItem("forms-test-hold"),version=1,definition=null;
 sessionStorage.removeItem("forms-test-hold");
 const listeners=[];
 const form=()=>({id:fid,organization_id:org,name:'Private approved draft',slug:'private-approved',type:'registration',description:'',status:'draft',permissions:['forms.read','forms.create','forms.edit'],submission_count:null,payment_enabled:false,published_version:null});
 const draft=()=>({form:form(),version:{id:'76000000-0000-4000-8000-000000000021',form_id:fid,version:1,revision:version,state:'draft',definition:definition||window.FormsModel.baptismInterest()},permissions:['forms.read','forms.create','forms.edit'],capabilities:caps});
 const f=window.formsFixture={A,B,org,fid,calls:[],setUser:(who,callback=false)=>{current=who;if(callback)listeners.forEach(cb=>cb(who?'SIGNED_IN':'SIGNED_OUT',who?{user:who}:null))},deny:()=>{revoked=true},allow:()=>{revoked=false},hold:action=>{holdAction=action},failNext:action=>{failAction=action},release:()=>{held?.();held=null},get pending(){return !!held},expire:()=>{current=null}};
 const client={auth:{getUser:async()=>({data:{user:current},error:null}),getSession:async()=>({data:{session:current?{user:current}:null},error:null}),onAuthStateChange:cb=>{listeners.push(cb);return{data:{subscription:{unsubscribe(){}}}}},signOut:async()=>{current=null;listeners.forEach(cb=>cb('SIGNED_OUT',null));return{error:null}}},rpc:async(name,args)=>{
 f.calls.push({name,args:JSON.parse(JSON.stringify(args)),user:current?.id});
 const failed=args.p_action===failAction;if(failed)failAction=null;
 let result;if(revoked||!current)result={error:{code:'42501',message:'Access denied'},status:403};
 else if(args.p_action==='context')result={data:{capabilities:caps,organizations:[{id:org,name:'Fictional Church',permissions:['forms.read','forms.create','forms.edit'],scoped_forms:[]}]}};
 else if(args.p_action==='list')result={data:{forms:[form()],capabilities:caps}};
 else if(['get','draft'].includes(args.p_action))result={data:draft()};
 else if(args.p_action==='save'){if(args.p_payload.revision!==version)result={error:{code:'PT409',message:'Conflict'}};else{version++;definition=JSON.parse(JSON.stringify(args.p_payload.definition));result={data:draft()}}}
 else if(args.p_action==='create'){definition=JSON.parse(JSON.stringify(args.p_payload.definition));result={data:draft()}}
 else result={error:{code:'0A000',message:'Capability unavailable'}};
 if(args.p_action===holdAction){holdAction=null;await new Promise(resolve=>{held=resolve})}
 if(failed)throw Error("Synthetic temporary transport failure");
 return result;
 }};
 window.ChampionLifeAuth={client,getUser:async()=>current,getSession:async()=>current?{user:current}:null};
})();
