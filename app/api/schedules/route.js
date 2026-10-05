import {NextResponse} from 'next/server';
import {withApiErrors} from '../../../lib/api';
import {authorized,calendarAuthorized} from '../../../lib/auth';
import {db} from '../../../lib/db';

const kinds=new Set(['employee','client']);
const no=()=>NextResponse.json({error:'Unauthorized'},{status:401});
const safe=(value,max=120)=>String(value??'').trim().slice(0,max);
const validKind=value=>kinds.has(value)?value:null;

async function ensureScheduleTable(sql){
  await sql`create table if not exists weekly_schedules(
    id bigserial primary key,
    schedule_kind text not null,
    category text not null default 'Employee',
    first_name text not null,
    last_name text,
    assigned_to text,
    monday text,
    tuesday text,
    wednesday text,
    thursday text,
    friday text,
    notes text,
    display_order integer not null default 0,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  )`;
  await sql`create index if not exists weekly_schedules_kind_order_idx on weekly_schedules(schedule_kind,display_order,id)`;
}

function normalizeRow(body,kind,order=0){
  return{
    schedule_kind:kind,
    category:safe(body.category,60)||(kind==='employee'?'Employee':'Client/Kid'),
    first_name:safe(body.first_name,120),
    last_name:safe(body.last_name,120),
    assigned_to:safe(body.assigned_to,160),
    monday:safe(body.monday,120),
    tuesday:safe(body.tuesday,120),
    wednesday:safe(body.wednesday,120),
    thursday:safe(body.thursday,120),
    friday:safe(body.friday,120),
    notes:safe(body.notes,500),
    display_order:Number.isInteger(Number(body.display_order))?Number(body.display_order):order,
  };
}

async function handleGET(req){
  if(!calendarAuthorized(req))return no();
  const kind=validKind(new URL(req.url).searchParams.get('kind')||'employee');
  if(!kind)return NextResponse.json({error:'Invalid schedule type.'},{status:400});
  const sql=await db();
  await ensureScheduleTable(sql);
  const rows=await sql`
    select id,schedule_kind,category,first_name,last_name,assigned_to,
      monday,tuesday,wednesday,thursday,friday,notes,display_order,created_at,updated_at
    from weekly_schedules
    where schedule_kind=${kind}
    order by display_order,id
  `;
  return NextResponse.json(rows);
}

async function handlePOST(req){
  if(!authorized(req))return no();
  const body=await req.json();
  const kind=validKind(body.kind);
  if(!kind)return NextResponse.json({error:'Invalid schedule type.'},{status:400});
  const sql=await db();
  await ensureScheduleTable(sql);

  if(body.action==='import'){
    const incoming=Array.isArray(body.rows)?body.rows:[];
    if(!incoming.length)return NextResponse.json({error:'No schedule rows were found to import.'},{status:400});
    if(incoming.length>500)return NextResponse.json({error:'Import is limited to 500 schedule rows at a time.'},{status:400});
    const rows=incoming.map((row,index)=>normalizeRow(row,kind,index)).filter(row=>row.first_name);
    if(!rows.length)return NextResponse.json({error:'Every imported row was blank.'},{status:400});
    await sql.begin(async transaction=>{
      if(body.replace!==false)await transaction`delete from weekly_schedules where schedule_kind=${kind}`;
      let offset=0;
      if(body.replace===false){
        const existing=await transaction`select coalesce(max(display_order),-1)+1 as next from weekly_schedules where schedule_kind=${kind}`;
        offset=Number(existing[0]?.next||0);
      }
      for(let index=0;index<rows.length;index+=1){
        const row=rows[index];
        await transaction`
          insert into weekly_schedules(
            schedule_kind,category,first_name,last_name,assigned_to,
            monday,tuesday,wednesday,thursday,friday,notes,display_order
          ) values(
            ${kind},${row.category},${row.first_name},${row.last_name||''},${row.assigned_to||''},
            ${row.monday||''},${row.tuesday||''},${row.wednesday||''},${row.thursday||''},${row.friday||''},${row.notes||''},${offset+index}
          )
        `;
      }
    });
    return NextResponse.json({ok:true,imported:rows.length});
  }

  const row=normalizeRow(body,kind,0);
  if(!row.first_name)return NextResponse.json({error:'A first name or client/kid name is required.'},{status:400});
  const maxRows=await sql`select coalesce(max(display_order),-1)+1 as next from weekly_schedules where schedule_kind=${kind}`;
  const created=await sql`
    insert into weekly_schedules(
      schedule_kind,category,first_name,last_name,assigned_to,
      monday,tuesday,wednesday,thursday,friday,notes,display_order
    ) values(
      ${kind},${row.category},${row.first_name},${row.last_name||''},${row.assigned_to||''},
      ${row.monday||''},${row.tuesday||''},${row.wednesday||''},${row.thursday||''},${row.friday||''},${row.notes||''},${Number(maxRows[0]?.next||0)}
    ) returning *
  `;
  return NextResponse.json(created[0]);
}

async function handlePATCH(req){
  if(!authorized(req))return no();
  const body=await req.json();
  const id=Number(body.id),kind=validKind(body.kind);
  if(!Number.isInteger(id)||id<1||!kind)return NextResponse.json({error:'Invalid schedule row.'},{status:400});
  const row=normalizeRow(body,kind,0);
  if(!row.first_name)return NextResponse.json({error:'A first name or client/kid name is required.'},{status:400});
  const sql=await db();
  await ensureScheduleTable(sql);
  const updated=await sql`
    update weekly_schedules set
      category=${row.category},first_name=${row.first_name},last_name=${row.last_name||''},assigned_to=${row.assigned_to||''},
      monday=${row.monday||''},tuesday=${row.tuesday||''},wednesday=${row.wednesday||''},thursday=${row.thursday||''},friday=${row.friday||''},
      notes=${row.notes||''},updated_at=now()
    where id=${id} and schedule_kind=${kind}
    returning *
  `;
  return updated.length?NextResponse.json(updated[0]):NextResponse.json({error:'Schedule row not found.'},{status:404});
}

async function handleDELETE(req){
  if(!authorized(req))return no();
  const url=new URL(req.url);
  const kind=validKind(url.searchParams.get('kind'));
  if(!kind)return NextResponse.json({error:'Invalid schedule type.'},{status:400});
  const sql=await db();
  await ensureScheduleTable(sql);

  const scope=url.searchParams.get('scope');
  if(scope==='all'){
    const deleted=await sql`delete from weekly_schedules where schedule_kind=${kind} returning id`;
    return NextResponse.json({deleted:deleted.length});
  }
  if(scope==='section'){
    const category=safe(url.searchParams.get('category'),60);
    if(!category)return NextResponse.json({error:'Section category is required.'},{status:400});
    const deleted=await sql`delete from weekly_schedules where schedule_kind=${kind} and category=${category} returning id`;
    return NextResponse.json({deleted:deleted.length});
  }

  const id=Number(url.searchParams.get('id'));
  if(!Number.isInteger(id)||id<1)return NextResponse.json({error:'Invalid schedule row.'},{status:400});
  const deleted=await sql`delete from weekly_schedules where id=${id} and schedule_kind=${kind} returning id`;
  return NextResponse.json({deleted:deleted.length});
}

export const GET=withApiErrors(handleGET);
export const POST=withApiErrors(handlePOST);
export const PATCH=withApiErrors(handlePATCH);
export const DELETE=withApiErrors(handleDELETE);
