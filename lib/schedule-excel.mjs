import {buildScheduleExport} from './schedule-export-data.mjs';

export async function createScheduleWorkbook(ExcelJS,{kind,employees=[],clients=[],location,exportedAt=new Date()}){
 const workbook=new ExcelJS.Workbook();workbook.creator='Success On The Spectrum';workbook.created=exportedAt;
 const title={employee:'Employee Schedule',client:'Clients / Kids Schedule',summary:'Overall Summary'}[kind];
 for(const data of buildScheduleExport(kind,employees,clients)){
  const sheet=workbook.addWorksheet(data.name,{views:[{state:'frozen',ySplit:4}],pageSetup:{orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0}});
  const columns=data.headers.length;
  sheet.mergeCells(1,1,1,columns);sheet.getCell(1,1).value=`${location} — ${title}`;sheet.getRow(1).height=30;
  sheet.getCell(1,1).font={name:'Calibri',size:16,bold:true,color:{argb:'FF17305E'}};
  sheet.mergeCells(2,1,2,columns);sheet.getCell(2,1).value=`Exported ${exportedAt.toLocaleString('en-US',{timeZone:'America/New_York'})} (America/New_York) | ${data.name}`;sheet.getCell(2,1).font={name:'Calibri',size:10,color:{argb:'FF607687'}};sheet.getRow(2).height=24;
  if(data.groups){
   sheet.views=[{state:'frozen',ySplit:5,xSplit:2}];
   sheet.properties.defaultRowHeight=26;
   sheet.addRow([]);
   data.headers.forEach((_,index)=>{sheet.getColumn(index+1).width=index<2?22:index===7?36:27;});
   for(const group of data.groups){
    const titleRow=sheet.addRow([group.title]);
    sheet.mergeCells(titleRow.number,1,titleRow.number,columns);
    titleRow.height=28;titleRow.getCell(1).font={name:'Calibri',size:12,bold:true,color:{argb:'FF17305E'}};
    titleRow.getCell(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+group.tint}};
    const header=sheet.addRow(data.headers);header.height=27;
    header.eachCell(cell=>{cell.font={name:'Calibri',size:12,bold:true,color:{argb:'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF4472C4'}};cell.alignment={vertical:'middle',horizontal:'center'};cell.border={top:{style:'thin'},bottom:{style:'thin'},left:{style:'thin'},right:{style:'thin'}};});
    for(const values of group.rows){
     const row=sheet.addRow(values);row.height=Math.max(26,...values.map((value,index)=>Math.ceil(String(value).length/(index===7?34:25))*16));
     row.eachCell({includeEmpty:true},(cell,index)=>{cell.font={name:'Calibri',size:12,color:{argb:'FF000000'}};cell.alignment={vertical:'middle',wrapText:true};cell.border={top:{style:'thin'},bottom:{style:'thin'},left:{style:'thin'},right:{style:'thin'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:index<=2?'FFDCE6F1':index>=3&&index<=7&&!cell.value?'FFBFBFBF':'FFFFFFFF'}};});
    }
    if(!group.rows.length){const row=sheet.addRow(['No saved entries']);sheet.mergeCells(row.number,1,row.number,columns);row.getCell(1).font={name:'Calibri',size:11,color:{argb:'FF607687'}};}
    sheet.addRow([]);
   }
   continue;
  }
  sheet.getRow(4).values=data.headers;sheet.getRow(4).height=32;
  sheet.getRow(4).eachCell(cell=>{cell.font={name:'Calibri',size:11,bold:true,color:{argb:'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF17305E'}};cell.alignment={vertical:'middle',wrapText:true};});
  for(const values of data.rows){
   const row=sheet.addRow(values);row.height=32;
   const average=values[0]==='Average';
   row.eachCell({includeEmpty:true},cell=>{
    cell.font={name:'Calibri',size:11,bold:average,color:{argb:'FF17305E'}};
    cell.alignment={vertical:'middle',wrapText:true};
    cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:average?'FFE5EFF8':row.number%2?'FFF8FAFC':'FFFFFFFF'}};
    if(typeof cell.value==='number')cell.numFmt='0.##';
   });
   if(data.name==='Overview'&&values[0]==='Assumed call-out rate')row.getCell(2).numFmt='0%';
  }
  data.headers.forEach((header,index)=>{
   const lengths=[header.length,...data.rows.map(row=>String(row[index]??'').length)];
   sheet.getColumn(index+1).width=Math.min(46,Math.max(16,...lengths.map(length=>length+3)));
  });
  sheet.autoFilter={from:{row:4,column:1},to:{row:Math.max(4,sheet.rowCount),column:columns}};
 }
 return workbook;
}
export async function downloadScheduleExcel(options){
 const module=await import('exceljs');const ExcelJS=module.default||module;
 const workbook=await createScheduleWorkbook(ExcelJS,options);
 const buffer=await workbook.xlsx.writeBuffer();
 const blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 link.href=url;link.download=`${options.location.replace(/[^a-z0-9]+/gi,'_')}_${options.kind}_schedule_${day}.xlsx`;
 document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
