'use client';

import {useEffect,useState} from 'react';
import {apiRequest} from '../../lib/client-api';
import {summarizeSchedules} from '../../lib/schedule-summary.mjs';

export default function OverallScheduleSummary({onUnauthorized}){
  const [data,setData]=useState(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [refresh,setRefresh]=useState(0);
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
  const title=day=>day[0].toUpperCase()+day.slice(1);
  return <section className="overall-summary" aria-busy={loading}>
    <div className="schedule-topbar"><div><h2>Overall Summary</h2><p>Weekly staffing and client attendance from saved schedule information.</p></div><button type="button" disabled={loading} onClick={()=>setRefresh(value=>value+1)}>Refresh Summary</button></div>
    {loading&&<p role="status">Loading staff and client schedules…</p>}
    {error&&<p className="message error-message" role="alert">Could not load summary: {error}</p>}
    {data&&<>
      <div className="summary-totals"><div className="card"><h3>Total employees</h3><strong>{data.employees.length}</strong><p>All saved employee entries</p></div><div className="card"><h3>Total clients / kids</h3><strong>{data.clients.length}</strong><p>All saved client entries</p></div></div>
      <section className="schedule-section"><div className="schedule-section-head"><div><h3>Employees and clients per day</h3><p>Each person is counted once when that day's schedule contains hours. Blank days and off-days are not counted.</p></div></div>
        <div className="schedule-group-table-wrap"><table className="schedule-group-table"><thead><tr><th>Day</th><th>Total staff</th><th>Regular employees</th><th>BCBAs</th><th>Interns</th><th>Total clients</th><th>In-center clients</th><th>Home clients</th></tr></thead><tbody>{days.map(row=><tr key={row.day}><th scope="row">{title(row.day)}</th><td>{row.employees}</td><td>{row.regular}</td><td>{row.bcba}</td><td>{row.interns}</td><td>{row.clients}</td><td>{row.clients-row.home}</td><td>{row.home}</td></tr>)}</tbody></table></div>
      </section>
      <section className="schedule-section"><div className="schedule-section-head"><div><h3>Coverage with 10% employee call-outs</h3><p>Assumes one staff member per client. Call-outs = 10% of that day's scheduled staff, rounded up to a whole person.</p></div></div>
        <div className="schedule-group-table-wrap"><table className="schedule-group-table"><thead><tr><th>Day</th><th>Scheduled staff</th><th>Scheduled clients</th><th>Assumed call-outs</th><th>Staff remaining</th><th>Staff short</th><th>Staff surplus</th></tr></thead><tbody>{days.map(row=><tr key={row.day}><th scope="row">{title(row.day)}</th><td>{row.employees}</td><td>{row.clients}</td><td>{row.callOuts}</td><td>{row.remaining}</td><td className={row.shortage?'summary-shortage':''}>{row.shortage}</td><td>{row.surplus}</td></tr>)}</tbody></table></div>
      </section>
      <p className="summary-explanation">Staff short = clients − remaining staff, with a minimum of zero. For example, 10 staff and 5 clients means 1 assumed call-out, 9 remaining staff, and 0 staff short. This is a weekday headcount estimate based on saved hours, including regular employees, BCBAs, interns, in-center clients, and home clients. It does not apply actual calendar call-outs or verify overlapping hours, breaks, staff qualifications, or individual assignments.</p>
    </>}
  </section>;
}
