'use client';

import {useEffect,useMemo,useState} from 'react';
import Brand from './Brand';
import {apiRequest} from '../../lib/client-api';

const DAY_FIELDS=['monday','tuesday','wednesday','thursday','friday'];
const DAY_LABELS=['Monday','Tuesday','Wednesday','Thursday','Friday'];
const EMPLOYEE_CATEGORIES=['Employee','Intern','BCBA','Other'];
const CLIENT_CATEGORIES=['Client/Kid','Group/Program','Other'];

const normalize=value=>String(value||'').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
const categoryToken=value=>{
  const token=normalize(value);
  if(token.includes('intern'))return'intern';
  if(token.includes('bcba'))return'bcba';
  if(token.includes('client')||token.includes('kid'))return'client';
  if(token.includes('program')||token.includes('group'))return'program';
  if(token.includes('employee')||token.includes('staff'))return'employee';
  return'other';
};

function parseGrid(text){
  const sample=String(text||'').split(/\r?\n/).find(line=>line.trim())||'';
  const delimiter=(sample.match(/\t/g)||[]).length>(sample.match(/,/g)||[]).length?'\t':',';
  const rows=[];
  let row=[],cell='',quoted=false;
  const source=String(text||'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  for(let i=0;i<source.length;i+=1){
    const char=source[i];
    if(char==='"'){
      if(quoted&&source[i+1]==='"'){cell+='"';i+=1;}
      else quoted=!quoted;
    }else if(char===delimiter&&!quoted){row.push(cell);cell='';}
    else if(char==='\n'&&!quoted){row.push(cell);rows.push(row);row=[];cell='';}
    else cell+=char;
  }
  row.push(cell);
  if(row.some(value=>String(value).trim()))rows.push(row);
  return rows.map(values=>values.map(value=>String(value).trim()));
}

function headerMap(row){
  const map={};
  row.forEach((value,index)=>{
    const key=normalize(value);
    if(['firstname','first','name','client','clientname','kid','kidname'].includes(key)&&map.first_name==null)map.first_name=index;
    else if(['lastname','last'].includes(key))map.last_name=index;
    else if(['category','role','type'].includes(key))map.category=index;
    else if(['assignedstaff','assignedto','therapist','staffmember'].includes(key))map.assigned_to=index;
    else if(key==='monday'||key==='mon')map.monday=index;
    else if(key==='tuesday'||key==='tue'||key==='tues')map.tuesday=index;
    else if(key==='wednesday'||key==='wed')map.wednesday=index;
    else if(key==='thursday'||key==='thu'||key==='thur'||key==='thurs')map.thursday=index;
    else if(key==='friday'||key==='fri')map.friday=index;
    else if(['notes','note','comments','comment'].includes(key))map.notes=index;
  });
  return map;
}

function isHeader(row){
  const values=row.map(normalize);
  return values.some(value=>['monday','mon'].includes(value))&&values.some(value=>['firstname','first','name','client','clientname','kid','kidname'].includes(value));
}

function sectionCategory(value,kind){
  const token=normalize(value);
  if(kind==='employee'){
    if(token==='intern'||token==='interns')return'Intern';
    if(token==='bcba'||token==='bcbas')return'BCBA';
    if(token==='employee'||token==='employees'||token==='staff')return'Employee';
  }else{
    if(['client','clients','kid','kids','clientkid','clientskids','kidclient'].includes(token))return'Client/Kid';
    if(token==='program'||token==='group'||token==='groupprogram')return'Group/Program';
  }
  return null;
}

function parseScheduleText(text,kind){
  const grid=parseGrid(text);
  const output=[];
  let map=null;
  let currentCategory=kind==='employee'?'Employee':'Client/Kid';

  for(const row of grid){
    const nonEmpty=row.filter(value=>value.trim());
    if(!nonEmpty.length)continue;
    const section=nonEmpty.length===1?sectionCategory(nonEmpty[0],kind):null;
    if(section){currentCategory=section;continue;}
    if(isHeader(row)){map=headerMap(row);continue;}

    const read=(field,fallbackIndex)=>{
      const index=map&&map[field]!=null?map[field]:fallbackIndex;
      return index==null?'':String(row[index]||'').trim();
    };
    const firstName=read('first_name',0);
    const lastName=read('last_name',1);
    if(!firstName)continue;
    if(normalize(firstName)==='firstname')continue;

    const category=read('category',null)||currentCategory;
    const baseDayIndex=2;
    output.push({
      category,
      first_name:firstName,
      last_name:lastName,
      assigned_to:read('assigned_to',kind==='client'?2:null),
      monday:read('monday',kind==='client'?3:baseDayIndex),
      tuesday:read('tuesday',kind==='client'?4:baseDayIndex+1),
      wednesday:read('wednesday',kind==='client'?5:baseDayIndex+2),
      thursday:read('thursday',kind==='client'?6:baseDayIndex+3),
      friday:read('friday',kind==='client'?7:baseDayIndex+4),
      notes:read('notes',kind==='client'?8:baseDayIndex+5),
    });
  }
  return output;
}

