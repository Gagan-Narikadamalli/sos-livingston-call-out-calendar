'use client';
import {useState} from 'react';
import Brand from './components/Brand';

const emptyForm={submitter_type:'Employee',name:'',email:'',request_type:'PTO',date_mode:'single',event_date:'',selected_dates:['',''],range_start:'',range_end:'',reason:''};

export default function Home(){
  const [form,setForm]=useState(emptyForm);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const cutoff=advanceDate();
  const reasonRequired=form.request_type==='Non-PTO / Out';
  function update(patch){setForm(current=>({...current,...patch}))}
  function updateSelected(index,value){update({selected_dates:form.selected_dates.map((date,i)=>i===index?value:date)})}
  function addSelectedDate(){if(form.selected_dates.length<31)update({selected_dates:[...form.selected_dates,'']})}
  function removeSelectedDate(index){if(form.selected_dates.length>2)update({selected_dates:form.selected_dates.filter((_,i)=>i!==index)})}
  async function submit(event){event.preventDefault();setBusy(true);setMessage('');const response=await fetch('/api/callouts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(form)});const data=await response.json();setBusy(false);if(!response.ok)return setMessage(data.error);setMessage(`${data.created} PTO or leave date${data.created===1?'':'s'} submitted successfully.`);setForm(emptyForm)}

  return <>
    <header><Brand subtitle="Livingston PTO & Leave Request Portal"/><nav className="portal-links"><a className="link" href="/calendar">Livingston call-out calendar</a><a className="link" href="/manager">Manager calendar</a></nav></header>
    <section className="hero"><div><label>SUCCESS ON THE SPECTRUM · LIVINGSTON</label><h1>Submit a PTO or leave request</h1><p>Employees can request PTO or report non-PTO time away for one or more dates.</p></div></section>
    <main><form className="card form" onSubmit={submit}>
      <Field label="Employee name"><input required autoComplete="name" placeholder="Enter your full name" value={form.name} onChange={e=>update({name:e.target.value})}/></Field>
      <Field label="Employee email"><input required type="email" autoComplete="email" placeholder="Enter your work email" value={form.email} onChange={e=>update({email:e.target.value})}/><small className="muted">Your email is stored with the request so managers can identify who submitted it.</small></Field>
      <Field label="Request type"><select value={form.request_type} onChange={e=>update({request_type:e.target.value})}><option value="PTO">PTO (if available)</option><option value="Non-PTO / Out">Non-PTO / Out</option></select><small className="muted">PTO dates must be at least two calendar days after today.</small></Field>
      <Field label="Date selection"><select value={form.date_mode} onChange={e=>update({date_mode:e.target.value})}><option value="single">Single date</option><option value="multiple">Multiple selected dates</option><option value="range">Date range</option></select></Field>
      {form.date_mode==='single'&&<Field label="Requested date"><input required type="date" min={form.request_type==='PTO'?cutoff:undefined} value={form.event_date} onChange={e=>update({event_date:e.target.value})}/></Field>}
      {form.date_mode==='multiple'&&<div className="wide date-section"><b>Requested dates</b>{form.selected_dates.map((date,index)=><div className="date-row" key={index}><input aria-label={`Requested date ${index+1}`} required type="date" min={form.request_type==='PTO'?cutoff:undefined} value={date} onChange={e=>updateSelected(index,e.target.value)}/>{form.selected_dates.length>2&&<button type="button" className="secondary small-button" onClick={()=>removeSelectedDate(index)}>Remove</button>}</div>)}<button type="button" className="secondary add-date" onClick={addSelectedDate}>+ Add another date</button></div>}
      {form.date_mode==='range'&&<><Field label="Start date"><input required type="date" min={form.request_type==='PTO'?cutoff:undefined} value={form.range_start} onChange={e=>update({range_start:e.target.value})}/></Field><Field label="End date"><input required type="date" min={form.range_start||(form.request_type==='PTO'?cutoff:undefined)} value={form.range_end} onChange={e=>update({range_end:e.target.value})}/></Field></>}
      <div className="wide"><Field label={`Reason or details${reasonRequired?' (required)':' (optional)'}`}><textarea required={reasonRequired} placeholder={reasonRequired?'Briefly explain the time away.':'Optional details for the manager.'} value={form.reason} onChange={e=>update({reason:e.target.value})}/></Field><p className="muted">Submission details, employee email, and submission time are available only to authorized managers.</p><p className="request-notice"><strong>IMPORTANT: This is only a request and is still pending manager approval. Do not assume your request is approved until a manager confirms it.</strong></p>{message&&<p className="message">{message}</p>}<button disabled={busy}>{busy?'Submitting…':'Submit request'}</button></div>
    </form></main>
  </>;
}

function advanceDate(){const date=new Date();date.setHours(0,0,0,0);date.setDate(date.getDate()+2);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
function Field({label,children}){return <label className="field"><b>{label}</b>{children}</label>}
