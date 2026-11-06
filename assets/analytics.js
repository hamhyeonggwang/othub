(function () {
  'use strict';
  const CONSENT = 'othub.analytics-consent.v1';
  const SESSION = 'othub.analytics-session.v1';
  const allowed = new Set(['page_view','content_open','search','navigation','client_error']);
  let queue = [], timer, sending = false, generation = 0, controller=null;
  const attempts=new Map();
  let session = null;
  let currentRoute = 'home';
  function consent() {return OTServices.read(CONSENT, false) === true;}
  function enabled() {return window.OT_HUB_ANALYTICS_ENABLED === true && consent() && navigator.doNotTrack !== '1' && !navigator.globalPrivacyControl;}
  function sessionId() {
    if(session && Date.now()-session.time < 30*60*1000) {session.time=Date.now();}
    else {
      try {session=JSON.parse(sessionStorage.getItem(SESSION));} catch {}
      if(!session || !/^[0-9a-f-]{36}$/.test(session.id) || Date.now()-session.time >= 30*60*1000) session={id:crypto.randomUUID(),time:Date.now()};
      session.time=Date.now();
    }
    try {sessionStorage.setItem(SESSION,JSON.stringify(session));} catch {}
    return session.id;
  }
  function track(event, fields = {}) {
    if(!enabled() || !allowed.has(event)) return;
    const row = {id:crypto.randomUUID(),session_id:sessionId(),event,
      route:String(fields.route || currentRoute).replace(/[^a-z_]/g,'').slice(0,24),
      content_id: fields.content_id && /^[a-z][0-9]{1,4}$/.test(fields.content_id) ? fields.content_id : null,
      value: Math.max(0,Math.min(60000,Math.round(Number(fields.value)||0))),
      device:window.innerWidth<768?'mobile':window.innerWidth<1100?'tablet':'desktop',
      source: source(), version:'0.2.0'};
    queue.push(row);
    if(queue.length>50){queue.splice(0,queue.length-50).forEach(row=>attempts.delete(row.id));}
    if(!timer) timer=setTimeout(flush,4000);
  }
  function source() {
    try {const host=new URL(document.referrer).hostname; if(host===location.hostname)return 'direct'; if(/(^|\.)(google|naver|bing)\./.test(host))return 'search'; if(/(^|\.)(instagram|facebook|youtube)\.com$/.test(host))return 'social'; return 'referral';}catch{return 'direct';}
  }
  async function flush() {
    clearTimeout(timer); timer=null;
    if(!enabled()){queue=[]; return;}
    if(sending || !queue.length)return;
    sending=true;
    const sid=queue[0].session_id;
    const nextSession=queue.findIndex(row=>row.session_id!==sid);
    const batch=queue.splice(0,Math.min(20,nextSession<0?queue.length:nextSession)), epoch=generation;
    let retry=false;
    controller=new AbortController();
    const timeout=setTimeout(()=>controller?.abort(),8000);
    try {
      if(!enabled() || epoch!==generation) return;
      const response=await fetch('/api/events',{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(batch),
        credentials:'omit',keepalive:true,signal:controller.signal
      });
      retry=response.status===429||response.status>=500;
    } catch {
      retry=true;
    } finally {
      clearTimeout(timeout);controller=null;
      // Bounded in-memory retry only. Navigation never waits for analytics.
      if(retry&&enabled()&&epoch===generation){
        const remaining=batch.filter(row=>{const count=(attempts.get(row.id)||0)+1;if(count>=3){attempts.delete(row.id);return false;}attempts.set(row.id,count);return true;});
        queue=[...remaining,...queue];
        if(queue.length>50)queue.splice(0,queue.length-50).forEach(row=>attempts.delete(row.id));
      }else batch.forEach(row=>attempts.delete(row.id));
      sending=false;
      clearTimeout(timer);timer=null;
      if(queue.length && enabled())timer=setTimeout(flush,retry?60000:1000);
    }
  }
  window.OTAnalytics = {
    track, consent, enabled,
    page(route) {currentRoute=route; track('page_view',{route});},
    setConsent(value) {
      const saved=OTServices.write(CONSENT,!!value);
      generation++; queue=[];attempts.clear();controller?.abort(); clearTimeout(timer); timer=null;
      if(!value) {session=null; try{sessionStorage.removeItem(SESSION);}catch{}}
      if(value && saved) track('page_view',{route:currentRoute});
      return saved;
    }
  };
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flush();});
  window.addEventListener('storage',e=>{if((e.key===CONSENT||e.key===null) && !consent()){generation++; queue=[];attempts.clear();controller?.abort();clearTimeout(timer);timer=null;session=null;try{sessionStorage.removeItem(SESSION);}catch{}}});
  window.addEventListener('error',()=>track('client_error'));
  window.addEventListener('unhandledrejection',()=>track('client_error'));
})();
