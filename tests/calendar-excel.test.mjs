import {listCalendarMonths} from '../lib/calendar-months.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import ExcelJS from 'exceljs';
import {calendarExportData,createCalendarWorkbook,createCalendarRangeWorkbook} from '../lib/calendar-excel.mjs';
test('month grid handles leap years, Sunday-first placement, and six-week months',()=>{
 const feb=calendarExportData('2024-02',[],[]);assert.equal(feb.weeks.flat().filter(Boolean).length,29);assert.equal(feb.weeks[0][4].day,1);
 assert.equal(calendarExportData('2026-08',[],[]).weeks.length,6);
 assert.throws(()=>calendarExportData('2026-13',[],[]));
});
test('calendar preserves same-day events and recurring notes and excludes other months',()=>{
 const data=calendarExportData('2026-10',[{event_date:'2026-10-01',name:'Alex',request_type:'PTO',reason:'Vacation'},{event_date:'2026-09-30',name:'Old'}],[{event_date:'2026-10-01',title:'Client out',note_category:'Parent Note',note_type:'Out',details:'All day'},{event_date:'2026-10-02',title:'Recurring'}]);
 assert.equal(data.events.length,3);assert.equal(data.weeks.flat().find(day=>day?.day===1).events.length,2);assert.equal(data.events[1].category,'Parent/Client Note');
});
test('xlsx contains styled month grid and complete event details without formula interpretation',async()=>{
 const notes=[{event_date:'2026-10-01',title:'=HYPERLINK("bad")',note_type:'Out',details:'Long note '.repeat(100)}];
 const workbook=await createCalendarWorkbook(ExcelJS,{month:'2026-10',notes,location:'Test',filterLabel:'Manager notes'});
 const read=new ExcelJS.Workbook();await read.xlsx.load(await workbook.xlsx.writeBuffer());
 assert.equal(read.worksheets.length,2);const sheet=read.getWorksheet('Monthly Calendar');
 assert.ok(sheet.getCell('B1').value.includes('OCTOBER 2026'));assert.equal(sheet.getCell('F5').value,1);assert.ok(sheet.getCell('F6').value.includes('=HYPERLINK'));
 assert.equal(sheet.getCell('F6').fill.fgColor.argb,'FF2D7485');assert.equal(sheet.getCell('J4').value,'OCT');
 assert.equal(read.getWorksheet('Event Details').getCell('C4').value,notes[0].title);assert.equal(read.getWorksheet('Event Details').getCell('E4').value,notes[0].details);
});
test('empty month still exports calendar and detail headers',async()=>{
 const workbook=await createCalendarWorkbook(ExcelJS,{month:'2026-02',location:'Test'});assert.equal(workbook.getWorksheet('Event Details').getCell('A3').value,'Date');
});

test('inclusive month ranges cross years and reject reversed or invalid inputs',()=>{
 assert.deepEqual(listCalendarMonths('2026-12','2027-02'),['2026-12','2027-01','2027-02']);
 assert.deepEqual(listCalendarMonths('2026-10','2026-10'),['2026-10']);
 assert.throws(()=>listCalendarMonths('2026-12','2026-01'));
 assert.throws(()=>listCalendarMonths('2026-13','2027-01'));
});
test('multi-month workbook preserves each month grid, notes, styling and unique sheet names',async()=>{
 const workbook=await createCalendarRangeWorkbook(ExcelJS,{location:'Test',months:[{month:'2026-12',entries:[{event_date:'2026-12-01',name:'Alex',request_type:'PTO'}],notes:[]},{month:'2027-01',entries:[],notes:[{event_date:'2027-01-01',title:'January event',details:'Full note'}]}]});
 const read=new ExcelJS.Workbook();await read.xlsx.load(await workbook.xlsx.writeBuffer());
 assert.deepEqual(read.worksheets.map(sheet=>sheet.name),['2026-12 Calendar','2026-12 Details','2027-01 Calendar','2027-01 Details']);
 assert.ok(read.getWorksheet('2026-12 Calendar').getCell('B1').value.includes('DECEMBER 2026'));
 assert.ok(read.getWorksheet('2027-01 Calendar').getCell('B1').value.includes('JANUARY 2027'));
 assert.equal(read.getWorksheet('2026-12 Details').getCell('C4').value,'Alex');
 assert.equal(read.getWorksheet('2027-01 Details').getCell('C4').value,'January event');
 assert.equal(read.getWorksheet('2027-01 Details').getCell('E4').value,'Full note');
 assert.equal(read.getWorksheet('2027-01 Calendar').getCell('B1').fill.fgColor.argb,'FF2D7485');
});
