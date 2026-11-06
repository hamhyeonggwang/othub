(function () {
  'use strict';
  let pending;
  const SDK = 'https://unpkg.com/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
  window.OTServices = {
    async client() {
      const cfg = window.OT_HUB_SUPABASE || {};
      if (!cfg.url || !cfg.anonKey) throw new Error('로그인 연결이 준비되지 않았습니다.');
      if (!pending) pending = new Promise((resolve, reject) => {
        let timer, settled=false;
        const done = () => {
          if(settled)return;
          settled=true;clearTimeout(timer);
          try{if(!window.supabase?.createClient)throw new Error('로그인 모듈을 불러오지 못했습니다.');resolve(window.supabase.createClient(cfg.url,cfg.anonKey));}catch(error){reject(error);}
        };
        if (window.supabase) return done();
        const script = document.createElement('script');
        script.src = SDK;
        script.async = true;
        script.onload = done;
        const fail = message => {if(settled)return;settled=true;clearTimeout(timer);script.onload=script.onerror=null;script.remove();reject(new Error(message));};
        script.onerror = () => fail('연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
        timer = setTimeout(() => fail('연결 시간이 초과되었습니다. 다시 시도해 주세요.'), 10000);
        document.head.append(script);
      }).catch(error => { pending = null; throw error; });
      return pending;
    },
    escape(value) {return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));},
    read(key, fallback) {try {return JSON.parse(localStorage.getItem(key)) ?? fallback;} catch {return fallback;}},
    write(key, value) {try {localStorage.setItem(key, JSON.stringify(value)); return true;} catch {return false;}}
  };
})();
