'use client';
import {useEffect,useState} from 'react';
import ScheduleExportButton from './ScheduleExportButton';
import {apiRequest} from '../../lib/client-api';
import {summarizeSchedules,averageDailyMetrics,averageBtShortage,weeklyHourMetrics,invalidScheduleEntries,isCenterClient} from '../../lib/schedule-summary.mjs';
import {WEEKDAYS,DAY_NAMES,parseScheduleTime,formatHours,scheduleCategory} from '../../lib/schedule-time.mjs';
const dayName=day=>DAY_NAMES[WEEKDAYS.indexOf(day)];
const categoryName=row=>({bt:'BT',bcba:'BCBA',intern:'Intern',managerhr:'Manager/HR'}[scheduleCategory(row)]);
const decimal=value=>value.toLocaleString('en-US',{maximumFractionDigits:2});
function Shortage({value}){return <span className={`summary-badge ${value?'summary-badge-short':'summary-badge-ok'}`}>{value}</span>;}
function SummaryTable({headers,children}){return <div className="schedule-group-table-wrap"><table className="schedule-group-table"><thead><tr>{headers.map(label=><th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;}
function CoverageSection({days,includeInterns=false}){
 const key=includeInterns?'withInterns':'btOnly';
 return <section className="schedule-section"><div className="schedule-section-head"><div><h3>{includeInterns?'BT + intern coverage':'BT-only coverage'}</h3><p>{includeInterns?'Includes BTs and interns. BCBAs excluded.':'Includes BTs only. BCBAs and interns excluded.'} Only staff and clients with at least 4 scheduled hours that day are counted here. 10% call-outs rounded up to a whole person.</p></div></div>
 <SummaryTable headers={['Day',includeInterns?'BT + interns':'BT','Clients','10% call-outs','Remaining',includeInterns?'BT + intern shortage':'BT shortage','Surplus']}>
 {days.map(row=><tr key={row.day}><th scope="row">{dayName(row.day)}</th><td>{row[key].staff}</td><td>{row.coverageClients}</td><td>{row[key].callOuts}</td><td>{row[key].remaining}</td><td><Shortage value={row[key].shortage}/></td><td>{row[key].surplus}</td></tr>)}
 </SummaryTable></section>;
}
export default function OverallScheduleSummary({onUnauthorized,location}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0);
 useEffect(()=>{
  let active=true;
  setLoading(true);setError('');setData(null);
  Promise.all([apiRequest('/api/schedules?kind=employee'),apiRequest('/api/schedules?kind=client')])
   .then(([employees,clients])=>{if(active)setData({employees,clients});})
   .catch(error=>{if(active){setError(error.message);if(error.status===401)onUnauthorized();}})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[refresh]);
 const days=data?summarizeSchedules(data.employees,data.clients):[];
 const average=averageDailyMetrics(days);
 const hours=weeklyHourMetrics(days);
 const invalid=data?invalidScheduleEntries(data.employees,data.clients):[];
 return <section className="overall-summary" aria-busy={loading}>
 <div className="schedule-topbar"><div><h2>Overall Summary</h2><p>Weekly attendance, working hours, and BT coverage from saved schedules.</p></div><div className="schedule-topbar-actions"><ScheduleExportButton kind="summary" employees={data?.employees||[]} clients={data?.clients||[]} location={location} disabled={loading||!data}/><button type="button" disabled={loading} onClick={()=>setRefresh(value=>value+1)}>Refresh Summary</button></div></div>
 {loading&&<p role="status">Loading staff and client schedules…</p>}{error&&<p className="message error-message" role="alert">Could not load summary: {error}</p>}
 {data&&<>
 <div className="summary-totals summary-totals-with-clients">
  <div className="card summary-stat summary-stat-staff"><span className="summary-stat-label">STAFF ROSTER</span><h3>Total employees</h3><strong>{data.employees.length}</strong><p>BT, BCBA, interns, and Manager/HR</p></div>
  <div className="card summary-stat summary-stat-clients"><span className="summary-stat-label">CLIENT ROSTER</span><h3>Total clients / kids</h3><strong>{data.clients.filter(isCenterClient).length}</strong><p>In-center schedules</p></div>
  <div className="card summary-stat summary-stat-coverage"><span className="summary-stat-label">BT ONLY · 10% CALL-OUTS</span><h3>Average BT shortage</h3><strong>{decimal(averageBtShortage(days))}</strong><p>Monday–Friday, including zero-shortage days</p></div>
  <div className="card summary-stat"><span className="summary-stat-label">WEEKLY HOURS</span><h3>Total staff hours</h3><strong>{formatHours(hours.staffMinutes)}</strong><p>All employee categories</p></div>
  <div className="card summary-stat summary-stat-clients"><span className="summary-stat-label">WEEKLY CLIENT HOURS</span><h3>Total client hours</h3><strong>{formatHours(hours.clientMinutes)}</strong><p>In-center client scheduled hours</p></div>
  <div className="card summary-stat summary-stat-supervisor"><span className="summary-stat-label">20% SUPERVISION</span><h3>Supervisor hours</h3><strong>{formatHours(hours.supervisorMinutes)}</strong><p>20% of total in-center client hours</p></div>
  <div className="card summary-stat summary-stat-combined"><span className="summary-stat-label">COMBINED HOURS</span><h3>Client + supervisor hours</h3><strong>{formatHours(hours.clientAndSupervisorMinutes)}</strong><p>Total client hours plus supervisor hours</p></div>
  <div className="card summary-stat summary-stat-ratio"><span className="summary-stat-label">CLIENT TO STAFF RATIO</span><h3>Client hours ÷ staff hours</h3><strong>{hours.clientToStaffRatio===null?'N/A':`${decimal(hours.clientToStaffRatio*100)}%`}</strong><p>Total client hours divided by total staff hours</p></div>
 </div>
 {invalid.length>0&&<div className="summary-validation" role="alert"><h3>Schedule times need correction</h3><p>These entries are excluded from daily counts and hours until corrected in the schedule sheet.</p><ul>{invalid.map((item,index)=><li key={`${item.id}-${item.day}-${index}`}>{item.name} · {dayName(item.day)}: {item.value}</li>)}</ul></div>}
 <section className="schedule-section"><div className="schedule-section-head"><div><h3>Daily staff, clients, and hours</h3><p>Blank days count as not scheduled. Working hours are the sum of entered time ranges.</p></div></div>
 <SummaryTable headers={['Day','BT','BCBA','Interns','Clients','BT hours','BCBA hours','Intern hours','Total staff hours','Total client hours']}>
 {days.map(row=><tr key={row.day}><th scope="row">{dayName(row.day)}</th><td>{row.bt}</td><td>{row.bcba}</td><td>{row.interns}</td><td>{row.clients}</td><td>{formatHours(row.btMinutes)}</td><td>{formatHours(row.bcbaMinutes)}</td><td>{formatHours(row.internMinutes)}</td><td className="summary-total-cell">{formatHours(row.staffMinutes)}</td><td className="summary-total-cell">{formatHours(row.clientMinutes)}</td></tr>)}
 <tr className="summary-average-row"><th scope="row">Average</th><td>{decimal(average.bt)}</td><td>{decimal(average.bcba)}</td><td>{decimal(average.interns)}</td><td>{decimal(average.clients)}</td><td>{formatHours(average.btMinutes)}</td><td>{formatHours(average.bcbaMinutes)}</td><td>{formatHours(average.internMinutes)}</td><td>{formatHours(average.staffMinutes)}</td><td>{formatHours(average.clientMinutes)}</td></tr>
 </SummaryTable></section>
 <CoverageSection days={days}/><CoverageSection days={days} includeInterns/>
 <section className="schedule-section"><div className="schedule-section-head"><div><h3>Hours per staff member</h3><p>Daily and weekly scheduled working hours for each employee.</p></div></div>
 <SummaryTable headers={['Staff member','Category',...DAY_NAMES,'Weekly hours']}>
 {!data.employees.length&&<tr><td colSpan={8}>No employee schedules saved.</td></tr>}
 {data.employees.map(employee=>{const times=WEEKDAYS.map(day=>parseScheduleTime(employee[day]));return <tr key={employee.id}><th scope="row">{[employee.first_name,employee.last_name].filter(Boolean).join(' ')}</th><td>{categoryName(employee)}</td>{times.map((time,index)=><td key={WEEKDAYS[index]}>{time.valid?formatHours(time.minutes):<span className="schedule-time-error">Check time</span>}</td>)}<td className="summary-total-cell">{formatHours(times.reduce((sum,time)=>sum+time.minutes,0))}{times.some(time=>!time.valid)&&<small>Incomplete</small>}</td></tr>;})}
 </SummaryTable></section>
 </>}
 </section>;
}
