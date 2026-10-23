'use client';
import {useEffect,useRef,useState} from 'react';
import ScheduleTimeInput from './ScheduleTimeInput';
import ScheduleFontControl from './ScheduleFontControl';
import {normalizeDayColors,DEFAULT_TIME_COLOR} from '../../lib/schedule-colors.mjs';
import {WEEKDAYS,DAY_NAMES,parseScheduleTime,formatHours,applyHoursToDays} from '../../lib/schedule-time.mjs';

export default function ScheduleEditor({row,kind,onSave,onClose}){
 const [draft,setDraft]=useState({...row,day_colors:normalizeDayColors(row.day_colors)});
 const [error,setError]=useState('');
 const [saving,setSaving]=useState(false);
 const [bulkStart,setBulkStart]=useState('');
 const [bulkEnd,setBulkEnd]=useState('');
 const [bulkDays,setBulkDays]=useState(()=>[...WEEKDAYS]);
 const [bulkFeedback,setBulkFeedback]=useState('');
 const [bulkReset,setBulkReset]=useState({});
 const dialog=useRef(null);
 const noun=kind==='employee'?'staff member':'client / kid';
 useEffect(()=>{
  const node=dialog.current;const previous=document.activeElement;
  node.showModal();
  const original=document.body.style.overflow;document.body.style.overflow='hidden';
  return()=>{node.close();document.body.style.overflow=original;previous?.focus?.();};
 },[]);
 function update(field,value){setDraft(current=>({...current,[field]:value}));setError('');setBulkFeedback('');}
 function toggleBulkDay(day,checked){
  setBulkDays(current=>WEEKDAYS.filter(item=>item===day?checked:current.includes(item)));
  setBulkFeedback('');
 }
 function applyBulkHours(){
  try{
   const next=applyHoursToDays(draft,bulkDays,bulkStart,bulkEnd);
   setDraft(next);
   setBulkReset(current=>({...current,...Object.fromEntries(bulkDays.map(day=>[day,(current[day]||0)+1]))}));
   setBulkFeedback('Applied to '+bulkDays.length+' '+(bulkDays.length===1?'day':'days')+'. Review below, then save.');
  }catch(error){setBulkFeedback(error.message);}
 }
 async function save(event){
  event.preventDefault();if(saving)return;
  setSaving(true);setError('');
  try{await onSave(draft);}catch(error){setError(error.message);setSaving(false);}
 }
 const times=WEEKDAYS.map(day=>parseScheduleTime(draft[day]));
 return <dialog ref={dialog} className="schedule-editor" aria-labelledby="schedule-editor-title" onCancel={event=>{event.preventDefault();if(!saving)onClose();}}>
 <form onSubmit={save}>
  <div className="schedule-editor-head"><div><span className="schedule-eyebrow">{row._new?'NEW SCHEDULE':'EDIT SCHEDULE'}</span><h2 id="schedule-editor-title">{row._new?`Add ${noun}`:`Edit ${[row.first_name,row.last_name].filter(Boolean).join(' ')}`}</h2><p>Enter details and weekly hours, then save.</p></div><button type="button" className="schedule-editor-close" aria-label="Close editor" disabled={saving} onClick={onClose}>×</button></div>
  <fieldset disabled={saving} className="schedule-editor-body">
   <div className="schedule-editor-details">
    <label className="field"><b>First name <span aria-hidden="true">*</span></b><input required maxLength={120} autoFocus value={draft.first_name||''} onChange={event=>update('first_name',event.target.value)}/></label>
    <label className="field"><b>Last name</b><input maxLength={120} value={draft.last_name||''} onChange={event=>update('last_name',event.target.value)}/></label>
    <label className="field"><b>Category</b><select value={draft.category} onChange={event=>update('category',event.target.value)}>{(kind==='employee'?[['Employee','BT'],['BCBA','BCBA'],['Manager/HR','Manager/HR'],['Intern','Intern']]:[['Client/Kid','In-center client'],['Home Client','Home client']]).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
   </div>
   <div className="schedule-editor-hours-heading"><h3>Weekly hours</h3><span>{formatHours(times.reduce((sum,time)=>sum+time.minutes,0))} hrs total{times.some(time=>!time.valid)?' · check times':''}</span></div>
   <p className="schedule-editor-hint">Set the same hours for several days, or edit each day below. You can still add split shifts individually.</p>
   <div className="schedule-editor-bulk">
    <div className="schedule-editor-bulk-title"><strong>Apply hours to multiple days</strong><span>Enter the hours once.</span></div>
    <div className="schedule-editor-bulk-controls">
     <label className="schedule-editor-bulk-time"><span>From</span><input type="time" step="60" aria-label="Hours to apply, start time" value={bulkStart} onChange={event=>{setBulkStart(event.target.value);setBulkFeedback('');}}/></label>
     <label className="schedule-editor-bulk-time"><span>To</span><input type="time" step="60" aria-label="Hours to apply, end time" value={bulkEnd} onChange={event=>{setBulkEnd(event.target.value);setBulkFeedback('');}}/></label>
     <fieldset className="schedule-editor-bulk-days"><legend>Apply to</legend><div>{WEEKDAYS.map((day,index)=><label key={day} className="schedule-editor-bulk-day"><input type="checkbox" checked={bulkDays.includes(day)} onChange={event=>toggleBulkDay(day,event.target.checked)}/><span>{DAY_NAMES[index].slice(0,3)}</span></label>)}</div></fieldset>
     <button type="button" className="schedule-editor-bulk-apply" disabled={!bulkStart||!bulkEnd||!bulkDays.length} onClick={applyBulkHours}>Apply hours</button>
    </div>
    {bulkFeedback&&<p className="schedule-editor-bulk-feedback" role="status">{bulkFeedback}</p>}
   </div>
   <div className="schedule-editor-days">{WEEKDAYS.map((day,index)=><section className="schedule-editor-day" key={day}><div className="schedule-editor-day-title"><h4>{DAY_NAMES[index]}</h4><ScheduleFontControl day={DAY_NAMES[index]} color={draft.day_colors[day]} onChange={color=>update('day_colors',normalizeDayColors({...draft.day_colors,[day]:color}))}/></div><div className="schedule-colored-input" style={{'--time-color':draft.day_colors[day]||DEFAULT_TIME_COLOR,'--time-weight':draft.day_colors[day]==='#800000'?700:400}}><ScheduleTimeInput key={day+'-'+(bulkReset[day]||0)} value={draft[day]||''} onChange={value=>update(day,value)} label={`${draft.first_name||noun} ${DAY_NAMES[index]}`}/></div></section>)}</div>
   <label className="field schedule-editor-notes"><b>Notes</b><textarea rows={3} maxLength={500} value={draft.notes||''} onChange={event=>update('notes',event.target.value)} placeholder="Optional schedule notes"/></label>
  </fieldset>
  <div className="schedule-editor-footer">{error&&<p className="schedule-editor-error" role="alert">{error}</p>}<div><button type="button" className="schedule-editor-cancel" disabled={saving} onClick={onClose}>Cancel</button><button type="submit" disabled={saving}>{saving?'Saving…':row._new?'Save & Add':'Save Changes'}</button></div></div>
 </form>
 </dialog>;
}
