export function optionalPropertyNumber(value,{currency=false,integer=false}={}){
 if(!['string','number'].includes(typeof value)||typeof value==='string'&&!value.trim())return null;
 const clean=currency?String(value).replace(/,/g,''):value;
 const number=Number(clean);return Number.isFinite(number)&&number>=0?(integer?Math.trunc(number):number):null;
}
