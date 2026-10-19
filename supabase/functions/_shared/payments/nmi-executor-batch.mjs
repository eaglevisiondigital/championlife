import {dedicatedAcceptance} from './acceptance-pin.mjs';
import {createNmiQuery} from './nmi-query.mjs';
export async function lookupBatch({config,rpc,organization_id,actor_id,gateway_id,route_id,batch_reference,date,fetcher,readSecret}){
 const identity={actor_id,gateway_id,route_id};const scope=await rpc('batch_scope',organization_id,identity);
 const query=createNmiQuery({config:{...config,enabled:config.enabled===true||(dedicatedAcceptance(config)&&config.recoveryEnabled===true),organization_id,gateway_id},scope,fetcher,readSecret});
 const snapshot=await query.batch({batch_reference,date});
 return rpc('batch_record',organization_id,{...identity,snapshot});
}
