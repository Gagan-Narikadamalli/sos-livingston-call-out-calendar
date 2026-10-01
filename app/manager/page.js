'use client';

import {useEffect,useRef,useState} from 'react';
import Brand from '../components/Brand';
import CalendarFilters from '../components/CalendarFilters';
import {apiRequest} from '../../lib/client-api';
import {MANAGER_TYPES} from '../../lib/validate';

const LOCATION='Livingston';
const normalizeNoteType=value=>/^Non-PTO\s*\/\s*Out$/i.test(value||'')?'Non-PTO / Out':value;
const pad=n=>String(n).padStart(2,'0');
const monthKey=date=>`${date.getFullYear()}-${pad(date.getMonth()+1)}`;
const fmt=n=>`${(Number(n)/1048576).toFixed(1)} MB`;

const isNew=timestamp=>{
  const time=new Date(timestamp).getTime();
  const age=Date.now()-time;
  return Number.isFinite(time)&&age>=0&&age<24*60*60*1000;
};

const isPtoReason=value=>{
  const normalized=String(value||'').trim().toLowerCase().replace(/\s+/g,'');
  return normalized==='pto'||normalized==='1/2daypto';
};

const noteCategory=note=>note.note_category==='Parent Note'
  ?'Parent/Client Note'
  :(note.note_category||'Manager Note');

function entryMatchesFilter(entry,filter){
  if(!filter)return true;
  if(filter==='employee')return true;
  if(filter==='pto')return isPtoReason(entry.request_type);
  if(filter==='new')return isNew(entry.submitted_at);
  return false;
}

function noteMatchesFilter(note,filter){
  if(!filter)return true;
  if(filter==='new')return isNew(note.created_at);
  if(filter==='pto')return isPtoReason(note.note_type);
  const category=noteCategory(note);
  if(filter==='manager')return category==='Manager Note';
  if(filter==='employee')return category==='Employee Note';
  if(filter==='client')return category==='Parent/Client Note';
  return true;
}

