import {withApiErrors} from '../../../lib/api';
import {NextResponse} from 'next/server';
import {authorized} from '../../../lib/auth';
import {db} from '../../../lib/db';
import {validDate,validMonth} from '../../../lib/validate';

const no=()=>NextResponse.json({error:'Unauthorized'},{status:401});

async function handleGET(req){
  const url=new URL(req.url);
  const month=url.searchParams.get('month');
  const start=url.searchParams.get('start');
  const end=url.searchParams.get('end');
  const sql=await db();

  if(month){
    if(!validMonth(month))return NextResponse.json({error:'Invalid month'},{status:400});
    const rows=await sql`
      select event_date::text
      from calendar_holidays
      where event_date>=${month+'-01'}::date
        and event_date<(${month+'-01'}::date+interval '1 month')
      order by event_date
    `;
    return NextResponse.json({month,dates:rows.map(row=>row.event_date)});
  }

  if(!validDate(start||'')||!validDate(end||'')||start>end){
    return NextResponse.json({error:'Choose a valid start and end date.'},{status:400});
  }

  const rows=await sql`
    select event_date::text
    from calendar_holidays
    where event_date>=${start} and event_date<=${end}
    order by event_date
  `;
  return NextResponse.json({dates:rows.map(row=>row.event_date)});
}

async function handlePUT(req){
  if(!authorized(req))return no();

  const body=await req.json();
  const month=String(body.month||'');
  if(!validMonth(month))return NextResponse.json({error:'Choose a valid month.'},{status:400});
  if(!Array.isArray(body.dates))return NextResponse.json({error:'Choose the holiday dates for this month.'},{status:400});

  const dates=[...new Set(body.dates.map(value=>String(value||'').trim()))].sort();
  if(dates.length>31||dates.some(date=>!validDate(date)||!date.startsWith(month+'-'))){
    return NextResponse.json({error:'Holiday dates must be valid dates within the selected month.'},{status:400});
  }

  const sql=await db();
  await sql.begin(async transaction=>{
    await transaction`
      delete from calendar_holidays
      where event_date>=${month+'-01'}::date
        and event_date<(${month+'-01'}::date+interval '1 month')
    `;
    for(const eventDate of dates){
      await transaction`
        insert into calendar_holidays(event_date)
        values(${eventDate})
        on conflict(event_date) do update set updated_at=now()
      `;
    }
  });

  return NextResponse.json({ok:true,month,dates});
}

export const GET=withApiErrors(handleGET);
export const PUT=withApiErrors(handlePUT);
