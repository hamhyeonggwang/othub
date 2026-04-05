(function () {
  var STORAGE_ANON = 'othub_eng_anon_v1';

  function getCfg() {
    var c = window.OT_HUB_SUPABASE || {};
    return {
      url: (c.url && String(c.url).trim()) || '',
      key: (c.anonKey && String(c.anonKey).trim()) || '',
    };
  }

  var _client = null;
  function getClient() {
    var cfg = getCfg();
    if (!cfg.url || !cfg.key) return null;
    if (typeof supabase === 'undefined' || !supabase.createClient) return null;
    if (!_client) _client = supabase.createClient(cfg.url, cfg.key);
    return _client;
  }

  function getAnonId() {
    try {
      var id = localStorage.getItem(STORAGE_ANON);
      if (!id) {
        id = typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : 'a-' + String(Date.now()) + '-' + Math.random().toString(36).slice(2);
        localStorage.setItem(STORAGE_ANON, id);
      }
      return id;
    } catch (e) {
      return 'fallback-' + String(Date.now());
    }
  }

  function likeCounts(ids) {
    var sb = getClient();
    if (!sb || !ids.length) return Promise.resolve({});
    var uniq = ids.filter(function (x, i, a) { return a.indexOf(x) === i; });
    return sb
      .from('likes')
      .select('content_id')
      .in('content_id', uniq)
      .then(function (res) {
        var m = {};
        if (res.error || !res.data) return m;
        res.data.forEach(function (row) {
          var k = row.content_id;
          m[k] = (m[k] || 0) + 1;
        });
        return m;
      });
  }

  function toggleLike(contentId) {
    var sb = getClient();
    if (!sb) return Promise.reject(new Error('no client'));
    return sb.rpc('othub_toggle_like', {
      p_content_id: contentId,
      p_anon_id: getAnonId(),
    });
  }

  function fetchComments(contentId) {
    var sb = getClient();
    if (!sb) return Promise.resolve([]);
    return sb
      .from('comments')
      .select('id, body, created_at, user_id')
      .eq('content_id', contentId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(function (res) {
        if (res.error) return [];
        return res.data || [];
      });
  }

  function postComment(contentId, body) {
    var sb = getClient();
    if (!sb) return Promise.reject(new Error('no client'));
    return sb.auth.getSession().then(function (_ref) {
      var session = _ref.data && _ref.data.session;
      if (!session) throw new Error('login required');
      return sb
        .from('comments')
        .insert({
          content_id: contentId,
          user_id: session.user.id,
          body: body.trim(),
        })
        .then(function (res) {
          if (res.error) throw res.error;
        });
    });
  }

  function signInEmail(email) {
    var sb = getClient();
    if (!sb) return Promise.reject(new Error('no client'));
    var redirect =
      window.location.origin +
      window.location.pathname +
      (window.location.search || '');
    return sb.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirect },
    });
  }

  function el(id) {
    return document.getElementById(id);
  }

  var currentCid = null;

  function closeModal() {
    var m = el('engModal');
    if (m) m.style.display = 'none';
    currentCid = null;
  }

  function fmtUser(uid) {
    if (!uid) return '사용자';
    return '회원 · ' + uid.replace(/-/g, '').slice(0, 8);
  }

  function renderComments(list) {
    var box = el('engCommentList');
    if (!box) return;
    if (!list.length) {
      box.innerHTML =
        '<p class="eng-empty">아직 댓글이 없습니다.</p>';
      return;
    }
    box.innerHTML = list
      .map(function (c) {
        var t = new Date(c.created_at);
        var ts =
          t.getFullYear() +
          '.' +
          String(t.getMonth() + 1).padStart(2, '0') +
          '.' +
          String(t.getDate()).padStart(2, '0') +
          ' ' +
          String(t.getHours()).padStart(2, '0') +
          ':' +
          String(t.getMinutes()).padStart(2, '0');
        return (
          '<div class="eng-cmt-item">' +
          '<div class="eng-cmt-meta">' +
          fmtUser(c.user_id) +
          ' · ' +
          ts +
          '</div>' +
          '<div class="eng-cmt-body"></div>' +
          '</div>'
        );
      })
      .join('');
    list.forEach(function (c, i) {
      var bodies = box.querySelectorAll('.eng-cmt-body');
      if (bodies[i]) bodies[i].textContent = c.body;
    });
  }

  function refreshModalComments() {
    if (!currentCid) return;
    fetchComments(currentCid).then(renderComments);
  }

  function openCommentModal(contentId) {
    currentCid = contentId;
    var m = el('engModal');
    var title = el('engModalTitle');
    if (!m || !title) return;
    title.textContent = '댓글 · ' + contentId;
    m.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    var sb = getClient();
    var formWrap = el('engCommentFormWrap');
    var loginWrap = el('engLoginWrap');
    var hint = el('engNoSbHint');

    if (!sb) {
      if (hint) hint.style.display = 'block';
      if (formWrap) formWrap.style.display = 'none';
      if (loginWrap) loginWrap.style.display = 'none';
      el('engCommentList').innerHTML =
        '<p class="eng-empty">Supabase 설정 후 댓글을 불러올 수 있습니다.</p>';
      return;
    }
    if (hint) hint.style.display = 'none';

    sb.auth.getSession().then(function (_ref2) {
      var session = _ref2.data && _ref2.data.session;
      if (session) {
        if (loginWrap) loginWrap.style.display = 'none';
        if (formWrap) formWrap.style.display = 'block';
      } else {
        if (loginWrap) loginWrap.style.display = 'block';
        if (formWrap) formWrap.style.display = 'none';
      }
    });

    refreshModalComments();
  }

  function refreshStripCounts() {
    var wrap = document.getElementById('lStrip');
    if (!wrap) return;
    var nodes = wrap.querySelectorAll('.l-mini[data-content-id]');
    var ids = Array.prototype.map.call(nodes, function (n) {
      return n.getAttribute('data-content-id');
    });
    var btnMap = {};
    wrap.querySelectorAll('.eng-like-btn').forEach(function (btn) {
      btnMap[btn.getAttribute('data-cid')] = btn;
    });
    if (!getClient()) {
      ids.forEach(function (id) {
        var b = btnMap[id];
        var sp = b && b.querySelector('.eng-like-cnt');
        if (sp) sp.textContent = '–';
      });
      return;
    }
    likeCounts(ids).then(function (counts) {
      ids.forEach(function (id) {
        var b = btnMap[id];
        var sp = b && b.querySelector('.eng-like-cnt');
        if (sp) sp.textContent = String((counts && counts[id]) || 0);
      });
    });
  }

  function onStripClick(e) {
    var like = e.target.closest && e.target.closest('.eng-like-btn');
    var cmt = e.target.closest && e.target.closest('.eng-cmt-btn');
    if (!like && !cmt) return;
    e.stopPropagation();
    e.preventDefault();
    if (like) {
      var cid = like.getAttribute('data-cid');
      if (!getClient()) {
        window.alert(
          'Supabase가 연결되지 않았습니다.\nsupabase-config.js에 url과 anonKey를 입력해 주세요.'
        );
        return;
      }
      toggleLike(cid)
        .then(function () {
          return refreshStripCounts();
        })
        .catch(function (err) {
          console.error(err);
          window.alert('좋아요 처리에 실패했습니다. 콘솔을 확인해 주세요.');
        });
      return;
    }
    if (cmt) {
      openCommentModal(cmt.getAttribute('data-cid'));
    }
  }

  function bindStrip() {
    var wrap = document.getElementById('lStrip');
    if (!wrap) return;
    if (!wrap.getAttribute('data-eng-del')) {
      wrap.setAttribute('data-eng-del', '1');
      wrap.addEventListener('click', onStripClick);
    }
    refreshStripCounts();
  }

  function wireModal() {
    var m = el('engModal');
    if (!m) return;
    m.addEventListener('click', function (e) {
      if (e.target === m) closeModal();
    });
    var x = el('engModalClose');
    if (x) x.addEventListener('click', closeModal);

    var loginBtn = el('engLoginSubmit');
    if (loginBtn) {
      loginBtn.addEventListener('click', function () {
        var input = el('engLoginEmail');
        if (!input || !input.value.trim()) {
          window.alert('이메일을 입력해 주세요.');
          return;
        }
        signInEmail(input.value)
          .then(function () {
            window.alert(
              '로그인 링크를 이메일로 보냈습니다. 메일함을 확인해 주세요.'
            );
          })
          .catch(function (err) {
            console.error(err);
            window.alert('로그인 요청에 실패했습니다.');
          });
      });
    }

    var sendBtn = el('engCommentSubmit');
    if (sendBtn) {
      sendBtn.addEventListener('click', function () {
        var ta = el('engCommentBody');
        if (!ta || !ta.value.trim()) {
          window.alert('댓글 내용을 입력해 주세요.');
          return;
        }
        if (!currentCid) return;
        postComment(currentCid, ta.value)
          .then(function () {
            ta.value = '';
            refreshModalComments();
            window.alert('댓글이 등록되었습니다.');
          })
          .catch(function (err) {
            console.error(err);
            window.alert('댓글 등록에 실패했습니다. 로그인 상태를 확인해 주세요.');
          });
      });
    }

    var sb = getClient();
    if (sb) {
      sb.auth.onAuthStateChange(function () {
        if (el('engModal') && el('engModal').style.display === 'flex') {
          sb.auth.getSession().then(function (_ref3) {
            var session = _ref3.data && _ref3.data.session;
            var formWrap = el('engCommentFormWrap');
            var loginWrap = el('engLoginWrap');
            if (session) {
              if (loginWrap) loginWrap.style.display = 'none';
              if (formWrap) formWrap.style.display = 'block';
            }
          });
        }
      });
    }
  }

  window.OTHubEngagement = {
    attachStrip: bindStrip,
    refreshStripCounts: refreshStripCounts,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireModal);
  } else {
    wireModal();
  }
})();
