'use client';

import {usePathname} from 'next/navigation';

export default function ScheduleQuickNav(){
  const pathname=usePathname();
  const isManager=pathname?.startsWith('/manager');
  const isCalendar=pathname?.startsWith('/calendar');
  if(!isManager&&!isCalendar)return null;

  const base=isManager?'/manager':'/calendar';
  const onSchedules=pathname.includes('/schedules');
  return <details className="schedule-quick-nav">
    <summary aria-label="Open calendar views">Schedules</summary>
    <nav className="schedule-quick-menu" aria-label="Calendar views">
      <span>Calendar views</span>
      <a className={!onSchedules?'active':''} href={base}>Livingston Calendar</a>
      <a href={`${base}/schedules?view=employee`}>Employee Schedule</a>
      <a href={`${base}/schedules?view=client`}>Clients / Kids Schedule</a>
    </nav>
  </details>;
}
