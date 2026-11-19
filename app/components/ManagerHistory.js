'use client';
import {useCallback,useEffect,useState} from 'react';
import {apiRequest} from '../../lib/client-api';
const labels={add:'Added',edit:'Edited',delete:'Deleted',hold:'Hold',resume:'Resumed',undo:'Undo'};
const dateFmt=value=>{const d=new Date(value);return Number.isNaN(d.getTime())?'Unknown date':new Intl.DateTimeFormat('en-US',{dateStyle:'medium'}).format(d)};
const timeFmt=value=>{const d=new Date(value);return Number.isNaN(d.getTime())?'Unknown time':new Intl.DateTimeFormat('en-US',{timeStyle:'short'}).format(d)};
const fieldNames={first_name:'First name',last_name:'Last name',category:'Category',assigned_to:'Assigned to',monday:'Monday',tuesday:'Tuesday',wednesday:'Wednesday',thursday:'Thursday',friday:'Friday',start_date:'Start date',end_date:'End date',notes:'Notes',phone_number:'Phone number',email:'Email',event_date:'Date',title:'Title',note_type:'Note type',note_category:'Note category',details:'Details',name:'Name',request_type:'Request type',submitter_type:'Submitted by',reason:'Reason'};
function dateValue(value){
 if(value===null||value===undefined||value==='')return '—';
 if(typeof value==='string'){
  const dateOnly=value.match(/^(\\d{4}-\\d{2}-\\d{2})(?:T.*)?$/);
  if(dateOnly)return dateOnly[1];
 }
 const date=new Date(value);
 return Number.isNaN(date.getTime())?String(value):new Intl.DateTimeFormat('en-CA',{timeZone:'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
function showValue(value){if(value===null||value===undefined||value==='')return '—';if(typeof value==='object')return JSON.stringify(value);return String(value)}
function showFieldValue(key,value){return ['event_date','start_date','end_date'].includes(key)?dateValue(value):showValue(value)}
function lines(details){
 if(!details||typeof details!=='object')return[];
 if(Array.isArray(details.changes))return details.changes;
 if(details.changedFields?.length)return details.changedFields.map(key=>`${fieldNames[key]||key}: ${showFieldValue(key,details.before?.[key])} → ${showFieldValue(key,details.after?.[key])}`);
 if(Array.isArray(details.before)&&Array.isArray(details.after))return [`Dates before: ${details.before.join(', ')||'None'}`,`Dates after: ${details.after.join(', ')||'None'}`];
 if(details.before&&details.after){const keys=Object.keys(fieldNames).filter(key=>JSON.stringify(details.before[key]??null)!==JSON.stringify(details.after[key]??null));return keys.map(key=>`${fieldNames[key]}: ${showFieldValue(key,details.before[key])} → ${showFieldValue(key,details.after[key])}`)}

 const snapshot=details.after||details.before;
 if(snapshot&&typeof snapshot==='object')return Object.keys(fieldNames).filter(key=>snapshot[key]!==undefined&&snapshot[key]!==null&&snapshot[key]!=='').map(key=>`${fieldNames[key]}: ${showFieldValue(key,snapshot[key])}`);
 if(Array.isArray(details.records))return details.records.slice(0,20).map(record=>record.name||'Schedule entry').concat(details.records.length>20?[`and ${details.records.length-20} more`]:[]);
 const result=[];
 if(details.dates?.length)result.push(`Dates: ${details.dates.map(dateValue).join(', ')}`);
 if(details.event_date)result.push(`Date: ${dateValue(details.event_date)}`);
 if(details.start&&details.end)result.push(`Date range: ${dateValue(details.start)} – ${dateValue(details.end)}`);
 if(details.request_type)result.push(`Type: ${details.request_type}`);
 if(details.note_type)result.push(`Type: ${details.note_type}`);
 if(details.note_category)result.push(`Category: ${details.note_category}`);
 if(details.kind)result.push(`Schedule: ${details.kind==='employee'?'Staff':'Client'}`);
 if(details.scope)result.push(`Scope: ${details.scope}`);
 return result;
}
export default function ManagerHistory(){
 const [events,setEvents]=useState([]),[loading,setLoading]=useState(true),[busyId,setBusyId]=useState(null),[error,setError]=useState(''),[filter,setFilter]=useState('all');
 const load=useCallback(async()=>{setLoading(true);try{setEvents(await apiRequest('/api/history'));setError('')}catch(e){setError(e.status===401?'Manager sign-in is required to view calendar history.':e.message)}finally{setLoading(false)}},[]);
 useEffect(()=>{load()},[load]);
 async function undo(id){if(busyId||!confirm('Restore the deleted staff or client schedule?'))return;setBusyId(id);try{await apiRequest('/api/history',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'undo_delete',id})});await load()}catch(e){setError(e.message)}finally{setBusyId(null)}}
 const visible=events.filter(item=>filter==='all'||(filter==='schedule'?item.entity_type==='schedule':item.entity_type!=='schedule'));
 return <main className="schedule-page grouped-schedule-page manager-history-page">
  <section className="schedule-hero"><div><span className="schedule-eyebrow">MANAGER WORKSPACE</span><h1>Calendar History</h1><p>A record of calendar changes from the time History was enabled, including additions, edits, deletions and hold status changes.</p></div><span className="schedule-mode manager-mode">AUDIT LOG</span></section>
  <div className="history-toolbar"><div><h2>Activity history</h2><p>{events.length} recorded action{events.length===1?'':'s'} · newest first</p></div><div className="history-toolbar-actions"><select aria-label="Filter history" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All activity</option><option value="schedule">Staff & client schedules</option><option value="calendar">Calendar entries & notes</option></select><button type="button" onClick={load} disabled={loading}>Refresh</button></div></div>
  {error&&<p className="message error-message">{error}</p>}
  {loading?<section className="history-empty">Loading calendar history…</section>:!visible.length?<section className="history-empty"><strong>No history yet</strong><span>New calendar actions will appear here automatically.</span></section>:<div className="history-table-wrap"><div className="history-table" role="table" aria-label="Calendar activity history">
   <div className="history-table-header" role="row"><span role="columnheader">Date</span><span role="columnheader">Time</span><span role="columnheader">Action</span><span role="columnheader">Description</span></div>
   {visible.map(item=>{const detailLines=lines(item.details);return <article className="history-item" role="row" key={item.id}>
    <time className="history-date-cell" role="cell">{dateFmt(item.created_at)}</time>
    <time className="history-time-cell" role="cell">{timeFmt(item.created_at)}</time>
    <div className="history-action-cell" role="cell"><span className="history-action-label">{labels[item.action]||item.action}</span></div>
    <div className="history-description-cell" role="cell" title={[item.summary,...detailLines].join(' · ')}><div className="history-description-text"><strong>{item.summary}</strong>{detailLines.length>0&&<span>{detailLines.join(' · ')}</span>}{item.details?.count>1&&<small>{item.details.count} records affected</small>}</div><div className="history-inline-action">{item.undo_available?<button type="button" className="history-undo-button" disabled={busyId!==null} onClick={()=>undo(item.id)}>{busyId===item.id?'Restoring…':'Undo'}</button>:item.action==='delete'&&item.entity_type==='schedule'?<span className="history-meta">Expired</span>:null}</div></div>
   </article>})}
  </div></div>}
 </main>;
}
