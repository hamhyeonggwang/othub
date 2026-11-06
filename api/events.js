'use strict';
const {createHmac}=require('node:crypto');
const {isIP}=require('node:net');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVENTS=new Set(['page_view','content_open','search','navigation','client_error']);
const ROUTES=new Set(['home','explore','webapps','videos','siteinfo','bookmark','recent','updates','profile','privacy','search']);
const FIELDS=new Set(['id','session_id','event','route','content_id','value','device','source','version']);
function validBatch(batch){
  return Array.isArray(batch)&&batch.length>0&&batch.length<=20&&batch.every(e=>e&&typeof e==='object'&&!Array.isArray(e)&&
    Object.keys(e).length===FIELDS.size&&Object.keys(e).every(k=>FIELDS.has(k))&&UUID.test(e.id)&&UUID.test(e.session_id)&&e.session_id===batch[0].session_id&&
    EVENTS.has(e.event)&&ROUTES.has(e.route)&&(e.content_id===null||/^[a-z][0-9]{1,4}$/.test(e.content_id))&&
    Number.isInteger(e.value)&&e.value>=0&&e.value<=60000&&['desktop','tablet','mobile'].includes(e.device)&&
    ['direct','search','social','referral'].includes(e.source)&&/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(e.version));
}
function handler({env=process.env,fetcher=fetch,now=()=>new Date()}={}){
  return async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
    const reply=(status,message)=>{res.statusCode=status;res.end(JSON.stringify({status:message}));};
    if(req.method!=='POST'){res.setHeader('Allow','POST');return reply(405,'method_not_allowed');}
    if(env.OT_ANALYTICS_ENABLED!=='true')return reply(503,'not_ready');
    // Fail closed outside Vercel: never trust forwarded headers on arbitrary hosts.
    if(env.VERCEL!=='1'||!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(env.SUPABASE_URL||'')||!env.SUPABASE_SERVICE_ROLE_KEY||!env.OT_ANALYTICS_HASH_SECRET||env.OT_ANALYTICS_HASH_SECRET.length<32)return reply(503,'not_ready');
    const origins=(env.OT_ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
    const origin=req.headers.origin;
    if(typeof origin!=='string'||!origins.includes(origin)||req.headers['sec-fetch-site']==='cross-site')return reply(403,'origin_not_allowed');
    if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return reply(415,'json_required');
    if(Number(req.headers['content-length'])>16000)return reply(413,'batch_too_large');
    const ip=req.headers['x-vercel-forwarded-for'];
    if(typeof ip!=='string'||!isIP(ip.trim()))return reply(503,'not_ready');
    let batch;
    try{const raw=typeof req.body==='string'?req.body:JSON.stringify(req.body);if(!raw||Buffer.byteLength(raw)>16000)return reply(413,'batch_too_large');batch=JSON.parse(raw);if(!validBatch(batch))return reply(400,'invalid_events');}catch{return reply(400,'invalid_events');}
    // Daily HMAC bucket for rate limiting; raw IP never enters the analytics DB.
    const day=now().toISOString().slice(0,10);
    const bucket=createHmac('sha256',env.OT_ANALYTICS_HASH_SECRET).update(day+'|'+ip.trim()).digest('hex');
    try{
      const response=await fetcher(env.SUPABASE_URL+'/rest/v1/rpc/othub_ingest_events',{
        method:'POST',headers:{'Content-Type':'application/json',apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY},
        body:JSON.stringify({p_events:batch,p_bucket:bucket}),signal:AbortSignal.timeout(5000)
      });
      if(!response.ok){const error=await response.json().catch(()=>({}));if(error.code==='54000'){res.setHeader('Retry-After','60');return reply(429,'rate_limited');}if(['22023','22P02','23514','23502'].includes(error.code))return reply(400,'invalid_events');return reply(503,'temporarily_unavailable');}
      return reply(200,'accepted');
    }catch{return reply(503,'temporarily_unavailable');}
  };
}
module.exports=handler();
module.exports.createHandler=handler;
module.exports.validBatch=validBatch;
