'use client';

import {useEffect,useMemo,useState} from 'react';
import Brand from './Brand';
import ScheduleEditor from './ScheduleEditor';
import {parseScheduleTime,normalizedScheduleTime} from '../../lib/schedule-time.mjs';
import OverallScheduleSummary from './OverallScheduleSummary';
import {apiRequest} from '../../lib/client-api';

const DAY_FIELDS=['monday','tuesday','wednesday','thursday','friday'];
const DAY_LABELS=['Monday','Tuesday','Wednesday','Thursday','Friday'];

const employeeSections=[
  {key:'Employee',title:'BT',subtitle:'Weekly schedule for behavior technicians.',tone:'employee'},
  {key:'BCBA',title:'BCBA',subtitle:'Weekly schedule for BCBA team members.',tone:'bcba'},
  {key:'Manager/HR',title:'Manager/HR',subtitle:'Weekly schedule for managers and HR staff.',tone:'managerhr'},
  {key:'Intern',title:'Interns',subtitle:'Weekly schedule for interns.',tone:'intern'},
];
const clientSections=[
  {key:'Client/Kid',title:'Regular Kids / In-Center Clients',subtitle:'Clients and kids who receive services in the center.',tone:'client'},
  {key:'Home Client',title:'Home Clients',subtitle:'Clients and kids who receive services at home.',tone:'home'},
];

const normalize=value=>String(value||'').trim().toLowerCase();
function sectionKey(kind,category){
  const value=normalize(category);
  if(kind==='employee'){
    if(value.includes('manager')||value==='hr'||value.includes('/hr'))return'Manager/HR';
    if(value.includes('bcba'))return'BCBA';
    if(value.includes('intern'))return'Intern';
    return'Employee';
  }
  if(value.includes('home'))return'Home Client';
  return'Client/Kid';
}

function blankRow(category){
  return{
    id:`draft-${Date.now()}-${Math.random()}`,
    _new:true,
    category,
    first_name:'',last_name:'',assigned_to:'',
    monday:'',tuesday:'',wednesday:'',thursday:'',friday:'',notes:'',
  };
}

function matchesSearch(row,search){
  if(!search)return true;
  const value=[row.first_name,row.last_name,row.notes,...DAY_FIELDS.map(day=>row[day])].join(' ').toLowerCase();
  return value.includes(search.toLowerCase());
}

