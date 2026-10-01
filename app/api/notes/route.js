import {withApiErrors} from '../../../lib/api';
import {NextResponse} from 'next/server';
import {authorized} from '../../../lib/auth';
import {db} from '../../../lib/db';
import {ensureRecurrenceExceptions,materializeRecurringNotesForMonth} from '../../../lib/note-recurrence';
import {clean,validDate,validMonth} from '../../../lib/validate';

const no=()=>NextResponse.json({error:'Unauthorized'},{status:401});
const categories=['Manager Note','Parent/Client Note','Employee Note'];

function ordinaryDates(body){
  const mode=clean(body.note_date_mode,20)||'single';
  let raw=[];

  if(mode==='single')raw=[body.event_date];
  else if(mode==='multiple')raw=Array.isArray(body.repeat_dates)?body.repeat_dates:[];
  else if(mode==='range'){
    const start=clean(body.range_start,10),end=clean(body.range_end,10);
    if(!validDate(start)||!validDate(end)||start>end)return'Choose a valid note start and end date.';
    const cursor=new Date(start+'T00:00:00Z'),last=new Date(end+'T00:00:00Z');
    while(cursor<=last&&raw.length<=93){
      raw.push(cursor.toISOString().slice(0,10));
      cursor.setUTCDate(cursor.getUTCDate()+1);
    }
  }else return'Choose a valid note date option.';

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

async function handleGET(req){
  if(!authorized(req))return no();
  const sql=await db(),month=new URL(req.url).searchParams.get('month');
  if(!validMonth(month))return NextResponse.json({error:'Invalid month'},{status:400});

  await materializeRecurringNotesForMonth(sql,month);

  return NextResponse.json(await sql`
    select
      n.id,n.event_date::text,n.title,n.note_type,n.note_category,n.details,
      n.created_at,n.updated_at,n.recurrence_id,
      r.ongoing as recurrence_ongoing,
      r.active as recurrence_active,
      r.weekdays as recurrence_weekdays,
      r.start_date::text as recurrence_start,
      r.end_date::text as recurrence_end
    from calendar_notes n
    left join note_recurrences r on r.id=n.recurrence_id
    where n.event_date>=(${month+'-01'})::date
      and n.event_date<((${month+'-01'})::date+interval '1 month')
    order by n.event_date,n.created_at
  `);
}

async function handlePOST(req){
  if(!authorized(req))return no();
  const b=await req.json();
  const title=clean(b.title,120);
  const note_type=clean(b.note_type,40)||'Out';
  const note_category=clean(b.note_category,40)||'Manager Note';
  const details=clean(b.details,1000);

  if(!title)return NextResponse.json({error:'Person or title is required.'},{status:400});
  if(!categories.includes(note_category))return NextResponse.json({error:'Choose Manager Note, Parent/Client Note, or Employee Note.'},{status:400});

  const sql=await db();

  if(clean(b.note_date_mode,20)==='recurring'){
    const recurrence=recurrenceInput(b);
    if(typeof recurrence==='string')return NextResponse.json({error:recurrence},{status:400});

    const rows=await sql`
      insert into note_recurrences(
        title,note_type,note_category,details,start_date,end_date,weekdays,ongoing
      ) values(
        ${title},${note_type},${note_category},${details||''},${recurrence.start},
        ${recurrence.end},${recurrence.weekdays.join(',')},${recurrence.ongoing}
      )
      returning id
    `;

    const notes=await materializeRecurringNotesForMonth(sql,recurrence.start.slice(0,7));
    return NextResponse.json({ok:true,created:notes.length,recurrence_id:rows[0].id,notes});
  }

  const dates=ordinaryDates(b);
  if(typeof dates==='string')return NextResponse.json({error:dates},{status:400});

  const notes=await sql.begin(async transaction=>{
    const created=[];
    for(const eventDate of dates){
      const rows=await transaction`
        insert into calendar_notes(event_date,title,note_type,note_category,details)
        values(${eventDate},${title},${note_type},${note_category},${details||''})
        returning id,event_date::text,title,note_type,note_category,details,created_at,updated_at,recurrence_id
      `;
      created.push(...rows);
    }
    return created;
  });

  return NextResponse.json({ok:true,created:notes.length,notes});
}

async function handlePATCH(req){
  if(!authorized(req))return no();
  const b=await req.json(),sql=await db();

  if(b.action==='stop_recurrence'&&b.recurrence_id){
    const r=await sql`
      update note_recurrences
      set active=false,stopped_at=now(),updated_at=now()
      where id=${b.recurrence_id} and ongoing=true
      returning id
    `;
    return r.length?NextResponse.json({ok:true}):NextResponse.json({error:'Ongoing recurrence not found.'},{status:404});
  }

  const event_date=clean(b.event_date,10);
  const title=clean(b.title,120);
  const note_type=clean(b.note_type,40);
  const note_category=clean(b.note_category,40)||'Manager Note';
  const details=clean(b.details,1000);

  if(!validDate(event_date)||!title||!note_type)return NextResponse.json({error:'Complete the required fields.'},{status:400});
  if(!categories.includes(note_category))return NextResponse.json({error:'Choose Manager Note, Parent/Client Note, or Employee Note.'},{status:400});

  const r=await sql`
    update calendar_notes
    set event_date=${event_date},title=${title},note_type=${note_type},
        note_category=${note_category},details=${details||''},updated_at=now()
    where id=${b.id}
    returning id
  `;
  return r.length?NextResponse.json({ok:true}):NextResponse.json({error:'Note not found'},{status:404});
}

async function handleDELETE(req){
  if(!authorized(req))return no();
  const sql=await db();
  const id=new URL(req.url).searchParams.get('id');
  const rows=await sql`
    select id,recurrence_id,event_date::text
    from calendar_notes
    where id=${id}
  `;

  if(!rows.length)return NextResponse.json({deleted:0});

  const note=rows[0];
  if(note.recurrence_id){
    await ensureRecurrenceExceptions(sql);
    const deleted=await sql.begin(async transaction=>{
      await transaction`
        insert into note_recurrence_exceptions(recurrence_id,event_date)
        values(${note.recurrence_id},${note.event_date})
        on conflict(recurrence_id,event_date) do nothing
      `;
      return transaction`delete from calendar_notes where id=${id} returning id`;
    });
    return NextResponse.json({deleted:deleted.length,recurringOccurrence:true});
  }

  const deleted=await sql`delete from calendar_notes where id=${id} returning id`;
  return NextResponse.json({deleted:deleted.length,recurringOccurrence:false});
}

export const GET=withApiErrors(handleGET);
export const POST=withApiErrors(handlePOST);
export const PATCH=withApiErrors(handlePATCH);
export const DELETE=withApiErrors(handleDELETE);
