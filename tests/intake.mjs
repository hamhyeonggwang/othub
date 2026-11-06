import test from 'node:test';
import assert from 'node:assert/strict';
import intake from '../api/events.js';
const env={VERCEL:'1',OT_ANALYTICS_ENABLED:'true',OT_ALLOWED_ORIGINS:'https://othub.example',SUPABASE_URL:'https://test-project.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-server-key',OT_ANALYTICS_HASH_SECRET:'test-secret-32-characters-long-not-real'};
const event=()=>({id:crypto.randomUUID(),session_id:'33333333-3333-4333-8333-333333333333',event:'page_view',route:'home',content_id:null,value:0,device:'desktop',source:'direct',version:'0.2.0'});
async function call({changes={},settings=env,fetcher=async()=>({ok:true}),now}={}){
 const req={method:'POST',headers:{origin:'https://othub.example','content-type':'application/json','x-vercel-forwarded-for':'203.0.113.7'},body:[event()],...changes};
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},end(value){this.body=JSON.parse(value);}};
 await intake.createHandler({env:settings,fetcher,now})(req,res);return res;
}
test('server only intake hashes IP and does not forward browser auth or raw IP',async()=>{
 let sent;const result=await call({fetcher:async(url,options)=>{sent={url,options};return {ok:true};}});
 assert.equal(result.statusCode,200);assert.equal(sent.url,env.SUPABASE_URL+'/rest/v1/rpc/othub_ingest_events');
 const data=JSON.parse(sent.options.body);assert.match(data.p_bucket,/^[a-f0-9]{64}$/);assert.ok(!sent.options.body.includes('203.0.113.7'));assert.ok(!JSON.stringify(result).includes(env.SUPABASE_SERVICE_ROLE_KEY));
 assert.equal(sent.options.headers.Authorization,'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY);
});
test('HMAC rotates per day and origin is an exact allowlist',async()=>{
 const hashes=[];for(const date of ['2026-09-20','2026-09-21'])await call({now:()=>new Date(date),fetcher:async(_url,o)=>{hashes.push(JSON.parse(o.body).p_bucket);return {ok:true};}});
 assert.notEqual(hashes[0],hashes[1]);
 for(const origin of [undefined,'https://othub.example.attacker.test','null'])assert.equal((await call({changes:{headers:{origin,'content-type':'application/json'}}})).statusCode,403);
});
test('missing server configuration, IP, disabled collection fail closed',async()=>{
 for(const key of ['VERCEL','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','OT_ANALYTICS_HASH_SECRET'])assert.equal((await call({settings:{...env,[key]:''}})).statusCode,503);
 assert.equal((await call({settings:{...env,OT_ANALYTICS_ENABLED:'false'}})).statusCode,503);
 assert.equal((await call({changes:{headers:{origin:'https://othub.example','content-type':'application/json','x-vercel-forwarded-for':'not-an-ip'}}})).statusCode,503);
});
test('reject methods, unexpected fields, malformed and oversized batches before DB call',async()=>{
 let calls=0;const fetcher=async()=>{calls++;return {ok:true};};
 assert.equal((await call({changes:{method:'GET'},fetcher})).statusCode,405);
 for(const body of ['bad json',[],[event(),{...event(),session_id:crypto.randomUUID()}],[{...event(),query:'patient data'}],[{...event(),value:-1}],Array.from({length:21},event)])assert.equal((await call({changes:{body},fetcher})).statusCode,400);
 assert.equal((await call({changes:{body:'x'.repeat(16001)},fetcher})).statusCode,413);assert.equal(calls,0);
});
test('upstream rate limits, timeouts and errors never leak internals',async()=>{
 const fetcher=async()=>({ok:false,json:async()=>({code:'54000',message:'database details'})});
 const res=await call({fetcher});assert.equal(res.statusCode,429);assert.equal(res.headers['Retry-After'],'60');
 assert.equal((await call({fetcher:async()=>{throw Error('secret details');}})).statusCode,503);
 assert.equal((await call({fetcher:async()=>({ok:false,json:async()=>({code:'23514'})})})).statusCode,400);
 assert.ok(!JSON.stringify(res).includes('database details'));
});
