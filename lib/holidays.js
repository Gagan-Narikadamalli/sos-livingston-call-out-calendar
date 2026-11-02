export async function findHolidayDates(sql,dates){
  const requested=[...new Set((Array.isArray(dates)?dates:[]).filter(Boolean))].sort();
  if(!requested.length)return [];

  const rows=await sql`
    select event_date::text
    from calendar_holidays
    where event_date>=${requested[0]}
      and event_date<=${requested[requested.length-1]}
    order by event_date
  `;

  const selected=new Set(requested);
  return rows.map(row=>row.event_date).filter(date=>selected.has(date));
}

export function holidayConflictMessage(dates){
  return `The following date(s) are marked as holidays and cannot be used: ${dates.join(', ')}. Choose different dates.`;
}
