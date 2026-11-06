(function(){
  'use strict';
  let loading,active=null,opener;
  const $=id=>document.getElementById(id),esc=value=>OTServices.escape(value);
  async function service(){
    const client=await OTServices.client();
    if(!loading)loading=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='engagement.js';script.onload=resolve;script.onerror=()=>{script.remove();loading=null;reject(new Error('댓글 기능을 불러올 수 없습니다.'));};document.head.append(script);});
    await loading;window.OTHubEngagement.useClient(client);return window.OTHubEngagement;
  }
  async function comments(id){const api=await service();const rows=await api.fetchComments(id);if(active!==id)return;
    $('communityComments').innerHTML=rows.length?rows.map(x=>`<article class="comment"><small>회원 · ${esc(new Date(x.created_at).toLocaleDateString('ko-KR'))}</small><p>${esc(x.body)}</p></article>`).join(''):'<p class="fine-print">첫 번째 의견을 남겨 주세요.</p>';
  }
  document.addEventListener('click',async e=>{const button=e.target.closest('[data-discuss]');if(!button)return;opener=button;const id=button.dataset.discuss;active=id;$('communityTitle').textContent=window.OT_CONTENT.find(x=>x.id===id)?.title||'콘텐츠 이야기';$('communityComments').replaceChildren();$('communityBody').value='';$('communityStatus').textContent='댓글을 불러오고 있어요…';$('communityDialog').showModal();
    try{await comments(id);if(active===id)$('communityStatus').textContent='';}catch{if(active===id)$('communityStatus').textContent='댓글을 불러오지 못했습니다. 잠시 후 다시 열어 주세요.';}
  });
  document.addEventListener('DOMContentLoaded',()=>{
    const dialog=$('communityDialog');
    $('communityClose').onclick=()=>dialog.close();$('communityLogin').onclick=()=>dialog.close();
    dialog.addEventListener('close',()=>{active=null;opener?.focus();});
    $('communityLike').onclick=async()=>{const id=active,button=$('communityLike');if(!id)return;button.disabled=true;try{const result=await (await service()).toggleLike(id);if(active===id)$('communityStatus').textContent=result.liked?'좋아요를 남겼어요.':'좋아요를 취소했어요.';}catch(error){if(active===id)$('communityStatus').textContent=error.code==='login_required'?'내 정보에서 로그인한 후 좋아요를 남겨 주세요.':'좋아요를 처리하지 못했습니다.';}finally{button.disabled=false;}};
    $('communityForm').onsubmit=async e=>{e.preventDefault();const id=active,body=$('communityBody').value.trim(),button=e.target.querySelector('button');if(!id||!body)return;button.disabled=true;try{await (await service()).postComment(id,body);if(active!==id)return;$('communityBody').value='';$('communityStatus').textContent='댓글을 등록했어요.';await comments(id);}catch{if(active===id)$('communityStatus').textContent='댓글을 등록하지 못했습니다. 로그인 상태와 연결을 확인해 주세요.';}finally{button.disabled=false;}};
  });
})();
