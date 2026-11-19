import {NextResponse} from 'next/server';
import {normalizeDayColors} from '../../../lib/schedule-colors.mjs';
import {WEEKDAYS,parseScheduleTime,normalizedScheduleTime} from '../../../lib/schedule-time.mjs';
import {withApiErrors} from '../../../lib/api';
import {authorized,calendarAuthorized} from '../../../lib/auth';
import {db} from '../../../lib/db';
import {writeAudit} from '../../../lib/audit-log';

const kinds=new Set(['employee','client']);
const no=()=>NextResponse.json({error:'Unauthorized'},{status:401});
const safe=(value,max=120)=>String(value??'').trim().slice(0,max);
function validateContact(body){
  const phone=String(body.phone_number??'').trim();
  const email=String(body.email??'').trim();
  if(phone.length>40)return 'Phone number must be 40 characters or fewer.';
  if(email.length>254||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))return 'Enter a valid email address.';
  return null;
}
const validKind=value=>kinds.has(value)?value:null;
function dateOnly(value){
  if(!value)return '';
  if(value instanceof Date&&!Number.isNaN(value.getTime()))return value.toISOString().slice(0,10);
  const text=String(value).trim();
  return /^\d{4}-\d{2}-\d{2}/.test(text)?text.slice(0,10):'';
}
function readOptionalDate(value,label){
  const date=String(value??'').trim();
  if(!date)return {value:null,error:null};
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return {value:null,error:`${label} must be a valid date.`};
  const parsed=new Date(`${date}T00:00:00.000Z`);
  if(Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)return {value:null,error:`${label} must be a valid date.`};
  return {value:date,error:null};
}
function validateDateRange(body){
  const start=readOptionalDate(body.start_date,'Start Date');
  const end=readOptionalDate(body.end_date,'End Date');
  if(start.error)return {error:start.error};
  if(end.error)return {error:end.error};
  if(start.value&&end.value&&end.value<start.value)return {error:'End Date must be on or after Start Date.'};
  return {start_date:start.value,end_date:end.value};
}
function serializeScheduleRow(row){
  return {...row,start_date:dateOnly(row.start_date),end_date:dateOnly(row.end_date)};
}

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
    phone_number text,
    email text,
    display_order integer not null default 0,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  )`;
  await sql`alter table weekly_schedules add column if not exists day_colors jsonb not null default '{}'::jsonb`;
  await sql`alter table weekly_schedules add column if not exists start_date date`;
  await sql`alter table weekly_schedules add column if not exists end_date date`;
  await sql`alter table weekly_schedules add column if not exists phone_number text`;
  await sql`alter table weekly_schedules add column if not exists email text`;
  await sql`alter table weekly_schedules add column if not exists finalized_at timestamptz`;
  await sql`alter table weekly_schedules add column if not exists on_hold boolean not null default false`;
  await sql`create index if not exists weekly_schedules_kind_order_idx on weekly_schedules(schedule_kind,display_order,id)`;
}

function normalizeRow(body,kind,order=0){
  return{
    schedule_kind:kind,
    category:safe(body.category,60)||(kind==='employee'?'Employee':'Client/Kid'),
    first_name:safe(body.first_name,120),
    last_name:safe(body.last_name,120),
    assigned_to:safe(body.assigned_to,160),
    monday:normalizedScheduleTime(body.monday),
    tuesday:normalizedScheduleTime(body.tuesday),
    wednesday:normalizedScheduleTime(body.wednesday),
    thursday:normalizedScheduleTime(body.thursday),
    friday:normalizedScheduleTime(body.friday),
    start_date:dateOnly(body.start_date)||null,
    end_date:dateOnly(body.end_date)||null,
    notes:safe(body.notes,500),
    phone_number:safe(body.phone_number,40),
    email:safe(body.email,254),
    day_colors:normalizeDayColors(body.day_colors),
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
      monday,tuesday,wednesday,thursday,friday,start_date,end_date,notes,phone_number,email,day_colors,display_order,created_at,updated_at,finalized_at,on_hold
    from weekly_schedules
    where schedule_kind=${kind}
    order by display_order,id
  `;
  const managerView=authorized(req);
  return NextResponse.json(rows.map(row=>{
    const serialized=serializeScheduleRow(row);
    if(managerView)return serialized;
    const teamRow={...serialized};
    delete teamRow.phone_number;
    delete teamRow.email;
    delete teamRow.on_hold;
    return teamRow;
  }));
}

