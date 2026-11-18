import {WEEKDAYS,parseScheduleTime,isOffDay,scheduleCategory} from './schedule-time.mjs';
export const SUMMARY_DAYS=WEEKDAYS;
export const isOnHold=row=>row?.on_hold===true||row?.on_hold===1||row?.on_hold==='true';
const padDatePart=value=>String(value).padStart(2,'0');
export function scheduleDateKey(value){
 if(!value)return '';
 if(value instanceof Date&&!Number.isNaN(value.getTime()))return `${value.getUTCFullYear()}-${padDatePart(value.getUTCMonth()+1)}-${padDatePart(value.getUTCDate())}`;
 const match=String(value).trim().match(/^(\d{4}-\d{2}-\d{2})/);
 return match?match[1]:'';
}
export function currentScheduleDateKey(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const values=Object.fromEntries(parts.map(part=>[part.type,part.value]));
 return `${values.year}-${values.month}-${values.day}`;
}
export function isActiveOnDate(row,date=currentScheduleDateKey()){
 const dateKey=typeof date==='string'?scheduleDateKey(date):currentScheduleDateKey(date);
 if(!dateKey)return true;
 const start=scheduleDateKey(row.start_date),end=scheduleDateKey(row.end_date);
 return (!start||start<=dateKey)&&(!end||end>=dateKey);
}
export const hasScheduledHours=value=>{const time=parseScheduleTime(value);return time.valid&&time.minutes>0;};
export const qualifiesForCoverage=value=>{const time=parseScheduleTime(value);return time.valid&&time.minutes>=240;};
export const isCenterClient=row=>!String(row.category||'').toLowerCase().includes('home');
export function coverageEstimate(staff,clients){
 const callOuts=Math.ceil(staff/10),remaining=staff-callOuts;
 return {staff,callOuts,remaining,shortage:Math.max(0,clients-remaining),surplus:Math.max(0,remaining-clients)};
}
export function summarizeSchedules(employees,clients,asOfDate=currentScheduleDateKey()){
 const activeEmployees=employees.filter(row=>!isOnHold(row)&&isActiveOnDate(row,asOfDate));
 const centerClients=clients.filter(row=>!isOnHold(row)&&isCenterClient(row)&&isActiveOnDate(row,asOfDate));
 return SUMMARY_DAYS.map(day=>{
   const staff=activeEmployees.filter(row=>hasScheduledHours(row[day]));
   const kids=centerClients.filter(row=>hasScheduledHours(row[day]));
   const group=category=>staff.filter(row=>scheduleCategory(row)===category);
   const minutes=rows=>rows.reduce((total,row)=>total+parseScheduleTime(row[day]).minutes,0);
   const bt=group('bt'),bcba=group('bcba'),intern=group('intern');
   const coverageClients=kids.filter(row=>qualifiesForCoverage(row[day])).length;
   const coverageBt=bt.filter(row=>qualifiesForCoverage(row[day])).length;
   const coverageInterns=intern.filter(row=>qualifiesForCoverage(row[day])).length;
   return {day,coverageClients,employees:staff.length,clients:kids.length,bt:bt.length,bcba:bcba.length,interns:intern.length,
     clientMinutes:minutes(kids),staffMinutes:minutes(staff),btMinutes:minutes(bt),bcbaMinutes:minutes(bcba),internMinutes:minutes(intern),
     btOnly:coverageEstimate(coverageBt,coverageClients),withInterns:coverageEstimate(coverageBt+coverageInterns,coverageClients)};
 });
}
export function averageBtShortage(days){return days.length?days.reduce((total,day)=>total+day.btOnly.shortage,0)/days.length:0;}
export function futureBtShortage(employees,clients,{startDate=currentScheduleDateKey(),periodDays=30}={}){
 const fromDate=scheduleDateKey(startDate)||currentScheduleDateKey();
 const dayCount=Math.max(1,Math.floor(Number(periodDays)||30));
 const projectionCursor=new Date(fromDate+'T00:00:00.000Z');
 projectionCursor.setUTCDate(projectionCursor.getUTCDate()+dayCount-1);
 const toDate=scheduleDateKey(projectionCursor);
 // Project the full weekly schedule using the roster active at the end of the forecast window.
 const projectedDays=summarizeSchedules(employees,clients,toDate);
 const weeklyAverage=averageBtShortage(projectedDays);
 const days=projectedDays.map(row=>({
  date:toDate,
  day:row.day,
  staff:row.btOnly.staff,
  clients:row.coverageClients,
  callOuts:row.btOnly.callOuts,
  remaining:row.btOnly.remaining,
  shortage:row.btOnly.shortage,
  surplus:row.btOnly.surplus
 }));
 return {fromDate,toDate,projectionDate:toDate,periodDays:dayCount,weekdayCount:projectedDays.length,shortage:Math.round(weeklyAverage),days};
}
export const MAX_COUNTED_WEEKLY_STAFF_MINUTES=40*60;
// Cap each employee's combined Monday–Friday hours, not individual day totals.
export function cappedWeeklyStaffMinutes(employees){
 return employees.filter(employee=>!isOnHold(employee)).reduce((total,employee)=>{
  const actual=SUMMARY_DAYS.reduce((sum,day)=>sum+parseScheduleTime(employee[day]).minutes,0);
  return total+Math.min(actual,MAX_COUNTED_WEEKLY_STAFF_MINUTES);
 },0);
}
export function weeklyHourMetrics(days,employees){
 const staffMinutes=cappedWeeklyStaffMinutes(employees);
 const clientMinutes=days.reduce((total,day)=>total+day.clientMinutes,0);
 const supervisorMinutes=clientMinutes*0.2;
 return {
   staffMinutes,
   clientMinutes,
   supervisorMinutes,
   clientAndSupervisorMinutes:clientMinutes+supervisorMinutes,
   combinedToStaffRatio:staffMinutes>0?(clientMinutes+supervisorMinutes)/staffMinutes:null
 };
}
export function invalidScheduleEntries(employees,clients,asOfDate=currentScheduleDateKey()){
 return [...employees,...clients.filter(isCenterClient)].filter(row=>!isOnHold(row)&&isActiveOnDate(row,asOfDate)).flatMap(row=>SUMMARY_DAYS.filter(day=>!isOffDay(row[day])&&!parseScheduleTime(row[day]).valid).map(day=>({id:row.id,name:[row.first_name,row.last_name].filter(Boolean).join(' '),day,value:row[day]})));
}

export function averageDailyMetrics(days){
 const fields=['bt','bcba','interns','clients','btMinutes','bcbaMinutes','internMinutes','staffMinutes','clientMinutes'];
 return Object.fromEntries(fields.map(field=>[field,days.length?days.reduce((sum,day)=>sum+day[field],0)/days.length:0]));
}
