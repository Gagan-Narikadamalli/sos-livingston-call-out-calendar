export function listCalendarMonths(from,to){
 const valid=value=>/^\d{4}-(0[1-9]|1[0-2])$/.test(value)&&Number(value.slice(0,4))>=1000;
 if(!valid(from)||!valid(to))throw new Error('Choose a valid From Month and To Month.');
 if(from>to)throw new Error('To Month must be the same as or later than From Month.');
 const months=[];let [year,month]=from.split('-').map(Number);
 while(`${year}-${String(month).padStart(2,'0')}`<=to){months.push(`${year}-${String(month).padStart(2,'0')}`);if(++month===13){year++;month=1;}}
 return months;
}
