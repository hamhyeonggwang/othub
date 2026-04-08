/**
 * 키오스크 완료 화면 DOM을 PNG로 저장 (html2canvas CDN 동적 로드)
 */
(function () {
  var H2C_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';

  function ensureHtml2Canvas() {
    if (typeof html2canvas !== 'undefined') return Promise.resolve();
    if (window.__kioskH2CLoading) return window.__kioskH2CLoading;
    window.__kioskH2CLoading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = H2C_SRC;
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('html2canvas')); };
      document.head.appendChild(s);
    });
    return window.__kioskH2CLoading;
  }

  function stamp() {
    var d = new Date();
    function p(n) { return n < 10 ? '0' + n : String(n); }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
  }

  /**
   * @param {string|HTMLElement} elOrSelector
   * @param {string} filenameBase 확장자 제외 (자동으로 _날짜시각.png)
   * @param {function(string)=} toastFn
   */
  function kioskSaveImage(elOrSelector, filenameBase, toastFn) {
    if (typeof toastFn !== 'function') toastFn = function () {};
    var el = typeof elOrSelector === 'string' ? document.querySelector(elOrSelector) : elOrSelector;
    if (!el) {
      toastFn('저장할 화면을 찾을 수 없어요');
      return;
    }
    toastFn('이미지 준비 중...');
    ensureHtml2Canvas()
      .then(function () {
        return html2canvas(el, {
          scale: Math.min(2, window.devicePixelRatio || 2),
          useCORS: true,
          allowTaint: true,
          backgroundColor: null,
          logging: false
        });
      })
      .then(function (canvas) {
        var a = document.createElement('a');
        var base = String(filenameBase || 'kiosk-capture').replace(/\.png$/i, '');
        a.download = base + '_' + stamp() + '.png';
        a.href = canvas.toDataURL('image/png');
        a.click();
        toastFn('이미지로 저장했어요');
      })
      .catch(function () {
        toastFn('이미지 저장에 실패했어요');
      });
  }

  window.kioskSaveImage = kioskSaveImage;
})();
