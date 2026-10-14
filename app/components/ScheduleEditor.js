'use client';
import {useEffect,useRef,useState} from 'react';
import ScheduleTimeInput from './ScheduleTimeInput';
import {WEEKDAYS,DAY_NAMES,parseScheduleTime,formatHours} from '../../lib/schedule-time.mjs';

export default function ScheduleEditor({row,kind,onSave,onClose}){
 const [draft,setDraft]=useState({...row});
 const [error,setError]=useState('');
 const [saving,setSaving]=useState(false);
 const dialog=useRef(null);
 const noun=kind==='employee'?'staff member':'client / kid';
 useEffect(()=>{
  const node=dialog.current;const previous=document.activeElement;
  node.showModal();
  const original=document.body.style.overflow;document.body.style.overflow='hidden';
  return()=>{node.close();document.body.style.overflow=original;previous?.focus?.();};
 },[]);
 function update(field,value){setDraft(current=>({...current,[field]:value}));setError('');}
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
    <label className="field"><b>Category</b><select value={draft.category} onChange={event=>update('category',event.target.value)}>{(kind==='employee'?[['Employee','BT'],['BCBA','BCBA'],['Intern','Intern']]:[['Client/Kid','In-center client'],['Home Client','Home client']]).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
   </div>
   <div className="schedule-editor-hours-heading"><h3>Weekly hours</h3><span>{formatHours(times.reduce((sum,time)=>sum+time.minutes,0))} hrs total{times.some(time=>!time.valid)?' · check times':''}</span></div>
   <p className="schedule-editor-hint">Leave days empty when not scheduled. Add another time range for a split shift.</p>
   <div className="schedule-editor-days">{WEEKDAYS.map((day,index)=><section className="schedule-editor-day" key={day}><h4>{DAY_NAMES[index]}</h4><ScheduleTimeInput value={draft[day]||''} onChange={value=>update(day,value)} label={`${draft.first_name||noun} ${DAY_NAMES[index]}`}/></section>)}</div>
   <label className="field schedule-editor-notes"><b>Notes</b><textarea rows={3} maxLength={500} value={draft.notes||''} onChange={event=>update('notes',event.target.value)} placeholder="Optional schedule notes"/></label>
  </fieldset>
  <div className="schedule-editor-footer">{error&&<p className="schedule-editor-error" role="alert">{error}</p>}<div><button type="button" className="schedule-editor-cancel" disabled={saving} onClick={onClose}>Cancel</button><button type="submit" disabled={saving}>{saving?'Saving…':row._new?'Save & Add':'Save Changes'}</button></div></div>
 </form>
 </dialog>;
}
