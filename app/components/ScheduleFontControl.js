'use client';
export default function ScheduleFontControl({day,color,onChange}){
 const active=color?.toUpperCase()==='#800000';
 return <div className="schedule-font-control">
  <button type="button" className={active?'active':''} aria-label={`Maroon text for ${day} timings`} aria-pressed={active} title={active?'Remove maroon text':'Use maroon text'} onClick={()=>onChange(active?'':'#800000')}><span style={{color:'#800000'}}>A</span></button>
 </div>;
}
