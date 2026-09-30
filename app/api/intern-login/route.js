import {withApiErrors} from '../../../lib/api';
import {NextResponse} from 'next/server';
import {calendarAuthorized,setCalendarAuth,clearCalendarAuth} from '../../../lib/auth';

async function handleGET(req){return NextResponse.json({authenticated:calendarAuthorized(req)})}
async function handlePOST(req){
  const {password}=await req.json();
  if(!process.env.INTERN_CALENDAR_PASSWORD||password!==process.env.INTERN_CALENDAR_PASSWORD)return NextResponse.json({error:'Incorrect password.'},{status:401});
  const response=NextResponse.json({ok:true});setCalendarAuth(response);return response;
}
async function handleDELETE(){const response=NextResponse.json({ok:true});clearCalendarAuth(response);return response}

export const GET=withApiErrors(handleGET);
export const POST=withApiErrors(handlePOST);
export const DELETE=withApiErrors(handleDELETE);
