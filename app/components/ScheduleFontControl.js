'use client';
import {DEFAULT_TIME_COLOR} from '../../lib/schedule-colors.mjs';
export default function ScheduleFontControl({day,color,onChange}){
 const selected=color||DEFAULT_TIME_COLOR;
 return <div className="schedule-font-control">
  <button type="button" className={selected==='#800000'?'active':''} aria-label={`Use maroon for ${day} timings`} aria-pressed={selected==='#800000'} title="Maroon text" onClick={()=>onChange(selected==='#800000'?'':'#800000')}><span style={{color:'#800000'}}>A</span></button>
  <label title="Choose text color"><span className="schedule-color-label">Choose {day} timing color</span><input type="color" aria-label={`Choose ${day} timing color`} value={selected} onChange={event=>onChange(event.target.value)}/></label>
  {color&&<button type="button" className="schedule-color-reset" title="Reset to default text color" aria-label={`Reset ${day} timing color`} onClick={()=>onChange('')}>↺</button>}
 </div>;
}
