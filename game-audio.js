/**
 * OT Hub — Web Audio 효과음 (외부 파일 불필요)
 * window.GameAudio.resume() — 첫 제스처 후 AudioContext 활성화
 */
(function (global) {
  var _ac = null;
  var _lastUiTap = 0;

  function getAc() {
    if (!_ac) {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      _ac = new AC();
    }
    return _ac;
  }

  function resume() {
    try {
      var c = getAc();
      if (c && c.state === 'suspended') c.resume();
    } catch (e) {}
  }

  function tone(freq, type, dur, vol, delaySec) {
    try {
      var c = getAc();
      if (!c) return;
      var t0 = c.currentTime + (delaySec || 0);
      var o = c.createOscillator();
      var g = c.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(vol == null ? 0.2 : vol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g);
      g.connect(c.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.03);
    } catch (e) {}
  }

  function playTone(freq, type, dur, vol) {
    resume();
    tone(freq, type, dur, vol);
  }

  function tap() {
    resume();
    tone(660, 'sine', 0.045, 0.14);
    tone(880, 'sine', 0.055, 0.09, 0.02);
  }

  function throttledTap() {
    var n = Date.now();
    if (n - _lastUiTap < 75) return;
    _lastUiTap = n;
    tap();
  }

  function pop() {
    resume();
    tone(380, 'sine', 0.07, 0.2);
    tone(520, 'triangle', 0.1, 0.14, 0.04);
  }

  function error() {
    resume();
    tone(200, 'sawtooth', 0.12, 0.11);
    tone(160, 'sawtooth', 0.14, 0.09, 0.06);
  }

  function success() {
    resume();
    tone(523, 'sine', 0.1, 0.16);
    tone(659, 'sine', 0.1, 0.12, 0.09);
    tone(784, 'sine', 0.14, 0.11, 0.18);
  }

  function fanfare() {
    resume();
    [523, 659, 784, 988, 1047].forEach(function (f, i) {
      tone(f, i < 3 ? 'sine' : 'triangle', 0.16, 0.15, i * 0.11);
    });
  }

  var PITCHES = {
    red: 440,
    blue: 523,
    yellow: 587,
    green: 494,
    orange: 659,
    pink: 784,
    rainbow: 1047,
  };

  function catchColor(name) {
    resume();
    var f = PITCHES[name] || 440;
    tone(f, 'sine', 0.12, 0.28);
    tone(f * 1.5, 'sine', 0.08, 0.14, 0.02);
    tone(f * 2, 'triangle', 0.06, 0.1, 0.04);
  }

  function feverStart() {
    resume();
    [523, 659, 784, 1047].forEach(function (f, i) {
      tone(f, 'square', 0.14, 0.18, i * 0.065);
    });
  }

  function star() {
    resume();
    tone(1000 + Math.random() * 600, 'sine', 0.06, 0.18);
  }

  function combo(n) {
    resume();
    tone(300 + n * 45, 'triangle', 0.1, 0.22);
  }

  function gameStart() {
    resume();
    tone(392, 'sine', 0.1, 0.15);
    tone(523, 'sine', 0.12, 0.14, 0.1);
    tone(659, 'triangle', 0.1, 0.12, 0.2);
  }

  function gameEnd() {
    resume();
    tone(784, 'sine', 0.15, 0.1);
    tone(659, 'sine', 0.18, 0.12, 0.12);
    tone(523, 'sine', 0.22, 0.14, 0.28);
    tone(392, 'triangle', 0.28, 0.12, 0.42);
  }

  /** 키오스크 등: 버튼·터치 영역 클릭 시 */
  function bindUiTap(root) {
    var rootEl = root ? (typeof root === 'string' ? document.querySelector(root) : root) : document;
    if (!rootEl || rootEl._gaUiBound) return;
    rootEl._gaUiBound = true;
    rootEl.addEventListener(
      'click',
      function (e) {
        var el = e.target.closest(
          'button, [role="button"], .btn, .sw, .bp, .dfb, .temp-btn, .size-btn, .cm-btn, .idle-touch-btn, .wmrev, .qnxt, .tap, .key, .tpbtn, .num-key, .menu-item, .option-btn'
        );
        if (!el) return;
        throttledTap();
      },
      true
    );
  }

  global.GameAudio = {
    resume: resume,
    playTone: playTone,
    tap: tap,
    throttledTap: throttledTap,
    pop: pop,
    error: error,
    success: success,
    fanfare: fanfare,
    catchColor: catchColor,
    feverStart: feverStart,
    star: star,
    combo: combo,
    gameStart: gameStart,
    gameEnd: gameEnd,
    bindUiTap: bindUiTap,
  };
})(typeof window !== 'undefined' ? window : this);
