'use client';
import {useState} from 'react';
export default function CalendarExportButton(props){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function download(){if(busy)return;setBusy(true);setError('');try{const {downloadCalendarExcel}=await import('../../lib/calendar-excel.mjs');await downloadCalendarExcel(props);}catch{setError('Could not export the calendar. Please try again.');}finally{setBusy(false);}}
 return <div className="schedule-export-control"><button type="button" className="schedule-export-button" disabled={props.disabled||busy} onClick={download}>{busy?'Exporting…':'Export Calendar Excel'}</button>{error&&<span role="alert" className="schedule-export-error">{error}</span>}</div>;
}