async function handlePOST(req){
  if(!authorized(req))return no();
  const body=await req.json();
  const kind=validKind(body.kind);
  const invalidDay=WEEKDAYS.find(day=>!parseScheduleTime(body[day]).valid);
  if(invalidDay)return NextResponse.json({error:`${invalidDay}: ${parseScheduleTime(body[invalidDay]).error}`},{status:400});
  if(!kind)return NextResponse.json({error:'Invalid schedule type.'},{status:400});
  const invalidContact=validateContact(body);
  if(invalidContact)return NextResponse.json({error:invalidContact},{status:400});
  const dates=validateDateRange(body);
  if(dates.error)return NextResponse.json({error:dates.error},{status:400});
  const sql=await db();
  await ensureScheduleTable(sql);

  const row=normalizeRow({...body,...dates},kind,0);
  if(!row.first_name)return NextResponse.json({error:'A first name or client/kid name is required.'},{status:400});
  const maxRows=await sql`select coalesce(max(display_order),-1)+1 as next from weekly_schedules where schedule_kind=${kind}`;
  const created=await sql`
    insert into weekly_schedules(
      schedule_kind,category,first_name,last_name,assigned_to,
      monday,tuesday,wednesday,thursday,friday,start_date,end_date,notes,phone_number,email,day_colors,display_order
    ) values(
      ${kind},${row.category},${row.first_name},${row.last_name||''},${row.assigned_to||''},
      ${row.monday||''},${row.tuesday||''},${row.wednesday||''},${row.thursday||''},${row.friday||''},${row.start_date},${row.end_date},${row.notes||''},${row.phone_number||''},${row.email||''},${sql.json(row.day_colors)},${Number(maxRows[0]?.next||0)}
    ) returning *
  `;
  const saved=serializeScheduleRow(created[0]);
  await writeAudit(sql,{action:'add',entityType:'schedule',entityId:saved.id,summary:`Added ${kind==='employee'?'staff member':'client'}: ${saved.first_name} ${saved.last_name||''}`.trim(),details:{kind,category:saved.category,after:saved}});
  return NextResponse.json(saved);
}

async function handlePATCH(req){
  if(!authorized(req))return no();
  const body=await req.json();
  if(body.action==='set_hold'){
    const holdId=Number(body.id);
    const holdKind=validKind(body.kind);
    if(!Number.isInteger(holdId)||holdId<1||!holdKind||typeof body.on_hold!=='boolean'){
      return NextResponse.json({error:'Invalid hold status request.'},{status:400});
    }
    const sql=await db();
    await ensureScheduleTable(sql);
    const beforeRows=await sql`select * from weekly_schedules where id=${holdId} and schedule_kind=${holdKind}`;
    if(!beforeRows.length)return NextResponse.json({error:'Schedule row not found.'},{status:404});
    const updated=await sql`
      update weekly_schedules
      set on_hold=${body.on_hold},updated_at=now()
      where id=${holdId} and schedule_kind=${holdKind}
      returning *
    `;
    const saved=serializeScheduleRow(updated[0]);
    await writeAudit(sql,{action:body.on_hold?'hold':'resume',entityType:'schedule',entityId:holdId,summary:`${saved.first_name} ${saved.last_name||''} ${body.on_hold?'placed on hold':'resumed'}`.trim(),details:{kind:holdKind,category:saved.category}});
    return NextResponse.json(saved);
  }
  if(body.action==='finalize'){
    const finalizeId=Number(body.id);
    const finalizeKind=validKind(body.kind);
    if(!Number.isInteger(finalizeId)||finalizeId<1||!finalizeKind){
      return NextResponse.json({error:'Invalid schedule row.'},{status:400});
    }
    const sql=await db();
    await ensureScheduleTable(sql);
    const finalized=await sql`
      update weekly_schedules
      set finalized_at=coalesce(finalized_at,now()),updated_at=now()
      where id=${finalizeId} and schedule_kind=${finalizeKind}
      returning *
    `;
    return finalized.length
      ?NextResponse.json(serializeScheduleRow(finalized[0]))
      :NextResponse.json({error:'Schedule row not found.'},{status:404});
  }
  const invalidContact=validateContact(body);
  if(invalidContact)return NextResponse.json({error:invalidContact},{status:400});
  const id=Number(body.id),kind=validKind(body.kind);
  const invalidDay=WEEKDAYS.find(day=>!parseScheduleTime(body[day]).valid);
  if(invalidDay)return NextResponse.json({error:`${invalidDay}: ${parseScheduleTime(body[invalidDay]).error}`},{status:400});
  if(!Number.isInteger(id)||id<1||!kind)return NextResponse.json({error:'Invalid schedule row.'},{status:400});
  const dates=validateDateRange(body);
  if(dates.error)return NextResponse.json({error:dates.error},{status:400});
  const row=normalizeRow({...body,...dates},kind,0);
  if(!row.first_name)return NextResponse.json({error:'A first name or client/kid name is required.'},{status:400});
  const sql=await db();
  await ensureScheduleTable(sql);
  const beforeRows=await sql`select * from weekly_schedules where id=${id} and schedule_kind=${kind}`;
  if(!beforeRows.length)return NextResponse.json({error:'Schedule row not found.'},{status:404});
  const before=serializeScheduleRow(beforeRows[0]);
  const updated=await sql`
    update weekly_schedules set
      category=${row.category},first_name=${row.first_name},last_name=${row.last_name||''},assigned_to=${row.assigned_to||''},
      monday=${row.monday||''},tuesday=${row.tuesday||''},wednesday=${row.wednesday||''},thursday=${row.thursday||''},friday=${row.friday||''},
      start_date=${row.start_date},end_date=${row.end_date},notes=${row.notes||''},phone_number=${row.phone_number||''},email=${row.email||''},day_colors=coalesce(${body.day_colors===undefined?null:sql.json(row.day_colors)},day_colors),updated_at=now()
    where id=${id} and schedule_kind=${kind}
    returning *
  `;
  if(!updated.length)return NextResponse.json({error:'Schedule row not found.'},{status:404});
  const saved=serializeScheduleRow(updated[0]);
  const fields=['category','first_name','last_name','assigned_to','monday','tuesday','wednesday','thursday','friday','start_date','end_date','notes','phone_number','email','day_colors'];
  const changedFields=fields.filter(field=>JSON.stringify(before[field]??null)!==JSON.stringify(saved[field]??null));
  await writeAudit(sql,{action:'edit',entityType:'schedule',entityId:id,summary:`Edited ${kind==='employee'?'staff member':'client'}: ${saved.first_name} ${saved.last_name||''}`.trim(),details:{kind,category:saved.category,changedFields,before,after:saved}});
  return NextResponse.json(saved);
}

