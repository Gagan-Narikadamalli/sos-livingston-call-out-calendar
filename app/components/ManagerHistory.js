'use client';
import {useCallback,useEffect,useState} from 'react';
import {apiRequest} from '../../../lib/client-api';
const labels={add:'Added',edit:'Edited',delete:'Deleted',hold:'Placed on hold',resume:'Resumed',undo:'Undo'};
const fmt=value=>{const d=new Date(value);return Number.isNaN(d.getTime())?'Unknown date':new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeStyle:'short'}).format(d)};
function lines(details){if(!details||typeof details!=='object')return[];if(Array.isArray(details.changes))return details.changes;if(details.changedFields?.length)return details.changedFields.map(k=>`${k}: ${String(details.before?.[k]??'—')} → ${String(details.after?.[k]??'—')}`);return[]}
export default function ManagerHistory(){
 const [events,setEvents]=useState([]),[loading,setLoading]=useState(true),[busyId,setBusyId]=useState(null),[error,setError]=useState(''),[filter,setFilter]=useState('all');
 const load=useCallback(async()=>{setLoading(true);try{setEvents(await apiRequest('/api/history'));setError('')}catch(e){setError(e.status===401?'Manager sign-in is required to view calendar history.':e.message)}finally{setLoading(false)}},[]);
 useEffect(()=>{load()},[load]);
 async function undo(id){if(busyId||!confirm('Restore the deleted staff or client schedule?'))return;setBusyId(id);try{await apiRequest('/api/history',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'undo_delete',id})});await load()}catch(e){setError(e.message)}finally{setBusyId(null)}}
 const visible=events.filter(item=>filter==='all'||(filter==='schedule'?item.entity_type==='schedule':item.entity_type!=='schedule'));
 return <main className="schedule-page grouped-schedule-page manager-history-page">
  <section className="schedule-hero"><div><span className="schedule-eyebrow">MANAGER WORKSPACE</span><h1>Calendar History</h1><p>A record of changes across this calendar, including additions, edits, deletions and hold status changes.</p></div><span className="schedule-mode manager-mode">AUDIT LOG</span></section>
  <div className="history-toolbar"><div><h2>Activity history</h2><p>{events.length} recorded action{events.length===1?'':'s'} · newest first</p></div><div className="history-toolbar-actions"><select aria-label="Filter history" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All activity</option><option value="schedule">Staff & client schedules</option><option value="calendar">Calendar entries & notes</option></select><button type="button" onClick={load} disabled={loading}>Refresh</button></div></div>
  {error&&<p className="message error-message">{error}</p>}
  {loading?<section className="history-empty">Loading calendar history…</section>:!visible.length?<section className="history-empty"><strong>No history yet</strong><span>New calendar actions will appear here automatically.</span></section>:<div className="history-list">{visible.map(item=><article className="history-item" key={item.id}>
   <div className={`history-action-icon history-action-${item.action}`}>{item.action==='add'?'＋':item.action==='edit'?'✎':item.action==='delete'?'−':item.action==='hold'?'Ⅱ':item.action==='resume'?'▶':'↶'}</div>
   <div className="history-item-content"><div className="history-item-heading"><span className="history-action-label">{labels[item.action]||item.action}</span><time>{fmt(item.created_at)}</time></div><h3>{item.summary}</h3>
   {lines(item.details).length>0&&<ul>{lines(item.details).map((line,index)=><li key={index}>{line}</li>)}</ul>}
   {item.details?.count>1&&<p className="history-meta">{item.details.count} records affected</p>}
   {item.undo_available&&<button type="button" className="history-undo-button" disabled={busyId!==null} onClick={()=>undo(item.id)}>{busyId===item.id?'Restoring…':'Undo deletion'}</button>}
   {item.action==='delete'&&item.entity_type==='schedule'&&!item.undo_available&&<span className="history-meta">Undo is no longer available for this deletion.</span>}
   </div></article>)}</div>}
 </main>;
}
