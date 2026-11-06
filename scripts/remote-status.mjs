// Read-only inspection. Never sends login email or writes database records.
import fs from 'node:fs';
import vm from 'node:vm';
const launch=JSON.parse(fs.readFileSync('ops/launch.json','utf8'));
const context=vm.createContext({window:{}});
vm.runInContext(fs.readFileSync('supabase-config.js','utf8'),context,{timeout:1000});
const cfg=context.window.OT_HUB_SUPABASE;
const result={domain:launch.productionOrigin,checkedAt:new Date().toISOString()};
try{
 const r=await fetch(launch.productionOrigin,{redirect:'manual',signal:AbortSignal.timeout(10000)});
 result.site={httpStatus:r.status,redirect:r.headers.get('location')||null};
 if(r.ok){const text=await r.text();result.site.currentWorkspace=text.includes('assets/workspace.js');result.site.nextApp=text.includes('/_next/');}
}catch(error){result.site={reachable:false,reason:error.cause?.code||error.name};}
try{
 const r=await fetch(cfg.url+'/rest/v1/rpc/othub_admin_metrics',{method:'POST',headers:{apikey:cfg.anonKey,Authorization:'Bearer '+cfg.anonKey,'Content-Type':'application/json'},body:JSON.stringify({p_days:7}),signal:AbortSignal.timeout(10000)});
 const response=await r.json().catch(()=>({}));
 result.analytics={httpStatus:r.status,status:r.ok?'UNEXPECTED_PUBLIC_ACCESS':response.code==='PGRST202'?'migration_missing':response.code==='42501'?'anonymous_access_denied':'unverified',code:response.code||null};
}catch(error){result.analytics={reachable:false,reason:error.cause?.code||error.name};}
console.log(JSON.stringify(result,null,2));
