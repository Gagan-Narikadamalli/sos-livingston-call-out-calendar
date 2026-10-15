import assert from 'node:assert/strict';
import {test} from 'node:test';
import {scheduleOutlierIndexes} from '../lib/schedule-time.mjs';
test('majority timing highlights only different days even with the same duration',()=>{
 assert.deepEqual(scheduleOutlierIndexes(['8-4','9-5','8-4','10-6','8-4']),[1,3]);
});
test('equivalent time formats match; blanks and invalid values are excluded',()=>{
 assert.deepEqual(scheduleOutlierIndexes(['8-4','08:00 AM - 04:00 PM','8:00 to 4:00','off','bad']),[]);
 assert.deepEqual(scheduleOutlierIndexes(['8-4','8-4','','9-5','--']),[3]);
});
test('ties or unique timings do not invent a normal schedule',()=>{
 assert.deepEqual(scheduleOutlierIndexes(['8-4','8-4','9-5','9-5','10-6']),[]);
 assert.deepEqual(scheduleOutlierIndexes(['8-4','9-5','10-6','','']),[]);
 assert.deepEqual(scheduleOutlierIndexes(['','','','','']),[]);
});
test('split schedules compare actual ranges and consistent short shifts remain unbolded',()=>{
 assert.deepEqual(scheduleOutlierIndexes(['9-12;1-4','09:00 AM - 12:00 PM; 01:00 PM - 04:00 PM','9-3','','']),[2]);
 assert.deepEqual(scheduleOutlierIndexes(['4:30-6:30','4:30-6:30','4:30-6:30','4:30-6:30','4:30-6:30']),[]);
});
