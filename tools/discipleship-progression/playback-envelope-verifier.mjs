import {createHash,createPublicKey,verify} from 'node:crypto';
import {COURSE} from './evidence-review.mjs';
// Server-only source implementation. No keys, provider, or repository is installed.
export const PLAYBACK_SIGNATURE_DOMAIN='championlife.playback-observation.v1\n';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(x);
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const plain=x=>x&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,keys)=>plain(x)&&Reflect.ownKeys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const sha=x=>createHash('sha256').update(x).digest('hex');
const fields=['id','userId','sessionId','course','lesson','mediaId','videoRevision','provider','policyVersion','observedAt','validUntil','eligiblePlayback','startMs','endMs','elapsedMs'];
function decode(x,max){
 if(typeof x!=='string'||x.length>max||!x.length||!/^[A-Za-z0-9_-]+$/.test(x))throw Error('Invalid encoding');
 const b=Buffer.from(x,'base64url');if(b.toString('base64url')!==x)throw Error('Invalid encoding');return b;
}
const requireValue=x=>{if(!x)throw Error('Trusted observation unavailable')};
/** withCurrentObserver must hold compatible locks against registry/key/policy
 * revocation until its callback AND transaction finish. No HTTP/JWKS resolution,
 * environment defaults, caller keys, or browser approval flags are supported.
 * Registry approval asserts separately reviewed observation provenance; crypto
 * proves only envelope origin/integrity, never human attention or actual viewing.
 */
export function createPlaybackEnvelopeVerifier({repository,now=Date.now}={}){
 if(typeof now!=='function')throw TypeError('Clock required');
 return async function verifyPlayback(envelope,{signal}={}){
  try{
   requireValue(!signal?.aborted&&typeof envelope==='string'&&envelope.length<=65536&&typeof repository?.withCurrentObserver==='function');
   const e=JSON.parse(envelope);
   requireValue(exact(e,['version','keyId','payload','signature'])&&e.version===1&&id(e.keyId));
   const bytes=decode(e.payload,60000),text=bytes.toString('utf8'),p=JSON.parse(text),signature=decode(e.signature,128);
   requireValue(Buffer.from(text).equals(bytes)&&JSON.stringify(p)===text&&signature.length===64&&exact(p,fields));
   for(const k of ['id','userId','sessionId','mediaId','videoRevision','provider','policyVersion'])requireValue(id(p[k]));
   requireValue(p.course===COURSE&&Number.isInteger(p.lesson)&&p.lesson>=1&&p.lesson<=10&&p.eligiblePlayback===true);
   for(const k of ['observedAt','validUntil','startMs','endMs','elapsedMs'])requireValue(integer(p[k]));
   requireValue(p.startMs<p.endMs&&p.endMs-p.startMs<=p.elapsedMs);
   let called=false,result,deadline;
   await repository.withCurrentObserver(Object.freeze({provider:p.provider,keyId:e.keyId}),raw=>{
    requireValue(!called&&!signal?.aborted);called=true;const r=structuredClone(raw),t=now();
    requireValue(integer(t)&&p.observedAt<=t&&t<p.validUntil&&p.elapsedMs<=t-p.observedAt);
    requireValue(r?.provider===p.provider&&r.keyId===e.keyId&&r.active===true&&id(r.revision)&&r.source==='independent_provider_observation');
    requireValue(r.review?.accepted===true&&id(r.review.id)&&hash(r.review.sourceSha256));
    requireValue(integer(r.effectiveAt)&&r.effectiveAt<=p.observedAt&&(r.expiresAt===null||integer(r.expiresAt)&&t<r.expiresAt));
    requireValue(Array.isArray(r.policies)&&r.policies.every(x=>exact(x,['course','lesson','mediaId','videoRevision','policyVersion'])));
    requireValue(r.policies.some(x=>x.course===p.course&&x.lesson===p.lesson&&x.mediaId===p.mediaId&&x.videoRevision===p.videoRevision&&x.policyVersion===p.policyVersion));
    requireValue(typeof r.publicKeyPem==='string'&&r.publicKeyPem.length<=4096&&hash(r.publicKeySha256));
    const key=createPublicKey(r.publicKeyPem);requireValue(key.asymmetricKeyType==='ed25519'&&sha(key.export({type:'spki',format:'der'}))===r.publicKeySha256);
    requireValue(verify(null,Buffer.concat([Buffer.from(PLAYBACK_SIGNATURE_DOMAIN),bytes]),key,signature)&&!signal?.aborted);
    deadline=Math.min(p.validUntil,r.expiresAt===null?Infinity:r.expiresAt);
    result=Object.freeze({...p,source:r.source,envelopeSha256:sha(envelope),observerRevision:r.revision,observerReview:r.review.id});
   },{signal});
   requireValue(called&&result&&!signal?.aborted&&integer(now())&&now()<deadline);
   return result;
  }catch{return null}
 };
}
