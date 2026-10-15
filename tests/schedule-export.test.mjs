import assert from 'node:assert/strict';
import {test} from 'node:test';
import ExcelJS from 'exceljs';
import {buildScheduleExport} from '../lib/schedule-export-data.mjs';
import {createScheduleWorkbook} from '../lib/schedule-excel.mjs';
const employees=[{id:1,first_name:'Alex',last_name:'Staff',category:'Employee',monday:'8-4',notes:'Split schedule notes'},{id:2,first_name:'HR',category:'Manager/HR',monday:'9-5'}];
const clients=[{id:3,first_name:'Center',monday:'8-4'},{id:4,first_name:'Home',category:'Home Client',monday:'9-5'},{id:5,first_name:'Short',monday:'8-11'}];
test('separate schedule exports preserve full names, category, notes, timing and hours',()=>{
 const staff=buildScheduleExport('employee',employees,clients);assert.equal(staff.length,1);assert.equal(staff[0].rows.length,2);
 assert.equal(staff[0].rows[0][2],'8:00 AM to 4:00 PM');assert.equal(staff[0].rows[0][7],'Split schedule notes');assert.equal(staff[0].headers.length,8);assert.ok(!staff[0].headers.some(header=>header.includes('Hours')));
 assert.equal(staff[0].groups.find(group=>group.title==='Manager/HR').rows[0][0],'HR');
 const kids=buildScheduleExport('client',employees,clients);assert.equal(kids[0].rows.length,3);assert.equal(kids[0].groups.find(group=>group.title==='Home clients').rows.length,1);
});
test('summary export matches daily averages and coverage population without home clients',()=>{
 const sheets=buildScheduleExport('summary',employees,clients);
 assert.equal(sheets.find(sheet=>sheet.name==='Daily Summary').rows.at(-1)[0],'Average');
 assert.equal(sheets.find(sheet=>sheet.name==='Daily Summary').rows[0].at(-1),11);
 assert.equal(sheets.find(sheet=>sheet.name==='BT Coverage').rows[0][2],1);
 assert.equal(sheets.find(sheet=>sheet.name==='Staff Hours').rows.length,2);
});
test('all three exports roundtrip as native xlsx with numbers, sheets and formatting',async()=>{
 for(const kind of ['employee','client','summary']){
  const workbook=await createScheduleWorkbook(ExcelJS,{kind,employees,clients,location:'Test Clinic',exportedAt:new Date('2026-10-14T18:00:00Z')});
  const buffer=await workbook.xlsx.writeBuffer();assert.equal(buffer[0],80);assert.equal(buffer[1],75);
  const read=new ExcelJS.Workbook();await read.xlsx.load(buffer);
  assert.equal(read.worksheets.length,kind==='summary'?1:buildScheduleExport(kind,employees,clients).length);
  assert.ok(read.worksheets[0].getCell('A1').value.includes('Test Clinic'));
  assert.equal(read.worksheets[0].views[0].ySplit,kind==='summary'?3:5);
  if(kind==='summary'){const sheet=read.getWorksheet('Overall Summary');const index=sheet.getColumn(1).values.indexOf('Daily staff, clients, and hours');assert.equal(sheet.getCell(index+2,2).value,1);}
  else {assert.equal(read.worksheets[0].getCell('A5').value,'First Name');assert.equal(read.worksheets[0].columnCount,8);}
 }
});
test('invalid hours and formula-like notes remain literal text',async()=>{
 const workbook=await createScheduleWorkbook(ExcelJS,{kind:'employee',employees:[{first_name:'Test',monday:'bad',notes:'=HYPERLINK("bad")'}],location:'Test'});
 const read=new ExcelJS.Workbook();await read.xlsx.load(await workbook.xlsx.writeBuffer());
 assert.equal(read.worksheets[0].getCell('H6').value,'=HYPERLINK("bad")');assert.equal(read.worksheets[0].getCell('C6').value,'bad');
});

test('schedule rows sort alphabetically inside each category without mutating source',()=>{
 const source=[{id:1,first_name:'Zoe',category:'Employee'},{id:2,first_name:'amy',category:'Employee'},{id:3,first_name:'Ben',category:'Intern'}];
 const sheet=buildScheduleExport('employee',source,[])[0];
 assert.deepEqual(sheet.groups[0].rows.map(row=>row[0]),['amy','Zoe']);
 assert.equal(sheet.groups.find(group=>group.title==='Interns').rows[0][0],'Ben');
 assert.equal(source[0].first_name,'Zoe');
});

test('summary opens as one complete worksheet with clean integer and fractional formats',async()=>{
 const workbook=await createScheduleWorkbook(ExcelJS,{kind:'summary',employees,clients,location:'Test'});
 const read=new ExcelJS.Workbook();await read.xlsx.load(await workbook.xlsx.writeBuffer());
 const sheet=read.getWorksheet('Overall Summary');assert.equal(read.worksheets.length,1);
 const labels=sheet.getColumn(1).values;
 for(const label of ['Overview','Daily staff, clients, and hours','BT-only coverage','BT + intern coverage','Hours per staff member','Average'])assert.ok(labels.includes(label),label);
 const countIndex=labels.indexOf('Total employees');assert.equal(sheet.getCell(countIndex,2).numFmt,'#,##0');
 const rateIndex=labels.indexOf('Assumed call-out rate');assert.equal(sheet.getCell(rateIndex,2).numFmt,'0%');
 const averageIndex=labels.indexOf('Average');assert.equal(sheet.getCell(averageIndex,2).numFmt,'#,##0.00');
 assert.equal(sheet.getCell(averageIndex,2).value,0.2);
});

test('export uses saved day colors without automatic bolding or shifting colors during sorting',async()=>{
 const workbook=await createScheduleWorkbook(ExcelJS,{kind:'employee',location:'Test',employees:[{first_name:'Zoe',monday:'8-4',day_colors:{monday:'#0000FF'}},{first_name:'Amy',monday:'4:30-6:30',tuesday:'3:30-5:30',wednesday:'4:30-6:30',day_colors:{tuesday:'#800000'}}]});
 const read=new ExcelJS.Workbook();await read.xlsx.load(await workbook.xlsx.writeBuffer());
 const sheet=read.worksheets[0];assert.equal(sheet.getCell('A6').value,'Amy');assert.equal(sheet.getCell('D6').font.color.argb,'FF800000');assert.equal(Boolean(sheet.getCell('D6').font.bold),false);assert.equal(Boolean(sheet.getCell('C6').font.bold),false);assert.equal(sheet.getCell('C7').font.color.argb,'FF0000FF');
});
