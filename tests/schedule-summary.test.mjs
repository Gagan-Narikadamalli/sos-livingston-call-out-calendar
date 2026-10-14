import assert from 'node:assert/strict';
import {test} from 'node:test';
import {hasScheduledHours,summarizeSchedules} from '../lib/schedule-summary.mjs';
test('blank and off days do not count as scheduled hours',()=>{
  for(const value of ['',null,'  ','Off','N/A','—','PTO','not working'])assert.equal(hasScheduledHours(value),false);
  for(const value of ['9:00 AM - 5:00 PM','8-4','9–12, 1–5'])assert.equal(hasScheduledHours(value),true);
});
test('counts each person once per day and includes category breakdowns',()=>{
 const days=summarizeSchedules([{category:'Employee',monday:'9-5'},{category:'BCBA',monday:'9-12, 1-5'},{category:'Intern',tuesday:'9-5'}],[{category:'Home Client',monday:'9-5'},{category:'Client/Kid',monday:'10-3'}]);
 assert.deepEqual([days[0].employees,days[0].regular,days[0].bcba,days[0].interns,days[0].clients,days[0].home],[2,1,1,0,2,1]);
 assert.equal(days[1].employees,1);assert.equal(days[1].clients,0);assert.equal(days[4].employees,0);
});
test('10% rounds up and shortages and surplus never become negative',()=>{
 const staff=Array.from({length:11},()=>({monday:'9-5'}));const clients=Array.from({length:5},()=>({monday:'9-5'}));
 const row=summarizeSchedules(staff.slice(0,10),clients)[0];assert.deepEqual([row.callOuts,row.remaining,row.shortage,row.surplus],[1,9,0,4]);
 assert.equal(summarizeSchedules(staff,clients)[0].callOuts,2);
 assert.equal(summarizeSchedules(staff.slice(0,4),clients)[0].shortage,2);
 assert.equal(summarizeSchedules([],clients)[0].shortage,5);
 assert.equal(summarizeSchedules([],[])[0].callOuts,0);
});
