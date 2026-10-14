export const SUMMARY_DAYS=['monday','tuesday','wednesday','thursday','friday'];

// A name alone, an empty cell, or an explicit off-day is not availability.
export function hasScheduledHours(value){
  const text=String(value??'').trim();
  return Boolean(text)&&! /^(off|out|n\/?a|none|not working|pto|closed|[-–—])$/i.test(text)&&/\d/.test(text);
}
export function summarizeSchedules(employees,clients){
  return SUMMARY_DAYS.map(day=>{
    const staff=employees.filter(row=>hasScheduledHours(row[day]));
    const kids=clients.filter(row=>hasScheduledHours(row[day]));
    const callOuts=Math.ceil(staff.length/10);
    const remaining=staff.length-callOuts;
    const categoryCount=match=>staff.filter(row=>match(String(row.category||'').toLowerCase())).length;
    return {day,employees:staff.length,clients:kids.length,
      regular:categoryCount(value=>!value.includes('bcba')&&!value.includes('intern')),
      bcba:categoryCount(value=>value.includes('bcba')),
      interns:categoryCount(value=>value.includes('intern')),
      home:kids.filter(row=>String(row.category||'').toLowerCase().includes('home')).length,
      callOuts,remaining,shortage:Math.max(0,kids.length-remaining),surplus:Math.max(0,remaining-kids.length)};
  });
}
