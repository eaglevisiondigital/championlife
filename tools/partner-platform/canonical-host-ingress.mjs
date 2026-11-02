// SERVER-ONLY, UNMOUNTED. No endpoint, credential, login role or provider setup.
// Issuer/public key and acquire are trusted host configuration, NEVER request data.
import {AuthClient} from '@supabase/auth-js';
import {createPublicKey,randomUUID} from 'node:crypto';
import {createRestrictedCanonicalPartnerRoutineRepository} from './canonical-repository.mjs';
import {createCanonicalPartnerIdentityBoundary} from './canonical-identity-boundary.mjs';

const unavailable=()=>{throw Error('Canonical identity unavailable')};
const unknown=()=>Object.freeze({identityStatus:'unverified',personId:null});
const requireValue=value=>{if(!value)unavailable()};
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const record=value=>value&&Object.getPrototypeOf(value)===Object.prototype&&Reflect.ownKeys(value).every(key=>typeof key==='string'&&Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),'value'));
const exact=(value,keys)=>record(value)&&Reflect.ownKeys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const requestKeys=['accessToken','organizationId','campaignId','assignmentId'];

export function createCanonicalPartnerHostIngress(options){
 requireValue(exact(options,['issuer','publicJwk','acquire']));
 const {issuer,acquire}=options;
 requireValue(typeof issuer==='string'&&typeof acquire==='function'&&globalThis.crypto?.subtle);
 const url=new URL(issuer);
 requireValue(url.protocol==='https:'&&url.origin+url.pathname===issuer&&url.pathname==='/auth/v1'&&!url.username&&!url.password);
 requireValue(record(options.publicJwk));
 const jwk=structuredClone(options.publicJwk);
 requireValue(Object.keys(jwk).every(key=>['kty','crv','x','y','kid','alg','use','key_ops','ext'].includes(key)));
 requireValue(jwk.kty==='EC'&&jwk.crv==='P-256'&&jwk.alg==='ES256'&&jwk.use==='sig'&&typeof jwk.kid==='string'&&jwk.kid.length>0&&jwk.kid.length<=128);
 requireValue(['x','y'].every(key=>typeof jwk[key]==='string'&&/^[A-Za-z0-9_-]{43}$/.test(jwk[key])&&Buffer.from(jwk[key],'base64url').toString('base64url')===jwk[key]));
 requireValue(jwk.key_ops===undefined||JSON.stringify(jwk.key_ops)==='["verify"]');
 requireValue(jwk.ext===undefined||typeof jwk.ext==='boolean');
 requireValue(createPublicKey({key:jwk,format:'jwk'}).asymmetricKeyDetails?.namedCurve==='prime256v1');
 if(jwk.key_ops)Object.freeze(jwk.key_ops);Object.freeze(jwk);
 // Use the existing SDK version's verifier, with explicit public keys and a
 // private cache namespace. No discovery, getUser/HS fallback or stored session.
 const sdk=new AuthClient({url:issuer,storageKey:'partner-unmounted-'+randomUUID(),
  autoRefreshToken:false,persistSession:false,detectSessionInUrl:false,skipAutoInitialize:true,
  debug:false,fetch:async()=>unavailable()});
 const active=new Set();let retired=false;
 return Object.freeze({
  retire(){retired=true;for(const controller of active)controller.abort()},
  async read(input,signal){
   let controller,abort;
   try{
    requireValue(!retired&&signal instanceof AbortSignal&&!signal.aborted&&exact(input,requestKeys));
    const {accessToken,...request}={...input};
    requireValue(Object.values(request).every(uuid)&&typeof accessToken==='string'&&accessToken.length<=16384);
    const parts=accessToken.split('.');
    requireValue(parts.length===3&&parts.every(part=>/^[A-Za-z0-9_-]+$/.test(part)&&Buffer.from(part,'base64url').toString('base64url')===part));
    // This unverified header only narrows accepted input. Authority comes from
    // SDK signature verification, then the existing locked database read.
    const header=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
    requireValue(exact(header,['alg','typ','kid'])&&header.alg==='ES256'&&header.typ==='JWT'&&header.kid===jwk.kid&&Buffer.from(parts[2],'base64url').length===64);
    controller=new AbortController();active.add(controller);abort=()=>controller.abort();
    signal.addEventListener('abort',abort,{once:true});
    const live=()=>requireValue(!retired&&!signal.aborted&&!controller.signal.aborted);
    live();
    const {data,error}=await sdk.getClaims(accessToken,{jwks:{keys:[jwk]}});
    live();requireValue(!error&&record(data?.claims));
    const claims=data.claims,seconds=Math.floor(Date.now()/1000);
    requireValue(claims.iss===issuer&&claims.aud==='authenticated'&&claims.role==='authenticated'&&claims.is_anonymous===false);
    requireValue(uuid(claims.sub)&&uuid(claims.session_id)&&Number.isSafeInteger(claims.iat)&&claims.iat>0&&claims.iat<=seconds);
    requireValue(Number.isSafeInteger(claims.exp)&&claims.exp>seconds&&claims.exp>claims.iat&&Number.isSafeInteger(claims.exp*1000));
    requireValue(claims.nbf===undefined||(Number.isSafeInteger(claims.nbf)&&claims.nbf>0&&claims.nbf<=seconds));
    // Ignore email, names, user_metadata, app_metadata, role tags and scopes.
    // Each request owns this immutable principal; no ambient/shared session.
    const principal=Object.freeze({userId:claims.sub,sessionId:claims.session_id,verified:true,expiresAt:new Date(claims.exp*1000).toISOString()});
    const current=()=>{live();requireValue(Date.now()<claims.exp*1000)};
    const repository=createRestrictedCanonicalPartnerRoutineRepository({acquire:async()=>{
     current();const connection=await acquire(Object.freeze({signal:controller.signal}));
     let closed=false,disposal;
     const close=discard=>{closed=true;return disposal??=Promise.resolve().then(()=>connection.release(discard))};
     const cancel=()=>{void close(true).catch(()=>{})};
     controller.signal.addEventListener('abort',cancel,{once:true});
     try{current()}catch{await close(true).catch(()=>{});controller.signal.removeEventListener('abort',cancel);unavailable()}
     return Object.freeze({
      async query(sql,values){
       // Rollback must still run on expiry/retirement. Destruction on abort
       // releases locks even when a query is blocked; never recycle this lease.
       if(closed)unavailable();if(sql!=='rollback')current();
       const result=await connection.query(sql,values);
       if(sql!=='rollback')current();return result;
      },
      async release(discard){try{await close(discard||controller.signal.aborted)}finally{controller.signal.removeEventListener('abort',cancel)}}
     });
    }});
    const boundary=createCanonicalPartnerIdentityBoundary({repository,getPrincipal:()=>{current();return principal}});
    const result=await boundary.read(request);current();return result;
   }catch{return unknown()}
   finally{if(controller)active.delete(controller);if(abort)signal.removeEventListener('abort',abort)}
  }
 });
}
