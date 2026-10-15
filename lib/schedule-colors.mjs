import {WEEKDAYS} from './schedule-time.mjs';
export const DEFAULT_TIME_COLOR='#17305E';
export function normalizeDayColors(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return {};
 return Object.fromEntries(WEEKDAYS.filter(day=>typeof value[day]==='string'&&/^#[0-9a-f]{6}$/i.test(value[day])&&value[day].toUpperCase()!==DEFAULT_TIME_COLOR).map(day=>[day,value[day].toUpperCase()]));
}
