import {WEEKDAYS} from './schedule-time.mjs';
export const DEFAULT_TIME_COLOR='#17305E';
export function normalizeDayColors(value){
 // Recover colors saved as a JSON string by older versions.
 if(typeof value==='string'){try{value=JSON.parse(value);}catch{return {};}}
 if(!value||typeof value!=='object'||Array.isArray(value))return {};
 return Object.fromEntries(WEEKDAYS.filter(day=>typeof value[day]==='string'&&/^#[0-9a-f]{6}$/i.test(value[day])&&value[day].toUpperCase()!==DEFAULT_TIME_COLOR).map(day=>[day,value[day].toUpperCase()]));
}
