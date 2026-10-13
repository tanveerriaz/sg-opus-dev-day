// Explicit opt-in live check: calls paid extraction and saves a test restaurant.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin=process.argv[2];
if(!origin) throw new Error('Usage: node scripts/check-scrape-live.mjs <origin> [restaurant website URL]');
const url=process.argv[3];
let body,headers;
if(url){body=JSON.stringify({url});headers={'Content-Type':'application/json'};}
else {
 body=new FormData();body.set('name','Harbor Test Cafe');
 for(const file of ['menu-photo.png','menu-photo-2.png'])body.append('photos',new Blob([await readFile(new URL('../tests/fixtures/'+file,import.meta.url))],{type:'image/png'}),file);
}
const start=Date.now();
const response=await fetch(new URL('/api/scrape',origin),{method:'POST',headers,body});
assert.equal(response.status,200);
const reader=response.body.pipeThrough(new TextDecoderStream()).getReader();
let buffer='',events=[];
for(;;){const {value,done}=await reader.read();if(done)break;buffer+=value;const lines=buffer.split('\n');buffer=lines.pop();for(const line of lines.filter(Boolean)){const event=JSON.parse(line);events.push(event);console.log(JSON.stringify({elapsedMs:Date.now()-start,...event}));}}
const result=events.at(-1);assert.equal(result.type,'done');
const diner=new URL(`/r/${result.restaurant.id}?mode=table&t=12`,origin);
const page=await fetch(diner);assert.equal(page.status,200);const html=await page.text();assert.ok(html.includes('Table 12'));
if(!url){for(const expected of ['Peanut Noodles','Garden Rice','Lime Soda','Chocolate Cake','6.50','5.00','3.20','4.80','peanuts'])assert.ok(html.includes(expected),`Missing ${expected}`);assert.equal(result.restaurant.itemCount,4);}
console.log(JSON.stringify({verifiedDiner:diner.href,passed:true}));