function mergeNotes(current,incoming){
  const byId=new Map(current.map(note=>[String(note.id),note]));
  for(const note of incoming)byId.set(String(note.id),{...byId.get(String(note.id)),...note});
  return [...byId.values()].sort((a,b)=>
    String(a.event_date).localeCompare(String(b.event_date))||
    new Date(a.created_at).getTime()-new Date(b.created_at).getTime()
  );
}

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
  const [activeFilter,setActiveFilter]=useState('');
  const [,setClock]=useState(Date.now());
  const loadId=useRef(0);

  useEffect(()=>{
    apiRequest('/api/login')
      .then(data=>setAuth(data.authenticated))
      .catch(error=>{
        setAuth(false);
        setMsg(error.message);
      });
  },[]);

  useEffect(()=>{
    if(auth)load();
  },[auth,month]);

  useEffect(()=>{
    const timer=setInterval(()=>setClock(Date.now()),60000);
    return()=>clearInterval(timer);
  },[]);

  async function load(){
    const current=++loadId.current;
    const key=monthKey(month);
    try{
      const [entryData,noteData,storageData]=await Promise.all([
        apiRequest('/api/manager?month='+key),
        apiRequest('/api/notes?month='+key),
        apiRequest('/api/storage'),
      ]);
      if(current!==loadId.current)return;
      setEntries(entryData);
      setNotes(noteData);
      setStorage(storageData);
      setMsg('');
    }catch(error){
      if(current!==loadId.current)return;
      if(error.status===401)setAuth(false);
      setMsg(error.message);
    }
  }

  async function login(event){
    event.preventDefault();
    setMsg('');
    try{
      await apiRequest('/api/login',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({password:pass}),
      });
      setAuth(true);
      setPass('');
    }catch(error){
      setMsg(error.message);
    }
  }

  async function logout(){
    try{
      await apiRequest('/api/login',{method:'DELETE'});
      loadId.current++;
      setAuth(false);
    }catch(error){
      setMsg(error.message);
    }
  }

  async function remove(kind,id){
    if(!confirm('Delete this item?'))return;
    try{
      await apiRequest(`/api/${kind}?id=${id}`,{method:'DELETE'});
      setModal(null);
      await load();
    }catch(error){
      setMsg(error.message);
    }
  }

  async function save(event){
    event.preventDefault();
    const draft=modal;
    const isEntry=draft.kind==='entry';
    const method=draft.id?'PATCH':'POST';
    const url=isEntry?'/api/manager':'/api/notes';

    try{
      const result=await apiRequest(url,{
        method,
        headers:{'content-type':'application/json'},
        body:JSON.stringify(draft),
      });

      if(!draft.id&&draft.kind==='note'&&Array.isArray(result.notes)){
        const visible=result.notes.filter(note=>String(note.event_date).startsWith(monthKey(month)));
        if(visible.length)setNotes(current=>mergeNotes(current,visible));
        setModal(null);
        setMsg('');
        setTimeout(()=>load(),300);
        return;
      }

      setModal(null);
      setMsg('');
      await load();
    }catch(error){
      setMsg(error.message);
    }
  }

  function updateRepeatDate(index,value){
    setModal({...modal,repeat_dates:modal.repeat_dates.map((date,i)=>i===index?value:date)});
  }

  function addRepeatDate(){
    if(modal.repeat_dates.length<31)setModal({...modal,repeat_dates:[...modal.repeat_dates,'']});
  }

  function removeRepeatDate(index){
    if(modal.repeat_dates.length>2){
      setModal({...modal,repeat_dates:modal.repeat_dates.filter((_,i)=>i!==index)});
    }
  }

  async function cleanup(event){
    event.preventDefault();
    const form=new FormData(event.currentTarget);
    const mode=form.get('mode');
    const start=form.get('start');
    const end=form.get('end');

    if(mode==='custom'&&(!start||!end))return setMsg('Select both a start and end date.');

    const label=mode==='previous-month'
      ?'the entire previous month'
      :mode==='previous-week'
        ?'the entire previous week'
        :`${start} through ${end}`;

    if(!confirm(`Permanently delete all submissions and manager notes for ${label}?`))return;

    const query=new URLSearchParams({mode});
    if(mode==='custom'){
      query.set('start',start);
      query.set('end',end);
    }

    try{
      const result=await apiRequest('/api/manager?'+query,{method:'DELETE'});
      await load();
      setMsg(`${result.deleted} record(s) deleted from ${result.start} through ${result.end}: ${result.callOuts} submissions and ${result.managerNotes} manager notes.`);
    }catch(error){
      setMsg(error.message);
    }
  }

  async function stopRecurrence(){
    if(!confirm('Stop this ongoing recurring note? Existing occurrences will remain, but it will not continue into future months.'))return;
    try{
      await apiRequest('/api/notes',{
        method:'PATCH',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({action:'stop_recurrence',recurrence_id:modal.recurrence_id}),
      });
      setModal(null);
      setMsg('Recurring note stopped. It will not continue into a future month.');
      await load();
    }catch(error){
      setMsg(error.message);
    }
  }

  if(auth===null){
    return <Shell><main className="manager-login"><section className="card login-card"><h1>{LOCATION} Manager Calendar</h1><p>Checking {LOCATION} manager access…</p></section></main></Shell>;
  }

  if(!auth){
    return <Shell><main className="manager-login"><form className="card login-card" onSubmit={login}>
      <span className="login-label">AUTHORIZED MANAGER ACCESS</span>
      <h1>View the {LOCATION} Manager Calendar</h1>
      <p>Enter the manager password to view and manage {LOCATION} call-outs, time-off requests, and calendar notes.</p>
      <label className="field"><b>Manager password</b><input type="password" required autoFocus value={pass} onChange={e=>setPass(e.target.value)} placeholder="Enter manager password"/></label>
      {msg&&<p className="message error-message">{msg}</p>}
      <button>Open {LOCATION} Manager Calendar</button>
      <a className="back-link" href="/">← Return to submission form</a>
    </form></main></Shell>;
  }

  const first=new Date(month.getFullYear(),month.getMonth(),1);
  const days=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
  const cells=[...Array(first.getDay()).fill(null),...Array.from({length:days},(_,i)=>i+1)];
  while(cells.length%7)cells.push(null);

  return <Shell authenticated logout={logout}>
    <main className="manager">
      {msg&&<p className="message manager-message">{msg}</p>}

      <div className="tools">
        <section className="card storage-card">
          <h3>Database storage</h3>
          {storage?.used!=null
            ?<><p><strong>{fmt(storage.used)} used</strong> · {fmt(storage.remaining)} remaining</p><small>{storage.records} records · Estimated {fmt(storage.capacity)} capacity</small></>
            :<p className="muted">Loading storage information…</p>}
        </section>

        <form className="card cleanup compact-cleanup" onSubmit={cleanup}>
          <h3>Delete old records</h3>
          <div className="cleanup-row">
            <select name="mode" value={cleanupMode} onChange={e=>setCleanupMode(e.target.value)}>
              <option value="previous-month">Previous month</option>
              <option value="previous-week">Previous week</option>
              <option value="custom">Custom date range</option>
            </select>
            {cleanupMode==='custom'&&<>
              <input aria-label="Custom start date" name="start" type="date" required/>
              <span>to</span>
              <input aria-label="Custom end date" name="end" type="date" required/>
            </>}
            <button className="danger">Delete records</button>
          </div>
          <small>Deletes both submissions and manager notes for the selected period.</small>
        </form>
      </div>

      <div className="calendar-head">
        <button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}>← Previous</button>
        <div>
          <h1>{month.toLocaleString('en',{month:'long',year:'numeric'})}</h1>
          <button className="today-button" onClick={()=>setMonth(new Date(new Date().getFullYear(),new Date().getMonth(),1))}>Today</button>
        </div>
        <button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}>Next →</button>
      </div>

      <div className="calendar-controls">
        <div className="legend"><i className="recent"/>New in last 24 hours <i className="employee"/>Employee note <i className="parent-note"/>Parent/Client note <i className="note"/>Manager note</div>
        <CalendarFilters value={activeFilter} onChange={setActiveFilter}/>
      </div>

      <div className="week">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day=><b key={day}>{day}</b>)}</div>
      <div className="calendar">
        {cells.map((day,index)=>{
          const date=day?`${monthKey(month)}-${pad(day)}`:'';
          return <div className="day" key={index}>{day&&<>
            <div className="daytop">
              <b>{day}</b>
              <button className="plus" title="Add calendar note" onClick={()=>setModal({
                kind:'note',event_date:date,title:'',note_type:'Out',note_category:'Manager Note',details:'',
                note_date_mode:'single',repeat_dates:[date,''],range_start:date,range_end:date,
                recurrence_kind:'range',recurrence_start:date,recurrence_end:date,
                recurrence_weekdays:[new Date(date+'T00:00:00Z').getUTCDay()],
              })}>+ Note</button>
            </div>

            {entries
              .filter(entry=>entry.event_date===date&&entry.submitter_type==='Employee'&&entryMatchesFilter(entry,activeFilter))
              .map(entry=><button className={`event ${entry.submitter_type.toLowerCase()}${isNew(entry.submitted_at)?' recent':''}`} key={'e'+entry.id} onClick={()=>setModal({...entry,kind:'entry'})}>
                <small>Employee Note{isNew(entry.submitted_at)?' · New':''}</small>
                {entry.name} — {entry.request_type}
              </button>)}

            {notes
              .filter(note=>note.event_date===date&&noteMatchesFilter(note,activeFilter))
              .map(note=>{
                const category=noteCategory(note);
                const categoryClass=category==='Parent/Client Note'?'parent-note':category==='Employee Note'?'employee-note':'manager-note';
                return <button className={`event note ${categoryClass}${isNew(note.created_at)?' recent':''}`} key={'n'+note.id} onClick={()=>setModal({
                  ...note,
                  note_type:normalizeNoteType(note.note_type),
                  note_category:category,
                  kind:'note',
                  note_date_mode:'single',
                  repeat_dates:[note.event_date,''],
                  range_start:note.event_date,
                  range_end:note.event_date,
                })}>
                  <small>{category}{isNew(note.created_at)?' · New':''}</small>
                  {note.title} — {note.note_type}
                </button>;
              })}
          </>}</div>;
        })}
      </div>
    </main>

    {modal&&<div className="overlay"><form className="card modal" onSubmit={save}>
      <h2>{modal.id?'Edit':'Add'} {modal.kind==='note'?'calendar note':'request'}</h2>

      {modal.kind==='entry'
        ?<>
          <Field t="Name"><input required value={modal.name} onChange={e=>setModal({...modal,name:e.target.value})}/></Field>
          <Field t="Employee email"><input type="email" value={modal.email||''} onChange={e=>setModal({...modal,email:e.target.value})}/></Field>
          <Field t="Request type"><select value={modal.request_type} onChange={e=>setModal({...modal,request_type:e.target.value})}>{[...new Set([...MANAGER_TYPES,modal.request_type].filter(Boolean))].map(value=><option key={value}>{value}</option>)}</select></Field>
          <Field t="Details"><textarea value={modal.reason||''} onChange={e=>setModal({...modal,reason:e.target.value})}/></Field>
          <Field t="Date"><input required type="date" value={modal.event_date} onChange={e=>setModal({...modal,event_date:e.target.value})}/></Field>
        </>
        :<>
          <CategoryPicker value={modal.note_category||'Manager Note'} onChange={note_category=>setModal({...modal,note_category})}/>
          <Field t="Person or client name"><input required value={modal.title} onChange={e=>setModal({...modal,title:e.target.value})}/></Field>
          <Field t="Reason type"><select value={modal.note_type} onChange={e=>setModal({...modal,note_type:e.target.value})}>{[...new Set([...MANAGER_TYPES,modal.note_type].filter(Boolean))].map(value=><option key={value}>{value}</option>)}</select></Field>
          <Field t="Notes"><textarea value={modal.details||''} onChange={e=>setModal({...modal,details:e.target.value})}/></Field>

          {!modal.id&&<Field t="Date selection"><select value={modal.note_date_mode} onChange={e=>setModal({...modal,note_date_mode:e.target.value})}>
            <option value="single">Single date</option>
            <option value="multiple">Multiple selected dates</option>
            <option value="range">Date range</option>
            <option value="recurring">Recurring</option>
          </select></Field>}

          {modal.id||modal.note_date_mode==='single'
            ?<Field t="Date"><input required type="date" value={modal.event_date} onChange={e=>setModal({...modal,event_date:e.target.value})}/></Field>
            :modal.note_date_mode==='recurring'
              ?<RecurringFields modal={modal} setModal={setModal}/>
              :modal.note_date_mode==='multiple'
                ?<div className="date-section">
                  <b>Note dates</b>
                  {modal.repeat_dates.map((date,index)=><div className="date-row" key={index}>
                    <input required type="date" value={date} onChange={e=>updateRepeatDate(index,e.target.value)}/>
                    {modal.repeat_dates.length>2&&<button type="button" className="secondary small-button" onClick={()=>removeRepeatDate(index)}>Remove</button>}
                  </div>)}
                  <button type="button" className="secondary add-date" onClick={addRepeatDate}>+ Add another date</button>
                </div>
                :<>
                  <Field t="Start date"><input required type="date" value={modal.range_start} onChange={e=>setModal({...modal,range_start:e.target.value})}/></Field>
                  <Field t="End date"><input required type="date" min={modal.range_start} value={modal.range_end} onChange={e=>setModal({...modal,range_end:e.target.value})}/></Field>
                </>}
        </>}

      {msg&&<p className="message error-message">{msg}</p>}

      <div className="actions">
        <button>Save</button>
        {modal.recurrence_id&&modal.recurrence_ongoing&&modal.recurrence_active&&<button type="button" className="danger" onClick={stopRecurrence}>Stop ongoing</button>}
        {modal.id&&<button type="button" className="danger" onClick={()=>remove(modal.kind==='note'?'notes':'manager',modal.id)}>Delete</button>}
        <button type="button" className="secondary" onClick={()=>setModal(null)}>Cancel</button>
      </div>
    </form></div>}
  </Shell>;
}

