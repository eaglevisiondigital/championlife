// Holds a real fictional fixture response, including a denial, after computing it.
// No application method or SDK response handling is replaced.
import {fixture,ids,session} from '../staff-cycle8/modules-fixture.mjs';
export {ids,session};
export function detailFixture(){
 const base=fixture();let armed=null,release=null,finished=0;
 return {...base,
  holdDetail(name,deny=false){armed=name;if(deny)base.deny(name+':detail')},
  held:()=>!!release,finished:()=>finished,
  release(){const r=release;release=null;r?.()},
  async backend(route){
   const req=route.request(),name=new URL(req.url()).pathname.split('/').at(-1);
   const match=armed===name&&req.postDataJSON()?.p_action==='detail';
   if(!match)return base.backend(route);
   armed=null;
   return base.backend({request:()=>req,abort:(...a)=>route.abort(...a),async fulfill(options){
    await new Promise(r=>release=r);await route.fulfill(options);finished++;
   }});
  }
 };
}
