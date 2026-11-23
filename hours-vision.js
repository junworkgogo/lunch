/* 2026-11-23 營業時間「看圖帶入」：上傳營業時間截圖 → AI（Gemini，管理員）讀出每天時段 → 自動勾星期、填時間。
   AI 不能用（非管理員、額度用完、逾時）時改用瀏覽器內免費文字辨識（OCR）。只改編輯中的欄位，按「儲存店家」才會存。
   共用 menu-vision.js 的 window.LunchVision（圖片壓縮、OCR 載入、API 網址）與 hours-editor.js 的 window.LunchHours。 */
(function () {
  'use strict';
  var DAYS = ['一', '二', '三', '四', '五', '六', '日'];
  var MAX_FILES = 3;

  function V() { return window.LunchVision; }
  function pad(n) { n = String(n); return n.length < 2 ? '0' + n : n; }
  // 「9:00」「09：00」「24:00」→ 標準 HH:MM；不合理的回 null
  function hhmm(h, m) {
    h = Number(h); m = Number(m);
    if (!isFinite(h) || !isFinite(m) || m > 59 || h > 24) return null;
    if (h === 24) { if (m) return null; return '23:59'; }
    return pad(h) + ':' + pad(m);
  }
  function normTime(t) {
    var x = /^\s*(\d{1,2})\s*[:：.]\s*(\d{2})\s*$/.exec(String(t || ''));
    return x ? hhmm(x[1], x[2]) : null;
  }
  function dayIndex(ch) {
    ch = String(ch || '').trim();
    if (ch === '天') ch = '日';
    var i = DAYS.indexOf(ch);
    if (i >= 0) return i;
    var en = ch.slice(0, 3).toLowerCase();
    return ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].indexOf(en);
  }

  // AI 回傳 {days:[{day:'一',closed:false,ranges:[{start,end}]}]} → 每天的時段（0＝週一）
  function fromAI(days) {
    var map = {};
    (Array.isArray(days) ? days : []).forEach(function (d) {
      var i = dayIndex(d && d.day);
      if (i < 0) return;
      if (d.closed) { map[i] = []; return; }
      var ranges = (Array.isArray(d.ranges) ? d.ranges : []).map(function (r) {
        var s = normTime(r && r.start), e = normTime(r && r.end);
        return s && e && s !== e ? { start: s, end: e } : null;
      }).filter(Boolean);
      if (ranges.length) map[i] = (map[i] || []).concat(ranges);
      else if (!(i in map)) map[i] = [];
    });
    return map;
  }

  // OCR 文字 → 每天的時段。支援「星期一 09:00–21:50」「週一至週五 11:00-14:00、17:00-20:00」「每日」「平日／假日」「休息」
  var DAY_RE = /(每天|每日|平日|假日|週末|周末)|(?:星期|週|周|禮拜|礼拜)\s*([一二三四五六日天])(?:\s*[至到~～\-–—－]\s*(?:星期|週|周|禮拜|礼拜)?\s*([一二三四五六日天]))?|\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b/ig;
  var TIME_RE = /(\d{1,2})\s*[:：.]\s*(\d{2})\s*[-–—~～至到－]\s*(\d{1,2})\s*[:：.]\s*(\d{2})/g;
  function daysIn(line) {
    var out = [], m;
    DAY_RE.lastIndex = 0;
    while ((m = DAY_RE.exec(line))) {
      if (m[1]) {
        var w = m[1];
        if (w === '每天' || w === '每日') out.push(0, 1, 2, 3, 4, 5, 6);
        else if (w === '平日') out.push(0, 1, 2, 3, 4);
        else out.push(5, 6);
      } else if (m[2]) {
        var a = dayIndex(m[2]), b = m[3] ? dayIndex(m[3]) : a;
        for (var d = a; ; d = (d + 1) % 7) { out.push(d); if (d === b) break; }
      } else if (m[4]) out.push(dayIndex(m[4]));
    }
    return out.filter(function (d, i, all) { return d >= 0 && all.indexOf(d) === i; });
  }
  function rangesIn(line) {
    var out = [], m;
    TIME_RE.lastIndex = 0;
    while ((m = TIME_RE.exec(line))) {
      var s = hhmm(m[1], m[2]), e = hhmm(m[3], m[4]);
      if (s && e && s !== e) out.push({ start: s, end: e });
    }
    return out;
  }
  function fromText(text) {
    var map = {}, waiting = [];
    String(text || '').split(/\n+/).forEach(function (raw) {
      var line = raw.replace(/\s+/g, ' ').trim();
      if (!line) return;
      var days = daysIn(line), ranges = rangesIn(line);
      var closed = /休息|公休|店休|未營業|不營業|closed/i.test(line);
      if (/24\s*小時/.test(line) && !ranges.length) ranges = [{ start: '00:00', end: '23:59' }];
      if (!days.length) {
        if (waiting.length && (ranges.length || closed)) { days = waiting; waiting = []; }
        else return;
      }
      if (ranges.length) days.forEach(function (d) { map[d] = ranges.slice(); });
      else if (closed) days.forEach(function (d) { map[d] = []; });
      else waiting = days;
    });
    return map;
  }

  // 每天的時段 → 營業時間欄位的文字。全部同一組時段時，編輯器能直接顯示成「勾星期＋時間」
  function toValue(map) {
    var groups = [];
    for (var d = 0; d < 7; d++) {
      var r = map[d];
      if (!r || !r.length) continue;
      var key = r.map(function (x) { return x.start + '–' + x.end; }).join('；');
      var g = null;
      groups.forEach(function (x) { if (x.key === key) g = x; });
      if (!g) { g = { key: key, days: [], ranges: r }; groups.push(g); }
      g.days.push(d);
    }
    var H = window.LunchHours;
    return {
      value: groups.map(function (g) { return H.serializeHours(g.days, g.ranges); }).join('；'),
      groups: groups.length,
      open: groups.reduce(function (n, g) { return n + g.days.length; }, 0)
    };
  }

  async function callAI(images) {
    if (!window.firebase || !firebase.auth || !firebase.auth().currentUser) throw new Error('尚未登入');
    var token = await firebase.auth().currentUser.getIdToken();
    var response = await fetch(V().API, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ kind: 'hours', images: images }), cache: 'no-store' });
    var result = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(result.message || 'AI 服務暫時不可用');
    if (!Array.isArray(result.days)) throw new Error('AI 回傳格式不符');
    return { map: fromAI(result.days), source: 'Gemini', warnings: (result.warnings || []).filter(function (w) { return typeof w === 'string' && w; }).slice(0, 4) };
  }
  async function callOCR(images, onProgress) {
    var T = await V().loadOCR(), worker = null, text = [];
    try {
      worker = await T.createWorker('chi_tra+eng', 1, { logger: function (m) { if (m.status === 'recognizing text' && onProgress) onProgress(Math.round((m.progress || 0) * 100)); } });
      for (var i = 0; i < images.length; i++) { var r = await worker.recognize(images[i]); text.push(r.data.text); }
    } finally { if (worker) await worker.terminate(); }
    return { map: fromText(text.join('\n')), source: '免費文字辨識', ocr: true, warnings: [] };
  }

  function ask(o) {
    var A = window.LunchApp;
    if (A && typeof A.ask === 'function') return A.ask(o);
    return Promise.resolve(window.confirm(o.title + '\n' + (o.body || '')));
  }

  function mount(sh) {
    var editor = sh.nextElementSibling;
    if (!editor || !editor.classList.contains('lh-editor') || sh.dataset.hoursVision) return;
    sh.dataset.hoursVision = '1';
    var row = document.createElement('div');
    row.className = 'hv-row';
    row.innerHTML = '<button type="button" class="btn sm hv-btn">✦ 看圖帶入</button>' +
      '<input type="file" class="hv-file" accept="image/jpeg,image/png,image/webp,image/heic" multiple hidden>' +
      '<span class="hv-status" role="status" aria-live="polite">上傳營業時間截圖，自動勾星期、填時間</span>';
    editor.after(row);
    var btn = row.querySelector('.hv-btn'), file = row.querySelector('.hv-file'), st = row.querySelector('.hv-status');
    var working = false;
    function status(msg, bad) { st.textContent = msg; st.classList.toggle('hv-bad', !!bad); }
    function busy(on) { working = on; btn.disabled = on; }
    btn.addEventListener('click', function () { if (!working) file.click(); });
    file.addEventListener('change', async function () {
      var picked = Array.from(file.files || []); file.value = '';
      if (!picked.length || working) return;
      if (!V() || !window.LunchHours) { status('辨識元件還沒載入，請重新整理頁面', true); return; }
      if (picked.length > MAX_FILES) { status('最多一次 ' + MAX_FILES + ' 張圖', true); return; }
      busy(true);
      try {
        var images = [];
        for (var i = 0; i < picked.length; i++) {
          status('正在處理圖片…');
          images.push(await V().fileToData(picked[i]));
        }
        if (!row.isConnected) return;
        status('AI 正在讀營業時間，約需 5–30 秒…');
        var data;
        try { data = await callAI(images); }
        catch (err) {
          if (!row.isConnected) return;
          status('AI 沒有接上（' + String(err.message || '服務不可用').slice(0, 40) + '），改用免費文字辨識…');
          data = await callOCR(images, function (p) { if (row.isConnected) status('免費文字辨識中 ' + p + '%…'); });
        }
        if (!row.isConnected) return;
        var out = toValue(data.map);
        if (!out.open) { status('圖片裡沒有讀到營業時段，請換一張清楚的截圖，或手動選擇', true); return; }
        var old = sh.value.trim();
        if (old && old !== out.value) {
          var ok = await ask({ title: '要用圖片讀到的時間取代目前的營業時間嗎？', body: '讀到：' + out.value + '\n尚未儲存，按「儲存店家」才會存。', okText: '取代', cancelText: '先不要' });
          if (!ok) { status('已取消，營業時間沒有變更'); return; }
        }
        sh.value = out.value;
        sh.dispatchEvent(new Event('input', { bubbles: true }));
        sh.dispatchEvent(new Event('change', { bubbles: true }));
        var note = '✓ ' + data.source + ' 已帶入' + (data.ocr ? '（AI 沒有接上，準確度較低）' : '') + '，請對照圖片確認後按「儲存店家」';
        if (out.groups > 1) note += '。各天時間不同，以文字帶入';
        if (data.warnings.length) note += '。請再確認：' + data.warnings.join('、');
        status(note);
        if (window.LunchApp && window.LunchApp.toast) window.LunchApp.toast('✓ 營業時間已帶入，確認後記得儲存店家');
      } catch (e) {
        if (row.isConnected) status('辨識失敗：' + (e.message || '請換清楚一點的截圖'), true);
      } finally { if (row.isConnected) busy(false); }
    });
  }

  function scan() {
    var sh = document.querySelector('#app form#f #sh[data-hours-editor]');
    if (sh) mount(sh);
  }
  var app = document.getElementById('app');
  if (app) new MutationObserver(scan).observe(app, { childList: true, subtree: true });
  scan();
  window.LunchHoursVision = { fromAI: fromAI, fromText: fromText, toValue: toValue };
})();
