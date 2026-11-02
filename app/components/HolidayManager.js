'use client';

import {useEffect,useState} from 'react';
import {apiRequest} from '../../lib/client-api';

const WEEKDAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function HolidayManager({month,dates=[],onSaved}){
  const [managerAccess,setManagerAccess]=useState(false);
  const [open,setOpen]=useState(false);

  useEffect(()=>{
    let active=true;
    apiRequest('/api/login')
      .then(data=>{if(active)setManagerAccess(data.authenticated===true)})
      .catch(()=>{if(active)setManagerAccess(false)});
    return()=>{active=false};
  },[]);
  const [draft,setDraft]=useState([]);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');

  const [year,monthNumber]=month.split('-').map(Number);
  const firstWeekday=new Date(year,monthNumber-1,1).getDay();
  const dayCount=new Date(year,monthNumber,0).getDate();
  const cells=[...Array(firstWeekday).fill(null),...Array.from({length:dayCount},(_,index)=>index+1)];
  while(cells.length%7)cells.push(null);
  const monthLabel=new Date(year,monthNumber-1,1).toLocaleString('en',{month:'long',year:'numeric'});

  function openEditor(){
    setDraft([...dates]);
    setMessage('');
    setOpen(true);
  }

  function toggleDate(date){
    setDraft(current=>current.includes(date)
      ?current.filter(value=>value!==date)
      :[...current,date].sort());
  }

  async function save(event){
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try{
      const result=await apiRequest('/api/holidays',{
        method:'PUT',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({month,dates:draft}),
      });
      onSaved?.(result.dates||[]);
      setOpen(false);
    }catch(error){
      setMessage(error.message);
    }finally{
      setSaving(false);
    }
  }

  if(!managerAccess)return null;

  return <>
    <button type="button" className="filter-trigger holiday-trigger" onClick={openEditor}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 2v3M17 2v3M4 8h16M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm3 8h3v3H8z"/>
      </svg>
      <span>Add Holidays</span>
    </button>

    {open&&<div className="overlay holiday-overlay">
      <form className="card modal holiday-modal" onSubmit={save}>
        <h2>Manage holidays for {monthLabel}</h2>
        <p className="muted">Select the dates this location will be closed. Click a selected date again to remove it.</p>
        <div className="holiday-picker-weekdays">
          {WEEKDAYS.map(day=><span key={day}>{day}</span>)}
        </div>
        <div className="holiday-picker-grid">
          {cells.map((day,index)=>{
            if(!day)return <span className="holiday-picker-empty" key={'empty'+index}/>;
            const date=month+'-'+String(day).padStart(2,'0');
            const selected=draft.includes(date);
            return <button
              type="button"
              key={date}
              className={'holiday-picker-day'+(selected?' selected':'')}
              aria-pressed={selected}
              onClick={()=>toggleDate(date)}
            >
              {day}
            </button>;
          })}
        </div>
        <div className="holiday-selection-summary">
          <strong>{draft.length} holiday date{draft.length===1?'':'s'} selected</strong>
          <button type="button" className="link" onClick={()=>setDraft([])}>Clear month</button>
        </div>
        <p className="muted holiday-help">Selected dates will be shaded and labeled HOLIDAY on both calendars. New PTO/leave requests and calendar notes on those dates will be blocked. Existing records will remain visible and will not be deleted.</p>
        {message&&<p className="message error-message">{message}</p>}
        <div className="actions">
          <button disabled={saving}>{saving?'Saving…':'Save holidays'}</button>
          <button type="button" className="secondary" onClick={()=>setOpen(false)}>Cancel</button>
        </div>
      </form>
    </div>}
  </>;
}
