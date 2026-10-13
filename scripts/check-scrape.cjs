const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Load the actual TypeScript with controlled I/O, without invoking paid providers.
function load(file, mocks = {}, globals = {}, cache = new Map()) {
  const full = path.resolve(__dirname, '../', file);
  if (cache.has(full)) return cache.get(full);
  const exports = {};
  cache.set(full, exports);
  const context = { exports, process, console: { warn() {} }, URL, Response, Request,
    ReadableStream, TextEncoder, AbortController, setTimeout, clearTimeout, ...globals,
    require(id) {
      if (id in mocks) return mocks[id];
      if (id === 'server-only') return {};
      if (id.startsWith('@/') || id.startsWith('.')) {
        const target = id.startsWith('@/') ? path.resolve(__dirname, '../src', id.slice(2)) : path.resolve(path.dirname(full), id);
        return load(path.relative(path.resolve(__dirname, '..'), target + '.ts'), mocks, globals, cache);
      }
      return require(id);
    },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(full, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context, { filename: full });
  return exports;
}
const saved = { id: 'saved', name: 'Saved Restaurant', menu: {currency:'SGD',items:[{name:'Soup'}]} };
const page = {title:'Restaurant', markdown:'Soup $5', images:[], menuLinks:[], notFound:false};
function route(overrides = {}) {
  const calls = [];
  const db = { findRestaurantBySourceUrl: async () => saved, saveScrapedRestaurant: async r => ({id:'new',...r}), ...overrides.db };
  const reader = { readSite: async url => { calls.push(url); return page; }, ...overrides.reader };
  const extract = { extractMenu: async () => ({ name:'Restaurant', menu:saved.menu }), NoMenuItemsError: class extends Error {}, ...overrides.extract };
  const api = load('src/app/api/scrape/route.ts', {'@/lib/restaurants':db,'@/lib/scrape/reader':reader,'@/lib/scrape/extract':extract}, { setTimeout: (fn, ms) => setTimeout(fn, ms / 1000) });
  return {calls, async run(body = {url:'https://example.com'}) {
    const res = await api.POST(new Request('https://app.example/api/scrape', {method:'POST',body:JSON.stringify(body)}));
    return res.status === 400 ? {status:400} : (await res.text()).trim().split('\n').map(JSON.parse);
  }};
}
test('failed live scrape returns the saved menu', async () => {
  const events = await route({reader:{readSite:async()=>{throw Error('reader down')}}}).run();
  assert.equal(events.at(-1).fromSavedCopy,true);
});
test('hung provider falls back even if it ignores abort', async () => {
  const events = await route({reader:{readSite:()=>new Promise(()=>{})}}).run();
  assert.equal(events.at(-1).fromSavedCopy,true);
});
test('hung save also meets the saved-copy deadline', async () => {
  const events = await route({db:{saveScrapedRestaurant:()=>new Promise(()=>{})}}).run();
  assert.equal(events.at(-1).fromSavedCopy,true);
});
test('hung cache lookup cannot prevent an error response', async () => {
  const events = await route({db:{findRestaurantBySourceUrl:()=>new Promise(()=>{})},reader:{readSite:()=>new Promise(()=>{})}}).run();
  assert.equal(events.at(-1).type,'error');
});
test('homepage specials do not skip the full menu', async () => {
  const reads=[];
  const events = await route({reader:{readSite:async url=>{reads.push(url);return {...page,menuLinks:reads.length===1?['https://example.com/menu']:[]}}}}).run();
  assert.deepEqual(reads,['https://example.com','https://example.com/menu']);
  assert.equal(events.at(-1).fromSavedCopy,false);
});
test('invalid and null request bodies are rejected', async () => {
  assert.equal((await route().run(null)).status,400);
  assert.equal((await route().run({url:''})).status,400);
});
test('vision failure never retries text-only or reports a partial success', async () => {
  const requests=[];
  const api = load('src/lib/scrape/extract.ts', {}, {
    process:{env:{OPENAI_API_KEY:'test'}},
    fetch:async (_url, init)=>{requests.push(JSON.parse(init.body));return {ok:false,status:400}} });
  await assert.rejects(api.extractMenu({...page,images:['https://example.com/menu.jpg']},new AbortController().signal));
  assert.equal(requests.length,1);
  assert.equal(requests[0].messages[1].content[1].type,'image_url');
});
test('vision-only priced item reaches the shared menu contract', async () => {
  const api = load('src/lib/scrape/extract.ts', {}, {
    process:{env:{OPENAI_API_KEY:'test'}},
    fetch:async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({restaurant_name:'Photo Cafe',currency:'SGD',items:[{name:'Photo Soup',price:6.5,category:'Mains',description:'',image:null,dietary_tags:[],allergens:['soy']}]})}}]})}) });
  const result=await api.extractMenu({...page,markdown:'Menu in photo',images:['https://example.com/menu.jpg']},new AbortController().signal);
  assert.equal(result.menu.items[0].id,'photo-soup');
  assert.equal(result.menu.items[0].price,6.5);
});

test('uploads reject disguised files, empty selection and oversized payloads', async () => {
  const {readMenuPhotos}=load('src/lib/scrape/uploads.ts',{}, {Buffer});
  await assert.rejects(readMenuPhotos(new FormData()));
  const bad=new FormData();bad.append('photos',new Blob(['not an image'],{type:'image/png'}),'fake.png');
  await assert.rejects(readMenuPhotos(bad), /JPG/);
  const large=new FormData();large.append('photos',new Blob([new Uint8Array(3*1024*1024+1)]),'large.png');
  await assert.rejects(readMenuPhotos(large), /3 MB/);
});
test('uploads send valid image bytes to vision and keep the optional restaurant name', async () => {
  const {readMenuPhotos}=load('src/lib/scrape/uploads.ts',{}, {Buffer});
  const form=new FormData();form.set('name','My Cafe');
  form.append('photos',new Blob([Buffer.from([137,80,78,71,13,10,26,10,0])]),'menu.png');
  const input=await readMenuPhotos(form);
  assert.equal(input.title,'My Cafe');assert.match(input.images[0],/^data:image\/png;base64,/);
});
