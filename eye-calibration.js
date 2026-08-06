/**
 * 시선 캘리브레이션 공통 모듈 — writing-game-v1.html / gazeplay_v1.html에서
 * 로직이 100% 동일했던 부분(9점 타깃, 표본 수집, 선형 보정 계산)만 추출.
 * 원시 좌표 취득(getGaze)과 완료 후 처리(onFinish)는 게임마다 달라 콜백으로 주입받는다.
 *
 * @param {object} config
 * @param {function(): {x:number,y:number}} config.getGaze 현재 원시 시선 좌표
 * @param {function(): boolean} [config.guard] true를 반환해야 캘리브레이션 시작
 * @param {function(object)} [config.onFinish] 계산 완료 후 eyeCalib를 받아 실행할 게임별 훅
 */
(function (global) {
  var CALIB_TARGETS = [
    { nx: .5, ny: .5 },
    { nx: .05, ny: .05 },
    { nx: .95, ny: .05 },
    { nx: .05, ny: .95 },
    { nx: .95, ny: .95 },
    { nx: .5, ny: .05 },
    { nx: .5, ny: .95 },
    { nx: .05, ny: .5 },
    { nx: .95, ny: .5 },
  ];

  function createEyeCalibration(config) {
    config = config || {};
    var getGaze = config.getGaze || function () { return { x: 0, y: 0 }; };
    var guard = config.guard || function () { return true; };
    var onFinish = config.onFinish || function () {};

    var eyeCalib = {
      points: [],
      offsetX: 0, offsetY: 0,
      scaleX: 1.0, scaleY: 1.0,
      centerRawX: 0, centerRawY: 0,
      manualOffsetX: 0, manualOffsetY: 0,
      manualScaleX: 1.0, manualScaleY: 1.0,
      smoothing: 0.6,
      calibrated: false,
    };

    var calibIdx = 0;
    var calibCollecting = false;
    var calibTimer = null;

    function openCalib() {
      if (!guard()) return;
      calibIdx = 0;
      eyeCalib.points = [];
      var overlay = document.getElementById('calib-overlay');
      var arena = document.getElementById('calib-arena');
      overlay.classList.add('open');
      document.getElementById('calib-close-btn').style.display = 'none';
      buildCalibDots(arena);
      document.getElementById('calib-progress-text').textContent = '0 / ' + CALIB_TARGETS.length + ' 완료';
      startCalibTarget(0);
    }

    function buildCalibDots(arena) {
      arena.innerHTML = '';
      CALIB_TARGETS.forEach(function (t, i) {
        var dot = document.createElement('div');
        dot.className = 'calib-dot';
        dot.id = 'cdot-' + i;
        dot.style.left = (t.nx * window.innerWidth) + 'px';
        dot.style.top = (t.ny * window.innerHeight) + 'px';
        dot.textContent = '👁️';
        if (i > 0) dot.style.opacity = '0.3';
        dot.addEventListener('click', function () { forceCollectCalib(i); });
        arena.appendChild(dot);
      });
    }

    function startCalibTarget(idx) {
      if (idx >= CALIB_TARGETS.length) { finishCalib(); return; }
      calibIdx = idx;
      CALIB_TARGETS.forEach(function (_, i) {
        var d = document.getElementById('cdot-' + i);
        if (d) d.style.opacity = i === idx ? '1' : '0.3';
      });
      document.getElementById('calib-sub').textContent =
        '(' + (idx + 1) + '/' + CALIB_TARGETS.length + ') 노란 점 👁️ 을 바라보세요!';
      calibCollecting = true;
      calibTimer = setTimeout(function () { collectCalibSample(idx); }, 1500);
    }

    function forceCollectCalib(idx) {
      if (idx !== calibIdx) return;
      clearTimeout(calibTimer);
      collectCalibSample(idx);
    }

    function collectCalibSample(idx) {
      if (!calibCollecting) return;
      calibCollecting = false;
      var t = CALIB_TARGETS[idx];
      var gaze = getGaze();
      eyeCalib.points.push({
        rawX: gaze.x, rawY: gaze.y,
        screenX: t.nx * window.innerWidth, screenY: t.ny * window.innerHeight,
      });
      var d = document.getElementById('cdot-' + idx);
      if (d) { d.classList.add('done'); d.textContent = '✅'; }
      document.getElementById('calib-progress-text').textContent =
        (idx + 1) + ' / ' + CALIB_TARGETS.length + ' 완료';
      setTimeout(function () { startCalibTarget(idx + 1); }, 400);
    }

    function finishCalib() {
      var pts = eyeCalib.points;
      if (pts.length < 2) return;
      var rawXs = pts.map(function (p) { return p.rawX; });
      var rawYs = pts.map(function (p) { return p.rawY; });
      var scrXs = pts.map(function (p) { return p.screenX; });
      var scrYs = pts.map(function (p) { return p.screenY; });
      var minRX = Math.min.apply(null, rawXs), maxRX = Math.max.apply(null, rawXs);
      var minRY = Math.min.apply(null, rawYs), maxRY = Math.max.apply(null, rawYs);
      var minSX = Math.min.apply(null, scrXs), maxSX = Math.max.apply(null, scrXs);
      var minSY = Math.min.apply(null, scrYs), maxSY = Math.max.apply(null, scrYs);

      eyeCalib.scaleX = (maxRX - minRX) > 10 ? (maxSX - minSX) / (maxRX - minRX) : 1.0;
      eyeCalib.scaleY = (maxRY - minRY) > 10 ? (maxSY - minSY) / (maxRY - minRY) : 1.0;
      eyeCalib.centerRawX = (minRX + maxRX) / 2;
      eyeCalib.centerRawY = (minRY + maxRY) / 2;
      var screenCX = (minSX + maxSX) / 2;
      var screenCY = (minSY + maxSY) / 2;
      eyeCalib.offsetX = screenCX - eyeCalib.centerRawX * eyeCalib.scaleX;
      eyeCalib.offsetY = screenCY - eyeCalib.centerRawY * eyeCalib.scaleY;
      eyeCalib.calibrated = true;

      document.getElementById('calib-sub').textContent =
        '영점 완료! ✨ 스케일 X:' + eyeCalib.scaleX.toFixed(2) + ' Y:' + eyeCalib.scaleY.toFixed(2);
      document.getElementById('calib-close-btn').style.display = 'block';
      document.getElementById('calib-progress-text').textContent = '✅ 완료!';

      onFinish(eyeCalib);
    }

    function closeCalib() {
      document.getElementById('calib-overlay').classList.remove('open');
    }

    function applyCalib(rx, ry) {
      var ax = eyeCalib.calibrated ? rx * eyeCalib.scaleX + eyeCalib.offsetX : rx;
      var ay = eyeCalib.calibrated ? ry * eyeCalib.scaleY + eyeCalib.offsetY : ry;
      var scx = window.innerWidth / 2, scy = window.innerHeight / 2;
      return {
        x: (ax - scx) * eyeCalib.manualScaleX + scx + eyeCalib.manualOffsetX,
        y: (ay - scy) * eyeCalib.manualScaleY + scy + eyeCalib.manualOffsetY,
      };
    }

    return {
      eyeCalib: eyeCalib,
      openCalib: openCalib,
      buildCalibDots: buildCalibDots,
      startCalibTarget: startCalibTarget,
      forceCollectCalib: forceCollectCalib,
      collectCalibSample: collectCalibSample,
      finishCalib: finishCalib,
      closeCalib: closeCalib,
      applyCalib: applyCalib,
    };
  }

  global.createEyeCalibration = createEyeCalibration;
})(typeof window !== 'undefined' ? window : this);
