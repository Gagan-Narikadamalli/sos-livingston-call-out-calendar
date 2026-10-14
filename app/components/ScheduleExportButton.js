'use client';
import {useState} from 'react';
export default function ScheduleExportButton({kind,employees=[],clients=[],location,disabled=false}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function download(){
  if(busy)return;setBusy(true);setError('');
  try{const {downloadScheduleExcel}=await import('../../lib/schedule-excel.mjs');await downloadScheduleExcel({kind,employees,clients,location});}
  catch{setError('Could not export Excel. Please try again.');}
  finally{setBusy(false);}
 }
 return <div className="schedule-export-control"><button type="button" className="schedule-export-button" disabled={disabled||busy} onClick={download}>{busy?'Exporting…':'Export Excel'}</button>{error&&<span role="alert" className="schedule-export-error">{error}</span>}</div>;
}
