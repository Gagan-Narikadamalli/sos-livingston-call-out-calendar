import assert from 'node:assert/strict';
import {test} from 'node:test';
import {hasScheduledHours,qualifiesForCoverage,summarizeSchedules,averageDailyMetrics,averageBtShortage,weeklyHourMetrics,invalidScheduleEntries} from '../lib/schedule-summary.mjs';
import {parseScheduleTime,normalizedScheduleTime,serializeRanges} from '../lib/schedule-time.mjs';
test('blank/off days are not availability; malformed times are flagged',()=>{
 for(const value of ['',null,'  ','Off','N/A','—','---','PTO','not working'])assert.equal(hasScheduledHours(value),false);
 for(const value of ['8:12:00','3:30-5:5:30','9:75-5','25:00-26:00','09:00 AM - 08:00 AM','09:00 AM - '])assert.equal(parseScheduleTime(value).valid,false,value);
});
test('legacy business times become correct explicit AM/PM ranges',()=>{
 for(const [raw,hours] of [['8-4',8],['09:00 -5:00',8],['8:30-12:30',4],['12:00 - 5:00',5],['4:15-6:30',2.25],['9:30 to 4:00',6.5],['08:00-17:00',9],['9 AM - 5 PM',8],['1-5 PM',4],['9 AM-5',8],['6:30-12:30',6],['6:00-5 PM',11]]){
  const time=parseScheduleTime(raw);assert.equal(time.valid,true,raw);assert.equal(time.minutes,hours*60,raw);
  assert.equal(parseScheduleTime(normalizedScheduleTime(raw)).minutes,time.minutes);
 }
 assert.equal(normalizedScheduleTime('8-4'),'08:00 AM - 04:00 PM');
});
test('multiple shifts total only entered hours and reject overlapping ranges',()=>{
 assert.equal(parseScheduleTime('9-12,1-5').minutes,420);
 assert.equal(parseScheduleTime('09:00 AM - 12:00 PM; 01:00 PM - 05:00 PM').minutes,420);
 assert.equal(parseScheduleTime('9-12;10-1').valid,false);
 assert.equal(parseScheduleTime(serializeRanges([{start:'08:15',end:'16:45'}])).minutes,510);
 assert.equal(parseScheduleTime(serializeRanges([{start:'08:15',end:''}])).valid,false);
});
test('BT-only excludes BCBAs and interns; second calculation adds interns; home clients excluded',()=>{
 const employees=[...Array.from({length:10},()=>({category:'Employee',monday:'9-5'})),{category:'BCBA',monday:'9-5'},{category:'Intern',monday:'9-5'}];
 const clients=[...Array.from({length:10},()=>({category:'Client/Kid',monday:'9-5'})),...Array.from({length:20},()=>({category:'Home Client',monday:'9-5'}))];
 const row=summarizeSchedules(employees,clients)[0];
 assert.deepEqual([row.bt,row.bcba,row.interns,row.clients],[10,1,1,10]);
 assert.deepEqual(row.btOnly,{staff:10,callOuts:1,remaining:9,shortage:1,surplus:0});
 assert.deepEqual(row.withInterns,{staff:11,callOuts:2,remaining:9,shortage:1,surplus:0});
 assert.equal(row.btMinutes,4800);assert.equal(row.staffMinutes,5760);
});
test('BCBA remains zero when absent; daily staffing and hours follow saved days',()=>{
 const days=summarizeSchedules([{category:'BT',monday:'8-4',tuesday:'off'},{category:'Intern',monday:'9-12',friday:'1-5'}],[{monday:'9-5'}]);
 assert.equal(days[0].bcba,0);assert.equal(days[1].employees,0);assert.equal(days[4].interns,1);assert.equal(days[0].staffMinutes,660);
});
test('average BT shortage averages all five weekdays including zeros, without offsetting shortages by surplus',()=>{
 const days=summarizeSchedules([{monday:'9-5'}],[{monday:'9-5',tuesday:'9-5'},{tuesday:'9-5'}]);
 assert.equal(averageBtShortage(days),0.6);assert.equal(averageBtShortage([]),0);
 assert.equal(summarizeSchedules([],[])[0].btOnly.callOuts,0);
 assert.equal(summarizeSchedules([],[{monday:'9-5'}])[0].btOnly.shortage,1);
});
test('bad saved entries are excluded and listed for correction',()=>{
 const employees=[{id:1,first_name:'Staff',monday:'8:12:00'}];
 const clients=[{id:2,first_name:'Client',monday:'8-4'},{id:3,category:'Home Client',monday:'bad'}];
 assert.equal(summarizeSchedules(employees,clients)[0].employees,0);
 assert.deepEqual(invalidScheduleEntries(employees,clients),[{id:1,name:'Staff',day:'monday',value:'8:12:00'}]);
});

