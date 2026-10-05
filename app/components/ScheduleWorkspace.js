'use client';

import {useEffect,useMemo,useState} from 'react';
import Brand from './Brand';
import {apiRequest} from '../../lib/client-api';

const DAY_FIELDS=['monday','tuesday','wednesday','thursday','friday'];
const DAY_LABELS=['Monday','Tuesday','Wednesday','Thursday','Friday'];

const employeeSections=[
  {key:'Employee',title:'Regular Employees',subtitle:'Weekly schedule for regular staff members.',tone:'employee'},
  {key:'BCBA',title:'BCBA',subtitle:'Weekly schedule for BCBA team members.',tone:'bcba'},
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

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    if(params.get('view')==='client')setKind('client');
  },[]);

  useEffect(()=>{
    apiRequest(loginUrl)
      .then(data=>setAuth(data.authenticated))
      .catch(error=>{setAuth(false);setMessage(error.message);});
  },[loginUrl]);

  useEffect(()=>{
    if(auth)loadRows(kind);
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

  function updateRow(id,field,value){
    setRows(current=>current.map(row=>row.id===id?{...row,[field]:value}:row));
  }

  function addRow(category){
    setRows(current=>[...current,blankRow(category)]);
    setMessage('');
  }

  async function saveRow(row){
    if(!String(row.first_name||'').trim())return setMessage('Enter a first name before saving.');
    try{
      const canonicalCategory=sectionKey(kind,row.category);
      const saved=await apiRequest('/api/schedules',{
        method:row._new?'POST':'PATCH',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({...row,category:canonicalCategory,kind}),
      });
      setRows(current=>current.map(item=>item.id===row.id?saved:item));
      setMessage(`${row.first_name}${row.last_name?' '+row.last_name:''} saved successfully.`);
    }catch(error){setMessage(error.message);}
  }

  async function deleteRow(row){
    if(row._new){
      setRows(current=>current.filter(item=>item.id!==row.id));
      setMessage('Unsaved entry removed.');
      return;
    }
    if(!confirm(`Delete ${row.first_name}${row.last_name?' '+row.last_name:''} from this schedule?`))return;
    try{
      await apiRequest(`/api/schedules?kind=${kind}&id=${row.id}`,{method:'DELETE'});
      setRows(current=>current.filter(item=>item.id!==row.id));
      setMessage('Schedule entry deleted.');
    }catch(error){setMessage(error.message);}
  }

  async function deleteSection(section){
    const sectionRows=rows.filter(row=>sectionKey(kind,row.category)===section.key);
    if(!sectionRows.length)return setMessage(`${section.title} is already empty.`);
    if(!confirm(`Delete ALL ${sectionRows.length} entr${sectionRows.length===1?'y':'ies'} from ${section.title}? This cannot be undone.`))return;
    try{
      await apiRequest(`/api/schedules?kind=${kind}&scope=section&category=${encodeURIComponent(section.key)}`,{method:'DELETE'});
      setRows(current=>current.filter(row=>sectionKey(kind,row.category)!==section.key));
      setMessage(`All entries in ${section.title} were deleted.`);
    }catch(error){setMessage(error.message);}
  }

  async function clearSchedule(){
    if(!rows.length)return setMessage('This schedule is already empty.');
    const title=kind==='employee'?'Employee Schedule':'Clients / Kids Schedule';
    if(!confirm(`Delete ALL ${rows.length} entries from the ${title}? This clears every section and cannot be undone.`))return;
    try{
      await apiRequest(`/api/schedules?kind=${kind}&scope=all`,{method:'DELETE'});
      setRows([]);
      setMessage(`${title} cleared.`);
    }catch(error){setMessage(error.message);}
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
          <p>{manager?'Add staff and clients directly to the correct section, then update their weekly hours whenever the schedule changes.':'This is the current weekly reference schedule. Schedule changes are made only from the manager view.'}</p>
        </div>
        <span className={`schedule-mode ${manager?'manager-mode':'readonly-mode'}`}>{manager?'EDITABLE':'READ ONLY'}</span>
      </section>

      <div className="schedule-view-tabs" role="tablist" aria-label="Schedule type">
        <button className={kind==='employee'?'active':''} type="button" onClick={()=>switchKind('employee')}>Employee Schedule</button>
        <button className={kind==='client'?'active':''} type="button" onClick={()=>switchKind('client')}>Clients / Kids Schedule</button>
      </div>

      <div className="schedule-topbar">
        <div>
          <h2>{kind==='employee'?'Employee Schedule':'Clients / Kids Schedule'}</h2>
          <p>{loading?'Refreshing schedule…':`${rows.length} total ${kind==='employee'?'staff member(s)':'client/kid(s)'}`}</p>
        </div>
        <div className="schedule-topbar-actions">
          <input aria-label="Search schedule" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search name, hours, notes…"/>
          {manager&&<button type="button" className="danger schedule-clear-all" onClick={clearSchedule}>Clear Entire Schedule</button>}
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
            updateRow={updateRow}
            saveRow={saveRow}
            deleteRow={deleteRow}
            deleteSection={deleteSection}
            addRow={addRow}
          />;
        })}
      </div>
    </main>
  </PageShell>;
}

function ScheduleSection({section,rows,totalCount,manager,kind,updateRow,saveRow,deleteRow,deleteSection,addRow}){
  const noun=kind==='employee'?'Staff Member':'Client / Kid';
  return <section className={`schedule-section schedule-section-${section.tone}`}>
    <div className="schedule-section-head">
      <div>
        <span className="schedule-section-kicker">{kind==='employee'?'STAFF':'CLIENTS / KIDS'}</span>
        <h2>{section.title}</h2>
        <p>{section.subtitle}</p>
      </div>
      <div className="schedule-section-actions">
        <span className="schedule-count">{totalCount}</span>
        {manager&&<button type="button" onClick={()=>addRow(section.key)}>+ Add {noun}</button>}
        {manager&&totalCount>0&&<button type="button" className="danger schedule-delete-section" onClick={()=>deleteSection(section)}>Delete All in Section</button>}
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
          {rows.map(row=><ScheduleRow key={row.id} row={row} manager={manager} updateRow={updateRow} saveRow={saveRow} deleteRow={deleteRow}/>) }
        </tbody>
      </table>
    </div>
  </section>;
}

function ScheduleRow({row,manager,updateRow,saveRow,deleteRow}){
  const textCell=field=>manager
    ?<input value={row[field]||''} onChange={event=>updateRow(row.id,field,event.target.value)}/>
    :<span>{row[field]||'—'}</span>;

  return <tr>
    <td>{textCell('first_name')}</td>
    <td>{textCell('last_name')}</td>
    {DAY_FIELDS.map(day=><td key={day}>{textCell(day)}</td>)}
    <td>{manager?<textarea className="schedule-notes-input" value={row.notes||''} onChange={event=>updateRow(row.id,'notes',event.target.value)}/>:<span>{row.notes||'—'}</span>}</td>
    {manager&&<td><div className="schedule-row-actions"><button type="button" onClick={()=>saveRow(row)}>Save</button><button type="button" className="danger" onClick={()=>deleteRow(row)}>Delete</button></div></td>}
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
