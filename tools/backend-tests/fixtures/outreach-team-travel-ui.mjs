// Fictional UI contract responses only; never a substitute for native SQL tests.
export const ids={campaign:'11111111-1111-4111-8111-111111111111',org:'22222222-2222-4222-8222-222222222222',application:'33333333-3333-4333-8333-333333333333',person:'44444444-4444-4444-8444-444444444444',member:'55555555-5555-4555-8555-555555555555',leg:'66666666-6666-4666-8666-666666666666',vehicle:'77777777-7777-4777-8777-777777777777',assignment:'88888888-8888-4888-8888-888888888888'};
export function uiFixture(){
 const application={id:ids.application,reference:'V-0123456789ABCDEF',first_name:'=Synthetic',last_name:'Applicant',email:'synthetic@example.test',phone:'',attendance:null,rv_experience:'Yes',travel_choice:null,passenger_names:'<img src=x onerror=alert(1)> Alex, Sam',additional_information:'Fictional fixture only',status:'pending',revision:1,confirmation_state:'accepted'};
 let members=[],assignments=[],reviews=[],leg={id:ids.leg,label:'Outbound',itinerary_confirmed:false,departure_at:null,revision:1};
 const vehicle={id:ids.vehicle,label:'Synthetic van',vehicle_type:'Van',total_capacity:3,passenger_capacity:2,active:true,revision:1};
 const calls=[];let forbidden=false,hold=null;
 const clone=x=>JSON.parse(JSON.stringify(x));
 async function rpc(name,p){calls.push({name,p:clone(p)});if(hold&&name==='outreach_team_workspace'&&p.p_action==='manifest'){const h=hold;hold=null;return new Promise(r=>h.resolve=()=>r({data:clone(manifest())}))}if(forbidden)return{error:{code:'42501',message:'Sensitive private text'}};
  if(name==='people_workspace')return{data:[{id:ids.person,first_name:application.first_name,last_name:application.last_name,email:application.email}]};
  if(name==='outreach_volunteer_workspace')return{data:clone(p.p_action==='list'?{campaign_id:ids.campaign,name:'Synthetic Minden outreach',received:1,applications:[application]}:application)};
  const a=p.p_action,x=p.p_payload||{};let data;
  if(a==='context')data={campaign_id:ids.campaign,organization_id:ids.org,name:'Synthetic Minden outreach',application_review_allowed:true,capabilities:['team.view','team.manage','travel.view','travel.manage','travel.export'],summary:{applied:members.filter(m=>m.status==='applied').length,approved:members.filter(m=>m.status==='approved').length}};
  else if(a==='members'||a==='travelers')data=members;
  else if(a==='roster')data={legs:[leg],vehicles:[vehicle],driver_reviews:reviews,assignments,capacity:[{leg_id:leg.id,vehicle_id:vehicle.id,total_capacity:3,passenger_capacity:2,occupants:assignments.filter(a=>a.state!=='cancelled').length,available_passenger_seats:2-assignments.filter(a=>a.state!=='cancelled').length}],unassigned_approved:members.filter(m=>m.status==='approved'&&!assignments.some(a=>a.member_id===m.id&&a.state!=='cancelled')).length};
  else if(a==='enroll'){members.push({id:ids.member,application_id:ids.application,person_id:ids.person,first_name:application.first_name,last_name:application.last_name,status:'applied',source_application_status:'pending',age:null,availability_confirmed:false,travel_ready:false,revision:1});data={id:ids.member,saved:true};}
  else if(['status','review_age','availability_review','attendance'].includes(a)){const m=members.find(m=>m.id===x.member_id);if(a==='status')m.status=x.status;if(a==='review_age')m.age=x.age;if(a==='availability_review')m.availability_confirmed=x.confirmed;if(a==='attendance')m.checked_in_at='2026-12-19T18:00:00Z';m.travel_ready=m.status==='approved'&&m.age!==null&&m.availability_confirmed;m.revision++;data={id:m.id,saved:true};}
  else if(a==='history')data=[{created_at:'2026-11-17T18:00:00Z',kind:'enroll',metadata:{reason:'Synthetic verified review'}}];
  else if(a==='guardian_options')data=[];
  else if(a==='assignment_save'){assignments.push({id:ids.assignment,member_id:x.member_id,vehicle_id:x.vehicle_id,leg_id:x.leg_id,seat_role:x.seat_role,state:'assigned',revision:1});data={id:ids.assignment,saved:true};}
  else if(a==='assignment_confirm'){const row=assignments.find(a=>a.id===x.assignment_id);row.state='confirmed';row.revision++;data={id:row.id,saved:true};}
  else if(a==='assignment_cancel'){assignments.find(a=>a.id===x.assignment_id).state='cancelled';data={saved:true};}
  else if(a==='driver_review'){reviews.push({...x,qualified:x.qualified,revision:1});data={saved:true};}
  else if(a==='leg_save'){leg={...leg,...x,revision:leg.revision+1};for(const row of assignments){row.state='assigned';row.revision++}data={id:leg.id,saved:true};}
  else if(a==='manifest')data=manifest();else if(a==='csv')data={csv:'Name,Vehicle\r\n"\'=Synthetic Applicant","Synthetic van"\r\n',filename:'synthetic-travel.csv'};
  else data={saved:true};return{data:clone(data)};
 }
 function manifest(){return assignments.filter(a=>a.state!=='cancelled').map(a=>({...a,name:application.first_name+' '+application.last_name,vehicle:vehicle.label,leg:leg.label,itinerary_confirmed:leg.itinerary_confirmed,confirmation_valid:leg.itinerary_confirmed&&a.state==='confirmed'}))}
 return{rpc,calls,ids,application,get members(){return members},deny:()=>forbidden=true,holdManifest:()=>{hold={};return hold}};
}