test('client hours total split shifts by day, excluding home, blank and malformed entries',()=>{
 const days=summarizeSchedules([], [{category:'Client/Kid',monday:'9-12;1-5',tuesday:'8-4'}, {category:'Client/Kid',monday:'8:30-12:30'}, {category:'Home Client',monday:'9-5'}, {category:'Client/Kid',monday:'bad',tuesday:''}]);
 assert.equal(days[0].clientMinutes,660);
 assert.equal(days[1].clientMinutes,480);
 assert.equal(days[2].clientMinutes,0);
 assert.equal(days.reduce((total,day)=>total+day.clientMinutes,0),1140);
});

test('daily averages include all five days and every count and hours column',()=>{
 const days=summarizeSchedules([{category:'Employee',monday:'8-4'},{category:'Intern',monday:'9-12',tuesday:'9-12'}],[{monday:'8-4',tuesday:'8-4'}]);
 assert.deepEqual(averageDailyMetrics(days),{bt:0.2,bcba:0,interns:0.4,clients:0.4,btMinutes:96,bcbaMinutes:0,internMinutes:72,staffMinutes:168,clientMinutes:192});
 assert.equal(averageDailyMetrics([]).staffMinutes,0);
});

test('four-hour minimum applies to staff and clients for coverage only',()=>{
 for(const value of ['', '8-11', '08:00 AM - 11:59 AM', 'bad'])assert.equal(qualifiesForCoverage(value),false);
 assert.equal(qualifiesForCoverage('8-12'),true);
 assert.equal(qualifiesForCoverage('9-11;1-3'),true);
 const employees=[{category:'Employee',monday:'8-12',tuesday:'8-11'},{category:'Employee',monday:'8-11'},{category:'Intern',monday:'8-12'},{category:'Intern',monday:'8-11'},{category:'BCBA',monday:'8-5'}];
 const clients=[{monday:'8-12',tuesday:'8-11'},{monday:'8-12'},{monday:'8-11'},{category:'Home Client',monday:'8-5'}];
 const days=summarizeSchedules(employees,clients),monday=days[0];
 assert.equal(monday.employees,5);assert.equal(monday.clients,3);
 assert.equal(monday.staffMinutes,1380);assert.equal(monday.clientMinutes,660);
 assert.equal(monday.coverageClients,2);
 assert.deepEqual(monday.btOnly,{staff:1,callOuts:1,remaining:0,shortage:2,surplus:0});
 assert.deepEqual(monday.withInterns,{staff:2,callOuts:1,remaining:1,shortage:1,surplus:0});
 assert.equal(days[1].btOnly.staff,0);assert.equal(days[1].coverageClients,0);assert.equal(days[1].btOnly.shortage,0);
 assert.equal(averageBtShortage(days),0.4);
});

test('Manager/HR contributes to staff hours and roster but not BT or intern coverage',()=>{
 const row=summarizeSchedules([{category:'Manager/HR',monday:'8-4'},{category:'HR',monday:'8-4'},{category:'Employee',monday:'8-4'}],[{monday:'8-4'}])[0];
 assert.equal(row.employees,3);assert.equal(row.staffMinutes,1440);assert.equal(row.bt,1);
 assert.equal(row.btOnly.staff,1);assert.equal(row.withInterns.staff,1);
});

test('weekly supervision is 20% of in-center client hours and combined/ratio metrics use saved totals',()=>{
 const days=summarizeSchedules([{category:'Employee',monday:'9-5'},{category:'Intern',monday:'9-12'}],[
  {category:'Client/Kid',monday:'9-5'},
  {category:'Home Client',monday:'9-5'}
 ]);
 const hours=weeklyHourMetrics(days);
 assert.equal(hours.staffMinutes,660);
 assert.equal(hours.clientMinutes,480);
 assert.equal(hours.supervisorMinutes,96);
 assert.equal(hours.clientAndSupervisorMinutes,576);
 assert.equal(hours.combinedToStaffRatio,576/660);
});
test('supervisor and ratio metrics preserve partial hours and handle zero staff safely',()=>{
 assert.deepEqual(weeklyHourMetrics([{staffMinutes:660,clientMinutes:505}]),{
  staffMinutes:660,clientMinutes:505,supervisorMinutes:101,clientAndSupervisorMinutes:606,combinedToStaffRatio:606/660
 });
 assert.deepEqual(weeklyHourMetrics([]),{
  staffMinutes:0,clientMinutes:0,supervisorMinutes:0,clientAndSupervisorMinutes:0,combinedToStaffRatio:null
 });
 assert.equal(weeklyHourMetrics([{staffMinutes:0,clientMinutes:480}]).combinedToStaffRatio,null);
});
