'use client';
import {useState} from 'react';
import {parseScheduleTime,inputClock,serializeRanges,formatHours} from '../../lib/schedule-time.mjs';

export default function ScheduleTimeInput({value,onChange,label}){
 const parsed=parseScheduleTime(value);
 const [ranges,setRanges]=useState(()=>parsed.valid?parsed.ranges.map(range=>({start:inputClock(range.start),end:inputClock(range.end)})):null);
 function change(next){setRanges(next);onChange(serializeRanges(next));}
 if(ranges===null)return <div className="schedule-time-input"><span className="schedule-time-invalid">{value}</span><small>Time needs correction</small><button type="button" onClick={()=>change([{start:'',end:''}])}>Select times</button></div>;
 return <div className="schedule-time-input">
   {ranges.map((range,index)=><div className="schedule-time-range" key={index}>
     <label><span>From</span><input type="time" step="60" aria-label={`${label} start ${index+1}`} value={range.start} onChange={event=>change(ranges.map((item,i)=>i===index?{...item,start:event.target.value}:item))}/></label>
     <label><span>To</span><input type="time" step="60" aria-label={`${label} end ${index+1}`} value={range.end} onChange={event=>change(ranges.map((item,i)=>i===index?{...item,end:event.target.value}:item))}/></label>
     <button type="button" className="schedule-time-remove" aria-label={`Remove ${label} time range ${index+1}`} onClick={()=>change(ranges.filter((_,i)=>i!==index))}>×</button>
   </div>)}
   {parsed.valid&&parsed.minutes>0&&<small className="schedule-hours">{formatHours(parsed.minutes)} hrs</small>}
   {!parsed.valid&&<small className="schedule-time-error">{parsed.error}</small>}
   <button type="button" className="schedule-time-add" onClick={()=>change([...ranges,{start:'',end:''}])}>{ranges.length?'+ Time range':'+ Set hours'}</button>
   {!ranges.length&&<small>Not scheduled</small>}
 </div>;
}
