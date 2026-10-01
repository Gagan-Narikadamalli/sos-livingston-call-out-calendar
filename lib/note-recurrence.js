function easternMonthKey(now=new Date()){
  const parts=new Intl.DateTimeFormat('en-US',{
    timeZone:'America/New_York',
    year:'numeric',
    month:'2-digit',
  }).formatToParts(now);
  const year=parts.find(part=>part.type==='year')?.value;
  const month=parts.find(part=>part.type==='month')?.value;
  return `${year}-${month}`;
}

export async function ensureRecurrenceExceptions(sql){
  await sql`
    create table if not exists note_recurrence_exceptions(
      recurrence_id bigint not null,
      event_date date not null,
      created_at timestamptz default now(),
      primary key(recurrence_id,event_date)
    )
  `;
}

export async function materializeRecurringNotesForMonth(sql,month){
  await ensureRecurrenceExceptions(sql);

  const monthStart=`${month}-01`;
  const currentMonth=easternMonthKey();
  const series=await sql`
    select *
    from note_recurrences
    where start_date<(${monthStart})::date+interval '1 month'
      and (end_date is null or end_date>=(${monthStart})::date)
      and (
        active=true
        or (stopped_at at time zone 'America/New_York')::date>=(${monthStart})::date
      )
  `;

  const created=[];

  for(const item of series){
    if(item.ongoing&&month>currentMonth)continue;

    const allowedWeekdays=String(item.weekdays)
      .split(',')
      .map(Number)
      .filter(day=>Number.isInteger(day)&&day>=0&&day<=6);

    const firstOfMonth=new Date(`${monthStart}T00:00:00Z`);
    const lastOfMonth=new Date(Date.UTC(
      firstOfMonth.getUTCFullYear(),
      firstOfMonth.getUTCMonth()+1,
      0,
    ));
    const seriesStart=new Date(`${String(item.start_date).slice(0,10)}T00:00:00Z`);
    const seriesEnd=item.end_date
      ?new Date(`${String(item.end_date).slice(0,10)}T00:00:00Z`)
      :null;

    for(
      const cursor=new Date(firstOfMonth);
      cursor<=lastOfMonth;
      cursor.setUTCDate(cursor.getUTCDate()+1)
    ){
      if(cursor<seriesStart)continue;
      if(seriesEnd&&cursor>seriesEnd)continue;
      if(!allowedWeekdays.includes(cursor.getUTCDay()))continue;

      const eventDate=cursor.toISOString().slice(0,10);
      const rows=await sql`
        insert into calendar_notes(
          event_date,title,note_type,note_category,details,recurrence_id,
          created_at,updated_at
        )
        select
          ${eventDate},${item.title},${item.note_type},${item.note_category},
          ${item.details||''},${item.id},${item.created_at},${item.updated_at}
        where not exists(
          select 1
          from calendar_notes
          where recurrence_id=${item.id}
            and event_date=${eventDate}
        )
        and not exists(
          select 1
          from note_recurrence_exceptions
          where recurrence_id=${item.id}
            and event_date=${eventDate}
        )
        on conflict do nothing
        returning
          id,event_date::text,title,note_type,note_category,details,
          created_at,updated_at,recurrence_id
      `;
      created.push(...rows);
    }
  }

  return created;
}

export async function stopOngoingRecurrenceIfCurrentMonthEmpty(sql,recurrenceId){
  const id=Number(recurrenceId);
  if(!Number.isInteger(id)||id<1)return false;

  const active=await sql`
    select id
    from note_recurrences
    where id=${id} and ongoing=true and active=true
    limit 1
  `;
  if(!active.length)return false;

  const month=easternMonthKey();
  await materializeRecurringNotesForMonth(sql,month);

  const remaining=await sql`
    select 1
    from calendar_notes
    where recurrence_id=${id}
      and event_date>=(${month+'-01'})::date
      and event_date<((${month+'-01'})::date+interval '1 month')
    limit 1
  `;
  if(remaining.length)return false;

  const stopped=await sql`
    update note_recurrences
    set active=false,stopped_at=now(),updated_at=now()
    where id=${id} and ongoing=true and active=true
    returning id
  `;
  return stopped.length>0;
}
