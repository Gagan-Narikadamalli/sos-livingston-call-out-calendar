'use client';
import {usePathname} from 'next/navigation';
import {useEffect,useRef,useState} from 'react';

export default function ScheduleQuickNav(){
 const pathname=usePathname();
 const dialog=useRef(null);
 const [open,setOpen]=useState(false);
 const isManager=pathname?.startsWith('/manager');
 const isCalendar=pathname?.startsWith('/calendar');
 useEffect(()=>{
  if(!open)return;
  const previous=document.body.style.overflow;document.body.style.overflow='hidden';
  return()=>{document.body.style.overflow=previous;};
 },[open]);
 if(!isManager&&!isCalendar)return null;
 const base=isManager?'/manager':'/calendar';
 function show(){dialog.current.showModal();setOpen(true);}
 function close(){dialog.current.close();setOpen(false);}
 return <>
  <button className="schedule-nav-trigger" type="button" title="Schedules" aria-label="Open schedules navigation" aria-haspopup="dialog" aria-expanded={open} aria-controls="schedule-nav-drawer" onClick={show}>
   <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 10h18M7 14h3M14 14h3M7 17h3"/></svg>
  </button>
  <dialog ref={dialog} id="schedule-nav-drawer" className="schedule-nav-drawer" aria-labelledby="schedule-nav-title" onClose={()=>setOpen(false)} onClick={event=>{if(event.target===event.currentTarget){const rect=dialog.current.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close();}}}>
   <div className="schedule-nav-heading"><div><span>QUICK NAVIGATION</span><h2 id="schedule-nav-title">Schedules</h2></div><button type="button" autoFocus aria-label="Close schedules navigation" onClick={close}>×</button></div>
   <p className="schedule-nav-description">Choose a calendar or schedule view.</p>
   <nav className="schedule-nav-links" aria-label="Calendar views">
    <a className={!pathname.includes('/schedules')?'active':''} href={base} onClick={close}><span>Livingston Calendar</span><span aria-hidden="true">→</span></a>
    <a href={`${base}/schedules?view=employee`} onClick={close}><span>Employee Schedule</span><span aria-hidden="true">→</span></a>
    <a href={`${base}/schedules?view=client`} onClick={close}><span>Clients / Kids Schedule</span><span aria-hidden="true">→</span></a>
    {isManager&&<a href={`${base}/schedules?view=summary`} onClick={close}><span>Overall Summary</span><span aria-hidden="true">→</span></a>}
   </nav>
   <div className="schedule-nav-footnote">{isManager?'Manager workspace':'Read-only team workspace'}</div>
  </dialog>
 </>;
}
