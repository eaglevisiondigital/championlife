// TEST ONLY. Ephemeral fictional issuer: never Supabase provider acceptance.
import {generateKeyPairSync,sign,randomUUID} from 'node:crypto';
export function signedHostFixture(f){
 const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 const publicJwk={...publicKey.export({format:'jwk'}),kid:randomUUID(),alg:'ES256',use:'sig'};
 const issuer='https://fictional-partner-issuer.invalid/auth/v1';
 const header={alg:'ES256',typ:'JWT',kid:publicJwk.kid};
 return {issuer,publicJwk,token(overrides={},headers={}){
  const seconds=Math.floor(Date.now()/1000);
  const claims={iss:issuer,aud:'authenticated',role:'authenticated',is_anonymous:false,
   sub:f.actor,session_id:f.session,iat:seconds-30,exp:seconds+3600,...overrides};
  const input=[{...header,...headers},claims].map(value=>Buffer.from(JSON.stringify(value)).toString('base64url')).join('.');
  return input+'.'+sign('sha256',Buffer.from(input),{key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
 }};
}
