/* 會員模組：只有 Firebase Auth 驗證後才建立會員身分。 */
(function () {
  'use strict';
  var A, auth = null, verified = null, authReady = false, startupError = '', pendingNext = '', activeRefresh = null;
  var C = window.LUNCH_MEMBERS_CONFIG || window.LUNCH_MEMBER_CONFIG || {};
  var avatars = ['☀', '☁', '✦', '◒', '✿', '▰'];
  function esc(v) { return A.esc(String(v == null ? '' : v)); }
  function path(v) { return /^[A-Za-z0-9_-]{1,160}$/.test(String(v)); }
  function config() { return C.firebase || (A && Object.prototype.hasOwnProperty.call(A,'firebaseConfig') ? A.firebaseConfig : (typeof FIREBASE_CONFIG !== 'undefined' ? FIREBASE_CONFIG : null)); }
  function demo() { return C.demo === true && !config(); }
  function configured() { var c = config(); return !!(c && c.apiKey && c.authDomain && c.projectId && c.databaseURL); }
  function secure() { return (configured() || demo()) && (C.requireAuth === true || C.required === true); }
  function user() { return verified; }
  function go(h) { location.hash = h.indexOf('#/') === 0 ? h : '#/' + h.replace(/^\//, ''); }
  function safeNext(value) { return /^#\/(?!members\/login)[A-Za-z0-9_/?=&%+.#-]*$/.test(value || '') ? value : '#/members'; }
  function errorText(e) {
    var code = e && e.code;
    return ({'auth/user-cancelled':'你已取消登入，可隨時再試。','auth/cancelled-popup-request':'登入已取消，可隨時再試。','auth/popup-closed-by-user':'登入視窗已關閉，尚未登入。','auth/popup-blocked':'瀏覽器擋住登入視窗，請允許彈出視窗後重試。','auth/unauthorized-domain':'此網址尚未加入登入授權網域，請聯絡站長。','auth/operation-not-allowed':'此登入方式尚未由站長啟用。','auth/invalid-credential':'電子郵件或密碼不正確。','auth/email-already-in-use':'此電子郵件已註冊，請直接登入。','auth/weak-password':'請使用至少 8 個字元的密碼。','auth/too-many-requests':'嘗試次數過多，請稍後重試。','auth/network-request-failed':'網路連線失敗，請稍後重試。','PERMISSION_DENIED':'目前沒有讀取這些資料的權限。','permission_denied':'目前沒有讀取這些資料的權限。'})[code] || '操作未成功，請稍後重試；若持續發生，請聯絡站長確認登入設定與資料權限。';
  }
  function shell(title, body, hint) {
    return '<div class="page member-page"><div class="member-kicker">午餐團／會員專區</div><div class="member-heading"><div><h1>'+esc(title)+'</h1><p>'+esc(hint || '查看餐點、訂單與個人資料。')+'</p></div><a class="member-back" href="#/">回團訂首頁 ↗</a></div>'+body+'</div>';
  }
  function avatar(u, cls) { var av = Number(u && u.avatar); av = Number.isInteger(av) && av >= 0 && av < avatars.length ? av : 0; return '<span class="member-avatar '+(cls || '')+' tone-'+av+'" aria-hidden="true">'+avatars[av]+'</span>'; }
  function notify(root, message) { var el = root.querySelector('[data-member-status]'); if (el) { el.textContent = message; el.hidden = false; } }
  function messageBox() { return '<p class="member-status" data-member-status role="status" aria-live="polite" hidden></p>'; }
  function money(n) { return '$' + Math.round(Number(n) || 0).toLocaleString('zh-TW'); }
  function total(o) { return Number(A.orderTotal(o)) || 0; }
  function loginView(root, query) {
    if (demo()) return demoView(root,query);
    if (verified) { go(safeNext(query.next || pendingNext)); return; }
    var ready = configured();
    root.innerHTML = shell('會員登入', '<section class="member-login"><div class="member-art" aria-hidden="true"><span>一起</span><span>吃飯</span><i>午餐有人作伴</i><div class="member-art-orb">✦</div></div><div class="member-login-form"><p class="member-kicker">你的午餐帳號</p><h2>使用帳戶登入</h2><p class="member-muted">登入後，在不同裝置查看自己的訂單與個人資料。</p>'+(!ready ? '<div class="member-notice"><strong>會員登入尚待啟用</strong><p>站長仍需完成帳戶登入設定與存取權限。現在仍可返回公開團訂頁。</p></div>' : '<button class="btn primary member-google" type="button" data-google>使用帳戶登入 ↗</button>'+(C.providers && C.providers.indexOf('email') >= 0 ? '<details class="member-email"><summary>使用電子郵件與密碼</summary><form data-email><label>電子郵件<input name="email" type="email" autocomplete="email" required maxlength="200"></label><label>密碼<input name="password" type="password" autocomplete="current-password" minlength="8" required maxlength="128"></label><div class="actions"><button class="btn primary" type="submit">登入</button><button class="btn" type="button" data-signup>註冊帳戶</button></div></form><button class="member-link" type="button" data-reset>忘記密碼</button></details>' : '') )+messageBox()+'<p class="member-fine">選擇個人頭像是外觀設定；登入身分由帳戶服務驗證。</p></div></section>');
    if (!ready) return;
    if (startupError) notify(root, startupError);
    function run(fn) { if (!authReady || !auth) { notify(root, startupError || '登入服務載入中，請稍後再試。'); return; } Array.from(root.querySelectorAll('button')).forEach(function(b) { b.disabled = true; }); Promise.resolve().then(fn).catch(function(e) { notify(root, errorText(e)); }).finally(function() { Array.from(root.querySelectorAll('button')).forEach(function(b) { b.disabled = false; }); }); }
    root.querySelector('[data-google]').onclick = function() { pendingNext = safeNext(query.next || pendingNext); run(function() { return auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }); };
    var f = root.querySelector('[data-email]');
    if (f) {
      f.onsubmit = function(e) { e.preventDefault(); pendingNext = safeNext(query.next || pendingNext); run(function() { return auth.signInWithEmailAndPassword(f.email.value.trim(), f.password.value); }); };
      root.querySelector('[data-signup]').onclick = function() { if (!f.reportValidity()) return; pendingNext = safeNext(query.next || pendingNext); run(function() { return auth.createUserWithEmailAndPassword(f.email.value.trim(), f.password.value).then(function(r) { return r.user.sendEmailVerification(); }); }); };
      root.querySelector('[data-reset]').onclick = function() { if (!f.email.value.trim()) { notify(root, '請先填寫電子郵件。'); return; } run(function() { return auth.sendPasswordResetEmail(f.email.value.trim()).then(function() { notify(root, '若此電子郵件可重設密碼，你將收到重設信。'); }); }); };
    }
  }
  function demoView(root,query) {
    root.innerHTML=shell('會員登入', '<section class="member-login"><div class="member-art" aria-hidden="true"><span>一起</span><span>吃飯</span><i>午餐有人作伴</i><div class="member-art-orb">✦</div></div><form class="member-login-form member-editor" data-demo><p class="member-kicker">本機示範</p><h2>選擇個人頭像</h2><div class="member-notice"><strong>本機示範會員，不是真實登入</strong><p>資料只存在這個瀏覽器，無法跨裝置同步。正式網站必須完成帳戶身分驗證。</p></div><fieldset class="member-avatars"><legend>選擇頭像</legend>'+avatars.map(function(a,i){return '<label><input type="radio" name="avatar" value="'+i+'" '+(!i?'checked':'')+'><span class="member-avatar tone-'+i+'" aria-label="頭像 '+(i+1)+'">'+a+'</span></label>';}).join('')+'</fieldset><label>顯示名字<input name="displayName" required maxlength="30" autocomplete="name" placeholder="怎麼稱呼你？"></label><label>部門<input name="department" maxlength="40" placeholder="例如：設計部"></label><button class="btn primary" type="submit">進入本機示範 →</button></form></section>');
    root.querySelector('[data-demo]').onsubmit=function(e){e.preventDefault();var f=e.currentTarget,name=f.displayName.value.trim();if(!name)return;var uid='demo-member';try{uid=localStorage.getItem('lunch_demo_member_uid') || ('demo-'+Date.now().toString(36));localStorage.setItem('lunch_demo_member_uid',uid);}catch(ignore){}verified={uid:uid,id:uid,name:name,department:f.department.value.trim(),avatar:Number(f.avatar.value),demo:true,authenticated:false,admin:true};A.setUser(verified);go(safeNext(query.next || pendingNext));pendingNext='';};
  }
  function profileView(root) {
    var u = verified;
    root.innerHTML = shell('我的帳號', '<div class="member-dashboard"><section class="member-profile">'+avatar(u, 'member-avatar-large')+'<p class="member-kicker">個人資料</p><h2>'+esc(u.name || '午餐夥伴')+'</h2><p>'+esc(u.department || '尚未設定部門')+'</p><span class="member-verified">'+(u.demo ? '本機示範會員，不是真實登入' : '✓ 帳號已驗證')+'</span><p class="member-fine">'+esc(auth && auth.currentUser && auth.currentUser.email || '')+'</p><div class="actions"><a class="btn primary" href="#/members/orders">我的訂單 ↗</a><button class="btn" type="button" data-logout>登出</button></div></section><form class="member-editor" data-profile><h2>個人資料</h2><p class="member-muted">名字方便團主核對，會員識別使用專屬帳號。</p><fieldset class="member-avatars"><legend>選擇個人頭像</legend>'+avatars.map(function(a,i) { return '<label><input type="radio" name="avatar" value="'+i+'" '+(Number(u.avatar || 0) === i ? 'checked' : '')+'><span class="member-avatar tone-'+i+'" aria-label="頭像 '+(i+1)+'">'+a+'</span></label>'; }).join('')+'</fieldset><label>顯示名字<input name="displayName" required maxlength="30" autocomplete="name" value="'+esc(u.name)+'"></label><label>部門<input name="department" maxlength="40" autocomplete="organization" value="'+esc(u.department)+'"></label><button class="btn primary" type="submit">儲存個人資料</button>'+messageBox()+'</form></div>');
    root.querySelector('[data-logout]').onclick = function() { if(demo()){verified=null;A.setUser(null);go('#/members/login');}else auth.signOut().catch(function(e) { notify(root,errorText(e)); }); };
    root.querySelector('[data-profile]').onsubmit = function(e) { e.preventDefault(); var f = e.currentTarget, name = f.displayName.value.trim(); if (!name) return; var p = {name:name,department:f.department.value.trim(),avatar:Number(f.avatar.value),updatedAt:A.now()}; var b = f.querySelector('button'); b.disabled = true; A.DB.update('members/'+u.uid,p).then(function() { Object.assign(verified,p); A.setUser(verified); A.toast('個人資料已儲存'); }).catch(function(er) { notify(root,errorText(er)); }).finally(function() { b.disabled=false; }); };
  }
  function orderView(root) {
    var alive = true, uid = verified.uid, groups = Object.create(null);
    root.innerHTML = shell('我的訂單', '<div class="member-toolbar"><a href="#/members">← 個人資料</a><span>'+(demo() ? '本機示範 · 不會跨裝置同步' : '跨裝置同步 · 只顯示此帳號訂單')+'</span></div><div data-order-content class="member-loading" role="status">正在讀取你的訂單…</div>'+messageBox());
    function groupData(gid) {
      if (!groups[gid]) groups[gid] = Promise.all([A.DB.get('groups/'+gid), A.DB.get('orders/'+gid)]).then(function(v) {
        if (!v[0]) throw new Error('GROUP_MISSING');
        return {group:v[0], orders:v[1] || {}, settled:A.settlement(v[1] || {},v[0])};
      });
      return groups[gid];
    }
    A.DB.get('userOrders/'+uid).then(function(index) {
      if (!alive) return [];
      var tasks = [];
      Object.keys(index || {}).forEach(function(gid) {
        if (!path(gid)) return;
        var ids = Object.keys(index[gid] || {}).filter(function(oid) { return path(oid) && index[gid][oid]; });
        if (!ids.length) return;
        tasks.push(groupData(gid).then(function(data) {
          if (!alive) return [];
          return Promise.all(ids.map(function(oid) {
            var o = data.orders[oid];
            if (!o || o.userId !== uid) return null;
            return A.DB.get('paid/'+gid+'/'+oid).then(function(paid) {
              var bill = o.cancelled ? {base:total(o),shipping:0,discount:0,due:0,lineDues:[]} : data.settled.orders[oid];
              if (!bill && !Object.keys(o.items || {}).length) bill = {base:0,shipping:0,discount:0,due:0,lineDues:[]};
              if (!bill) throw new Error('SETTLEMENT_MISSING');
              var received = bill.lineDues.reduce(function(sum,n,i) { return sum + (paid && paid[i] ? Number(n) : 0); },0);
              return {gid:gid,oid:oid,order:o,group:data.group,bill:bill,received:received,pending:bill.due-received};
            });
          }));
        }));
      });
      return Promise.all(tasks).then(function(rows) { return [].concat.apply([],rows).filter(Boolean); });
    }).then(function(rows) {
      if (!alive) return;
      rows.sort(function(a,b) { return (b.order.createdAt || 0) - (a.order.createdAt || 0); });
      var live = rows.filter(function(r) { return !r.order.cancelled; });
      function sum(key) { return live.reduce(function(s,r) { return s+(key === 'received' || key === 'pending' ? r[key] : r.bill[key]); },0); }
      var metrics = [['有效訂單',live.length],['餐點原價',money(sum('base'))],['運費',money(sum('shipping'))],['折扣',money(sum('discount'))],['應付',money(sum('due'))],['已收',money(sum('received'))],['待付',money(sum('pending'))]];
      root.querySelector('[data-order-content]').innerHTML = '<div class="member-metrics">'+metrics.map(function(m) { return '<div><span>'+m[0]+'</span><b>'+m[1]+'</b></div>'; }).join('')+'</div>'+(rows.length ? '<div class="member-orders">'+rows.map(function(r) {
        var o = r.order, bill = r.bill;
        var state = o.cancelled ? '已取消 · 不計入總計' : r.pending === 0 ? '已收齊' : r.received > 0 ? '部分收款' : '待付款';
        return '<article class="member-order"><div><span class="member-kicker">'+state+'</span><h2>'+esc(r.group.title || '未命名團購')+'</h2><p>'+esc(new Date(o.createdAt || 0).toLocaleString('zh-TW'))+'</p></div><strong>應付 '+money(bill.due)+'</strong><ul>'+Object.values(o.items || {}).map(function(it) { return '<li>'+esc(typeof A.lineLabel === 'function' ? A.lineLabel(it) : it.name || it.item || '餐點')+' × '+esc(it.qty || 0)+'</li>'; }).join('')+'</ul><p class="member-fine">餐點原價 '+money(bill.base)+' · 運費 '+money(bill.shipping)+' · 折扣 '+money(bill.discount)+'</p><p>已收 '+money(r.received)+' · 待付 '+money(r.pending)+'</p>'+(!r.group.deleted ? '<a class="member-link" href="#/g/'+esc(r.gid)+'">查看團購 ↗</a>' : '')+'</article>';
      }).join('')+'</div>' : '<div class="member-empty"><span>◒</span><h2>目前沒有訂單</h2><p>此會員帳號尚無訂單。舊裝置的匿名訂單不會自動歸入同名會員。</p><a class="btn primary" href="#/">去看看開放中的團購</a></div>')+'<div class="member-notice"><strong>關於先前的匿名訂單</strong><p>舊資料仍保留於原團購及原裝置；名字相同不代表相同帳號，因此不會自動認領。需要轉移時，請由團主核對訂單與本人身分後另行處理。</p></div>';
    }).catch(function(e) {
      if (!alive) return;
      root.querySelector('[data-order-content]').textContent = '目前無法完整讀取訂單與收款資料，金額尚未確認。';
      notify(root,e.message === 'GROUP_MISSING' ? '部分團購資料已不存在，無法確認運費與折扣，請聯絡團主。' : e.message === 'SETTLEMENT_MISSING' ? '部分訂單無法結算，請聯絡團主確認餐點資料。' : errorText(e));
    });
    return function() { alive=false; };
  }
  function collectionView(root,gid) {
    var alive=true; if (!path(gid)) { root.innerHTML=shell('找不到這個團購','<p>請從團購管理頁重新開啟。</p>'); return; }
    root.innerHTML=shell('會員收款統計','<p role="status">正在核對團主權限…</p>');
    A.DB.get('groups/'+gid).then(function(g) { if (!g || g.ownerUserId !== verified.uid && !verified.admin) throw new Error('OWNER'); return Promise.all([Promise.resolve(g), A.DB.get('orders/'+gid), A.DB.get('paid/'+gid)]); }).then(function(v) {
      if (!alive) return; var g=v[0],orders=v[1] || {},paid=v[2] || {},members={},sum=0,received=0,settled=typeof A.settlement === 'function' ? A.settlement(orders,g) : null;
      Object.keys(orders).forEach(function(id) { var o=orders[id]; if (!o || o.cancelled) return; var key=o.userId || 'legacy:'+id; if(!members[key])members[key]={name:o.name || '未填名字',uid:o.userId,amount:0,received:0,count:0}; var m=members[key]; m.count++; Object.values(o.items || {}).forEach(function(it,i) { var bill=settled && settled.orders && settled.orders[id]; var n = bill && bill.lineDues && bill.lineDues[i] != null ? Number(bill.lineDues[i]) : (typeof A.lineTotal === 'function' ? A.lineTotal(it) : Number(it.price || 0)*Number(it.qty || 0)); m.amount+=n;sum+=n;if(paid[id] && paid[id][i]) {m.received+=n;received+=n;} }); });
      root.innerHTML=shell('會員收款統計','<div class="member-toolbar"><a href="#/g/'+esc(gid)+'/admin">← 回團購管理</a><span>'+esc(g.title)+'</span></div><div class="member-metrics"><div><span>應收</span><b>'+money(sum)+'</b></div><div><span>已收</span><b>'+money(received)+'</b></div><div><span>待收</span><b>'+money(sum-received)+'</b></div></div><div class="member-table-wrap"><table class="member-table"><thead><tr><th>會員 / 訂購人</th><th>訂單數</th><th>應收</th><th>已收</th><th>待收</th></tr></thead><tbody>'+Object.keys(members).map(function(k) { var m=members[k]; return '<tr><td>'+esc(m.name)+'<small>'+(m.uid ? '會員訂單' : '舊版匿名訂單 · 未認領')+'</small></td><td>'+m.count+'</td><td>'+money(m.amount)+'</td><td>'+money(m.received)+'</td><td>'+money(m.amount-m.received)+'</td></tr>'; }).join('')+'</tbody></table></div><p class="member-fine">依專屬會員識別彙整；同名帳號不會合併。收款狀態請於團購管理更新。</p>');
    }).catch(function(e) { if(alive) root.innerHTML=shell('無法開啟收款統計','<div class="member-notice">'+(e.message === 'OWNER' ? '僅此團已驗證的團主可以查看。舊團不會自動由同名帳號接管。' : esc(errorText(e)))+'</div>'); });
    return function(){alive=false;};
  }
  function guardRoute(_,parts,query,href) {
    if (!secure() || parts[0] === 'members') return true;
    if (verified) return true;
    pendingNext=safeNext(href); go('#/members/login?next='+encodeURIComponent(pendingNext)); return false;
  }
  function render(root,parts,query) {
    query=query || {}; if (!(query instanceof Object)) query={};
    if (query instanceof URLSearchParams) { var q={}; query.forEach(function(v,k){q[k]=v;});query=q; }
    var page=parts[1] || '';
    if (!verified) { if (!query.next && location.hash.indexOf('/members/login') < 0) pendingNext=safeNext(location.hash); return loginView(root,query); }
    if (page === 'orders') return orderView(root);
    if (page === 'collection') return collectionView(root,parts[2]);
    return profileView(root);
  }
  function loadScript(src) { return new Promise(function(resolve,reject){var s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=function(){reject(new Error('SDK'));};document.head.appendChild(s);}); }
  function initAuth() {
    if (!configured()) return;
    var appReady=typeof A.firebaseReady === 'function' ? A.firebaseReady() : Promise.resolve();
    appReady.then(function(){ if(!window.firebase) return loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js'); }).then(function(){if(!firebase.apps.length)firebase.initializeApp(config());return typeof firebase.auth === 'function' ? null : loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js');}).then(function(){auth=firebase.auth();return auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);}).then(function(){auth.onAuthStateChanged(function(fu){authReady=true;var expected=fu&&fu.uid; verified=null;
      if (!fu) { A.setUser(null); if(location.hash.indexOf('#/members')===0)A.route(); return; }
      Promise.all([A.DB.get('members/'+fu.uid),fu.getIdTokenResult()]).then(function(values){var p=values[0],claims=values[1].claims || {}; if(!auth.currentUser || auth.currentUser.uid!==expected)return;p=p||{};verified={uid:fu.uid,id:fu.uid,name:p.name || fu.displayName || '午餐夥伴',department:p.department || '',avatar:p.avatar || 0,authenticated:true,admin:claims.email_verified === true && claims.email === 'junworkgogo@gmail.com'};A.setUser(verified);var next=pendingNext;pendingNext='';if(next && location.hash.indexOf('#/members')===0)go(next);else if(location.hash.indexOf('#/members')===0)A.route();}).catch(function(){startupError='無法確認帳號權限，請重新登入。';verified=null;A.setUser(null);});
    });}).catch(function(){startupError='會員登入載入失敗，請聯絡站長檢查登入設定與授權網域。';if(location.hash.indexOf('#/members')===0)A.route();});
  }
  function updateNav() {
    var nav=document.querySelector('header .nav');if(!nav)return;
    var el=nav.querySelector('[data-members-nav]');if(!el){el=document.createElement('span');el.setAttribute('data-members-nav','');el.className='member-nav';nav.appendChild(el);}
    el.innerHTML=verified ? '<a class="btn sm" href="#/members/orders">我的訂單</a><a class="member-nav-profile" href="#/members" aria-label="我的會員資料">'+avatar(verified)+'<span>'+esc(verified.name)+'</span></a><button type="button" class="member-nav-logout" data-member-nav-logout>登出</button>' : '<a class="btn sm primary" href="#/members/login">會員登入</a>';
    var b=el.querySelector('[data-member-nav-logout]');if(b)b.onclick=function(){if(demo()){verified=null;A.setUser(null);go('#/members/login');}else if(auth)auth.signOut().catch(function(){A.toast('登出未成功，請稍後重試');});};
  }
  function start() {
    A=window.LunchApp; if(!A)return;
    A.registerRoute('members',render);
    if(typeof A.setRouteGuard==='function')A.setRouteGuard(guardRoute);
    window.LunchMembers={guardRoute:guardRoute,getUser:user,isConfigured:configured,isSecure:secure};
    window.addEventListener('lunch:userchange',updateNav);
    updateNav();
    A.route();
    initAuth();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
