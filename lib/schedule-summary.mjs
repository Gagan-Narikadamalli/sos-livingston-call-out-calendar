import {WEEKDAYS,parseScheduleTime,isOffDay,scheduleCategory} from './schedule-time.mjs';
export const SUMMARY_DAYS=WEEKDAYS;
export const hasScheduledHours=value=>{const time=parseScheduleTime(value);return time.valid&&time.minutes>0;};
export const isCenterClient=row=>!String(row.category||'').toLowerCase().includes('home');
export function coverageEstimate(staff,clients){
 const callOuts=Math.ceil(staff/10),remaining=staff-callOuts;
 return {staff,callOuts,remaining,shortage:Math.max(0,clients-remaining),surplus:Math.max(0,remaining-clients)};
}
export function summarizeSchedules(employees,clients){
 const centerClients=clients.filter(isCenterClient);
 return SUMMARY_DAYS.map(day=>{
   const staff=employees.filter(row=>hasScheduledHours(row[day]));
   const kids=centerClients.filter(row=>hasScheduledHours(row[day]));
   const group=category=>staff.filter(row=>scheduleCategory(row)===category);
   const minutes=rows=>rows.reduce((total,row)=>total+parseScheduleTime(row[day]).minutes,0);
   const bt=group('bt'),bcba=group('bcba'),intern=group('intern');
   return {day,employees:staff.length,clients:kids.length,bt:bt.length,bcba:bcba.length,interns:intern.length,
     staffMinutes:minutes(staff),btMinutes:minutes(bt),bcbaMinutes:minutes(bcba),internMinutes:minutes(intern),
     btOnly:coverageEstimate(bt.length,kids.length),withInterns:coverageEstimate(bt.length+intern.length,kids.length)};
 });
}
export function averageBtShortage(days){return days.length?days.reduce((total,day)=>total+day.btOnly.shortage,0)/days.length:0;}
export function invalidScheduleEntries(employees,clients){
 return [...employees,...clients.filter(isCenterClient)].flatMap(row=>SUMMARY_DAYS.filter(day=>!isOffDay(row[day])&&!parseScheduleTime(row[day]).valid).map(day=>({id:row.id,name:[row.first_name,row.last_name].filter(Boolean).join(' '),day,value:row[day]})));
}
