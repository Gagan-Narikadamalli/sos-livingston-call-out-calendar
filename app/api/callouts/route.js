import {withApiErrors} from '../../../lib/api';
import {NextResponse} from'next/server';
import {db}from'../../../lib/db';
import {validatePublicSubmission}from'../../../lib/validate';
async function handlePOST(req){const value=validatePublicSubmission(await req.json());if(typeof value==='string')return NextResponse.json({error:value},{status:400});const sql=await db(),groupId=crypto.randomUUID();await sql.begin(async transaction=>{for(const eventDate of value.dates)await transaction`insert into call_outs(submitter_type,name,email,request_type,event_date,reason,request_group_id) values(${value.submitter_type},${value.name},${value.email},${value.request_type},${eventDate},${value.reason||''},${groupId})`});return NextResponse.json({ok:true,created:value.dates.length})}

export const POST=withApiErrors(handlePOST);
