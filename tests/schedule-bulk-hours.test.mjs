import assert from 'node:assert/strict';
import {test} from 'node:test';
import {applyHoursToDays,parseScheduleTime,WEEKDAYS} from '../lib/schedule-time.mjs';

test('one click applies one range to all weekdays without modifying the source record',()=>{
 const row={first_name:'Test',monday:'',tuesday:'',wednesday:'',thursday:'',friday:'',notes:'Keep me',day_colors:{monday:'#800000'}};
 const result=applyHoursToDays(row,WEEKDAYS,'08:30','16:00');
 assert.equal(row.monday,'');
 for(const day of WEEKDAYS)assert.equal(parseScheduleTime(result[day]).minutes,450);
 assert.equal(result.notes,'Keep me');
 assert.deepEqual(result.day_colors,{monday:'#800000'});
});
test('selected days change while unselected days and split shifts remain untouched',()=>{
 const row={monday:'9-12;1-5',tuesday:'8-4',wednesday:'',thursday:'Off',friday:'10-2'};
 const result=applyHoursToDays(row,['tuesday','thursday'],'09:00','15:30');
 assert.equal(result.monday,'9-12;1-5');
 assert.equal(result.wednesday,'');
 assert.equal(result.friday,'10-2');
 assert.equal(parseScheduleTime(result.tuesday).minutes,390);
 assert.equal(result.tuesday,result.thursday);
});
test('quick fill requires selected days and a valid time range',()=>{
 const row={monday:''};
 for(const args of [[[], '09:00','17:00'],[['monday'],'','17:00'],[['monday'],'15:00','09:00'],[['sunday'],'09:00','17:00'],[['monday'],'12:00','12:00']]){
  assert.throws(()=>applyHoursToDays(row,...args));
 }
 assert.deepEqual(row,{monday:''});
});
