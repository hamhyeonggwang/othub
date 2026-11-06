(function(){
  'use strict';
  const $=id=>document.getElementById(id),esc=OTServices.escape;
  let sb, request=0, busy=false,account=null;
  const names=Object.fromEntries((window.OT_CONTENT||[]).map(x=>[x.id,x.title]));
  const routes={home:'홈',webapps:'활동 · 웹앱',explore:'전체 콘텐츠',videos:'영상 자료',siteinfo:'학회 · 기관',bookmark:'저장한 콘텐츠',recent:'최근 이용',updates:'업데이트',profile:'내 정보',privacy:'이용 데이터 안내',search:'검색 결과'};
  function table(rows,label,key='name'){return rows?.length?`<table class="data-table"><thead><tr><th scope="col">${label}</th><th scope="col">횟수</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x[key])}</td><td>${Number(x.count).toLocaleString()}</td></tr>`).join('')}</tbody></table>`:'<p>이 기간에 수집된 데이터가 없습니다.</p>';}
  function metric(name,value,hint){return `<article class="metric"><span>${name}</span><strong>${value}</strong><small>${hint}</small></article>`;}
  function render(data){const d=data||{},days=d.daily||[],max=Math.max(1,...days.map(x=>x.count));
    $('analyticsResult').innerHTML=`${d.events===0?'<div class="notice">선택한 기간에 수집된 이용 데이터가 없습니다. 통계 수집 설정과 사용자 동의 여부를 확인하세요.</div>':''}<div class="metric-grid">${metric('방문 세션',Number(d.sessions||0).toLocaleString(),'이 기간에 활동한 탭별 세션')}${metric('메뉴 조회',Number(d.page_views||0).toLocaleString(),'화면을 조회한 횟수')}${metric('콘텐츠 열기',Number(d.content_opens||0).toLocaleString(),'활동·자료 실행 링크 클릭')}${metric('전환 시간 p75',d.nav_p75==null?'—':`${Math.round(d.nav_p75)}<small> ms</small>`,'측정된 메뉴 전환의 75백분위')}</div><section class="panel"><div class="section-heading"><div><h2>일별 방문 흐름</h2><p>UTC 날짜 기준 · 방문 세션 수</p></div></div><div class="chart" role="img" aria-label="일별 방문 세션 수. 아래 상세표에서 값을 확인할 수 있습니다.">${days.map((x,i)=>`<div class="chart-col"><strong>${days.length<=7?Number(x.count):''}</strong><div class="chart-bar" style="height:${Math.round(x.count/max*115)}px" title="${esc(x.date)}: ${Number(x.count)}"></div><span>${i===0||i===days.length-1||days.length<=7?esc(x.date.slice(5)):''}</span></div>`).join('')}</div><details><summary>일별 수치 보기</summary>${table(days.map(x=>({name:x.date,count:x.count})),'날짜 (UTC)')}</details></section><div class="admin-grid"><section class="panel"><h2>많이 열린 콘텐츠</h2>${table((d.content||[]).map(x=>({...x,name:names[x.name]||x.name})),'콘텐츠')}</section><section class="panel"><h2>자주 찾는 메뉴</h2>${table((d.routes||[]).map(x=>({...x,name:routes[x.name]||x.name})),'메뉴')}</section><section class="panel"><h2>메뉴 이동 흐름</h2>${table((d.flows||[]).map(x=>({name:`${routes[x.from]||x.from} → ${routes[x.to]||x.to}`,count:x.count})),'이동 경로')}</section><section class="panel"><h2>유입 · 이용 환경</h2>${table((d.sources||[]).map(x=>({...x,name:({direct:'직접 / 내부 이동',search:'검색 엔진',social:'소셜',referral:'기타 외부 링크'})[x.name]||x.name})),'유입 유형')}${table((d.devices||[]).map(x=>({...x,name:({desktop:'데스크톱',tablet:'태블릿',mobile:'모바일'})[x.name]||x.name})),'환경 · 방문 세션')}</section></div><div class="notice" style="margin-top:22px">검색 ${Number(d.searches||0)}회 · 결과 없는 검색 ${Number(d.empty_searches||0)}회 · 보고된 클라이언트 오류 ${Number(d.errors||0)}회. 검색어와 오류 본문은 저장하지 않습니다. 전환 시간은 메뉴 표시까지의 실험적 측정값이며 Core Web Vitals INP와는 다릅니다.</div>`;
  }
  async function load(){if(!account)return;const ticket=++request;busy=true;$('refresh').disabled=true;$('analyticsResult').replaceChildren();$('adminStatus').textContent='이용 통계를 불러오고 있습니다…';$('adminStatus').classList.remove('admin-error');
    try{const {data,error}=await sb.rpc('othub_admin_metrics',{p_days:Number($('period').value)});if(ticket!==request)return;if(error)throw error;render(data);$('adminStatus').textContent=`최종 조회 ${new Date().toLocaleTimeString('ko-KR')} · 실시간 집계`;}
    catch(error){if(ticket!==request)return;$('adminStatus').classList.add('admin-error');$('adminStatus').textContent=['42501','PGRST301'].includes(error.code)?'이 계정에는 관리자 권한이 없습니다. 운영자가 관리자 등록을 완료해야 합니다.':['PGRST202','42883'].includes(error.code)?'통계 데이터베이스가 아직 연결되지 않았습니다. 운영 설정 문서에 따라 통계 마이그레이션을 적용해 주세요.':'통계를 불러오지 못했습니다. 연결을 확인하고 새로고침해 주세요.';}
    finally{if(ticket===request){busy=false;$('refresh').disabled=false;}}
  }
  function auth(state){
    if(state.error){request++;busy=false;$('refresh').disabled=false;$('analyticsResult').replaceChildren();$('adminRetry').hidden=false;$('adminStatus').textContent='로그인 서버에 연결할 수 없습니다. 네트워크를 확인하고 다시 시도해 주세요.';if(!account)$('adminLogin').hidden=false;return;}
    if(!state.ready)return;
    $('adminRetry').hidden=true;
    const next=state.session?.user?.id||state.session?.user?.email||'';
    if(next===account)return;
    request++;account=next;busy=false;$('refresh').disabled=false;
    $('adminLogin').hidden=!!account;$('adminTools').hidden=!account;$('analyticsResult').replaceChildren();
    if(account)load();else $('adminStatus').textContent='통계는 등록된 운영자에게만 공개됩니다.';
  }
  $('period').addEventListener('change',()=>load());$('refresh').addEventListener('click',()=>{if(!busy)load();});
  $('signOut').addEventListener('click',async()=>{request++;busy=false;$('refresh').disabled=false;$('analyticsResult').replaceChildren();$('signOut').disabled=true;try{await OTAuth.signOut();}catch{$('adminStatus').textContent='로그아웃하지 못했습니다. 다시 시도해 주세요.';}finally{$('signOut').disabled=false;}});
  $('adminLoginForm').addEventListener('submit',async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;try{await OTAuth.sendLink($('adminEmail').value.trim(),{admin:true});$('adminStatus').textContent='등록된 계정의 메일함에서 로그인 링크를 확인해 주세요.';}catch{$('adminStatus').textContent='로그인 링크를 보내지 못했습니다. 계정과 연결을 확인해 주세요.';}finally{button.disabled=false;}});
  OTAuth.subscribe(auth);
  async function connect(){try{sb=await OTServices.client();await OTAuth.start();OTAuth.clearCallback();}catch{auth({error:true});}}
  $('adminRetry').addEventListener('click',()=>connect());
  connect();
})();
