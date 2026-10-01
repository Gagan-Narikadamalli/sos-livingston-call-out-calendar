import {withApiErrors} from '../../../lib/api';
import {NextResponse} from 'next/server';
import {authorized} from '../../../lib/auth';
import {db} from '../../../lib/db';
import {clean,validDate,validMonth} from '../../../lib/validate';

const no=()=>NextResponse.json({error:'Unauthorized'},{status:401});
const categories=['Manager Note','Parent/Client Note','Employee Note'];
const weekdayNames=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function ordinaryDates(body){
  const mode=clean(body.note_date_mode,20)||'single';
  let raw=[];
  if(mode==='single')raw=[body.event_date];
  else if(mode==='multiple')raw=Array.isArray(body.repeat_dates)?body.repeat_dates:[];
  else if(mode==='range'){
    const start=clean(body.range_start,10),end=clean(body.range_end,10);
    if(!validDate(start)||!validDate(end)||start>end)return'Choose a valid note start and end date.';
    const cursor=new Date(start+'T00:00:00Z'),last=new Date(end+'T00:00:00Z');
    while(cursor<=last&&raw.length<=93){raw.push(cursor.toISOString().slice(0,10));cursor.setUTCDate(cursor.getUTCDate()+1)}
  } else return'Choose a valid note date option.';
  const dates=[...new Set(raw.map(date=>clean(date,10)).filter(Boolean))].sort();
  if(!dates.length||dates.some(date=>!validDate(date)))return'Choose all note dates.';
  if(dates.length>93)return'A note can include no more than 93 dates.';
  return dates;
}

function recurrenceInput(body){
  const start=clean(body.recurrence_start,10);
  const kind=clean(body.recurrence_kind,20);
  const end=kind==='range'?clean(body.recurrence_end,10):'';
  const weekdays=[...new Set((Array.isArray(body.recurrence_weekdays)?body.recurrence_weekdays:[]).map(Number))]
    .filter(day=>Number.isInteger(day)&&day>=0&&day<=6);
  if(!validDate(start))return'Choose a valid recurring start date.';
  if(kind!=='range'&&kind!=='ongoing')return'Choose a recurring duration.';
  if(kind==='range'&&(!validDate(end)||end<start))return'Choose a valid recurring end date.';
  if(!weekdays.length)return'Choose at least one weekday for the recurring note.';
  return {start,end:end||null,weekdays,ongoing:kind==='ongoing'};
}

async function materializeMonth(sql,month){
  const monthStart=month+'-01';
  const series=await sql`select * from note_recurrences
    where start_date < (${monthStart})::date + interval '1 month'
      and (end_date is null or end_date >= (${monthStart})::date)
      and (active=true or stopped_at >= (${monthStart})::date)`;
  for(const item of series){
    const allowed=String(item.weekdays).split(',').map(Number);
    const start=new Date(monthStart+'T00:00:00Z');
    const finish=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0));
    const seriesStart=new Date(String(item.start_date).slice(0,10)+'T00:00:00Z');
    const seriesEnd=item.end_date?new Date(String(item.end_date).slice(0,10)+'T00:00:00Z'):null;
    for(const cursor=new Date(start);cursor<=finish;cursor.setUTCDate(cursor.getUTCDate()+1)){
      if(cursor<seriesStart||(seriesEnd&&cursor>seriesEnd)||!allowed.includes(cursor.getUTCDay()))continue;
      const eventDate=cursor.toISOString().slice(0,10);
      await sql`insert into calendar_notes(event_date,title,note_type,note_category,details,recurrence_id)
        select ${eventDate},${item.title},${item.note_type},${item.note_category},${item.details||''},${item.id}
        where not exists(select 1 from calendar_notes where recurrence_id=${item.id} and event_date=${eventDate})`;
    }
  }
}

