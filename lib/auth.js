import crypto from 'crypto';
const COOKIE='sos_manager';
const INTERN_COOKIE='sos_intern_calendar';
function secret(){return process.env.AUTH_SECRET||process.env.MANAGER_PASSWORD||'change-me'}
function token(){return crypto.createHmac('sha256',secret()).update('manager-access-v1').digest('hex')}
function internSecret(){return process.env.AUTH_SECRET||process.env.INTERN_CALENDAR_PASSWORD||'change-intern-password'}
function internToken(){return crypto.createHmac('sha256',internSecret()).update('intern-calendar-access-v1').digest('hex')}
export function authorized(req){return req.cookies.get(COOKIE)?.value===token()}
export function calendarAuthorized(req){return authorized(req)||req.cookies.get(INTERN_COOKIE)?.value===internToken()}
export function setAuth(res){res.cookies.set(COOKIE,token(),{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',path:'/',maxAge:60*60*24*30})}
export function clearAuth(res){res.cookies.set(COOKIE,'',{httpOnly:true,path:'/',maxAge:0})}
export function setCalendarAuth(res){res.cookies.set(INTERN_COOKIE,internToken(),{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',path:'/',maxAge:60*60*24*30})}
export function clearCalendarAuth(res){res.cookies.set(INTERN_COOKIE,'',{httpOnly:true,path:'/',maxAge:0})}
