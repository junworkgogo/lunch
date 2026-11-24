(function () {
  'use strict';

  var A = window.LunchApp;
  if (!A) return;

  var dateFormat = new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit'
  });
  var fields = ['deleted', 'title', 'shopId', 'shop/name', 'shop/address', 'closed'];
  var maxReads = 5;
  var readTimeout = 15000;

  function normalize(value) {
    var words = String(value || '');
    if (window.LunchTraditional) words = window.LunchTraditional(words);
    return words.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  function dateLabel(value) {
    return value > 0 && Number.isFinite(value) ? dateFormat.format(value) : '日期未記錄';
  }

  function dateOf(group) {
    return group.createdAt || group.deadline;
  }

  function shopKey(group) {
    if (group.shopId) return 'shop:' + group.shopId;
    var name = String(group.shopName || '').trim();
    var address = String(group.address || '').trim();
    return name && address ? 'old:' + JSON.stringify([name, address]) : 'group:' + group.id;
  }

  function collectShops(groups, query) {
    var shops = new Map();
    groups.sort(function (a, b) { return dateOf(b) - dateOf(a) || a.id.localeCompare(b.id); });
    groups.forEach(function (group) {
      var key = shopKey(group);
      var shop = shops.get(key);
      if (!shop) {
        shop = { key: key, name: group.shopName || '店家未記錄', address: group.address, all: [], matches: [] };
        shops.set(key, shop);
      }
      shop.all.push(group);
      if (!query || normalize(group.title).includes(query)) shop.matches.push(group);
    });
    shops.forEach(function (shop, key) {
      if (query && shop.all.some(function (group) { return normalize(group.shopName).includes(query); })) {
        shop.matches = shop.all;
      }
      if (!shop.matches.length) shops.delete(key);
    });
    return shops;
  }

  function renderPage(root) {
    var user = A.getUser();
    var uid = user && user.uid;
    var canRead = uid && (user.authenticated || (!A.firebaseConfig && user.demo));
    root.innerHTML = '<div class="page">' + A.homeHero() +
      '<section class="home-groups my-groups" aria-label="我開的團">' + A.homeTabs('mine') +
      (canRead
        ? '<div class="my-groups-toolbar"><label class="my-groups-search"><span>搜尋店名或團名</span><input type="search" autocomplete="off" placeholder="搜尋店名或團名"></label><button type="button" class="btn" data-my-refresh>重新整理</button></div><p id="myGroupsStatus" class="my-groups-status" role="status"></p><div id="myGroupsResults"></div>'
        : '<div class="card my-groups-notice"><p>登入後就能查看你開過的團購。</p><a class="btn primary" href="#/members/login?next=%23%2Fmy-groups">會員登入</a></div>') +
      '</section></div>';
    if (!canRead) return;

    var section = root.querySelector('.my-groups');
    var search = section.querySelector('input');
    var status = section.querySelector('#myGroupsStatus');
    var results = section.querySelector('#myGroupsResults');
    var refresh = section.querySelector('[data-my-refresh]');
    var alive = true;
    var epoch = 0;
    var unsubscribes = [];
    var sources = new Map();
    var entries = new Map();
    var pending = new Set();
    var queue = [];
    var inFlight = 0;
    var readError = '';
    var sourceTimer;
    var reconcileQueued = false;
    var selectedShop = '';
    var shopScroll = 0;
    // 2026-11-24 改讀開團人專屬索引 ownerGroupIds/<uid>，不再逐一讀全部公開團的開團人
    var paths = ['ownerGroupIds/' + uid];

    function mounted() {
      var activeUser = A.getUser();
      return alive && !!activeUser && activeUser.uid === uid &&
        A.parseHash().parts[0] === 'my-groups';
    }

    function current(entry) {
      return mounted() && entries.get(entry.id) === entry;
    }

    function putStatus(message) {
      if (status.textContent !== message) status.textContent = message;
    }

    function groupDate(group, recent) {
      var label = group.createdAt ? (recent ? '最近開團' : '開團') : (recent ? '最近一次截止' : '截止');
      return label + ' ' + dateLabel(dateOf(group));
    }

    function shopCard(shop) {
      var count = shop.all.length;
      var latest = shop.all[0];
      return '<button type="button" class="card my-groups-shop" data-my-shop="' + A.esc(shop.key, true) + '">' +
        '<span class="my-groups-shop-name">' + A.esc(shop.name) + '</span>' +
        (shop.address ? '<span class="my-groups-address">' + A.esc(shop.address) + '</span>' : '') +
        '<span class="my-groups-shop-meta"><span class="my-groups-count">' + count + ' 團</span>' +
        (shop.matches.length < count ? '<span>符合 ' + shop.matches.length + ' 團</span>' : '') +
        '<span>' + groupDate(latest, true) + '</span></span><span class="my-groups-arrow" aria-hidden="true">›</span></button>';
    }

    function groupRow(group) {
      var id = A.esc(group.id, true);
      var ended = A.groupClosed(group);
      return '<li class="card my-groups-row"><div class="my-groups-row-info"><h3>' + A.esc(group.title || '未命名團購') +
        '</h3><div class="my-groups-row-meta"><span class="my-groups-badge" data-my-status="' + id + '" data-ended="' +
        ended + '">' + (ended ? '已結束' : '進行中') + '</span><span>' + groupDate(group, false) +
        '</span></div></div><div class="my-groups-links"><a class="btn" href="#/g/' + id + '">查看</a>' +
        '<a class="btn" href="#/g/' + id + '/admin">管理</a></div></li>';
    }

    function render() {
      if (!mounted()) return;
      if (readError) {
        refresh.disabled = false;
        putStatus(readError);
        results.innerHTML = '';
        return;
      }
      if (sources.size < paths.length || pending.size) {
        refresh.disabled = true;
        putStatus('正在整理你開過的團購…');
        results.innerHTML = '';
        return;
      }
      refresh.disabled = false;
      var groups = [];
      entries.forEach(function (entry) {
        if (entry.group) groups.push(entry.group);
      });
      var query = normalize(search.value);
      var shops = collectShops(groups, query);
      var shop = selectedShop && shops.get(selectedShop);
      if (shop) {
        putStatus('');
        var count = shop.matches.length;
        var total = shop.all.length;
        results.innerHTML = '<div class="my-groups-detail-heading"><button type="button" class="btn" data-my-back>← 返回店家</button>' +
          '<div><h2 tabindex="-1">' + A.esc(shop.name) + '</h2>' +
          '<p>' + (count < total ? '符合 ' + count + ' 團，共 ' + total + ' 團' : '共 ' + total + ' 團') +
          '</p></div></div><ul class="my-groups-list">' + shop.matches.map(groupRow).join('') + '</ul>';
        return;
      }
      selectedShop = '';
      if (!shops.size) {
        putStatus(groups.length && query ? '找不到符合的店家或團購。' : '目前查不到你開過的團購。');
        results.innerHTML = '';
        return;
      }
      putStatus(query ? '找到 ' + shops.size + ' 家店' : '');
      results.innerHTML = '<div class="my-groups-grid">' + Array.from(shops.values(), shopCard).join('') + '</div>';
    }

    // 同一團的欄位會同時讀，所以每個讀取各自登記取消函式（entry.cancels），不能共用一格
    function cancelEntry(entry) {
      Array.from(entry.cancels).forEach(function (cancel) { cancel(); });
    }

    function readField(entry, path) {
      return new Promise(function (resolve, reject) {
        var finished = false;
        var off;
        function cancel() { finish(reject, new Error('READ_CANCELLED')); }
        function finish(settle, value) {
          if (finished) return;
          finished = true;
          window.clearTimeout(timer);
          entry.cancels.delete(cancel);
          if (off) off();
          settle(value);
        }
        var timer = window.setTimeout(function () { finish(reject, new Error('READ_TIMEOUT')); }, readTimeout);
        entry.cancels.add(cancel);
        // Use a one-time listener so a stalled read can also be detached.
        off = A.DB.on(path, function (value) { finish(resolve, value); }, {
          onError: function (error) { finish(reject, error); }
        });
        if (finished) off();
      });
    }

    async function loadGroup(entry) {
      var base = 'groups/' + entry.id + '/';
      try {
        // 開團人與 6 個欄位同時讀，不再一個接一個等
        var values = await Promise.all(['ownerUserId'].concat(fields).map(function (field) {
          return readField(entry, base + field);
        }));
        if (!current(entry) || values[0] !== uid) return;
        var data = {};
        fields.forEach(function (field, i) { data[field] = values[i + 1]; });
        if (data.deleted) return;
        if (data.title == null && data['shop/name'] == null) return;
        entry.group = {
          id: entry.id, createdAt: Number(entry.row.createdAt) || 0, deadline: Number(entry.row.deadline) || 0,
          title: data.title, shopId: data.shopId, shopName: data['shop/name'], address: data['shop/address'],
          closed: data.closed
        };
      } catch (error) {
        cancelEntry(entry);
        if (current(entry) && !window.LunchGroupAccess.permissionDenied(error)) {
          failRead('有部分團購暫時無法讀取，請重新整理後再試。');
        }
      }
    }

    function pump() {
      while (mounted() && !readError && inFlight < maxReads && queue.length) {
        var entry = queue.shift();
        if (!current(entry)) continue;
        inFlight++;
        loadGroup(entry).finally(done.bind(null, entry));
      }
    }

    function done(entry) {
      inFlight--;
      pending.delete(entry);
      if (!mounted()) return;
      if (!pending.size) render();
      pump();
    }

    function sameRow(a, b) {
      return a.revision === b.revision && a.createdAt === b.createdAt && a.deadline === b.deadline;
    }

    function reconcile() {
      if (!mounted() || readError || sources.size < paths.length) return;
      var rows = new Map();
      sources.forEach(function (snapshot) {
        Object.keys(snapshot || {}).forEach(function (id) {
          var row = snapshot[id];
          if (!row || typeof row !== 'object' || !/^[^.#$\[\]/\x00-\x1f\x7f]+$/.test(id)) return;
          if (!rows.has(id) || Number(row.revision) >= Number(rows.get(id).revision)) rows.set(id, row);
        });
      });
      var changed = false;
      entries.forEach(function (entry, id) {
        if (rows.has(id) && sameRow(rows.get(id), entry.row)) return;
        entries.delete(id);
        pending.delete(entry);
        cancelEntry(entry);
        changed = true;
      });
      rows.forEach(function (row, id) {
        if (entries.has(id)) return;
        var entry = { id: id, row: row, group: null, cancels: new Set() };
        entries.set(id, entry);
        pending.add(entry);
        queue.push(entry);
        changed = true;
      });
      if (changed || refresh.disabled) render();
      pump();
    }

    function stopSources() {
      epoch++;
      window.clearTimeout(sourceTimer);
      unsubscribes.forEach(function (off) { off(); });
      unsubscribes = [];
      sources.clear();
      entries.forEach(cancelEntry);
      entries.clear();
      pending.clear();
      queue = [];
    }

    function failRead(message) {
      stopSources();
      readError = message;
      render();
    }

    function startSources() {
      stopSources();
      readError = '';
      reconcileQueued = false;
      var token = epoch;
      var indexError = '團購暫時無法讀取，請重新整理後再試。';
      function failIndex() {
        if (mounted() && token === epoch) failRead(indexError);
      }
      sourceTimer = window.setTimeout(failIndex, readTimeout);
      render();
      unsubscribes = paths.map(function (path) {
        return A.DB.on(path, function (value) {
          if (!mounted() || token !== epoch) return;
          sources.set(path, value);
          if (sources.size === paths.length) window.clearTimeout(sourceTimer);
          if (reconcileQueued) return;
          reconcileQueued = true;
          Promise.resolve().then(function () {
            if (token !== epoch) return;
            reconcileQueued = false;
            reconcile();
          });
        }, { onError: function () { Promise.resolve().then(failIndex); } });
      });
    }

    refresh.addEventListener('click', startSources);
    search.addEventListener('input', function () {
      selectedShop = '';
      render();
    });
    results.addEventListener('click', function (event) {
      var card = event.target.closest('[data-my-shop]');
      if (card) {
        selectedShop = card.dataset.myShop;
        shopScroll = window.scrollY;
        render();
        results.querySelector('h2').focus();
        return;
      }
      if (event.target.closest('[data-my-back]')) {
        var key = selectedShop;
        selectedShop = '';
        render();
        Array.prototype.find.call(results.querySelectorAll('[data-my-shop]'), function (button) {
          return button.dataset.myShop === key;
        })?.focus({ preventScroll: true });
        window.scrollTo(0, shopScroll);
      }
    });
    var statusTimer = window.setInterval(function () {
      results.querySelectorAll('[data-my-status]').forEach(function (badge) {
        var entry = entries.get(badge.dataset.myStatus);
        if (!entry || !entry.group) return;
        var ended = A.groupClosed(entry.group);
        if (badge.dataset.ended === String(ended)) return;
        badge.dataset.ended = String(ended);
        badge.textContent = ended ? '已結束' : '進行中';
      });
    }, 15000);
    startSources();

    return function () {
      alive = false;
      window.clearInterval(statusTimer);
      stopSources();
    };
  }

  A.registerRoute('my-groups', renderPage);
})();
