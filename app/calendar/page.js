'use client';
import {
  useEffect,useRef,useState
}
 from 'react';
import Brand from '../components/Brand';
import {
  apiRequest
}
 from '../../lib/client-api';
const pad=n=>String(n).padStart(2,'0');
const monthKey=date=>`${date.getFullYear()}-${pad(date.getMonth()+1)}`;
const isNew=timestamp=>{
  const time=new Date(timestamp).getTime();
  const age=Date.now()-time;
  return Number.isFinite(time)&&age>=0&&age<24*60*60*1000
};
export default function TeamCalendar(){
    const [authenticated,setAuthenticated]=useState(null);
    const [password,setPassword]=useState('');
    const [month,setMonth]=useState(new Date(new Date().getFullYear(),new Date().getMonth(),1));
    const [entries,setEntries]=useState([]);
    const [notes,setNotes]=useState([]);
    const [message,setMessage]=useState('');
    const [,setClock]=useState(Date.now());
    const loadId=useRef(0);
    useEffect(()=>{apiRequest('/api/intern-login').then(data=>setAuthenticated(data.authenticated)).catch(error=>{setAuthenticated(false);setMessage(error.message)
})
},[]);
    useEffect(()=>{if(authenticated)load()
},[authenticated,month]);
    useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),60000);return()=>clearInterval(timer)
},[]);
    async function load(){
        const current=++loadId.current;
    setMessage('');
        try{
            const data=await apiRequest('/api/calendar?month='+monthKey(month));
            if(current!==loadId.current)return;
            setEntries(data.entries);
      setNotes(data.notes);
}
    catch(error){
      if(current!==loadId.current)return;
      if(error.status===401)setAuthenticated(false);
      setMessage(error.message)
}
}
    async function login(event){
        event.preventDefault();
    setMessage('');
        try{
      await apiRequest('/api/intern-login',{method:'POST',headers:{'content-type':'application/json'
},body:JSON.stringify({password
})
});
      setAuthenticated(true);
      setPassword('')
}
    catch(error){
      setMessage(error.message)
}
}
    async function logout(){
    try{
      await apiRequest('/api/intern-login',{method:'DELETE'
});
      loadId.current++;
      setAuthenticated(false)
}
    catch(error){
      setMessage(error.message)
}
}
    if(authenticated===null)return <Shell><main className="manager-login"><section className="card login-card"><h1>Livingston call-out calendar</h1><p>Checking calendar access…</p></section></main></Shell>;
    if(!authenticated)return <Shell><main className="manager-login"><form className="card login-card" onSubmit={
    login
}
  ><span className="login-label">AUTHORIZED TEAM ACCESS</span><h1>View the Livingston call-out calendar</h1><p>Enter the calendar password to view Livingston call-outs, time-off requests, and manager notes.</p><label className="field"><b>Calendar password</b><input type="password" required autoFocus value={
    password
}
   onChange={
    e=>setPassword(e.target.value)
}
   placeholder="Enter calendar password"/></label>{
    message&&<p className="message error-message">{
      message
}
    </p>
}
  <button>Open Livingston calendar</button><p className="viewer-login-note">This calendar is read-only. Only managers can add, edit, or delete records.</p><a className="back-link" href="/">← Return to submission form</a></form></main></Shell>;
    const first=new Date(month.getFullYear(),month.getMonth(),1);
    const days=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
    const cells=[...Array(first.getDay()).fill(null),...Array.from({length:days
},(_,i)=>i+1)];
    while(cells.length%7)cells.push(null);
    return <Shell authenticated logout={
    logout
}
  ><main className="manager viewer"><section className="viewer-banner"><div><h1>Livingston call-out calendar</h1><p>Employee, parent/client, and manager calendar notes.</p></div><span className="readonly">READ-ONLY VIEW</span></section>{
    message&&<p className="message">{
      message
}
    </p>
}
  <div className="calendar-head"><button onClick={
    ()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))
}
  >← Previous</button><div><h1>{
    month.toLocaleString('en',{month:'long',year:'numeric'
})
}
  </h1><button className="today-button" onClick={
    ()=>setMonth(new Date(new Date().getFullYear(),new Date().getMonth(),1))
}
  >Today</button></div><button onClick={
    ()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))
}
  >Next →</button></div><div className="legend"><i className="recent"/>New in last 24 hours <i className="employee"/>Employee note <i className="parent-note"/>Parent/Client note <i className="note"/>Manager note</div><div className="week">{
    ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day=><b key={day
}>{day
}</b>)
}
  </div><div className="calendar">{
    cells.map((day,index)=>{const date=day?`${monthKey(month)}-${pad(day)}`:'';return <div className="day" key={index
}>{day&&<><div className="daytop"><b>{day
}</b></div>{entries.filter(entry=>entry.event_date===date&&entry.submitter_type==='Employee').map(entry=><div className={`event ${entry.submitter_type.toLowerCase()}${isNew(entry.submitted_at)?' recent':''}`
} key={'e'+entry.id
}><small>Employee Note{isNew(entry.submitted_at)?' · New':''
}</small>{entry.name
} — {entry.request_type
}</div>)
}{notes.filter(note=>note.event_date===date).map(note=>{const category=note.note_category==='Parent Note'?'Parent/Client Note':note.note_category||'Manager Note';const categoryClass=category==='Parent/Client Note'?'parent-note':category==='Employee Note'?'employee-note':'manager-note';return <div className={`event note ${categoryClass}${isNew(note.created_at)?' recent':''}`
} key={'n'+note.id
}><small>{category
}{isNew(note.created_at)?' · New':''
}</small>{note.title
} — {note.note_type
}</div>
})
}</>
}</div>
})
}
  </div></main></Shell>;
}
function Shell({children,authenticated=false,logout
}){
  return <><header><Brand title="Livingston Call-Out Calendar" subtitle="Success On The Spectrum"/><nav className="manager-nav"><a href="/">Form</a>{
    authenticated&&<button className="link" onClick={
      logout
}
    >Log out</button>
}
  </nav></header>{
    children
}
  </>
}
