(function () {
  'use strict';
  const $ = id => document.getElementById(id), esc = OTServices.escape;
  const items = window.OT_CONTENT;
  const itemMap = new Map(items.map(x=>[x.id,x]));
  const savedKey='othub.bookmarks.v1', recentKey='othub.recent.v1';
  const readIds=key=>{const value=OTServices.read(key,[]);return Array.isArray(value)?value.filter(id=>itemMap.has(id)):[];};
  let saved=new Set(readIds(savedKey)), recent=readIds(recentKey);
  let route='', searchTimer, navigation=0, session=null;
  const pages=new Map();
  const paths={home:'M3 10l9-7 9 7v10H3z M9 20v-7h6v7',grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',play:'M9 5l11 7-11 7z',link:'M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-2 2 M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l2-2',bookmark:'M6 3h12v18l-6-4-6 4z',clock:'M12 8v5l3 2 M22 12a10 10 0 11-20 0 10 10 0 0120 0',spark:'M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z',user:'M16 7a4 4 0 11-8 0 4 4 0 018 0 M4 21v-3a8 8 0 0116 0v3',arrow:'M5 12h14 M13 6l6 6-6 6',check:'M5 12l4 4L19 6',search:'M21 21l-5-5 M18 10a8 8 0 11-16 0 8 8 0 0116 0'};
  const icon=(name,size=20)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.grid}"/></svg>`;
  const nav=[['home','홈','home'],['explore','전체 콘텐츠','grid'],['webapps','활동 · 웹앱','play'],['videos','영상 자료','play'],['siteinfo','학회 · 기관','link'],['bookmark','저장한 콘텐츠','bookmark'],['recent','최근 이용','clock'],['updates','업데이트','spark']];
  const labels=Object.fromEntries(nav.map(x=>[x[0],x[1]]));
  Object.assign(labels,{profile:'내 정보 · 설정',privacy:'이용 데이터 안내',search:'검색 결과'});
  function notify(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('toast').hidden=true,2800);}
  function group(item){return item.type==='game'?(item.title.includes('키오스크')?'일상생활 훈련':'인터랙티브 활동'):item.type==='video'?'영상 자료':'학회 · 기관';}
  function card(item){
    return `<article class="content-card" data-id="${item.id}"><div class="card-art"><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer" data-open="${item.id}" tabindex="-1" aria-hidden="true"><img src="${esc(item.img)}" alt="" width="400" height="300" loading="lazy" decoding="async"></a><span class="card-kind">${group(item)}</span><button class="save-button${saved.has(item.id)?' saved':''}" data-save="${item.id}" aria-label="${esc(item.title)} 저장" aria-pressed="${saved.has(item.id)}">${icon('bookmark',17)}</button></div><div class="card-body"><span class="card-eyebrow">${item.type==='game'?'ACTIVITY':item.type==='video'?'WATCH & LEARN':'RESOURCE'}</span><h3><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer" data-open="${item.id}">${esc(item.title)}</a></h3><div class="card-foot"><span>${esc(item.ch||item.tag||'OT Hub')}</span><span aria-hidden="true">↗</span></div></div></article>`;
  }
  const grid=list=>`<div class="content-grid">${list.map(item=>card(item).replace('</article>',`${item.id!=='g1'?`<button class="discuss-button" data-discuss="${item.id}" aria-label="${esc(item.title)} 댓글과 좋아요">댓글 · 좋아요 <span>↗</span></button>`:''}</article>`)).join('')}</div>`;
  const empty=(title,description)=>`<div class="empty-state">${icon('bookmark',30)}<h2>${title}</h2><p>${description}</p><a class="button primary" href="#explore">콘텐츠 둘러보기 ${icon('arrow',17)}</a></div>`;
  const heading=(eyebrow,title,description,extra='')=>`<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${description}</p></div>${extra}</div>`;
  const section=(title,subtitle,link)=>`<div class="section-heading"><div><h2>${title}</h2><p>${subtitle}</p></div>${link?`<a href="#${link}">전체 보기 ${icon('arrow',16)}</a>`:''}</div>`;
  function home(){
    const hero=itemMap.get('g8')||items.find(x=>x.type==='game');
    const toolCopy={
      g6:['일상생활 훈련','메뉴를 고르고 주문을 완료하는 과정을 차근차근 연습합니다.','로그인 없이 시작'],
      g7:['일상생활 훈련','상품을 선택하고 주문하는 생활 속 화면을 익힙니다.','로그인 없이 시작'],
      g16:['인터랙티브 활동','손을 움직여 화면 위에 그림을 그리는 활동입니다.','카메라 안내 제공']
    };
    const tools=['g6','g7','g16'].map(id=>itemMap.get(id)).filter(Boolean);
    const external=item=>/^https?:/i.test(item.url)?' target="_blank" rel="noopener noreferrer"':'';
    return `<div class="page homepage">
      <section class="hero" id="home">
        <div class="public-container hero__grid">
          <div class="hero__copy">
            <h1>오늘 필요한 일상을,<br>먼저 연습하세요.</h1>
            <p class="hero__lead">로그인 없이 작업치료 활동과 자료를 바로 시작할 수 있어요.</p>
            <div class="hero__actions"><a class="button button--dark" href="#webapps">활동 시작하기</a><a class="text-link" href="#videos">자료 둘러보기</a></div>
            <p class="hero__note">카메라가 필요한 도구는 시작 전에 안내합니다.</p>
          </div>
          <figure class="hero-product">
            <a class="hero-product__link" href="${esc(hero.url)}" data-open="${esc(hero.id)}"${external(hero)}>
              <div class="screen-stage"><img src="${esc(hero.img)}" alt="${esc(hero.title)} 시작 화면" width="400" height="300"></div>
            </a>
            <figcaption><strong>${esc(hero.title)}</strong><span>스캔부터 결제까지, 실제 생활의 순서를 연습합니다.</span></figcaption>
          </figure>
        </div>
      </section>

      <section class="choice-section" aria-labelledby="choice-title"><div class="public-container">
        <div class="section-heading"><h2 id="choice-title">어디서 시작할까요?</h2><p>필요한 활동으로 바로 이동하세요.</p></div>
        <div class="choice-grid">
          <a class="choice" href="#webapps"><span class="choice__index">01</span><span><strong>일상 활동</strong><small>주문, 결제, 손 동작처럼 직접 해보는 도구</small></span></a>
          <a class="choice" href="#videos"><span class="choice__index">02</span><span><strong>작업치료 자료</strong><small>영상과 참고 링크를 한곳에서 찾기</small></span></a>
          <a class="choice" href="#profile"><span class="choice__index">03</span><span><strong>치료사 공간</strong><small>저장하고 의견을 나누며 작업 이어가기</small></span></a>
        </div>
      </div></section>

      <section class="tools-section" aria-labelledby="tools-title"><div class="public-container">
        <div class="section-heading section-heading--split"><div><h2 id="tools-title">일상에서 바로 연습하는 도구</h2><p>브라우저에서 열고, 나에게 맞는 속도로 시작하세요.</p></div><a class="text-link" href="#webapps">전체 도구 보기</a></div>
        <div class="tool-list">${tools.map(item=>{const copy=toolCopy[item.id]||['인터랙티브 활동','나에게 맞는 속도로 화면을 따라가며 연습합니다.','로그인 없이 시작'];return `<article class="tool-row"><img src="${esc(item.img)}" alt="${esc(item.title)} 화면" width="400" height="300" loading="lazy" decoding="async"><div class="tool-row__body"><span class="tool-row__type">${esc(copy[0])}</span><h3>${esc(item.title)}</h3><p>${esc(copy[1])}</p><a class="text-link" href="${esc(item.url)}" data-open="${esc(item.id)}"${external(item)}>도구 시작하기</a></div><span class="tool-row__state">${esc(copy[2])}</span></article>`;}).join('')}</div>
      </div></section>

      <section class="practice-section" aria-labelledby="practice-title"><div class="public-container practice__grid"><div><h2 id="practice-title">활동을 고르는 기준도 함께 보세요.</h2><p>도구 이름만 나열하지 않고, 어떤 일상을 연습하는지부터 설명합니다.</p></div><dl class="practice-list"><div><dt>생활 장면</dt><dd>주문하고, 계산하고, 움직이는 실제 순서</dd></div><div><dt>사용 방법</dt><dd>카메라와 오디오처럼 시작 전에 알아야 할 조건</dd></div><div><dt>다음 행동</dt><dd>저장하고 다시 찾아볼 수 있는 개인 공간</dd></div></dl></div></section>

      <section class="resources-section" aria-labelledby="resources-title"><div class="public-container resources__grid"><div><h2 id="resources-title">자료는 필요한 만큼만.</h2><p>작업치료 영상과 학회·기관 링크를 별도 흐름으로 찾아볼 수 있습니다.</p></div><div class="resource-links"><a href="#videos"><strong>영상 자료</strong><span>치료사의 설명과 현장 이야기를 보기</span></a><a href="#siteinfo"><strong>학회·기관</strong><span>필요한 공식 사이트로 이동하기</span></a></div></div></section>

      <section class="therapist-section" aria-labelledby="therapist-title"><div class="public-container therapist__grid"><div><h2 id="therapist-title">필요한 만큼, 편하게 시작하세요.</h2><p>공개 도구는 누구나 시작하고, 계정 기능은 원하는 사람만 이어서 사용합니다.</p></div><div class="audience-blocks"><div class="audience-block"><h3>누구나</h3><p>로그인 없이 활동을 경험하고, 이 브라우저에 콘텐츠를 저장할 수 있어요.</p><a class="text-link" href="#webapps">도구 둘러보기</a></div><div class="audience-block"><h3>회원과 치료사</h3><p>로그인하면 저장과 의견 기능을 이어서 사용할 수 있어요.</p><a class="text-link" href="#profile">내 공간 열기</a></div></div></div></section>

      <section class="updates-section" aria-labelledby="updates-title"><div class="public-container updates__inner"><div><h2 id="updates-title">조금씩 더 좋아지는 OT Hub</h2><p>새로운 기능과 개선 내용은 공개 기록으로 남깁니다.</p></div><a class="button button--light" href="#updates">업데이트 보기</a></div></section>
    </div>`;
  }
  function catalogue(type){let list=type==='explore'?items:items.filter(x=>x.type===({webapps:'game',videos:'video',siteinfo:'info'}[type]));return heading('CONTENT LIBRARY',labels[type],`${list.length}개의 콘텐츠 · 관심 있는 활동을 선택해 보세요.`)+`<div class="filter-row">${[['explore','전체'],['webapps','활동 · 웹앱'],['videos','영상'],['siteinfo','학회 · 기관']].map(([id,label])=>`<a class="filter${type===id?' active':''}" href="#${id}"${type===id?' aria-current="page"':''}>${label}</a>`).join('')}</div>`+grid(list);}
  function updates(){return heading('PRODUCT UPDATES','함께 만들어가는 OT Hub','새로운 기능, 개선 사항, 앞으로의 방향을 투명하게 공유합니다.')+`<div class="updates-layout"><div>${OT_RELEASES.map(r=>`<article class="release panel"><div class="release-meta"><span class="release-version">v${esc(r.version)}</span><time>${esc(r.date)}</time><span class="soft-badge">${esc(r.status)}</span></div><h2>${esc(r.title)}</h2><p>${esc(r.summary)}</p><ul>${r.changes.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></article>`).join('')}</div><aside class="panel roadmap"><span class="eyebrow">UP NEXT</span><h2>앞으로의 방향</h2>${OT_ROADMAP.map(r=>`<div class="roadmap-item"><span>${esc(r.phase)} · ${esc(r.state)}</span><h3>${esc(r.title)}</h3><p>${esc(r.description)}</p></div>`).join('')}<small>우선순위는 실제 이용과 의견에 따라 조정됩니다.</small></aside></div>`;}
  function privacy(){return heading('YOUR CHOICE','이용 데이터 안내','더 나은 서비스와 나의 선택을 함께 생각합니다.')+`<section class="panel prose"><h2>어떤 정보를 사용하나요?</h2><p>선택적으로 동의한 브라우저에서 메뉴 방문, 콘텐츠 열기, 검색 결과 수, 화면 전환 시간, 기기 크기 구분과 유입 유형을 수집하도록 설계했습니다. 검색어 원문, 이메일, 이름, 환자 정보, 카메라 영상, 댓글 본문은 이 통계에 포함하지 않습니다.</p><h2>방문을 어떻게 구분하나요?</h2><p>통계용 임의 세션 ID로 같은 탭의 방문을 구분하며, 30분 동안 활동이 없으면 새 방문으로 계산합니다. 따라서 방문 수는 실제 사람 수와 다를 수 있습니다. 콘텐츠 열기는 실행 링크 클릭이며 훈련 완료를 의미하지 않습니다.</p><h2>저장과 보관</h2><p>북마크와 최근 이용 목록은 이 브라우저에 저장합니다. 통계 연결 시 수집한 이벤트는 운영자만 집계 조회하며, 90일 보관 후 정리하도록 운영합니다. 통신 과정에서 호스팅·인증 제공업체가 처리하는 접속 기록은 이 선택적 통계와 별개입니다.</p><h2>언제든 선택을 바꿀 수 있어요</h2><p>수집을 끄면 이후 전송과 대기 중인 이벤트를 중단합니다. 브라우저의 추적 거부 설정도 존중합니다. 서비스 개선에 동의하지 않아도 콘텐츠를 이용할 수 있습니다.</p><a class="button primary" href="#profile">내 이용 설정 ${icon('arrow',16)}</a><p class="fine-print">이 안내는 선택적 이용 통계의 범위입니다. 공개 서비스의 전체 개인정보처리방침·이용약관과 운영 연락처는 출시 전 확정 예정입니다.</p></section>`;}
  function profile(){return heading('MY WORKSPACE','내 정보 · 설정','내 콘텐츠를 관리하고, 데이터 이용 방식을 선택하세요.')+`<div class="settings-grid"><section class="panel"><span class="eyebrow">ACCOUNT</span><h2>나의 계정</h2><div id="accountState"><p>이메일로 로그인하면 좋아요·댓글 등 계정 기능을 이용할 수 있어요.</p><form id="loginForm" class="login-form"><label for="loginEmail">이메일</label><input id="loginEmail" type="email" autocomplete="email" required placeholder="you@example.com"><button class="button primary" type="submit">로그인 링크 받기</button></form><button class="text-button" data-action="check-session">로그인 상태 확인</button></div><p class="inline-status" id="authMessage" role="status"></p></section><section class="panel"><span class="eyebrow">PRIVACY & STORAGE</span><h2>내 이용 설정</h2><label class="consent-row"><span><strong>서비스 개선 통계에 참여</strong><small>방문과 콘텐츠 이용 패턴을 공유해요.</small></span><input id="analyticsConsent" type="checkbox" role="switch" ${OTAnalytics.consent()?'checked':''}></label><p class="fine-print">${window.OT_HUB_ANALYTICS_ENABLED?'동의한 경우에만 수집합니다. 추적 거부가 켜진 브라우저에서는 전송하지 않습니다.':'현재 통계 연결 전입니다. 선택은 저장되며 운영 연결 후 적용됩니다.'}</p><a class="text-link" href="#privacy">수집 범위 자세히 보기 ↗</a><hr><h3>이 기기의 콘텐츠</h3><p>저장한 콘텐츠 ${saved.size}개 · 최근 이용 ${recent.length}개</p><button class="button secondary" data-action="clear-recent">최근 이용 기록 비우기</button><p class="fine-print">북마크와 최근 기록은 계정 간·기기 간 동기화되지 않습니다.</p></section></div>`;}
  function renderPage(id){if(id==='home')return home();if(['explore','webapps','videos','siteinfo'].includes(id))return catalogue(id);if(id==='updates')return updates();if(id==='privacy')return privacy();if(id==='profile')return profile();const list=(id==='bookmark'?[...saved]:recent).map(x=>itemMap.get(x)).filter(Boolean);return heading('MY COLLECTION',labels[id],id==='bookmark'?'다시 찾고 싶은 콘텐츠를 가까이에. 이 브라우저에 저장됩니다.':'이 브라우저에서 최근에 열어 본 콘텐츠입니다.')+(list.length?grid(list):empty(id==='bookmark'?'아직 저장한 콘텐츠가 없어요':'첫 활동을 시작해 보세요',id==='bookmark'?'카드의 책갈피를 누르면 여기에 모아 볼 수 있어요.':'이용한 콘텐츠를 여기에서 다시 찾아볼 수 있어요.'));}
  function invalidate(...ids){ids.forEach(id=>pages.delete(id));}
  function syncNavigation(id){document.querySelectorAll('[data-route]').forEach(a=>{const on=a.dataset.route===id;a.classList.toggle('active',on);on?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current');});const breadcrumb=$('breadcrumb');if(breadcrumb)breadcrumb.textContent=labels[id]||'검색 결과';document.title=`${labels[id]||'검색 결과'} · OT Hub`;}
  function navigate(id,{force=false,focus=false}={}){
    if(!labels[id] || id==='search')id='home';
    clearTimeout(searchTimer);
    if(route===id && !force && !$('searchInput').value)return;
    const start=performance.now(), token=++navigation;
    route=id; $('searchInput').value=''; syncNavigation(id);
    if(!pages.has(id)){const node=document.createElement('div');node.className='page';node.innerHTML=renderPage(id);pages.set(id,node);}
    $('view').replaceChildren(pages.get(id));
    refreshSavedButtons();
    $('main').scrollTop=0;
    if(window.innerWidth<768)window.scrollTo({top:0,behavior:'instant'});
    if(focus)$('main').focus({preventScroll:true});
    if(id==='profile'){paintAccount();OTAuth.start().catch(()=>{});}
    OTAnalytics.page(id);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(token!==navigation)return;
      const duration=Math.round(performance.now()-start);
      window.OT_NAV_TIMING={route:id,duration};
      OTAnalytics.track('navigation',{route:id,value:duration});
    }));
  }
  function search(){const q=$('searchInput').value.trim().slice(0,120);if(!q){navigate(location.hash.slice(1)||'home',{force:true});return;}
    route='search';navigation++;syncNavigation('search');const needle=q.toLocaleLowerCase();
    const list=items.filter(x=>[x.title,x.ch,x.tag,...(x.tags||[])].join(' ').toLocaleLowerCase().includes(needle));
    $('view').innerHTML=`<div class="page">${heading('SEARCH RESULTS',`“${esc(q)}” 검색 결과`,`${list.length}개의 콘텐츠를 찾았습니다.`)}${list.length?grid(list):empty('검색 결과가 없어요','다른 활동명이나 키워드로 다시 찾아보세요.')}</div>`;
    OTAnalytics.track('search',{route:'search',value:list.length});
  }
  function refreshSavedButtons(){document.querySelectorAll('[data-save]').forEach(b=>{const on=saved.has(b.dataset.save);b.classList.toggle('saved',on);b.setAttribute('aria-pressed',on);});}
  function paintAccount(){const el=$('accountState');if(!el)return;
    const key=session?.user?.id||session?.user?.email||'';
    if((el.dataset.account||'')===key)return;
    if(!session){const template=document.createElement('div');template.innerHTML=profile();el.replaceChildren(...template.querySelector('#accountState').childNodes);}
    else el.innerHTML=`<p class="signed-in">${icon('check',18)} 로그인됨</p><p>${esc(session.user.email||'회원')}</p><button class="button secondary" data-action="logout">로그아웃</button>`;
    el.dataset.account=key;
  }
  OTAuth.subscribe(state=>{
    const changed=(session?.user?.id||session?.user?.email||'')!==(state.session?.user?.id||state.session?.user?.email||'');
    session=state.session;
    if(changed)invalidate('profile');
    paintAccount();
    const identity=$('accountIdentity');if(identity)identity.textContent=session?'로그인됨':'내 공간';
    const avatar=$('accountAvatar');if(avatar)avatar.textContent=session?.user?.email?.slice(0,1).toUpperCase()||'OT';
    if(state.error&&$('authMessage'))$('authMessage').textContent='로그인 상태를 확인하지 못했습니다. 다시 시도해 주세요.';
  });
  async function checkSession(){try{await OTAuth.start();if(!session&&$('authMessage'))$('authMessage').textContent='로그인하지 않은 상태입니다.';}catch(error){notify(error.message);}}
  $('primaryNav').innerHTML=[['webapps','도구'],['videos','자료'],['profile','치료사 공간']].map(([id,label])=>`<a href="#${id}" data-route="${id}">${label}</a>`).join('')+'<a href="about.html">소개</a>';
  $('mobileNav').innerHTML=[['home','홈','home'],['webapps','도구','play'],['videos','자료','play'],['profile','내 공간','user']].map(([id,label,glyph])=>`<a href="#${id}" data-route="${id}">${icon(glyph)}<span>${label}</span></a>`).join('');
  document.addEventListener('click',async event=>{
    const save=event.target.closest('[data-save]');
    if(save){const id=save.dataset.save;const next=new Set(saved);next.has(id)?next.delete(id):next.add(id);if(!OTServices.write(savedKey,[...next]))return notify('브라우저 저장 공간을 사용할 수 없습니다.');saved=next;invalidate('home','bookmark','profile');refreshSavedButtons();if(route==='bookmark')navigate('bookmark',{force:true});notify(saved.has(id)?'내 콘텐츠에 저장했어요.':'저장을 해제했어요.');return;}
    const open=event.target.closest('[data-open]');
    if(open){const id=open.dataset.open;recent=[id,...recent.filter(x=>x!==id)].slice(0,20);OTServices.write(recentKey,recent);invalidate('recent','home','profile');OTAnalytics.track('content_open',{content_id:id,route});return;}
    const action=event.target.closest('[data-action]')?.dataset.action;
    if(action==='clear-recent'){if(!OTServices.write(recentKey,[]))return notify('기록을 비울 수 없습니다.');recent=[];invalidate('recent','home','profile');navigate('profile',{force:true});notify('최근 이용 기록을 비웠어요.');}
    if(action==='check-session')checkSession();
    if(action==='logout'){const button=event.target.closest('[data-action]');button.disabled=true;try{await OTAuth.signOut();notify('로그아웃했어요.');}catch(e){notify('로그아웃하지 못했습니다. 다시 시도해 주세요.');}finally{button.disabled=false;}}
    const hash=event.target.closest('a[href^="#"]');if(hash && labels[hash.hash.slice(1)] && hash.hash===location.hash){event.preventDefault();navigate(hash.hash.slice(1),{force:true,focus:true});}
  });
  document.addEventListener('change',e=>{if(e.target.id==='analyticsConsent'){const value=e.target.checked;if(!OTAnalytics.setConsent(value)){e.target.checked=!value;return notify('설정을 저장할 수 없습니다.');}invalidate('profile');notify(value?'통계 참여 설정을 저장했어요.':'통계 참여를 해제했어요.');}});
  document.addEventListener('submit',async e=>{if(e.target.id!=='loginForm')return;e.preventDefault();const email=$('loginEmail').value.trim();const button=e.target.querySelector('button');button.disabled=true;const message=$('authMessage');message.textContent='로그인 링크를 보내고 있어요…';try{await OTAuth.sendLink(email);message.textContent='메일함에서 로그인 링크를 확인해 주세요.';}catch(error){message.textContent='로그인 링크를 보내지 못했습니다. 이메일과 연결을 확인해 주세요.';}finally{button.disabled=false;}});
  $('searchForm').addEventListener('submit',e=>{e.preventDefault();clearTimeout(searchTimer);search();});
  $('searchInput').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(search,120);});
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!/INPUT|TEXTAREA/.test(document.activeElement.tagName)){e.preventDefault();$('searchInput').focus();}if(e.key==='Escape'&&document.activeElement===$('searchInput')){$('searchInput').value='';navigate(location.hash.slice(1),{force:true});}});
  window.addEventListener('hashchange',()=>navigate(location.hash.slice(1),{focus:true}));
  window.addEventListener('storage',e=>{if([savedKey,recentKey].includes(e.key)){saved=new Set(readIds(savedKey));recent=readIds(recentKey);pages.clear();if(route==='search')search();else navigate(route,{force:true});}});
  // Supabase implicit callbacks use the fragment; preserve it until the SDK consumes it.
  if(/access_token=|error_description=/.test(location.hash)||new URLSearchParams(location.search).has('code')){
    navigate('profile');OTAuth.start().then(()=>OTAuth.clearCallback()).catch(()=>{});
  }else navigate(location.hash.slice(1)||'home');
})();
