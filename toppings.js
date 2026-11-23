/* 2026-11-23 店家編輯頁「加料區（全店共用）」：使用者回報飲料店點餐視窗沒有加料，要像店家菜單那種「+$10 珍珠 椰果…」的加料區。
   加料存在菜單文字最上面（第一個分類之前）的一行「  加料: 珍珠+10, 椰果+10, 芝芝+20」，parseMenu 會把它套到每個品項；
   這裡只負責讓店家用「加價＋品名」的表格編輯那一行，以及看圖帶入（AI，管理員才能用）。按「儲存店家」才會存，之後新開的團才有。 */
(function () {
  'use strict';
  var GROUP = '加料';
  var MAX_ROWS = 8, MAX_NAMES = 40, MAX_FILES = 3;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function half(s) { return String(s || '').replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }); }
  function isIndented(raw) { return /^[ \t　]*-[ \t　]+/.test(raw) || /^[ \t　]*/.exec(raw)[0].replace(/[\t　]/g, '  ').length >= 2; }
  // 品名裡不能有會打斷菜單格式的字（逗號、加號、冒號、大括號、換行）
  function cleanName(s) { return String(s || '').replace(/[,，﹐､+＋:：{}｛｝\r\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 20); }
  function splitNames(s) { return String(s || '').split(/[、,，﹐､;；\/／\n]+/).map(cleanName).filter(Boolean); }

  // 菜單文字最上面那段縮排行裡的「加料:」那一行 → {index, rows:[{price, names[]}]}
  function readShared(text) {
    var lines = String(text || '').split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i];
      if (!raw.trim()) continue;
      if (!isIndented(raw)) break;
      var s = half(raw).replace(/^[ \t　]*-?[ \t　]*/, '').replace(/：/g, ':').replace(/＋/g, '+').replace(/[，﹐､]/g, ',');
      var c = s.indexOf(':');
      if (c < 0 || s.slice(0, c).replace(/\*+$/, '').trim() !== GROUP) continue;
      var rows = [];
      s.slice(c + 1).split(',').forEach(function (part) {
        var m = /^(.*?)\s*\+\s*\$?\s*(\d+)\s*元?$/.exec(part.trim()), name = m ? m[1].trim() : part.trim(), price = m ? Number(m[2]) : 0;
        if (!name) return;
        var row = null;
        rows.forEach(function (r) { if (r.price === price) row = r; });
        if (!row) { row = { price: price, names: [] }; rows.push(row); }
        row.names.push(name);
      });
      rows.sort(function (a, b) { return a.price - b.price; });
      return { index: i, rows: rows };
    }
    return { index: -1, rows: [] };
  }
  // 表格 → 菜單文字那一行；沒有任何有效加料就回空字串（＝拿掉那一行）
  function lineOf(rows) {
    var seen = {}, parts = [];
    rows.slice().sort(function (a, b) { return a.price - b.price; }).forEach(function (r) {
      if (!(r.price >= 0 && r.price <= 9999)) return;
      r.names.forEach(function (n) {
        n = cleanName(n);
        if (!n || seen[n] || parts.length >= MAX_NAMES) return;
        seen[n] = 1; parts.push(n + (r.price ? '+' + r.price : ''));
      });
    });
    return parts.length ? '  ' + GROUP + ': ' + parts.join(', ') : '';
  }
  function writeShared(text, rows) {
    var lines = String(text || '').split(/\r?\n/), cur = readShared(text), line = lineOf(rows);
    if (cur.index >= 0) { if (line) lines[cur.index] = line; else lines.splice(cur.index, 1); }
    else if (line) lines.unshift(line);
    return lines.join('\n');
  }

  async function callAI(images) {
    var V = window.LunchVision;
    if (!window.firebase || !firebase.auth || !firebase.auth().currentUser) throw new Error('尚未登入');
    var token = await firebase.auth().currentUser.getIdToken();
    var response = await fetch(V.API, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ kind: 'toppings', images: images }), cache: 'no-store' });
    var result = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(result.message || 'AI 服務暫時不可用');
    if (!Array.isArray(result.toppings)) throw new Error('AI 回傳格式不符');
    var rows = [];
    result.toppings.forEach(function (t) {
      var name = cleanName(t && t.name), note = cleanName(t && t.note), price = Number(t && t.add);
      if (!name || !Number.isInteger(price) || price < 0 || price > 9999) return;
      if (note && name.indexOf(note) < 0) name = cleanName(name + '（' + note + '）');
      var row = null;
      rows.forEach(function (r) { if (r.price === price) row = r; });
      if (!row) { row = { price: price, names: [] }; rows.push(row); }
      if (row.names.indexOf(name) < 0) row.names.push(name);
    });
    rows.sort(function (a, b) { return a.price - b.price; });
    return { rows: rows, warnings: (result.warnings || []).filter(function (w) { return typeof w === 'string' && w; }).slice(0, 4) };
  }

  function ask(o) {
    var A = window.LunchApp;
    if (A && typeof A.ask === 'function') return A.ask(o);
    return Promise.resolve(window.confirm(o.title + '\n' + (o.body || '')));
  }

  function mount(form) {
    var sm = form.querySelector('#sm');
    if (!sm || form.dataset.toppingsReady) return;
    var field = sm.closest('.fld');
    if (!field) return;
    form.dataset.toppingsReady = '1';
    var box = document.createElement('section');
    box.className = 'tp-box';
    box.setAttribute('aria-labelledby', 'tpTitle');
    box.innerHTML = '<h3 id="tpTitle">加料區<span class="tp-tag">全店共用</span></h3>' +
      '<p class="tp-sub">飲料店的加料，例如珍珠、椰果。填了以後，每個品項的點餐視窗都會出現「加料」讓大家複選。按「儲存店家」才會存，之後新開的團才會有。</p>' +
      '<div class="tp-rows" data-tp-rows></div>' +
      '<div class="tp-actions"><button type="button" class="btn sm" data-tp-add>＋ 新增一組價格</button><button type="button" class="btn sm" data-tp-ai>✦ 看圖帶入</button>' +
      '<input type="file" class="tp-file" accept="image/jpeg,image/png,image/webp,image/heic" multiple hidden></div>' +
      '<p class="tp-status" role="status" aria-live="polite"></p>';
    field.after(box);
    var list = box.querySelector('[data-tp-rows]'), st = box.querySelector('.tp-status'), file = box.querySelector('.tp-file'), aiBtn = box.querySelector('[data-tp-ai]');
    var rows = [], selfWrite = false, working = false;
    function status(msg, bad) { st.textContent = msg || ''; st.classList.toggle('tp-bad', !!bad); }
    function idle() { status(rows.length ? '' : '還沒有加料。可按「＋ 新增一組價格」自己填，或「✦ 看圖帶入」上傳店家菜單的加料區。'); }
    function draw() {
      list.innerHTML = rows.map(function (r, i) {
        return '<div class="tp-row" data-i="' + i + '">' +
          '<label class="tp-price-l"><span>加價 $</span><input class="tp-price" type="number" inputmode="numeric" min="0" max="9999" step="1" value="' + esc(r.price) + '" aria-label="第 ' + (i + 1) + ' 組加價"></label>' +
          '<label class="tp-names-l"><span class="tp-vh">第 ' + (i + 1) + ' 組品名</span><textarea class="tp-names" rows="1" maxlength="400" placeholder="用頓號分開，例如 珍珠、椰果、仙草凍">' + esc(r.names.join('、')) + '</textarea></label>' +
          '<button type="button" class="btn sm tp-del" data-tp-del="' + i + '" aria-label="刪除第 ' + (i + 1) + ' 組">刪除</button></div>';
      }).join('');
      box.querySelector('[data-tp-add]').disabled = rows.length >= MAX_ROWS;
      list.querySelectorAll('.tp-names').forEach(fit);
    }
    function fit(ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 2 + 'px'; }
    function collect() {
      rows = Array.prototype.map.call(list.querySelectorAll('.tp-row'), function (row) {
        var p = row.querySelector('.tp-price').value.trim();
        return { price: p === '' ? NaN : Number(p), names: splitNames(row.querySelector('.tp-names').value) };
      });
    }
    function save() {
      var bad = rows.some(function (r) { return r.names.length && !valid(r); });
      var next = writeShared(sm.value, rows.filter(valid));
      if (next !== sm.value) {
        selfWrite = true;
        try { sm.value = next; sm.dispatchEvent(new Event('input', { bubbles: true })); } finally { selfWrite = false; }
      }
      if (bad) status('有一組的加價不是 0–9999 的整數，那一組先不會存進菜單', true);
      else idle();
    }
    function load() {
      if (selfWrite) return;
      var focused = box.contains(document.activeElement);
      if (focused) return; // 正在打字時不重畫，離開欄位時會以表格為準寫回
      rows = readShared(sm.value).rows;
      draw(); idle();
    }
    list.addEventListener('input', function (e) { if (e.target.classList.contains('tp-names')) fit(e.target); });
    list.addEventListener('change', function () { collect(); save(); });
    function valid(r) { return r.names.length && Number.isInteger(r.price) && r.price >= 0 && r.price <= 9999; }
    list.addEventListener('focusout', function () {
      // 離開整個加料區時，把表格整理成跟菜單文字一致（同價錢併成一列、由便宜到貴、「珍珠,椰果」→「珍珠、椰果」）；還沒填完的列留在最下面
      setTimeout(function () {
        if (box.contains(document.activeElement) || !box.isConnected) return;
        collect();
        rows = readShared(sm.value).rows.concat(rows.filter(function (r) { return !valid(r); }));
        draw();
      }, 0);
    });
    list.addEventListener('click', function (e) {
      var d = e.target.closest('[data-tp-del]');
      if (!d) return;
      collect(); rows.splice(+d.getAttribute('data-tp-del'), 1); draw(); save();
    });
    box.querySelector('[data-tp-add]').addEventListener('click', function () {
      collect();
      if (rows.length >= MAX_ROWS) return;
      var last = rows.length ? rows[rows.length - 1].price : 0;
      rows.push({ price: Number.isInteger(last) && last > 0 ? last + 10 : 10, names: [] });
      draw(); idle();
      var t = list.querySelectorAll('.tp-names'); if (t.length) t[t.length - 1].focus();
    });
    aiBtn.addEventListener('click', function () { if (!working) file.click(); });
    file.addEventListener('change', async function () {
      var picked = Array.from(file.files || []); file.value = '';
      if (!picked.length || working) return;
      if (!window.LunchVision) { status('辨識元件還沒載入，請重新整理頁面', true); return; }
      if (picked.length > MAX_FILES) { status('最多一次 ' + MAX_FILES + ' 張圖', true); return; }
      working = true; aiBtn.disabled = true;
      try {
        var images = [];
        status('正在處理圖片…');
        for (var i = 0; i < picked.length; i++) images.push(await window.LunchVision.fileToData(picked[i]));
        if (!box.isConnected) return;
        status('AI 正在讀加料區，約需 5–30 秒…');
        var data;
        try { data = await callAI(images); }
        catch (err) { if (box.isConnected) status('AI 沒有接上（' + String(err.message || '服務不可用').slice(0, 40) + '），請手動填寫加料', true); return; }
        if (!box.isConnected) return;
        if (!data.rows.length) { status('圖片裡沒有讀到加料，請換一張只拍加料區的清楚圖片，或手動填寫', true); return; }
        collect();
        var had = rows.some(function (r) { return r.names.length; });
        if (had && lineOf(rows) !== lineOf(data.rows)) {
          var n = data.rows.reduce(function (s, r) { return s + r.names.length; }, 0);
          var ok = await ask({ title: '要用圖片讀到的 ' + n + ' 種加料取代目前的加料區嗎？', body: data.rows.map(function (r) { return '+$' + r.price + '：' + r.names.join('、'); }).join('\n') + '\n尚未儲存，按「儲存店家」才會存。', okText: '取代', cancelText: '先不要' });
          if (!ok) { status('已取消，加料區沒有變更'); return; }
        }
        rows = data.rows; draw(); save();
        status('✓ 已帶入 ' + data.rows.reduce(function (s, r) { return s + r.names.length; }, 0) + ' 種加料，請對照圖片確認後按「儲存店家」' + (data.warnings.length ? '。請再確認：' + data.warnings.join('、') : ''));
        if (window.LunchApp && window.LunchApp.toast) window.LunchApp.toast('✓ 加料已帶入，確認後記得儲存店家');
      } catch (e) {
        if (box.isConnected) status('辨識失敗：' + (e.message || '請換清楚一點的圖片'), true);
      } finally { working = false; if (box.isConnected) aiBtn.disabled = false; }
    });
    // 店家編輯器的「復原上一步」、圖片辨識菜單帶入都會發 input 事件 → 以菜單文字為準重畫（「找菜單」帶入會保留原本的加料行，見 index.html keepSharedLines）
    sm.addEventListener('input', load);
    rows = readShared(sm.value).rows; draw(); idle();
  }

  function scan() { document.querySelectorAll('#app form#f').forEach(function (f) { if (f.querySelector('#sm')) mount(f); }); }
  var app = document.getElementById('app');
  if (app) new MutationObserver(scan).observe(app, { childList: true, subtree: true });
  scan();
  window.LunchToppings = { readShared: readShared, writeShared: writeShared, lineOf: lineOf, splitNames: splitNames };
})();