async function handleGET(req){
  if(!authorized(req))return no();
  const sql=await db(),month=new URL(req.url).searchParams.get('month');
  if(!validMonth(month))return NextResponse.json({error:'Invalid month'},{status:400});
  await materializeMonth(sql,month);
  return NextResponse.json(await sql`select n.id,n.event_date::text,n.title,n.note_type,n.note_category,n.details,n.created_at,n.updated_at,n.recurrence_id,
    r.ongoing as recurrence_ongoing,r.active as recurrence_active,r.weekdays as recurrence_weekdays,r.start_date::text as recurrence_start,r.end_date::text as recurrence_end
    from calendar_notes n left join note_recurrences r on r.id=n.recurrence_id
    where n.event_date>=(${month+'-01'})::date and n.event_date<((${month+'-01'})::date+interval '1 month')
    order by n.event_date,n.created_at`);
}

async function handlePOST(req){
  if(!authorized(req))return no();
  const b=await req.json(),title=clean(b.title,120),note_type=clean(b.note_type,40)||'Out',note_category=clean(b.note_category,40)||'Manager Note',details=clean(b.details,1000);
  if(!title)return NextResponse.json({error:'Person or title is required.'},{status:400});
  if(!categories.includes(note_category))return NextResponse.json({error:'Choose Manager Note, Parent/Client Note, or Employee Note.'},{status:400});
  const sql=await db();
  if(clean(b.note_date_mode,20)==='recurring'){
    const recurrence=recurrenceInput(b);
    if(typeof recurrence==='string')return NextResponse.json({error:recurrence},{status:400});
    const rows=await sql`insert into note_recurrences(title,note_type,note_category,details,start_date,end_date,weekdays,ongoing)
      values(${title},${note_type},${note_category},${details||''},${recurrence.start},${recurrence.end},${recurrence.weekdays.join(',')},${recurrence.ongoing}) returning id`;
    const month=recurrence.start.slice(0,7);
    await materializeMonth(sql,month);
    return NextResponse.json({ok:true,created:1,recurrence_id:rows[0].id});
  }
  const dates=ordinaryDates(b);
  if(typeof dates==='string')return NextResponse.json({error:dates},{status:400});
  await sql.begin(async transaction=>{for(const eventDate of dates)await transaction`insert into calendar_notes(event_date,title,note_type,note_category,details) values(${eventDate},${title},${note_type},${note_category},${details||''})`});
  return NextResponse.json({ok:true,created:dates.length});
}

async function handlePATCH(req){
  if(!authorized(req))return no();
  const b=await req.json(),sql=await db();
  if(b.action==='stop_recurrence'&&b.recurrence_id){
    const r=await sql`update note_recurrences set active=false,stopped_at=now(),updated_at=now() where id=${b.recurrence_id} and ongoing=true returning id`;
    return r.length?NextResponse.json({ok:true}):NextResponse.json({error:'Ongoing recurrence not found.'},{status:404});
  }
  const event_date=clean(b.event_date,10),title=clean(b.title,120),note_type=clean(b.note_type,40),note_category=clean(b.note_category,40)||'Manager Note',details=clean(b.details,1000);
  if(!validDate(event_date)||!title||!note_type)return NextResponse.json({error:'Complete the required fields.'},{status:400});
  if(!categories.includes(note_category))return NextResponse.json({error:'Choose Manager Note, Parent/Client Note, or Employee Note.'},{status:400});
  const r=await sql`update calendar_notes set event_date=${event_date},title=${title},note_type=${note_type},note_category=${note_category},details=${details||''},updated_at=now() where id=${b.id} returning id`;
  return r.length?NextResponse.json({ok:true}):NextResponse.json({error:'Note not found'},{status:404});
}

async function handleDELETE(req){
  if(!authorized(req))return no();
  const sql=await db(),id=new URL(req.url).searchParams.get('id'),r=await sql`delete from calendar_notes where id=${id} returning id`;
  return NextResponse.json({deleted:r.length});
}
export const GET=withApiErrors(handleGET);
export const POST=withApiErrors(handlePOST);
export const PATCH=withApiErrors(handlePATCH);
export const DELETE=withApiErrors(handleDELETE);
