'use client';

import {usePathname} from 'next/navigation';

export default function ScheduleQuickNav(){
  const pathname=usePathname();
  const isManager=pathname?.startsWith('/manager');
  const isCalendar=pathname?.startsWith('/calendar');
  if(!isManager&&!isCalendar)return null;

  const base=isManager?'/manager':'/calendar';
  return <nav className="schedule-quick-nav" aria-label="Calendar views">
    <a className={!pathname.includes('/schedules')?'active':''} href={base}>Call-Out Calendar</a>
    <a href={`${base}/schedules?view=employee`}>Employee Schedule</a>
    <a href={`${base}/schedules?view=client`}>Clients / Kids Schedule</a>
  </nav>;
}
