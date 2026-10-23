import {normalizeDayColors} from './schedule-colors.mjs';
import {sortScheduleRows} from './schedule-order.mjs';
import {WEEKDAYS,DAY_NAMES,parseScheduleTime,normalizedScheduleTime,scheduleCategory} from './schedule-time.mjs';
import {summarizeSchedules,averageDailyMetrics,averageBtShortage,weeklyHourMetrics,invalidScheduleEntries,isCenterClient} from './schedule-summary.mjs';
const categoryName=row=>({bt:'BT',bcba:'BCBA',intern:'Intern',managerhr:'Manager/HR'}[scheduleCategory(row)]);
const name=row=>[row.first_name,row.last_name].filter(Boolean).join(' ');
const hours=value=>{const parsed=parseScheduleTime(value);return parsed.valid?parsed.minutes/60:'Needs correction';};
function scheduleSheet(title,rows,kind){
 const headers=['First Name','Last Name',...DAY_NAMES,'Notes'];
 const categories=kind==='employee'?[['BT','bt','DDEEDD'],['BCBA','bcba','DEF2F5'],['Manager/HR','managerhr','FFF2BA'],['Interns','intern','EDE3F5']]:[['In-center clients','center','FFE9CC'],['Home clients','home','FBE5EA']];
 const sorted=sortScheduleRows(rows);
 const values=row=>[row.first_name||'',row.last_name||'',...WEEKDAYS.map(day=>{const parsed=parseScheduleTime(row[day]);return parsed.valid?normalizedScheduleTime(row[day]).replace(/\b0(?=\d:)/g,'').replaceAll(' - ',' to '):String(row[day]||'');}),row.notes||''];
 const groups=categories.map(([label,key,tint])=>({title:label,tint,rows:sorted.filter(row=>(kind==='employee'?scheduleCategory(row):isCenterClient(row)?'center':'home')===key).map(values),colors:sorted.filter(row=>(kind==='employee'?scheduleCategory(row):isCenterClient(row)?'center':'home')===key).map(row=>normalizeDayColors(row.day_colors))}));
 return {name:title,headers,rows:groups.flatMap(group=>group.rows),groups};
}
export function buildScheduleExport(kind,employees,clients){
 if(kind==='employee')return [scheduleSheet('Employee Schedule',employees,'employee')];
 if(kind==='client')return [scheduleSheet('Client Schedule',clients,'client')];
 const days=summarizeSchedules(employees,clients),average=averageDailyMetrics(days),weekly=weeklyHourMetrics(days,employees);
 const metrics=row=>[row.bt,row.bcba,row.interns,row.clients,row.btMinutes/60,row.bcbaMinutes/60,row.internMinutes/60,row.staffMinutes/60,row.clientMinutes/60];
 const coverage=(key,title)=>({name:title,headers:['Day','Staff','Clients','10% Call-outs','Staff Remaining','Shortage','Surplus'],rows:days.map(row=>[DAY_NAMES[WEEKDAYS.indexOf(row.day)],row[key].staff,row.coverageClients,row[key].callOuts,row[key].remaining,row[key].shortage,row[key].surplus])});
 const sheets=[
 {name:'Overview',headers:['Metric','Value'],rows:[['Total employees',employees.length],['Total in-center clients',clients.filter(isCenterClient).length],['Average BT shortage',averageBtShortage(days)],['Weekly total staff hours (40h cap/person)',weekly.staffMinutes/60],['Weekly total client hours',weekly.clientMinutes/60],['Weekly supervisor hours (20%)',weekly.supervisorMinutes/60],['Weekly client + supervisor hours',weekly.clientAndSupervisorMinutes/60],['Client + supervisor ÷ staff hours',weekly.combinedToStaffRatio===null?'N/A':weekly.combinedToStaffRatio],['Coverage minimum scheduled hours',4],['Assumed call-out rate',0.1],['Coverage categories','BT only; BT + interns. BCBA and Manager/HR excluded.'],['Clients included in summary','In-center clients only'],['Average period','Monday–Friday, including zero days']]},
 {name:'Daily Summary',headers:['Day','BT','BCBA','Interns','Clients','BT Hours','BCBA Hours','Intern Hours','Total Staff Hours','Total Client Hours'],rows:[...days.map(row=>[DAY_NAMES[WEEKDAYS.indexOf(row.day)],...metrics(row)]),['Average',...metrics(average)]]},
 coverage('btOnly','BT Coverage'),coverage('withInterns','BT and Intern Coverage'),
 {name:'Staff Hours',headers:['Staff Member','Category',...DAY_NAMES,'Weekly Hours'],rows:sortScheduleRows(employees).map(row=>{const daily=WEEKDAYS.map(day=>hours(row[day]));return [name(row),categoryName(row),...daily,daily.every(value=>typeof value==='number')?daily.reduce((sum,value)=>sum+value,0):'Incomplete'];})},
 ];
 const invalid=invalidScheduleEntries(employees,clients);
 if(invalid.length)sheets.push({name:'Times to Correct',headers:['Name','Day','Entered Time'],rows:invalid.map(row=>[row.name,DAY_NAMES[WEEKDAYS.indexOf(row.day)],row.value])});
 return sheets;
}
