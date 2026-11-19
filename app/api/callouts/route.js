import {withApiErrors} from '../../../lib/api';
import {NextResponse} from 'next/server';
import {db} from '../../../lib/db';
import {writeAudit} from '../../../lib/audit-log';
import {validatePublicSubmission} from '../../../lib/validate';
import {findHolidayDates,holidayConflictMessage} from '../../../lib/holidays';

async function handlePOST(req){
  const value=validatePublicSubmission(await req.json());
  if(typeof value==='string')return NextResponse.json({error:value},{status:400});

  const sql=await db();
  const blockedDates=await findHolidayDates(sql,value.dates);
  if(blockedDates.length){
    return NextResponse.json({error:holidayConflictMessage(blockedDates)},{status:400});
  }

  const groupId=crypto.randomUUID();
  await sql.begin(async transaction=>{
    for(const eventDate of value.dates){
      await transaction`insert into call_outs(
        submitter_type,name,email,request_type,event_date,reason,request_group_id
      ) values(
        ${value.submitter_type},${value.name},${value.email},${value.request_type},
        ${eventDate},${value.reason||''},${groupId}
      )`;
    }
  });

  await writeAudit(sql,{action:'add',entityType:'call_out',entityId:groupId,summary:`Added ${value.dates.length===1?'calendar call-out':'calendar call-outs'}: ${value.name} — ${value.request_type}`,details:{name:value.name,submitter_type:value.submitter_type,request_type:value.request_type,dates:value.dates,createdCount:value.dates.length}});
  return NextResponse.json({ok:true,created:value.dates.length});
}

export const POST=withApiErrors(handlePOST);
