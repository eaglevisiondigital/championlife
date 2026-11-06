import {materialize,verifySuccessor,pins} from './composition.mjs';
import path from 'node:path';
const target=process.argv[2];if(!target||!path.isAbsolute(target))throw Error('Pass a new absolute disposable directory');
const source=verifySuccessor(),plans=materialize(target);
console.log(JSON.stringify({status:'PASS',source,pins,target,files:Object.fromEntries(Object.entries(plans).map(([k,v])=>[k,Object.keys(v).length])),hostedAcceptance:false}));
