'use client';
import {useEffect,useState} from 'react';
import {apiRequest} from '../../lib/client-api';
import {listCalendarMonths} from '../../lib/calendar-months.mjs';
export default function CalendarExportButton(props){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [from,setFrom]=useState(props.month),[to,setTo]=useState(props.month),[progress,setProgress]=useState('');
 useEffect(()=>{setFrom(props.month);setTo(props.month);setError('');},[props.month]);
 async function download(){
  if(busy)return;setError('');let months;
  try{months=listCalendarMonths(from,to);}catch(error){setError(error.message);return;}
  setBusy(true);
  try{
   const data=[];
   for(const [index,month] of months.entries()){
    setProgress(`Loading ${index+1}/${months.length}…`);
    let entries,notes,holidayData;
    if(props.manager){[entries,notes,holidayData]=await Promise.all([apiRequest('/api/manager?month='+month),apiRequest('/api/notes?month='+month),apiRequest('/api/holidays?month='+month)]);}
    else{const [result,holidayResult]=await Promise.all([apiRequest('/api/calendar?month='+month),apiRequest('/api/holidays?month='+month)]);entries=result.entries;notes=result.notes;holidayData=holidayResult;}
    data.push({month,entries:props.filterEntries(entries),notes:props.filterNotes(notes),holidays:holidayData.dates||[]});
   }
   setProgress('Creating Excel…');
   const {downloadCalendarRangeExcel}=await import('../../lib/calendar-excel.mjs');
   await downloadCalendarRangeExcel({months:data,location:props.location,filterLabel:props.filterLabel,from,to});
  }catch(error){setError(error.message||'Could not export the calendars. Please try again.');}
  finally{setBusy(false);setProgress('');}
 }
 return <div className="calendar-export-range"><div className="calendar-export-inputs"><label>From Month<input type="month" aria-label="Export from month" value={from} disabled={busy} onChange={event=>setFrom(event.target.value)}/></label><label>To Month<input type="month" aria-label="Export to month" value={to} min={from} disabled={busy} onChange={event=>setTo(event.target.value)}/></label><button type="button" className="schedule-export-button" disabled={props.disabled||busy} onClick={download}>{busy?progress||'Exporting…':'Export Calendar Excel'}</button></div>{error&&<span role="alert" className="schedule-export-error">{error}</span>}</div>;
}
