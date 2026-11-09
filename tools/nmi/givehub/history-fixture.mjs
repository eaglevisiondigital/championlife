import {fixture,authority} from './fixture.mjs';
export {authority};
export function historyFixture(){
 const b=fixture(),gift=b.transactions[0];
 const correction=(id,parent,kind,direction,amount,day)=>({...parent,source_transaction_id:id,amount_minor:'0',received_at_utc:`2025-12-${day}T18:00:00Z`,source_receipt_reference_or_null:'Receipt-'+id,original_source_transaction_id_or_null:parent.source_transaction_id,correction_kind_or_null:kind,correction_amount_minor_or_null:amount,...(kind==='adjustment'?{adjustment_direction:direction}:{})});
 b.transactions=b.transactions.filter(r=>r.correction_kind_or_null===null);
 b.transactions.push(correction('Partial1',gift,'refund','decrease','2000','11'),correction('Partial2',gift,'refund','decrease','1000','12'),correction('Increase1',gift,'adjustment','increase','500','13'),correction('Decrease1',gift,'adjustment','decrease','250','14'));
 const merch=b.transactions.find(r=>r.source_transaction_id==='Gift3');b.transactions.push(correction('FullRefund',merch,'refund','decrease','3000','15'));
 b.control_totals[0]={...b.control_totals[0],refunds:'3000',adjustments:'250'};b.control_totals[1]={...b.control_totals[1],refunds:'3000'};
 b.statements[0]={...b.statements[0],contribution_minor:'10250',refund_minor:'6000'};
 return b;
}
