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
  validateEntry,validDate,validMonth
}
from'../../../lib/validate';
const no=()=>NextResponse.json({error:'Unauthorized'
},{status:401
});
async function handleGET(req){
  if(!authorized(req))return no();
  const sql=await db(),u=new URL(req.url),month=u.searchParams.get('month');
  if(!validMonth(month))return NextResponse.json({error:'Invalid month'
},{status:400
});
  const rows=await sql`select id,submitter_type,name,email,request_type,event_date::text,reason,request_group_id,submitted_at from call_outs where event_date>=(${month+'-01'})::date and event_date<((${month+'-01'})::date+interval '1 month') order by event_date,submitted_at`;
  return NextResponse.json(rows)
}
async function handlePATCH(req){
  if(!authorized(req))return no();
  const b=await req.json(),v=validateEntry(b,{enforceAdvance:false,allowParent:true
});
  if(typeof v==='string')return NextResponse.json({error:v
},{status:400
});
  const sql=await db(),rows=await sql`update call_outs set submitter_type=${v.submitter_type},name=${v.name},email=${v.email||null},request_type=${v.request_type},event_date=${v.event_date},reason=${v.reason||''} where id=${b.id} returning id`;
  return rows.length?NextResponse.json({ok:true
}):NextResponse.json({error:'Record not found'
},{status:404
})
}
async function handleDELETE(req){
  if(!authorized(req))return no();
  const sql=await db(),u=new URL(req.url),id=u.searchParams.get('id');
  if(id){
    const r=await sql`delete from call_outs where id=${id} returning id`;
    return NextResponse.json({deleted:r.length
})
}
  const mode=u.searchParams.get('mode')||'custom';
  let start=u.searchParams.get('start'),end=u.searchParams.get('end');
  const iso=d=>d.toISOString().slice(0,10),today=new Date();
  today.setUTCHours(0,0,0,0);
  if(mode==='previous-month'){
    start=iso(new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth()-1,1)));
    end=iso(new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),0)))
}
  else if(mode==='previous-week'){
    const lastSaturday=new Date(today);
    lastSaturday.setUTCDate(today.getUTCDate()-today.getUTCDay()-1);
    const lastSunday=new Date(lastSaturday);
    lastSunday.setUTCDate(lastSaturday.getUTCDate()-6);
    start=iso(lastSunday);
    end=iso(lastSaturday)
}
  else if(mode!=='custom')return NextResponse.json({error:'Choose a valid deletion option.'
},{status:400
});
  if(!validDate(start||'')||!validDate(end||'')||start>end)return NextResponse.json({error:'Select a valid start and end date.'
},{status:400
});
  const result=await sql.begin(async tx=>{const a=await tx`delete from call_outs where event_date>=${start} and event_date<=${end} returning id`;const b=await tx`delete from calendar_notes where event_date>=${start} and event_date<=${end} returning id`;return{callOuts:a.length,managerNotes:b.length
}
});
  return NextResponse.json({...result,deleted:result.callOuts+result.managerNotes,start,end
})
}
export const GET=withApiErrors(handleGET);
export const PATCH=withApiErrors(handlePATCH);
export const DELETE=withApiErrors(handleDELETE);
