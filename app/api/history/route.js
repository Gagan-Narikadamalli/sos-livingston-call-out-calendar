import {NextResponse} from 'next/server';
import {withApiErrors} from '../../../lib/api';
import {authorized} from '../../../lib/auth';
import {db} from '../../../lib/db';
const no=()=>NextResponse.json({error:'Unauthorized'},{status:401});
async function handleGET(req){
 if(!authorized(req))return no();
 const sql=await db();
 return NextResponse.json(await sql`
  select id,action,entity_type,entity_id,summary,details,created_at,
   (action='delete' and entity_type='schedule' and undo_data is not null and undone_at is null) as undo_available
  from calendar_audit_log order by created_at desc,id desc limit 500
 `);
}
async function handlePOST(req){
 if(!authorized(req))return no();
 const body=await req.json();
 if(body.action!=='undo_delete')return NextResponse.json({error:'Unsupported history action.'},{status:400});
 const auditId=Number(body.id);
 if(!Number.isInteger(auditId)||auditId<1)return NextResponse.json({error:'Invalid history item.'},{status:400});
 const sql=await db();
 const restored=await sql.begin(async tx=>{
  const events=await tx`select id,undo_data,summary from calendar_audit_log where id=${auditId} and action='delete' and entity_type='schedule' and undone_at is null for update`;
  if(!events.length)throw new Error('This deletion is no longer available to undo.');
  const rows=Array.isArray(events[0].undo_data)?events[0].undo_data:[];
  if(!rows.length)throw new Error('Deleted schedule details are unavailable.');
  const inserted=[];
  for(const row of rows){
   const result=await tx`
    insert into weekly_schedules(id,schedule_kind,category,first_name,last_name,assigned_to,monday,tuesday,wednesday,thursday,friday,start_date,end_date,notes,phone_number,email,day_colors,display_order,created_at,updated_at,finalized_at,on_hold)
    values(${row.id},${row.schedule_kind},${row.category},${row.first_name},${row.last_name||''},${row.assigned_to||''},${row.monday||''},${row.tuesday||''},${row.wednesday||''},${row.thursday||''},${row.friday||''},${row.start_date||null},${row.end_date||null},${row.notes||''},${row.phone_number||''},${row.email||''},${tx.json(row.day_colors||{})},${row.display_order||0},${row.created_at||new Date().toISOString()},now(),${row.finalized_at||null},${Boolean(row.on_hold)}) on conflict(id) do nothing returning id
   `;
   inserted.push(...result);
  }
  if(inserted.length!==rows.length)throw new Error('Some rows could not be restored because their IDs are already in use.');
  await tx`select setval(pg_get_serial_sequence('weekly_schedules','id'),greatest((select coalesce(max(id),1) from weekly_schedules),1),true)`;
  await tx`update calendar_audit_log set undone_at=now() where id=${auditId}`;
  await tx`insert into calendar_audit_log(action,entity_type,entity_id,summary,details) values('undo','schedule',${String(auditId)},${'Undid: '+events[0].summary},${tx.json({restoredCount:inserted.length,originalHistoryId:auditId})})`;
  return inserted.length;
 });
 return NextResponse.json({ok:true,restored});
}
export const GET=withApiErrors(handleGET);
export const POST=withApiErrors(handlePOST);
