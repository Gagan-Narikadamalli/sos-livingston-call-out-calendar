export function calendarExportData(month,entries,notes){
 if(!/^\d{4}-\d{2}$/.test(month))throw new Error('Invalid month.');
 const [year,number]=month.split('-').map(Number);if(number<1||number>12)throw new Error('Invalid month.');
 const start=new Date(Date.UTC(year,number-1,1)),count=new Date(Date.UTC(year,number,0)).getUTCDate();
 const events=[...entries.map(row=>({date:String(row.event_date).slice(0,10),category:'Employee Note',title:row.name||'',type:row.request_type||'',details:row.reason||''})),...notes.map(row=>({date:String(row.event_date).slice(0,10),category:row.note_category==='Parent Note'?'Parent/Client Note':row.note_category||'Manager Note',title:row.title||'',type:row.note_type||'',details:row.details||''}))].filter(row=>row.date.startsWith(month+'-')).sort((a,b)=>a.date.localeCompare(b.date));
 const cells=[...Array(start.getUTCDay()).fill(null),...Array.from({length:count},(_,i)=>{const day=i+1,date=`${month}-${String(day).padStart(2,'0')}`;return {day,date,events:events.filter(row=>row.date===date)};})];
 while(cells.length%7)cells.push(null);
 return {month,start,events,weeks:Array.from({length:cells.length/7},(_,i)=>cells.slice(i*7,i*7+7))};
}
export async function createCalendarWorkbook(ExcelJS,{month,entries=[],notes=[],location,filterLabel='All calendar events',exportedAt=new Date()}){
 const data=calendarExportData(month,entries,notes),workbook=new ExcelJS.Workbook();workbook.creator='Success On The Spectrum';workbook.created=exportedAt;
 const label=data.start.toLocaleString('en-US',{timeZone:'UTC',month:'long',year:'numeric'});
 const sheet=workbook.addWorksheet('Monthly Calendar',{properties:{showGridLines:false},views:[{showGridLines:false}],pageSetup:{orientation:'landscape',paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:1}});
 const teal='FF2D7485',white='FFFFFFFF';
 sheet.columns=[{width:3},...Array.from({length:7},()=>({width:27})),{width:5},{width:14}];
 const endRow=7+data.weeks.length*2;
 for(let row=1;row<=endRow;row++)for(let col=1;col<=10;col++){const cell=sheet.getCell(row,col);cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:teal}};cell.font={name:'Calibri',size:11,color:{argb:white}};cell.alignment={vertical:'top',wrapText:true};}
 sheet.mergeCells('B1:H1');sheet.getCell('B1').value=`${location} — ${label.toUpperCase()}`;sheet.getCell('B1').font={name:'Calibri',size:20,bold:true,color:{argb:white}};sheet.getRow(1).height=42;
 sheet.mergeCells('B2:H2');sheet.getCell('B2').value=`${filterLabel} | Exported ${exportedAt.toLocaleString('en-US',{timeZone:'America/New_York'})} (America/New_York)`;sheet.getRow(2).height=25;
 ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'].forEach((day,index)=>{const cell=sheet.getCell(4,index+2);cell.value=day;cell.font={name:'Calibri',size:12,bold:true,color:{argb:white}};});sheet.getRow(4).height=26;
 data.weeks.forEach((week,index)=>{
  const dateRow=5+index*2,eventRow=dateRow+1;sheet.getRow(dateRow).height=22;
  let height=70;
  week.forEach((day,column)=>{
   const dateCell=sheet.getCell(dateRow,column+2),eventsCell=sheet.getCell(eventRow,column+2);
   dateCell.border={top:{style:'hair',color:{argb:'FF7DA8B2'}}};
   if(!day)return;
   dateCell.value=day.day;dateCell.font={name:'Calibri',size:12,bold:true,color:{argb:white}};
   const lines=day.events.map(row=>`${row.title}${row.type?' — '+row.type:''}${row.details?'\n'+row.details:''}`);
   eventsCell.value=lines.join('\n\n');
   height=Math.max(height,lines.reduce((total,text)=>total+text.split('\n').reduce((sum,line)=>sum+Math.max(1,Math.ceil(line.length/27)),0)+1,0)*14+12);
  });
  sheet.getRow(eventRow).height=Math.min(409,height);
 });
 sheet.mergeCells(4,10,4+data.weeks.length*2,10);sheet.getCell(4,10).value=data.start.toLocaleString('en-US',{timeZone:'UTC',month:'short'}).toUpperCase();sheet.getCell(4,10).font={name:'Calibri',size:64,bold:true,color:{argb:white}};sheet.getCell(4,10).alignment={textRotation:90,vertical:'middle',horizontal:'center'};
 const noteRow=6+data.weeks.length*2;sheet.mergeCells(noteRow,2,noteRow,8);sheet.getCell(noteRow,2).value='NOTES';sheet.getCell(noteRow,2).border={top:{style:'thin',color:{argb:white}}};sheet.getRow(noteRow).height=25;
 sheet.mergeCells(noteRow+1,2,noteRow+1,8);sheet.getCell(noteRow+1,2).value='Selected month and active filter. Full event text is included in the Event Details worksheet.';sheet.getRow(noteRow+1).height=28;
 sheet.pageSetup.printArea=`A1:J${endRow}`;
 const detail=workbook.addWorksheet('Event Details',{views:[{state:'frozen',ySplit:3}]});
 detail.columns=[{width:14},{width:24},{width:30},{width:22},{width:70}];detail.mergeCells('A1:E1');detail.getCell('A1').value=`${location} — ${label} — ${filterLabel}`;detail.getCell('A1').font={name:'Calibri',size:14,bold:true,color:{argb:'FF17305E'}};detail.getRow(1).height=30;
 detail.getRow(3).values=['Date','Category','Name / Title','Request / Note Type','Details'];detail.getRow(3).height=26;detail.getRow(3).eachCell(cell=>{cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:teal}};cell.font={name:'Calibri',size:11,bold:true,color:{argb:white}};});
 for(const event of data.events){const row=detail.addRow([event.date,event.category,event.title,event.type,event.details]);row.height=Math.max(26,Math.ceil(event.details.length/65)*14+10);row.eachCell({includeEmpty:true},cell=>{cell.font={name:'Calibri',size:11};cell.alignment={wrapText:true,vertical:'top'};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:row.number%2?'FFF2F7FA':'FFFFFFFF'}};});}
 detail.autoFilter={from:'A3',to:`E${Math.max(3,detail.rowCount)}`};
 return workbook;
}
export async function downloadCalendarExcel(options){
 const module=await import('exceljs'),ExcelJS=module.default||module;
 const workbook=await createCalendarWorkbook(ExcelJS,options),buffer=await workbook.xlsx.writeBuffer();
 const url=URL.createObjectURL(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
 const link=document.createElement('a');link.href=url;link.download=`${options.location}_Calendar_${options.month}.xlsx`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
