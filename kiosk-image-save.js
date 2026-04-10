/**
 * 키오스크: 결과 화면 PNG 저장 + 열전지 스타일 영수증 모달(html2canvas CDN 동적 로드)
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

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function fmtWon(n) {
    if (n === '' || n === null || n === undefined) return '-';
    var x = typeof n === 'number' ? n : parseInt(n, 10);
    if (isNaN(x)) return '-';
    return x.toLocaleString('ko-KR') + '원';
  }

  function fmtDdMmYyyy(d) {
    d = d instanceof Date ? d : new Date();
    function p(n) { return n < 10 ? '0' + n : String(n); }
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
  }

  function injectKioskReceiptStyles() {
    if (document.getElementById('kiosk-receipt-style-tag')) return;
    var st = document.createElement('style');
    st.id = 'kiosk-receipt-style-tag';
    st.textContent = [
      '.kiosk-receipt-modal-ov{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.6);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;}',
      '.kiosk-receipt-modal-wrap{max-width:340px;width:100%;max-height:92vh;display:flex;flex-direction:column;gap:10px;}',
      '.kiosk-receipt-scroll{overflow:auto;max-height:calc(92vh - 52px);border-radius:12px;}',
      '.kiosk-receipt-modal-actions{display:flex;gap:8px;justify-content:stretch;}',
      '.kiosk-receipt-btn-close,.kiosk-receipt-btn-save{flex:1;padding:11px 12px;border-radius:10px;border:none;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;}',
      '.kiosk-receipt-btn-save{background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;}',
      '.kiosk-receipt-btn-close{background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.25);}',
      '.kiosk-receipt-paper{background:#fff;color:#111;font-family:Consolas,ui-monospace,monospace,"Malgun Gothic",sans-serif;font-size:10.5px;line-height:1.45;padding:14px 12px 16px;box-shadow:0 8px 32px rgba(0,0,0,.4);text-align:left;border-radius:2px;}',
      '.kiosk-r-title{text-align:center;font-weight:900;font-size:12px;margin-bottom:2px;font-family:"Malgun Gothic",sans-serif;}',
      '.kiosk-r-hr{color:#333;margin:4px 0 2px;word-break:break-all;font-size:9px;}',
      '.kiosk-r-note{color:#222;margin:6px 0 8px;white-space:pre-line;font-family:"Malgun Gothic",sans-serif;font-size:9.5px;line-height:1.5;}',
      '.kiosk-r-meta{margin:4px 0;font-family:"Malgun Gothic",sans-serif;font-size:10px;}',
      '.kiosk-r-bold{font-weight:700;}',
      '.kiosk-r-table{margin-top:6px;}',
      '.kiosk-r-th{margin:4px 0 2px;font-weight:700;font-size:9.5px;}',
      '.kiosk-r-row{margin:2px 0;font-size:9.5px;word-break:break-word;}',
      '.kiosk-r-total{margin-top:10px;font-weight:900;font-size:11px;text-align:right;font-family:"Malgun Gothic",sans-serif;}'
    ].join('');
    document.head.appendChild(st);
  }

  /**
   * @param {string|HTMLElement} elOrSelector
   * @param {string} filenameBase
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

  /**
   * 사이드바「결과 화면 저장」— #kiosk-result-capture 가 있을 때만
   * @param {string} prefix 파일명 접두 (예: cu, paik)
   * @param {function(string)} toastFn
   */
  function kioskSaveResultScreen(prefix, toastFn) {
    if (typeof toastFn !== 'function') toastFn = function () {};
    if (!document.querySelector('#kiosk-result-capture')) {
      toastFn('완료 화면에서 저장할 수 있어요');
      return;
    }
    kioskSaveImage('#kiosk-result-capture', String(prefix || 'kiosk') + '-result', toastFn);
  }

  function closeKioskReceiptModal() {
    var el = document.getElementById('kiosk-receipt-modal-ov');
    if (el) el.remove();
  }

  /**
   * @param {object} cfg
   * @param {function(string)} cfg.toast
   * @param {string} cfg.filenameBase PNG 접두 (예: cu-receipt)
   * @param {string|number} [cfg.orderNo]
   * @param {Date} [cfg.purchaseDate]
   * @param {Array<{name:string, unitPrice:number|string, qty:number|string, lineTotal:number}>} cfg.items
   * @param {number} cfg.total
   */
  function openKioskReceiptModal(cfg) {
    cfg = cfg || {};
    var toastFn = typeof cfg.toast === 'function' ? cfg.toast : function () {};
    var filenameBase = cfg.filenameBase || 'receipt';
    var orderNo = cfg.orderNo != null ? String(cfg.orderNo) : String(1000000 + Math.floor(Math.random() * 8999999));
    var purchaseDate = cfg.purchaseDate instanceof Date ? cfg.purchaseDate : new Date();
    var items = Array.isArray(cfg.items) ? cfg.items : [];
    var total = typeof cfg.total === 'number' ? cfg.total : 0;

    injectKioskReceiptStyles();
    closeKioskReceiptModal();

    var linesHtml = items.map(function (it, idx) {
      var no = idx + 1;
      var name = esc(it.name);
      var up = it.unitPrice === '' || it.unitPrice === undefined || it.unitPrice === null
        ? '-'
        : fmtWon(it.unitPrice);
      var q = it.qty === '' || it.qty === undefined || it.qty === null ? '-' : String(it.qty);
      var lt = fmtWon(it.lineTotal);
      return '<div class="kiosk-r-row">' + no + '. ' + name + ' / ' + up + ' / ' + q + ' / ' + lt + '</div>';
    }).join('');

    var dateStr = fmtDdMmYyyy(purchaseDate);

    var ov = document.createElement('div');
    ov.id = 'kiosk-receipt-modal-ov';
    ov.className = 'kiosk-receipt-modal-ov';
    ov.innerHTML =
      '<div class="kiosk-receipt-modal-wrap">' +
      '<div class="kiosk-receipt-scroll">' +
      '<div id="kiosk-receipt-thermal" class="kiosk-receipt-paper">' +
      '<div class="kiosk-r-title">[영수증]</div>' +
      '<div class="kiosk-r-hr">---------------------</div>' +
      '<div class="kiosk-r-note">영수증 미지참시 교환/환불 불가\n* 정상상품에 한함, 30일 이내(신선 7일)\n교환/환불 구매점에서 가능(결제카드지참)</div>' +
      '<div class="kiosk-r-meta"><span class="kiosk-r-bold">주문번호 : </span>' + esc(orderNo) + '</div>' +
      '<div class="kiosk-r-meta"><span class="kiosk-r-bold">[구매]</span>' + esc(dateStr) + '</div>' +
      '<div class="kiosk-r-hr">--------------------------------</div>' +
      '<div class="kiosk-r-table">' +
      '<div class="kiosk-r-th">no. 상품명 / 단가 / 수량 / 금액</div>' +
      linesHtml +
      '</div>' +
      '<div class="kiosk-r-total">결제대상금액 ' + fmtWon(total) + '</div>' +
      '</div></div>' +
      '<div class="kiosk-receipt-modal-actions">' +
      '<button type="button" class="kiosk-receipt-btn-close">닫기</button>' +
      '<button type="button" class="kiosk-receipt-btn-save">🧾 영수증 저장</button>' +
      '</div></div>';

    document.body.appendChild(ov);

    ov.querySelector('.kiosk-receipt-btn-close').onclick = closeKioskReceiptModal;
    ov.querySelector('.kiosk-receipt-btn-save').onclick = function () {
      kioskSaveImage('#kiosk-receipt-thermal', filenameBase, toastFn);
    };
    ov.addEventListener('click', function (e) {
      if (e.target === ov) closeKioskReceiptModal();
    });
  }

  window.kioskSaveImage = kioskSaveImage;
  window.kioskSaveResultScreen = kioskSaveResultScreen;
  window.openKioskReceiptModal = openKioskReceiptModal;
  window.closeKioskReceiptModal = closeKioskReceiptModal;
})();
