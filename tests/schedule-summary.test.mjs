import assert from 'node:assert/strict';
import {test} from 'node:test';
import {hasScheduledHours,summarizeSchedules,averageDailyMetrics,averageBtShortage,invalidScheduleEntries} from '../lib/schedule-summary.mjs';
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