async function handleDELETE(req){
  if(!authorized(req))return no();
  const url=new URL(req.url);
  const kind=validKind(url.searchParams.get('kind'));
  if(!kind)return NextResponse.json({error:'Invalid schedule type.'},{status:400});
  const sql=await db();
  await ensureScheduleTable(sql);

  const scope=url.searchParams.get('scope');
  let predicate,values;
  if(scope==='all'){predicate='all';}
  else if(scope==='section'){
    const category=safe(url.searchParams.get('category'),60);
    if(!category)return NextResponse.json({error:'Section category is required.'},{status:400});
    predicate='section';values={category};
  }else{
    const id=Number(url.searchParams.get('id'));
    if(!Number.isInteger(id)||id<1)return NextResponse.json({error:'Invalid schedule row.'},{status:400});
    predicate='single';values={id};
  }
  const result=await sql.begin(async transaction=>{
    let snapshots;
    if(predicate==='all')snapshots=await transaction`select * from weekly_schedules where schedule_kind=${kind} for update`;
    else if(predicate==='section')snapshots=await transaction`select * from weekly_schedules where schedule_kind=${kind} and category=${values.category} for update`;
    else snapshots=await transaction`select * from weekly_schedules where id=${values.id} and schedule_kind=${kind} for update`;
    let deleted;
    if(predicate==='all')deleted=await transaction`delete from weekly_schedules where schedule_kind=${kind} returning id`;
    else if(predicate==='section')deleted=await transaction`delete from weekly_schedules where schedule_kind=${kind} and category=${values.category} returning id`;
    else deleted=await transaction`delete from weekly_schedules where id=${values.id} and schedule_kind=${kind} returning id`;
    if(snapshots.length)await writeAudit(transaction,{action:'delete',entityType:'schedule',entityId:values?.id??null,summary:predicate==='single'?`Deleted ${kind==='employee'?'staff member':'client'}: ${snapshots[0].first_name} ${snapshots[0].last_name||''}`.trim():`Deleted ${snapshots.length} ${kind==='employee'?'staff schedule':'client schedule'} entr${snapshots.length===1?'y':'ies'}`,details:{kind,scope:predicate,count:snapshots.length,category:values?.category||null,before:predicate==='single'?snapshots[0]:null,records:predicate==='single'?undefined:snapshots.map(row=>({name:[row.first_name,row.last_name].filter(Boolean).join(' '),category:row.category}))},undoData:snapshots});
    return deleted.length;
  });
  return NextResponse.json({deleted:result});
}

export const GET=withApiErrors(handleGET);
export const POST=withApiErrors(handlePOST);
export const PATCH=withApiErrors(handlePATCH);
export const DELETE=withApiErrors(handleDELETE);