function RecurringFields({modal,setModal}){
  const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const selected=modal.recurrence_weekdays||[];
  const toggle=day=>setModal({
    ...modal,
    recurrence_weekdays:selected.includes(day)
      ?selected.filter(value=>value!==day)
      :[...selected,day].sort((a,b)=>a-b),
  });

  return <div className="date-section">
    <b>Recurring schedule</b>
    <Field t="Repeat">
      <select value={modal.recurrence_kind||'range'} onChange={e=>setModal({...modal,recurrence_kind:e.target.value})}>
        <option value="range">From this date to this date</option>
        <option value="ongoing">From this date — ongoing until stopped</option>
      </select>
    </Field>
    <Field t="Start date"><input required type="date" value={modal.recurrence_start||modal.event_date} onChange={e=>setModal({...modal,recurrence_start:e.target.value})}/></Field>
    {modal.recurrence_kind!=='ongoing'&&<Field t="End date"><input required type="date" min={modal.recurrence_start} value={modal.recurrence_end||modal.recurrence_start} onChange={e=>setModal({...modal,recurrence_end:e.target.value})}/></Field>}
    <div className="field">
      <b>Repeat on</b>
      <div className="weekday-picker">{days.map((name,day)=><label key={name} className="weekday-option">
        <input type="checkbox" checked={selected.includes(day)} onChange={()=>toggle(day)}/>
        <span>{name}</span>
      </label>)}</div>
    </div>
    {modal.recurrence_kind==='ongoing'&&<small>Ongoing notes are generated only through the current month. When a new month begins, its matching days appear only if the series is still active. Open any occurrence and choose Stop ongoing to prevent future months.</small>}
  </div>;
}

function Shell({children,authenticated=false,logout}){
  return <>
    <header>
      <Brand title={`${LOCATION} Manager Calendar`} subtitle="Success On The Spectrum"/>
      <nav className="manager-nav">
        <a href="/">Form</a>
        {authenticated&&<button className="link" onClick={logout}>Log out</button>}
      </nav>
    </header>
    {children}
  </>;
}

function Field({t,children}){
  return <label className="field"><b>{t}</b>{children}</label>;
}

function CategoryPicker({value,onChange}){
  const categoryClass=value==='Employee Note'?'employee-note':value==='Parent/Client Note'?'parent-note':'manager-note';
  return <label className="field">
    <b>Note category</b>
    <select className={`note-category-select ${categoryClass}`} value={value} onChange={e=>onChange(e.target.value)}>
      <option className="manager-note" value="Manager Note">Manager Note</option>
      <option className="employee-note" value="Employee Note">Employee Note</option>
      <option className="parent-note" value="Parent/Client Note">Client/Parent Note</option>
    </select>
  </label>;
}
