(function () {
  'use strict';

  var A = window.LunchApp;
  var busy = false;
  var own = Object.prototype.hasOwnProperty;

  function validId(id) {
    return typeof id === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(id);
  }

  function validMember(profile) {
    return profile && typeof profile.name === 'string' && profile.name.trim() && profile.name.length <= 30 &&
      typeof profile.department === 'string' && profile.department.trim() && profile.department.length <= 40;
  }

  function eligible(group, uid) {
    return group.audience !== 'selected' || (group.participants && own.call(group.participants, uid));
  }

  function displayName(profile) {
    return profile.name + (profile.department ? '（' + profile.department + '）' : '');
  }

  function memberCard(entry) {
    var uid = entry[0], profile = entry[1];
    var memberAvatars = window.LunchMembers;
    var fallback = memberAvatars && memberAvatars.avatarHtml ?
      '<span class="order-transfer-avatar-default">' + memberAvatars.avatarHtml({ name: profile.name }) + '</span>' : '';
    return '<button type="button" class="order-transfer-person" value="' + A.esc(uid) + '" aria-pressed="false">' +
      '<span class="order-transfer-avatar" aria-hidden="true">' + A.memberAvSlot(uid, profile.name, 'order-transfer-avatar-slot') +
      fallback + '<span class="order-transfer-check">✓</span></span>' +
      '<span class="order-transfer-name">' + A.esc(profile.name) + '</span>' +
      '<span class="order-transfer-department">' + A.esc(profile.department) + '</span></button>';
  }

  function choose(members, current) {
    return new Promise(function (resolve) {
      var overlay = document.createElement('div');
      var previous = document.activeElement;
      overlay.className = 'modal-ov';
      overlay.innerHTML = '<form class="modal order-transfer-dialog" role="dialog" aria-modal="true" aria-labelledby="orderTransferTitle">' +
        '<h2 id="orderTransferTitle">轉讓訂單</h2><p>目前訂購人為 ' + A.esc(displayName(current)) + '。</p>' +
        '<h3 id="orderTransferChoices">選擇新訂購人</h3><div class="order-transfer-options" role="group" aria-labelledby="orderTransferChoices">' +
        members.map(memberCard).join('') + '</div><div class="modal-actions">' +
        '<button type="button" class="btn" data-transfer-cancel>取消</button>' +
        '<button type="submit" class="btn primary" disabled>下一步</button></div></form>';
      var form = overlay.querySelector('form'), next = form.querySelector('button[type="submit"]');
      var choices = form.querySelector('.order-transfer-options');
      var first = choices.querySelector('.order-transfer-person');
      var cancel = form.querySelector('[data-transfer-cancel]');
      var selected = null;
      var overflow = document.body.style.overflow;
      document.body.appendChild(overlay);
      document.body.style.overflow = 'hidden';

      function finish(uid) {
        document.removeEventListener('keydown', key);
        window.removeEventListener('hashchange', cancelChoice);
        window.removeEventListener('lunch:userchange', cancelChoice);
        overlay.remove();
        document.body.style.overflow = overflow;
        if (previous && previous.isConnected) previous.focus();
        resolve(uid);
      }
      function cancelChoice() { finish(''); }
      function key(event) {
        if (event.key === 'Escape') { event.preventDefault(); cancelChoice(); }
        if (event.key !== 'Tab') return;
        var last = next.disabled ? cancel : next;
        if (!form.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }
      document.addEventListener('keydown', key);
      window.addEventListener('hashchange', cancelChoice);
      window.addEventListener('lunch:userchange', cancelChoice);
      choices.addEventListener('click', function (event) {
        var card = event.target.closest('.order-transfer-person');
        if (!card || card === selected) return;
        if (selected) selected.setAttribute('aria-pressed', 'false');
        selected = card;
        selected.setAttribute('aria-pressed', 'true');
        next.disabled = false;
      });
      form.addEventListener('submit', function (event) { event.preventDefault(); if (selected) finish(selected.value); });
      cancel.addEventListener('click', cancelChoice);
      first.focus();
    });
  }

  function check(group, order, recipient) {
    if (!group || group.deleted || !order || order.cancelled || !validId(order.userId) || order.userId === recipient ||
        typeof order.updatedAt !== 'number' || !Object.keys(order.items || {}).length) {
      throw new Error('這筆訂單已變更，請重新開啟後再試。');
    }
    if (!eligible(group, recipient)) throw new Error('這位會員尚未列入本團參加名單，請先將他加入名單。');
    if (A.collectionReceiver(group, order.id) === recipient) throw new Error('這位會員是這筆訂單的收款人，請先更換收款人。');
  }

  function orderSignature(order) {
    return JSON.stringify([order.userId, order.name, order.department, order.updatedAt, order.cancelled, order.items, order.lastTransfer]);
  }

  async function open(options) {
    if (busy || !options.active() || !validId(options.gid) || !validId(options.oid)) return;
    if (!options.ready) { A.toast('會員名單載入中，請稍後再試。', true); return; }
    var choices = Object.entries(options.members).filter(function (entry) {
      return entry[0] !== options.order.userId && validId(entry[0]) && validMember(entry[1]);
    }).sort(function (a, b) {
      return (a[1].department + a[1].name).localeCompare(b[1].department + b[1].name, 'zh-Hant');
    });
    if (!choices.length) { A.toast('目前沒有其他可選會員。', true); return; }
    busy = true;
    try {
      var recipient = await choose(choices, options.order);
      if (!recipient || !options.active()) return;
      var groupPath = 'groups/' + options.gid, orderPath = 'orders/' + options.gid + '/' + options.oid;
      var selection = await Promise.all([A.DB.get(groupPath), A.DB.get(orderPath), A.DB.get('members/' + recipient)]);
      var group = selection[0], order = selection[1], profile = selection[2];
      if (!options.active()) return;
      if (!order || orderSignature(order) !== orderSignature(options.order)) throw new Error('這筆訂單已變更，請重新開啟後再試。');
      if (!validMember(profile)) throw new Error('讀不到這位會員的有效資料，請重新選擇。');
      order.id = options.oid;
      check(group, order, recipient);
      var items = Object.values(order.items).map(function (item) {
        return A.lineLabel(item) + ' × ' + item.qty + (item.note ? '（備註 ' + item.note + '）' : '');
      }).join('、');
      var ok = await A.ask({
        title: '確認轉讓這筆訂單？',
        body: '原訂購人 ' + displayName(order) + ' → 新訂購人 ' + displayName(profile) + '。餐點為 ' + items +
          '。訂單與應付款轉給新會員，金額與已收款狀態保留。',
        okText: '確認轉讓',
        cancelText: '取消'
      });
      if (!ok || !options.active()) return;
      await A.DB.transferOrder(options.gid, options.oid, order, recipient, profile);
      if (options.active()) A.toast('已將訂單轉給 ' + profile.name + '。');
    } catch (error) {
      if (options.active()) {
        if (/permission.denied/i.test(String(error.code || error.message))) {
          A.toast('無法轉讓。訂單、會員資料或權限可能已更新，請重新整理後再試。', true);
        } else A.fail(error);
      }
    } finally {
      busy = false;
    }
  }

  window.LunchOrderTransfer = { open: open };
})();