function blankRow(kind){
  return{
    id:`draft-${Date.now()}-${Math.random()}`,
    _new:true,
    category:kind==='employee'?'Employee':'Client/Kid',
    first_name:'',last_name:'',assigned_to:'',
    monday:'',tuesday:'',wednesday:'',thursday:'',friday:'',notes:'',
  };
}

function rowMatches(row,search,category){
  if(category&&row.category!==category)return false;
  if(!search)return true;
  const haystack=[row.first_name,row.last_name,row.assigned_to,row.category,row.notes,...DAY_FIELDS.map(day=>row[day])].join(' ').toLowerCase();
  return haystack.includes(search.toLowerCase());
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
  const [categoryFilter,setCategoryFilter]=useState('');
  const [importText,setImportText]=useState('');
  const [replaceExisting,setReplaceExisting]=useState(true);

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

  const detectedRows=useMemo(()=>importText.trim()?parseScheduleText(importText,kind):[],[importText,kind]);
  const categories=useMemo(()=>[...new Set(rows.map(row=>row.category).filter(Boolean))],[rows]);
  const visibleRows=rows.filter(row=>rowMatches(row,search,categoryFilter));

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
      setCategoryFilter('');
      setMessage('');
    }catch(error){
      if(error.status===401)setAuth(false);
      setMessage(error.message);
    }finally{setLoading(false);}
  }

  function switchKind(next){
    setKind(next);
    setSearch('');
    setCategoryFilter('');
    setImportText('');
    const base=manager?'/manager/schedules':'/calendar/schedules';
    window.history.replaceState(null,'',`${base}?view=${next}`);
  }

  function updateRow(id,field,value){
    setRows(current=>current.map(row=>row.id===id?{...row,[field]:value}:row));
  }

  function addRow(){
    setRows(current=>[...current,blankRow(kind)]);
    setCategoryFilter('');
    setTimeout(()=>window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'}),50);
  }

  async function saveRow(row){
    if(!row.first_name.trim())return setMessage(kind==='employee'?'Enter a first name.':'Enter the client/kid name.');
    try{
      const saved=await apiRequest('/api/schedules',{
        method:row._new?'POST':'PATCH',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({...row,kind}),
      });
      setRows(current=>current.map(item=>item.id===row.id?saved:item));
      setMessage(`${kind==='employee'?'Employee':'Client/kid'} schedule row saved.`);
    }catch(error){setMessage(error.message);}
  }

  async function deleteRow(row){
    if(row._new){setRows(current=>current.filter(item=>item.id!==row.id));return;}
    if(!confirm(`Delete ${row.first_name}${row.last_name?' '+row.last_name:''} from this schedule?`))return;
    try{
      await apiRequest(`/api/schedules?kind=${kind}&id=${row.id}`,{method:'DELETE'});
      setRows(current=>current.filter(item=>item.id!==row.id));
      setMessage('Schedule row deleted.');
    }catch(error){setMessage(error.message);}
  }

  async function importSchedule(){
    if(!detectedRows.length)return setMessage('No schedule rows were detected. Check the pasted/uploaded sheet format.');
    if(replaceExisting&&!confirm(`Replace the current ${kind==='employee'?'employee':'clients/kids'} schedule with ${detectedRows.length} imported row(s)?`))return;
    try{
      const result=await apiRequest('/api/schedules',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({action:'import',kind,rows:detectedRows,replace:replaceExisting}),
      });
      setImportText('');
      await loadRows(kind);
      setMessage(`${result.imported} schedule row(s) imported successfully.`);
    }catch(error){setMessage(error.message);}
  }

  async function readFile(event){
    const file=event.target.files?.[0];
    if(!file)return;
    try{setImportText(await file.text());setMessage(`Loaded ${file.name}. Review the detected row count, then import.`);}
    catch{setMessage('Could not read that file. Please use CSV, TSV, or copied Google Sheets cells.');}
  }

  function downloadTemplate(){
    const headers=kind==='employee'
      ?['FirstName','LastName','Monday','Tuesday','Wednesday','Thursday','Friday','Notes','Category']
      :['Client/Kid','LastName','Assigned Staff','Monday','Tuesday','Wednesday','Thursday','Friday','Notes','Category'];
    const blob=new Blob([headers.join(',')+'\n'],{type:'text/csv'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;
    link.download=`${kind}-schedule-template.csv`;
    link.click();
    URL.revokeObjectURL(url);
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

  const categoryOptions=kind==='employee'?EMPLOYEE_CATEGORIES:CLIENT_CATEGORIES;
  return <PageShell location={location} manager={manager} logout={logout}>
    <main className="schedule-page">
      <section className="schedule-hero">
        <div>
          <span className="schedule-eyebrow">{manager?'MANAGER SCHEDULE CENTER':'READ-ONLY TEAM SCHEDULE'}</span>
          <h1>{location} Weekly Schedules</h1>
          <p>{manager?'Import the Google Sheet, then edit individual rows whenever the weekly schedule changes.':'Use these views as the current weekly reference schedule. Changes are made only from the manager view.'}</p>
        </div>
        <span className={`schedule-mode ${manager?'manager-mode':'readonly-mode'}`}>{manager?'EDITABLE':'READ ONLY'}</span>
      </section>

      <div className="schedule-view-tabs" role="tablist" aria-label="Schedule type">
        <button className={kind==='employee'?'active':''} type="button" onClick={()=>switchKind('employee')}>Employee Schedule</button>
        <button className={kind==='client'?'active':''} type="button" onClick={()=>switchKind('client')}>Clients / Kids Schedule</button>
      </div>

      {manager&&<section className="card schedule-import-card">
        <div className="schedule-import-heading">
          <div><h2>Upload / paste schedule</h2><p>For Google Sheets, download the current tab as <b>CSV</b> or copy the cells and paste them below. Employee sheets with section labels such as <b>Intern</b> and <b>BCBA</b> are recognized automatically.</p></div>
          <button type="button" className="secondary" onClick={downloadTemplate}>Download template</button>
        </div>
        <div className="schedule-import-grid">
          <label className="schedule-file-field"><b>Upload CSV / TSV</b><input type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values" onChange={readFile}/></label>
          <label className="schedule-paste-field"><b>Or paste Google Sheets cells</b><textarea value={importText} onChange={event=>setImportText(event.target.value)} placeholder="Paste rows here…"/></label>
        </div>
        <div className="schedule-import-actions">
          <label className="schedule-check"><input type="checkbox" checked={replaceExisting} onChange={event=>setReplaceExisting(event.target.checked)}/> Replace the existing {kind==='employee'?'employee':'clients/kids'} schedule</label>
          <span className="schedule-detected">{detectedRows.length} row(s) detected</span>
          <button type="button" disabled={!detectedRows.length} onClick={importSchedule}>Import schedule</button>
        </div>
      </section>}

      {message&&<p className="message schedule-message">{message}</p>}

      <section className="card schedule-table-card">
        <div className="schedule-toolbar">
          <div>
            <h2>{kind==='employee'?'Employee Schedule':'Clients / Kids Schedule'}</h2>
            <small>{rows.length} total row(s){loading?' · Refreshing…':''}</small>
          </div>
          <div className="schedule-toolbar-controls">
            <input aria-label="Search schedule" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search name, time, notes…"/>
            <select aria-label="Filter category" value={categoryFilter} onChange={event=>setCategoryFilter(event.target.value)}>
              <option value="">All categories</option>
              {categories.map(category=><option key={category} value={category}>{category}</option>)}
            </select>
            {manager&&<button type="button" onClick={addRow}>+ Add row</button>}
          </div>
        </div>

        <div className="schedule-legend">
          {(kind==='employee'?['Employee','Intern','BCBA']:['Client/Kid','Group/Program']).map(category=><span key={category} className={`schedule-legend-chip category-${categoryToken(category)}`}>{category}</span>)}
        </div>

        <div className="schedule-table-wrap">
          <table className="schedule-table">
            <thead><tr>
              <th>Category</th>
              <th>{kind==='employee'?'First Name':'Client / Kid'}</th>
              <th>Last Name</th>
              {kind==='client'&&<th>Assigned Staff</th>}
              {DAY_LABELS.map(day=><th key={day}>{day}</th>)}
              <th>Notes</th>
              {manager&&<th>Actions</th>}
            </tr></thead>
            <tbody>
              {!visibleRows.length&&<tr><td colSpan={manager?(kind==='client'?11:10):(kind==='client'?10:9)} className="schedule-empty">No schedule rows match this view.</td></tr>}
              {visibleRows.map(row=><ScheduleRow key={row.id} row={row} kind={kind} manager={manager} categoryOptions={categoryOptions} updateRow={updateRow} saveRow={saveRow} deleteRow={deleteRow}/>) }
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </PageShell>;
}

function ScheduleRow({row,kind,manager,categoryOptions,updateRow,saveRow,deleteRow}){
  const rowClass=`category-${categoryToken(row.category)}`;
  const options=[...new Set([...categoryOptions,row.category].filter(Boolean))];
  const textCell=field=>manager
    ?<input value={row[field]||''} onChange={event=>updateRow(row.id,field,event.target.value)}/>
    :<span>{row[field]||'—'}</span>;

  return <tr className={rowClass}>
    <td>{manager
      ?<select value={row.category||''} onChange={event=>updateRow(row.id,'category',event.target.value)}>{options.map(value=><option key={value}>{value}</option>)}</select>
      :<span className={`schedule-category-pill ${rowClass}`}>{row.category}</span>}</td>
    <td>{textCell('first_name')}</td>
    <td>{textCell('last_name')}</td>
    {kind==='client'&&<td>{textCell('assigned_to')}</td>}
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
        <a href={manager?'/manager':'/calendar'}>Call-Out Calendar</a>
        {logout&&<button className="link" type="button" onClick={logout}>Log out</button>}
      </nav>
    </header>
    {children}
  </>;
}
