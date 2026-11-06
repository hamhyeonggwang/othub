(function(){
  'use strict';
  let starting,client,subscription,revision=0;
  let state={ready:false,session:null,error:null};
  const listeners=new Set();
  function publish(next){state=next;for(const fn of listeners)fn({...state});}
  async function start(){
    if(starting)return starting;
    starting=(async()=>{
      client=await OTServices.client();
      if(!subscription){
        // Never call a Supabase API while its auth callback holds the auth lock.
        subscription=client.auth.onAuthStateChange((_event,session)=>{
          const rev=++revision;
          setTimeout(()=>{if(rev===revision)publish({ready:true,session,error:null});},0);
        }) || true;
      }
      const rev=revision;
      let timer;
      try{
        const result=await Promise.race([client.auth.getSession(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('로그인 확인 시간이 초과되었습니다. 다시 시도해 주세요.')),10000);})]);
        if(result.error)throw result.error;
        if(rev===revision)publish({ready:true,session:result.data?.session||null,error:null});
        return state.session;
      }finally{clearTimeout(timer);}
    })().catch(error=>{starting=null;publish({...state,error});throw error;});
    return starting;
  }
  window.OTAuth={
    start,
    snapshot:()=>({...state}),
    subscribe(fn){listeners.add(fn);if(state.ready||state.error)fn({...state});return ()=>listeners.delete(fn);},
    async sendLink(email,{admin=false}={}){
      const sb=await OTServices.client();
      const callback=new URL(admin?'admin.html':'index.html',location.href);
      if(!admin)callback.hash='profile';
      const {error}=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:callback.href,...(admin?{shouldCreateUser:false}:{})}});
      if(error)throw error;
    },
    async signOut(){
      const sb=await OTServices.client();const {error}=await sb.auth.signOut();if(error)throw error;
      revision++;publish({ready:true,session:null,error:null});
    },
    clearCallback(){
      const url=new URL(location.href);
      ['code','error','error_code','error_description'].forEach(key=>url.searchParams.delete(key));
      if(/access_token=|error_description=/.test(url.hash))url.hash=url.pathname.endsWith('admin.html')?'':'profile';
      history.replaceState(null,'',url.pathname+url.search+url.hash);
    }
  };
})();
