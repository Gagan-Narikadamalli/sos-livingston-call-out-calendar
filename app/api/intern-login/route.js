import {NextResponse} from 'next/server';
import {calendarAuthorized,setCalendarAuth,clearCalendarAuth} from '../../../lib/auth';

export async function GET(req){return NextResponse.json({authenticated:calendarAuthorized(req)})}
export async function POST(req){
  const {password}=await req.json();
  if(!process.env.INTERN_CALENDAR_PASSWORD||password!==process.env.INTERN_CALENDAR_PASSWORD)return NextResponse.json({error:'Incorrect password.'},{status:401});
  const response=NextResponse.json({ok:true});setCalendarAuth(response);return response;
}
export async function DELETE(){const response=NextResponse.json({ok:true});clearCalendarAuth(response);return response}
