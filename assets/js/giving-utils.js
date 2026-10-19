/* Exact money and private CSV helpers shared by the finance foundation. */
(() => {'use strict';
 function amountToMinor(text,scale=2,allowZero=false){if(!Number.isInteger(scale)||scale<0||scale>4)throw Error('Invalid currency scale');const value=String(text).trim();if(!/^\d+(\.\d+)?$/.test(value))throw Error('Enter a positive amount');const [whole,fraction='']=value.split('.');if(fraction.length>scale)throw Error('Too many decimal places');const amount=BigInt(whole)*10n**BigInt(scale)+BigInt((fraction+'0'.repeat(scale)).slice(0,scale)||'0');if(amount<0n||(!allowZero&&amount===0n)||amount>1000000000000n)throw Error('Amount outside allowed range');return amount.toString();}
 function money(minor,currency='USD',scale=2){const v=BigInt(minor),sign=v<0n?'-':'',absolute=v<0n?-v:v,unit=10n**BigInt(scale);return currency+' '+sign+(absolute/unit).toLocaleString('en-US')+(scale?'.'+String(absolute%unit).padStart(scale,'0'):'');}
 function csvCell(value){let s=String(value??'');if(/^[\s\u0000-\u001f]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
 function csv(rows,headers){return [headers,...rows.map(r=>headers.map(h=>r[h]))].map(row=>row.map(csvCell).join(',')).join('\r\n');}
 window.GivingUtils=Object.freeze({amountToMinor,money,csv,csvCell});
})();
