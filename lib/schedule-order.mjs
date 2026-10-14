const collator=new Intl.Collator('en-US',{sensitivity:'base',numeric:true});
export function sortScheduleRows(rows){
 return [...rows].sort((a,b)=>collator.compare(String(a.first_name||'').trim(),String(b.first_name||'').trim())||collator.compare(String(a.last_name||'').trim(),String(b.last_name||'').trim())||collator.compare(String(a.id||''),String(b.id||'')));
}
