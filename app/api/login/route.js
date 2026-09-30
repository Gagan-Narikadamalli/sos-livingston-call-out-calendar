import {withApiErrors} from '../../../lib/api';
import{NextResponse}from'next/server';import{setAuth,clearAuth,authorized}from'../../../lib/auth';
async function handleGET(req){return NextResponse.json({authenticated:authorized(req)})}
async function handlePOST(req){const{password}=await req.json();if(!process.env.MANAGER_PASSWORD||password!==process.env.MANAGER_PASSWORD)return NextResponse.json({error:'Incorrect password.'},{status:401});const r=NextResponse.json({ok:true});setAuth(r);return r}
async function handleDELETE(){const r=NextResponse.json({ok:true});clearAuth(r);return r}

export const GET=withApiErrors(handleGET);
export const POST=withApiErrors(handlePOST);
export const DELETE=withApiErrors(handleDELETE);
