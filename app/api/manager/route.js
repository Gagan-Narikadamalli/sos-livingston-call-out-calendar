import {withApiErrors} from '../../../lib/api';
import {NextResponse} from 'next/server';
import {authorized} from '../../../lib/auth';
import {db} from '../../../lib/db';
import {ensureRecurrenceExceptions,stopOngoingRecurrenceIfCurrentMonthEmpty} from '../../../lib/note-recurrence';
import {validateEntry,validDate,validMonth} from '../../../lib/validate';

const no=()=>NextResponse.json({error:'Unauthorized'},{status:401});
const iso=date=>date.toISOString().slice(0,10);

function easternCalendarDate(now=new Date()){
  const parts=new Intl.DateTimeFormat('en-US',{
    timeZone:'America/New_York',
    year:'numeric',
    month:'2-digit',
    day:'2-digit',
  }).formatToParts(now);
  const year=Number(parts.find(part=>part.type==='year')?.value);
  const month=Number(parts.find(part=>part.type==='month')?.value);
  const day=Number(parts.find(part=>part.type==='day')?.value);
  return new Date(Date.UTC(year,month-1,day));
}

async function handleGET(req){
  if(!authorized(req))return no();
  const sql=await db();
  const month=new URL(req.url).searchParams.get('month');
  if(!validMonth(month))return NextResponse.json({error:'Invalid month'},{status:400});

  const rows=await sql`
    select id,submitter_type,name,email,request_type,event_date::text,
      reason,request_group_id,submitted_at
    from call_outs
    where event_date>=(${month+'-01'})::date
      and event_date<((${month+'-01'})::date+interval '1 month')
    order by event_date,submitted_at
  `;
  return NextResponse.json(rows);
}

async function handlePATCH(req){
  if(!authorized(req))return no();
  const b=await req.json();
  const v=validateEntry(b,{enforceAdvance:false,allowParent:true});
  if(typeof v==='string')return NextResponse.json({error:v},{status:400});

  const sql=await db();
  const rows=await sql`
    update call_outs
    set submitter_type=${v.submitter_type},name=${v.name},email=${v.email||null},
        request_type=${v.request_type},event_date=${v.event_date},reason=${v.reason||''}
    where id=${b.id}
    returning id
  `;
  return rows.length
    ?NextResponse.json({ok:true})
    :NextResponse.json({error:'Record not found'},{status:404});
}

async function handleDELETE(req){
  if(!authorized(req))return no();
  const sql=await db();
  const url=new URL(req.url);
  const rawId=url.searchParams.get('id');

  if(rawId){
    const id=Number(rawId);
    if(!Number.isInteger(id)||id<1)return NextResponse.json({error:'Invalid record.'},{status:400});
    const rows=await sql`delete from call_outs where id=${id} returning id`;
    return NextResponse.json({deleted:rows.length});
  }

  const mode=url.searchParams.get('mode')||'custom';
  let start=url.searchParams.get('start');
  let end=url.searchParams.get('end');
  const today=easternCalendarDate();

  if(mode==='previous-month'){
    start=iso(new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth()-1,1)));
    end=iso(new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),0)));
  }else if(mode==='previous-week'){
    const lastSaturday=new Date(today);
    lastSaturday.setUTCDate(today.getUTCDate()-today.getUTCDay()-1);
    const lastSunday=new Date(lastSaturday);
    lastSunday.setUTCDate(lastSaturday.getUTCDate()-6);
    start=iso(lastSunday);
    end=iso(lastSaturday);
  }else if(mode!=='custom'){
    return NextResponse.json({error:'Choose a valid deletion option.'},{status:400});
  }

  if(!validDate(start||'')||!validDate(end||'')||start>end){
    return NextResponse.json({error:'Select a valid start and end date.'},{status:400});
  }

  await ensureRecurrenceExceptions(sql);
  const result=await sql.begin(async transaction=>{
    const recurrenceRows=await transaction`
      select distinct r.id as recurrence_id
      from note_recurrences r
      cross join generate_series(${start}::date,${end}::date,interval '1 day') as day
      where day::date>=r.start_date
        and (r.end_date is null or day::date<=r.end_date)
        and extract(dow from day)::int=any(string_to_array(r.weekdays,',')::int[])
    `;

    await transaction`
      insert into note_recurrence_exceptions(recurrence_id,event_date)
      select r.id,day::date
      from note_recurrences r
      cross join generate_series(${start}::date,${end}::date,interval '1 day') as day
      where day::date>=r.start_date
        and (r.end_date is null or day::date<=r.end_date)
        and extract(dow from day)::int=any(string_to_array(r.weekdays,',')::int[])
      on conflict(recurrence_id,event_date) do nothing
    `;

    const callOuts=await transaction`
      delete from call_outs
      where event_date>=${start} and event_date<=${end}
      returning id
    `;
    const notes=await transaction`
      delete from calendar_notes
      where event_date>=${start} and event_date<=${end}
      returning id
    `;

    return {
      callOuts:callOuts.length,
      managerNotes:notes.length,
      recurrenceIds:recurrenceRows.map(row=>row.recurrence_id),
    };
  });

  let autoStoppedSeries=0;
  for(const recurrenceId of result.recurrenceIds){
    if(await stopOngoingRecurrenceIfCurrentMonthEmpty(sql,recurrenceId))autoStoppedSeries+=1;
  }

  return NextResponse.json({
    callOuts:result.callOuts,
    managerNotes:result.managerNotes,
    deleted:result.callOuts+result.managerNotes,
    autoStoppedSeries,
    start,
    end,
  });
}

export const GET=withApiErrors(handleGET);
export const PATCH=withApiErrors(handlePATCH);
export const DELETE=withApiErrors(handleDELETE);
