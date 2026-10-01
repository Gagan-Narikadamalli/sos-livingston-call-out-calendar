import {withApiErrors} from '../../../lib/api';
import {NextResponse} from 'next/server';
import {calendarAuthorized} from '../../../lib/auth';
import {db} from '../../../lib/db';
import {materializeRecurringNotesForMonth} from '../../../lib/note-recurrence';
import {validMonth} from '../../../lib/validate';

async function handleGET(req){
  if(!calendarAuthorized(req))return NextResponse.json({error:'Unauthorized'},{status:401});

  const month=new URL(req.url).searchParams.get('month');
  if(!validMonth(month))return NextResponse.json({error:'Invalid month'},{status:400});

  const sql=await db();
  await materializeRecurringNotesForMonth(sql,month);

  const [entries,notes]=await Promise.all([
    sql`
      select id,submitter_type,name,request_type,event_date::text,submitted_at
      from call_outs
      where event_date>=(${month+'-01'})::date
        and event_date<((${month+'-01'})::date+interval '1 month')
      order by event_date,submitted_at
    `,
    sql`
      select id,event_date::text,title,note_type,note_category,created_at,recurrence_id
      from calendar_notes
      where event_date>=(${month+'-01'})::date
        and event_date<((${month+'-01'})::date+interval '1 month')
      order by event_date,created_at
    `,
  ]);

  return NextResponse.json({entries,notes});
}

export const GET=withApiErrors(handleGET);
