'use client';
import {useEffect,useState} from 'react';
import Brand from '../components/Brand';

const pad=n=>String(n).padStart(2,'0');
const key=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}`;
const fmt=n=>`${(Number(n)/1048576).toFixed(1)} MB`;
const isNew=timestamp=>{const time=new Date(timestamp).getTime();const age=Date.now()-time;return Number.isFinite(time)&&age>=0&&age<24*60*60*1000};

export default function Manager(){
  const [auth,setAuth]=useState(null);
  const [pass,setPass]=useState('');
  const [month,setMonth]=useState(new Date(new Date().getFullYear(),new Date().getMonth(),1));
  const [entries,setEntries]=useState([]);
  const [notes,setNotes]=useState([]);
  const [storage,setStorage]=useState(null);
  const [modal,setModal]=useState(null);
  const [msg,setMsg]=useState('');
  const [cleanupMode,setCleanupMode]=useState('previous-month');
  const [,setClock]=useState(Date.now());

  useEffect(()=>{fetch('/api/login').then(r=>r.json()).then(x=>setAuth(x.authenticated)).catch(()=>setAuth(false))},[]);
  useEffect(()=>{if(auth)load()},[auth,month]);
  useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),60000);return()=>clearInterval(timer)},[]);

  async function load(){
    const m=key(month);
    const [a,b,c]=await Promise.all([fetch('/api/manager?month='+m),fetch('/api/notes?month='+m),fetch('/api/storage')]);
    if(a.status===401)return setAuth(false);
    if(a.ok)setEntries(await a.json());
    if(b.ok)setNotes(await b.json());
    if(c.ok)setStorage(await c.json());
  }
  async function login(e){e.preventDefault();setMsg('');const r=await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:pass})});if(r.ok){setAuth(true);setPass('')}else setMsg('Incorrect password. Please try again.')}
  async function logout(){await fetch('/api/login',{method:'DELETE'});setAuth(false)}
  async function remove(kind,id){if(!confirm('Delete this item?'))return;await fetch(`/api/${kind}?id=${id}`,{method:'DELETE'});setModal(null);load()}
  async function save(e){e.preventDefault();const isEntry=modal.kind==='entry',method=modal.id?'PATCH':'POST',url=isEntry?'/api/manager':'/api/notes',r=await fetch(url,{method,headers:{'content-type':'application/json'},body:JSON.stringify(modal)}),j=await r.json();if(!r.ok)return setMsg(j.error);setModal(null);setMsg('');load()}
  function updateRepeatDate(index,value){setModal({...modal,repeat_dates:modal.repeat_dates.map((date,i)=>i===index?value:date)})}
  function addRepeatDate(){if(modal.repeat_dates.length<31)setModal({...modal,repeat_dates:[...modal.repeat_dates,'']})}
  function removeRepeatDate(index){if(modal.repeat_dates.length>2)setModal({...modal,repeat_dates:modal.repeat_dates.filter((_,i)=>i!==index)})}
  async function cleanup(e){e.preventDefault();const form=new FormData(e.currentTarget),mode=form.get('mode'),start=form.get('start'),end=form.get('end');if(mode==='custom'&&(!start||!end))return setMsg('Select both a start and end date.');const label=mode==='previous-month'?'the entire previous month':mode==='previous-week'?'the entire previous week':`${start} through ${end}`;if(!confirm(`Permanently delete all submissions and manager notes for ${label}?`))return;const q=new URLSearchParams({mode});if(mode==='custom'){q.set('start',start);q.set('end',end)}const r=await fetch('/api/manager?'+q,{method:'DELETE'}),j=await r.json();if(!r.ok)return setMsg(j.error);setMsg(`${j.deleted} record(s) deleted from ${j.start} through ${j.end}: ${j.callOuts} submissions and ${j.managerNotes} manager notes.`);load()}

  if(auth===null)return <Shell><main className="manager-login"><section className="card login-card"><h1>Manager calendar</h1><p>Checking manager access…</p></section></main></Shell>;
  if(!auth)return <Shell><main className="manager-login"><form className="card login-card" onSubmit={login}><span className="login-label">AUTHORIZED MANAGER ACCESS</span><h1>View the manager calendar</h1><p>Enter the manager password to view and manage call-outs, time-off requests, and calendar notes.</p><label className="field"><b>Manager password</b><input type="password" required autoFocus value={pass} onChange={e=>setPass(e.target.value)} placeholder="Enter manager password"/></label>{msg&&<p className="message error-message">{msg}</p>}<button>Open manager calendar</button><a className="back-link" href="/">← Return to submission form</a></form></main></Shell>;

  const first=new Date(month.getFullYear(),month.getMonth(),1);
  const days=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
  const cells=[...Array(first.getDay()).fill(null),...Array.from({length:days},(_,i)=>i+1)];
  while(cells.length%7)cells.push(null);

  return <Shell authenticated logout={logout}>
    <main className="manager">
      {msg&&<p className="message manager-message">{msg}</p>}
      <div className="tools">
        <section className="card storage-card"><h3>Database storage</h3>{storage?.used!=null?<><p><strong>{fmt(storage.used)} used</strong> · {fmt(storage.remaining)} remaining</p><small>{storage.records} records · Estimated {fmt(storage.capacity)} capacity</small></>:<p className="muted">Loading storage information…</p>}</section>
        <form className="card cleanup compact-cleanup" onSubmit={cleanup}><h3>Delete old records</h3><div className="cleanup-row"><select name="mode" value={cleanupMode} onChange={e=>setCleanupMode(e.target.value)}><option value="previous-month">Previous month</option><option value="previous-week">Previous week</option><option value="custom">Custom date range</option></select>{cleanupMode==='custom'&&<><input aria-label="Custom start date" name="start" type="date" required/><span>to</span><input aria-label="Custom end date" name="end" type="date" required/></>}<button className="danger">Delete records</button></div><small>Deletes both submissions and manager notes for the selected period.</small></form>
      </div>
      <div className="calendar-head"><button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}>← Previous</button><div><h1>{month.toLocaleString('en',{month:'long',year:'numeric'})}</h1><button className="today-button" onClick={()=>setMonth(new Date(new Date().getFullYear(),new Date().getMonth(),1))}>Today</button></div><button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}>Next →</button></div>
      <div className="legend"><i className="recent"/>New in last 24 hours <i className="employee"/>Employee request <i className="employee-note"/>Employee note <i className="parent-note"/>Parent/Client note <i className="note"/>Manager note</div>
      <div className="week">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=><b key={x}>{x}</b>)}</div>
      <div className="calendar">{cells.map((d,i)=>{const date=d?`${key(month)}-${pad(d)}`:'';return <div className="day" key={i}>{d&&<><div className="daytop"><b>{d}</b><button className="plus" title="Add calendar note" onClick={()=>setModal({kind:'note',event_date:date,title:'',note_type:'Out',note_category:'Manager Note',details:'',note_date_mode:'single',repeat_dates:[date,''],range_start:date,range_end:date})}>+ Note</button></div>{entries.filter(x=>x.event_date===date&&x.submitter_type==='Employee').map(x=><button className={`event ${x.submitter_type.toLowerCase()}${isNew(x.submitted_at)?' recent':''}`} key={'e'+x.id} onClick={()=>setModal({...x,kind:'entry'})}><small>{x.submitter_type}{isNew(x.submitted_at)?' · New':''}</small>{x.name} — {x.request_type}</button>)}{notes.filter(x=>x.event_date===date).map(x=>{const category=x.note_category==='Parent Note'?'Parent/Client Note':x.note_category||'Manager Note';const categoryClass=category==='Parent/Client Note'?'parent-note':category==='Employee Note'?'employee-note':'manager-note';return <button className={`event note ${categoryClass}${isNew(x.created_at)?' recent':''}`} key={'n'+x.id} onClick={()=>setModal({...x,note_category:category,kind:'note',note_date_mode:'single',repeat_dates:[x.event_date,''],range_start:x.event_date,range_end:x.event_date})}><small>{category}{isNew(x.created_at)?' · New':''}</small>{x.title} — {x.note_type}</button>})}</>}</div>})}</div>
    </main>
    {modal&&<div className="overlay"><form className="card modal" onSubmit={save}><h2>{modal.id?'Edit':'Add'} {modal.kind==='note'?'calendar note':'request'}</h2>{modal.kind==='entry'?<><Field t="Name"><input required value={modal.name} onChange={e=>setModal({...modal,name:e.target.value})}/></Field><Field t="Employee email"><input type="email" value={modal.email||''} onChange={e=>setModal({...modal,email:e.target.value})}/></Field><Field t="Request type"><select value={modal.request_type} onChange={e=>setModal({...modal,request_type:e.target.value})}>{['PTO','Non-PTO / Out','Called Out','Sick Leave','Other'].map(x=><option key={x}>{x}</option>)}</select></Field><Field t="Details"><textarea value={modal.reason||''} onChange={e=>setModal({...modal,reason:e.target.value})}/></Field><Field t="Date"><input required type="date" value={modal.event_date} onChange={e=>setModal({...modal,event_date:e.target.value})}/></Field></>:<><CategoryPicker value={modal.note_category||'Manager Note'} onChange={note_category=>setModal({...modal,note_category})}/><Field t="Person or client name"><input required value={modal.title} onChange={e=>setModal({...modal,title:e.target.value})}/></Field><Field t="Reason type"><select value={modal.note_type} onChange={e=>setModal({...modal,note_type:e.target.value})}>{['Vacation','Out','Appointment','Leaving Early','Coming Late','Schedule Change','Other'].map(x=><option key={x}>{x}</option>)}</select></Field><Field t="Notes"><textarea value={modal.details||''} onChange={e=>setModal({...modal,details:e.target.value})}/></Field>{!modal.id&&<Field t="Date selection"><select value={modal.note_date_mode} onChange={e=>setModal({...modal,note_date_mode:e.target.value})}><option value="single">Single date</option><option value="multiple">Multiple selected dates</option><option value="range">Date range</option></select></Field>}{modal.id||modal.note_date_mode==='single'?<Field t="Date"><input required type="date" value={modal.event_date} onChange={e=>setModal({...modal,event_date:e.target.value})}/></Field>:modal.note_date_mode==='multiple'?<div className="date-section"><b>Note dates</b>{modal.repeat_dates.map((date,index)=><div className="date-row" key={index}><input required type="date" value={date} onChange={e=>updateRepeatDate(index,e.target.value)}/>{modal.repeat_dates.length>2&&<button type="button" className="secondary small-button" onClick={()=>removeRepeatDate(index)}>Remove</button>}</div>)}<button type="button" className="secondary add-date" onClick={addRepeatDate}>+ Add another date</button></div>:<><Field t="Start date"><input required type="date" value={modal.range_start} onChange={e=>setModal({...modal,range_start:e.target.value})}/></Field><Field t="End date"><input required type="date" min={modal.range_start} value={modal.range_end} onChange={e=>setModal({...modal,range_end:e.target.value})}/></Field></>}</>}<div className="actions"><button>Save</button>{modal.id&&<button type="button" className="danger" onClick={()=>remove(modal.kind==='note'?'notes':'manager',modal.id)}>Delete</button>}<button type="button" className="secondary" onClick={()=>setModal(null)}>Cancel</button></div></form></div>}
  </Shell>;
}

function Shell({children,authenticated=false,logout}){return <><header><Brand title="Livingston Manager Calendar" subtitle="Success On The Spectrum"/><nav className="manager-nav"><a href="/">Form</a>{authenticated&&<button className="link" onClick={logout}>Log out</button>}</nav></header>{children}</>}
function Field({t,children}){return <label className="field"><b>{t}</b>{children}</label>}
function CategoryPicker({value,onChange}){const categoryClass=value==='Employee Note'?'employee-note':value==='Parent/Client Note'?'parent-note':'manager-note';return <label className="field"><b>Note category</b><select className={`note-category-select ${categoryClass}`} value={value} onChange={e=>onChange(e.target.value)}><option className="manager-note" value="Manager Note">Manager Note</option><option className="employee-note" value="Employee Note">Employee Note</option><option className="parent-note" value="Parent/Client Note">Client/Parent Note</option></select></label>}
