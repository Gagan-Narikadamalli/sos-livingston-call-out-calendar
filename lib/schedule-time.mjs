export const WEEKDAYS=['monday','tuesday','wednesday','thursday','friday'];
export const DAY_NAMES=['Monday','Tuesday','Wednesday','Thursday','Friday'];
const OFF=/^(?:off|out|n\/?a|none|not working|pto|closed|[-–—]+)?$/i;
const TOKEN='(\\d{1,2})(?::(\\d{2}))?\\s*(a\\.?m\\.?|p\\.?m\\.?)?';
const RANGE=new RegExp('^\\s*'+TOKEN+'\\s*(?:-|–|—|to)\\s*'+TOKEN+'\\s*$','i');
export const isOffDay=value=>OFF.test(String(value??'').trim());
function clock(hour,minute,marker){
  const h=Number(hour),m=Number(minute||0);
  if(m>59||h>23||(marker&&(h<1||h>12)))return null;
  if(marker)return (h%12+(/^p/i.test(marker)?12:0))*60+m;
  return h*60+m;
}
export function formatClock(minutes){
  const hour=Math.floor(minutes/60),minute=minutes%60;
  return `${String(hour%12||12).padStart(2,'0')}:${String(minute).padStart(2,'0')} ${hour>=12?'PM':'AM'}`;
}
export function inputClock(minutes){return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;}
export function serializeRanges(ranges){return ranges.map(range=>`${range.start?formatClock(Number(range.start.slice(0,2))*60+Number(range.start.slice(3))):''} - ${range.end?formatClock(Number(range.end.slice(0,2))*60+Number(range.end.slice(3))):''}`).join('; ');}
export function parseScheduleTime(value){
  const text=String(value??'').trim();
  if(isOffDay(text))return {valid:true,ranges:[],minutes:0};
  const ranges=[];
  for(const part of text.split(/\s*(?:;|,|\band\b|\/)\s*/i)){
    const match=part.match(RANGE);
    if(!match)return {valid:false,ranges:[],minutes:0,error:'Select a valid start and end time.'};
    let start=clock(match[1],match[2],match[3]),end=clock(match[4],match[5],match[6]);
    if(start===null||end===null)return {valid:false,ranges:[],minutes:0,error:'Invalid time.'};
    // Legacy office schedules omit AM/PM: 8-4 is 8 AM–4 PM; 4-6 is 4 PM–6 PM.
    if(!match[3]&&!match[6]){
      if(start>0&&start<7*60&&end>start&&end<8*60){start+=12*60;end+=12*60;}
      if(end<=start&&end<12*60)end+=12*60;
    }else{
      if(!match[3]&&/^p/i.test(match[6]||'')&&start>0&&start<7*60&&start+12*60<end)start+=12*60;
      if(!match[6]&&end<=start&&end<12*60)end+=12*60;
    }
    if(end<=start)return {valid:false,ranges:[],minutes:0,error:'End time must be later than start time on the same day.'};
    ranges.push({start,end});
  }
  ranges.sort((a,b)=>a.start-b.start);
  if(ranges.some((range,index)=>index>0&&range.start<ranges[index-1].end))return {valid:false,ranges:[],minutes:0,error:'Time ranges cannot overlap.'};
  return {valid:true,ranges,minutes:ranges.reduce((sum,range)=>sum+range.end-range.start,0)};
}
export function normalizedScheduleTime(value){
  const result=parseScheduleTime(value);
  if(!result.valid)throw new Error(result.error);
  return result.ranges.map(range=>`${formatClock(range.start)} - ${formatClock(range.end)}`).join('; ');
}
export function formatHours(minutes){return (minutes/60).toLocaleString('en-US',{maximumFractionDigits:2});}
export function scheduleCategory(row){
 const category=String(row.category||'').toLowerCase();
 return category.includes('bcba')?'bcba':category.includes('intern')?'intern':'bt';
}