export default function ScheduleWorkspace({manager=false,location}){
  const loginUrl=manager?'/api/login':'/api/intern-login';
  const [auth,setAuth]=useState(null);
  const [password,setPassword]=useState('');
  const [kind,setKind]=useState('employee');
  const [rows,setRows]=useState([]);
  const [message,setMessage]=useState('');
  const [loading,setLoading]=useState(false);
  const [search,setSearch]=useState('');
  const [editing,setEditing]=useState(null);
  const [toast,setToast]=useState(null);
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    if(!toast)return;
    const timer=setTimeout(()=>setToast(null),3000);
    return()=>clearTimeout(timer);
  },[toast]);

  function notify(text){setMessage('');setToast({text,id:Date.now()});}

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    if(params.get('view')==='client')setKind('client');
    if(manager&&params.get('view')==='summary')setKind('summary');
  },[]);

  useEffect(()=>{
    apiRequest(loginUrl)
      .then(data=>setAuth(data.authenticated))
      .catch(error=>{setAuth(false);setMessage(error.message);});
  },[loginUrl]);

  useEffect(()=>{
    if(auth&&kind!=='summary')loadRows(kind);
  },[auth,kind]);

  const sections=kind==='employee'?employeeSections:clientSections;
  const totalVisible=useMemo(()=>rows.filter(row=>matchesSearch(row,search)).length,[rows,search]);

  async function login(event){
    event.preventDefault();
    setMessage('');
    try{
      await apiRequest(loginUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password})});
      setPassword('');
      setAuth(true);
    }catch(error){setMessage(error.message);}
  }

  async function logout(){
    try{await apiRequest(loginUrl,{method:'DELETE'});}catch{}
    setAuth(false);
  }

  async function loadRows(nextKind=kind){
    setLoading(true);
    try{
      const data=await apiRequest(`/api/schedules?kind=${nextKind}`);
      setRows(data);
      setMessage('');
    }catch(error){
      if(error.status===401)setAuth(false);
      setMessage(error.message);
    }finally{setLoading(false);}
  }

  function switchKind(next){
    setKind(next);
    setSearch('');
    const base=manager?'/manager/schedules':'/calendar/schedules';
    window.history.replaceState(null,'',`${base}?view=${next}`);
  }

  function addRow(category){
    setEditing(blankRow(category));
    setMessage('');
  }

  async function saveRow(row){
    if(!String(row.first_name||'').trim())throw new Error('Enter a first name before saving.');
    for(const day of DAY_FIELDS){
      const time=parseScheduleTime(row[day]);
      if(!time.valid)throw new Error(`${day[0].toUpperCase()+day.slice(1)}: ${time.error}`);
    }
    const hours=Object.fromEntries(DAY_FIELDS.map(day=>[day,normalizedScheduleTime(row[day])]));
    const canonicalCategory=sectionKey(kind,row.category);
    const saved=await apiRequest('/api/schedules',{
      method:row._new?'POST':'PATCH',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({...row,...hours,category:canonicalCategory,kind}),
    });
    setRows(current=>row._new?[...current,saved]:current.map(item=>item.id===row.id?saved:item));
    setEditing(null);
    notify(`${row.first_name}${row.last_name?' '+row.last_name:''} ${row._new?'added':'saved'} successfully.`);
  }

  async function deleteRow(row){
    if(busy)return;
    if(row._new){
      setRows(current=>current.filter(item=>item.id!==row.id));
      notify('Unsaved entry removed.');
      return;
    }
    if(!confirm(`Delete ${row.first_name}${row.last_name?' '+row.last_name:''} from this schedule?`))return;
    setBusy(true);
    try{
      await apiRequest(`/api/schedules?kind=${kind}&id=${row.id}`,{method:'DELETE'});
      setRows(current=>current.filter(item=>item.id!==row.id));
      notify('Schedule entry deleted successfully.');
    }catch(error){setMessage(error.message);}finally{setBusy(false);}
  }

  async function deleteSection(section){
    if(busy)return;
    const sectionRows=rows.filter(row=>sectionKey(kind,row.category)===section.key);
    if(!sectionRows.length)return setMessage(`${section.title} is already empty.`);
    if(!confirm(`Delete ALL ${sectionRows.length} entr${sectionRows.length===1?'y':'ies'} from ${section.title}? This cannot be undone.`))return;
    setBusy(true);
    try{
      await apiRequest(`/api/schedules?kind=${kind}&scope=section&category=${encodeURIComponent(section.key)}`,{method:'DELETE'});
      setRows(current=>current.filter(row=>sectionKey(kind,row.category)!==section.key));
      notify(`All entries in ${section.title} were deleted successfully.`);
    }catch(error){setMessage(error.message);}finally{setBusy(false);}
  }

  async function clearSchedule(){
    if(busy)return;
    if(!rows.length)return setMessage('This schedule is already empty.');
    const title=kind==='employee'?'Employee Schedule':'Clients / Kids Schedule';
    if(!confirm(`Delete ALL ${rows.length} entries from the ${title}? This clears every section and cannot be undone.`))return;
    setBusy(true);
    try{
      await apiRequest(`/api/schedules?kind=${kind}&scope=all`,{method:'DELETE'});
      setRows([]);
      notify(`${title} cleared successfully.`);
    }catch(error){setMessage(error.message);}finally{setBusy(false);}
  }

  if(auth===null)return <PageShell location={location} manager={manager}><main className="schedule-page"><section className="card schedule-status"><h1>Loading schedule…</h1></section></main></PageShell>;

  if(!auth)return <PageShell location={location} manager={manager}><main className="manager-login"><form className="card login-card" onSubmit={login}>
    <span className="login-label">{manager?'AUTHORIZED MANAGER ACCESS':'AUTHORIZED TEAM ACCESS'}</span>
    <h1>{location} schedules</h1>
    <p>{manager?'Sign in with the manager password to edit schedules.':'Sign in with the team calendar password to view schedules.'}</p>
    <label className="field"><b>Password</b><input type="password" required autoFocus value={password} onChange={event=>setPassword(event.target.value)}/></label>
    {message&&<p className="message error-message">{message}</p>}
    <button>Open schedules</button>
  </form></main></PageShell>;

  return <PageShell location={location} manager={manager} logout={logout}>
    <main className="schedule-page grouped-schedule-page">
      <section className="schedule-hero">
        <div>
          <span className="schedule-eyebrow">{manager?'MANAGER SCHEDULE CENTER':'READ-ONLY TEAM SCHEDULE'}</span>
          <h1>{location} Weekly Schedules</h1>
          <p>{manager?'View weekly schedules at a glance. Choose Edit to update details or Add to create a new schedule.':'This is the current weekly reference schedule. Schedule changes are made only from the manager view.'}</p>
        </div>
        <span className={`schedule-mode ${manager?'manager-mode':'readonly-mode'}`}>{manager?'EDITABLE':'READ ONLY'}</span>
      </section>

      <div className="schedule-view-tabs" role="tablist" aria-label="Schedule type">
        <button className={kind==='employee'?'active':''} type="button" onClick={()=>switchKind('employee')}>Employee Schedule</button>
        <button className={kind==='client'?'active':''} type="button" onClick={()=>switchKind('client')}>Clients / Kids Schedule</button>
        {manager&&<button className={kind==='summary'?'active':''} type="button" onClick={()=>switchKind('summary')}>Overall Summary</button>}
      </div>

      {manager&&kind==='summary'?<OverallScheduleSummary onUnauthorized={()=>setAuth(false)}/>:<>
      <div className="schedule-topbar">
        <div>
          <h2>{kind==='employee'?'Employee Schedule':'Clients / Kids Schedule'}</h2>
          <p>{loading?'Refreshing schedule…':`${rows.length} total ${kind==='employee'?'staff member(s)':'client/kid(s)'}`}</p>
        </div>
        <div className="schedule-topbar-actions">
          <input aria-label="Search schedule" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search name, hours, notes…"/>
          {manager&&<button type="button" className="danger schedule-clear-all" disabled={busy||loading} onClick={clearSchedule}>Clear Entire Schedule</button>}
        </div>
      </div>

      {message&&<p className="message schedule-message">{message}</p>}
      {search&&<p className="schedule-search-summary">Showing {totalVisible} matching entr{totalVisible===1?'y':'ies'}.</p>}

      <div className="schedule-sections">
        {sections.map(section=>{
          const allSectionRows=rows.filter(row=>sectionKey(kind,row.category)===section.key);
          const sectionRows=allSectionRows.filter(row=>matchesSearch(row,search));
          return <ScheduleSection
            key={section.key}
            section={section}
            rows={sectionRows}
            totalCount={allSectionRows.length}
            manager={manager}
            kind={kind}
            editRow={row=>setEditing({...row})}
            busy={busy||loading}
            deleteRow={deleteRow}
            deleteSection={deleteSection}
            addRow={addRow}
          />;
        })}
      </div>
      </>}
    </main>
    {manager&&editing&&<ScheduleEditor row={editing} kind={kind} onSave={saveRow} onClose={()=>setEditing(null)}/>}
    {toast&&<div className="schedule-toast" role="status" aria-live="polite"><span aria-hidden="true">✓</span>{toast.text}</div>}
  </PageShell>;
}

