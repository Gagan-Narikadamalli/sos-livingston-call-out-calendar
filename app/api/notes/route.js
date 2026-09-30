import {
  withApiErrors
}
 from '../../../lib/api';
import{
  NextResponse
}
from'next/server';
import{
  authorized
}
from'../../../lib/auth';
import{
  db
}
from'../../../lib/db';
import{
  clean,validDate,validMonth
}
from'../../../lib/validate';
const no=()=>NextResponse.json({error:'Unauthorized'
},{status:401
});
const categories=['Manager Note','Parent/Client Note','Employee Note'];
function noteDates(body){
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
      cursor.setUTCDate(cursor.getUTCDate()+1)
}
}
  else return'Choose a valid note date option.';
  const dates=[...new Set(raw.map(date=>clean(date,10)).filter(Boolean))].sort();
  if(!dates.length||dates.some(date=>!validDate(date)))return'Choose all note dates.';
  if(dates.length>93)return'A repeating note can include no more than 93 dates.';
  return dates
}
async function handleGET(req){
  if(!authorized(req))return no();
  const sql=await db(),month=new URL(req.url).searchParams.get('month');
  if(!validMonth(month))return NextResponse.json({error:'Invalid month'
},{status:400
});
  return NextResponse.json(await sql`select id,event_date::text,title,note_type,note_category,details,created_at,updated_at from calendar_notes where event_date>=(${month+'-01'})::date and event_date<((${month+'-01'})::date+interval '1 month') order by event_date,created_at`)
}
async function handlePOST(req){
  if(!authorized(req))return no();
  const b=await req.json(),title=clean(b.title,120),note_type=clean(b.note_type,40)||'Out',note_category=clean(b.note_category,40)||'Manager Note',details=clean(b.details,1000),dates=noteDates(b);
  if(!title)return NextResponse.json({error:'Person or title is required.'
},{status:400
});
  if(typeof dates==='string')return NextResponse.json({error:dates
},{status:400
});
  if(!categories.includes(note_category))return NextResponse.json({error:'Choose Manager Note, Parent/Client Note, or Employee Note.'
},{status:400
});
  const sql=await db();
  await sql.begin(async transaction=>{for(const eventDate of dates)await transaction`insert into calendar_notes(event_date,title,note_type,note_category,details) values(${eventDate},${title},${note_type},${note_category},${details||''})`
});
  return NextResponse.json({ok:true,created:dates.length
})
}
async function handlePATCH(req){
  if(!authorized(req))return no();
  const b=await req.json(),event_date=clean(b.event_date,10),title=clean(b.title,120),note_type=clean(b.note_type,40),note_category=clean(b.note_category,40)||'Manager Note',details=clean(b.details,1000);
  if(!validDate(event_date)||!title||!note_type)return NextResponse.json({error:'Complete the required fields.'
},{status:400
});
  if(!categories.includes(note_category))return NextResponse.json({error:'Choose Manager Note, Parent/Client Note, or Employee Note.'
},{status:400
});
  const sql=await db(),r=await sql`update calendar_notes set event_date=${event_date},title=${title},note_type=${note_type},note_category=${note_category},details=${details||''},updated_at=now() where id=${b.id} returning id`;
  return r.length?NextResponse.json({ok:true
}):NextResponse.json({error:'Note not found'
},{status:404
})
}
async function handleDELETE(req){
  if(!authorized(req))return no();
  const sql=await db(),id=new URL(req.url).searchParams.get('id'),r=await sql`delete from calendar_notes where id=${id} returning id`;
  return NextResponse.json({deleted:r.length
})
}
export const GET=withApiErrors(handleGET);
export const POST=withApiErrors(handlePOST);
export const PATCH=withApiErrors(handlePATCH);
export const DELETE=withApiErrors(handleDELETE);
