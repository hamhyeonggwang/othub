/**
 * 키오스크 트레이너 공통 셸 — 5개 kiosk-trainer HTML(homeplus/korail/maratang/paik/photobooth)에서
 * 바이트 단위로 동일하거나 토큰 1개만 다른 컨트롤 함수를 팩토리로 제공.
 * setMission/resetAll/goScr 등 키오스크별 로직은 각 파일에 그대로 둔다.
 *
 * @param {object} S 각 파일의 상태 객체 (difficulty/opts/stats/panelOpen 등)
 * @param {object} [config]
 * @param {string} [config.mhideKey='hide'] 미션-숨김 옵션의 S.opts 키 ('hide' 또는 'mhide')
 * @param {number} [config.toastMs=2200] 토스트 표시 시간(ms)
 * @param {boolean} [config.trackPanelOpen=false] togPanel이 S.panelOpen을 갱신할지 여부
 */
(function (global) {
  function createTrainerShell(S, config) {
    config = config || {};
    var mhideKey = config.mhideKey || 'hide';
    var toastMs = config.toastMs || 2200;
    var trackPanelOpen = !!config.trackPanelOpen;
    var toastT;

    function showToast(msg) {
      var t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(toastT);
      toastT = setTimeout(function () { t.classList.remove('show'); }, toastMs);
    }

    function togPanel() {
      var p = document.getElementById('tp');
      var b = document.getElementById('ptbtn');
      p.classList.toggle('col');
      if (trackPanelOpen) {
        S.panelOpen = !p.classList.contains('col');
        b.classList.toggle('open', S.panelOpen);
      } else {
        b.classList.toggle('open', !p.classList.contains('col'));
      }
    }

    function togOpt(k, el) {
      S.opts[k] = !S.opts[k];
      el.classList.toggle('on');
      if (k === 'mission') document.getElementById('wmbar').style.display = S.opts.mission ? 'block' : 'none';
      if (k === mhideKey) updateWmBar();
    }

    function updateWmBar() {
      var t = document.getElementById('wmtask');
      var r = document.getElementById('wmrev');
      if (!t) return;
      t.textContent = S.mission;
      if (S.opts[mhideKey]) {
        t.classList.add('blr');
        r.style.display = 'block';
      } else {
        t.classList.remove('blr');
        r.style.display = 'none';
      }
      document.getElementById('wmbar').style.display = S.opts.mission ? 'block' : 'none';
    }

    function revealMs() {
      var t = document.getElementById('wmtask');
      var r = document.getElementById('wmrev');
      t.classList.remove('blr');
      r.style.display = 'none';
      setTimeout(function () {
        if (S.opts[mhideKey]) {
          t.classList.add('blr');
          r.style.display = 'block';
        }
      }, 3000);
    }

    function setDiff(d, el, DIFF_INFO, afterSetMission) {
      S.difficulty = d;
      document.querySelectorAll('.dfb').forEach(function (b) { b.className = 'dfb'; });
      el.className = 'dfb a' + d;
      document.getElementById('ddt').textContent = DIFF_INFO[d].tag;
      document.getElementById('ddb').innerHTML = DIFF_INFO[d].desc;
      afterSetMission();
    }

    function updateStats() {
      document.getElementById('st-t').textContent = S.stats.trials;
      document.getElementById('st-c').textContent = S.stats.correct;
      var p = S.stats.trials > 0 ? Math.round(S.stats.correct / S.stats.trials * 100) : 0;
      document.getElementById('st-p').textContent = p + '%';
    }

    return {
      showToast: showToast,
      togPanel: togPanel,
      togOpt: togOpt,
      updateWmBar: updateWmBar,
      revealMs: revealMs,
      setDiff: setDiff,
      updateStats: updateStats,
    };
  }

  global.createTrainerShell = createTrainerShell;
})(typeof window !== 'undefined' ? window : this);
