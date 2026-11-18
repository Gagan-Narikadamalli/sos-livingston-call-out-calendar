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
  const monthEnd=`(${monthStart}::date+interval '1 month - 1 day')::date`;
  const currentMonth=easternMonthKey();

  // Remove legacy occurrences outside the exact saved bounds of every date-range series.
  await sql`
    delete from calendar_notes n
    using note_recurrences r
    where n.recurrence_id=r.id
      and r.ongoing=false
      and r.end_date is not null
      and (n.event_date<r.start_date or n.event_date>r.end_date)
  `;

  const series=await sql`
    select id,ongoing
    from note_recurrences
    where start_date<(${monthStart})::date+interval '1 month'
      and (
        (
          ongoing=false
          and end_date is not null
          and end_date>=(${monthStart})::date
        )
        or (
          ongoing=true
          and end_date is null
          and (
            active=true
            or (stopped_at at time zone 'America/New_York')::date>=(${monthStart})::date
          )
        )
      )
  `;

  const created=[];

  for(const item of series){
    if(item.ongoing&&month>currentMonth)continue;

    // Generate dates in PostgreSQL so date-only values never shift through JavaScript time zones.
    const rows=await sql`
      with recurrence as (
        select *
        from note_recurrences
        where id=${item.id}
      ),
      bounds as (
        select
          greatest(start_date,(${monthStart})::date) as first_day,
          least(
            coalesce(end_date,(${monthEnd})),
            (${monthEnd})
          ) as last_day,
          string_to_array(weekdays,',')::int[] as allowed_weekdays
        from recurrence
      ),
      occurrence_dates as (
        select generated_day::date as event_date
        from bounds
        cross join lateral generate_series(
          first_day::timestamp,
          last_day::timestamp,
          interval '1 day'
        ) as generated_day
        where extract(dow from generated_day)::int=any(allowed_weekdays)
      )
      insert into calendar_notes(
        event_date,title,note_type,note_category,details,recurrence_id,
        created_at,updated_at
      )
      select
        dates.event_date,r.title,r.note_type,r.note_category,
        coalesce(r.details,''),r.id,r.created_at,r.updated_at
      from occurrence_dates dates
      cross join recurrence r
      where not exists(
        select 1
        from calendar_notes existing
        where existing.recurrence_id=r.id
          and existing.event_date=dates.event_date
      )
      and not exists(
        select 1
        from note_recurrence_exceptions exceptions
        where exceptions.recurrence_id=r.id
          and exceptions.event_date=dates.event_date
      )
      and not exists(
        select 1
        from calendar_holidays holidays
        where holidays.event_date=dates.event_date
      )
      on conflict do nothing
      returning
        id,event_date::text,title,note_type,note_category,details,
        created_at,updated_at,recurrence_id
    `;
    created.push(...rows);
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