function ScheduleSection({section,rows,totalCount,manager,kind,editRow,busy,deleteRow,deleteSection,addRow}){
  const noun=kind==='employee'?'Staff Member':'Client / Kid';
  return <section className={`schedule-section schedule-section-${section.tone} schedule-display-section`}>
    <div className="schedule-section-head">
      <div>
        <span className="schedule-section-kicker">{kind==='employee'?'STAFF':'CLIENTS / KIDS'}</span>
        <h2>{section.title}</h2>
        <p>{section.subtitle}</p>
      </div>
      <div className="schedule-section-actions">
        <span className="schedule-count">{totalCount}</span>
        {manager&&<button type="button" disabled={busy} onClick={()=>addRow(section.key)}>+ Add {noun}</button>}
        {manager&&totalCount>0&&<button type="button" className="danger schedule-delete-section" disabled={busy} onClick={()=>deleteSection(section)}>Delete All in Section</button>}
      </div>
    </div>

    <div className="schedule-group-table-wrap">
      <table className="schedule-group-table">
        <thead><tr>
          <th>First Name</th>
          <th>Last Name</th>
          {DAY_LABELS.map(day=><th key={day}>{day}</th>)}
          <th>Notes</th>
          {manager&&<th>Actions</th>}
        </tr></thead>
        <tbody>
          {!rows.length&&<tr><td className="schedule-empty" colSpan={manager?9:8}>{manager?'No entries shown. Use Add to create one.':'No entries in this section.'}</td></tr>}
          {rows.map(row=><ScheduleRow key={row.id} row={row} manager={manager} editRow={editRow} busy={busy} deleteRow={deleteRow}/>) }
        </tbody>
      </table>
    </div>
  </section>;
}

function ScheduleRow({row,manager,editRow,busy,deleteRow}){
  return <tr>
    <td><span className="schedule-person-name">{row.first_name||'—'}</span></td>
    <td><span>{row.last_name||'—'}</span></td>
    {DAY_FIELDS.map(day=>{const time=parseScheduleTime(row[day]);return <td key={day}><div className="schedule-display-time">{time.valid?(normalizedScheduleTime(row[day])?normalizedScheduleTime(row[day]).split('; ').map((range,index)=><span key={index}>{range.replace(/\b0(?=\d:)/g,'').replace(' - ',' – ')}</span>):<span>—</span>):<span title={row[day]}>{row[day]}</span>}{!time.valid&&<small className="schedule-time-error">Needs correction</small>}</div></td>;})}
    <td><span className="schedule-display-notes" title={row.notes||''}>{row.notes||'—'}</span></td>
    {manager&&<td><div className="schedule-row-actions"><button type="button" disabled={busy} onClick={()=>editRow(row)}>Edit</button><button type="button" className="danger" disabled={busy} onClick={()=>deleteRow(row)}>Delete</button></div></td>}
  </tr>;
}

function PageShell({children,location,manager,logout}){
  return <>
    <header>
      <Brand title={`${location} ${manager?'Manager ':''}Schedules`} subtitle="Success On The Spectrum"/>
      <nav className="manager-nav">
        <a href={manager?'/manager':'/calendar'}>{location} Calendar</a>
        {logout&&<button className="link" type="button" onClick={logout}>Log out</button>}
      </nav>
    </header>
    {children}
  </>;
}
