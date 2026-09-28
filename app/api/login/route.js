import{NextResponse}from'next/server';import{setAuth,clearAuth,authorized}from'../../../lib/auth';
export async function GET(req){return NextResponse.json({authenticated:authorized(req)})}
export async function POST(req){const{password}=await req.json();if(!process.env.MANAGER_PASSWORD||password!==process.env.MANAGER_PASSWORD)return NextResponse.json({error:'Incorrect password.'},{status:401});const r=NextResponse.json({ok:true});setAuth(r);return r}
export async function DELETE(){const r=NextResponse.json({ok:true});clearAuth(r);return r}
