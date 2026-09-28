import {NextResponse} from 'next/server';
import {calendarAuthorized} from '../../../lib/auth';
import {db} from '../../../lib/db';

export async function GET(req){
  if(!calendarAuthorized(req))return NextResponse.json({error:'Unauthorized'},{status:401});
  const month=new URL(req.url).searchParams.get('month');
  if(!/^\d{4}-\d{2}$/.test(month||''))return NextResponse.json({error:'Invalid month'},{status:400});
  const sql=await db();
  const [entries,notes]=await Promise.all([
    sql`select id,submitter_type,name,request_type,event_date::text,submitted_at from call_outs where event_date>=(${month+'-01'})::date and event_date<((${month+'-01'})::date+interval '1 month') order by event_date,submitted_at`,
    sql`select id,event_date::text,title,note_type,note_category,created_at from calendar_notes where event_date>=(${month+'-01'})::date and event_date<((${month+'-01'})::date+interval '1 month') order by event_date,created_at`,
  ]);
  return NextResponse.json({entries,notes});
}
