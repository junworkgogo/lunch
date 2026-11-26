/* 會員模組：只有 Firebase Auth 驗證後才建立會員身分。 */
(function () {
  'use strict';
  var A, auth = null, verified = null, authReady = false, startupError = '', pendingNext = '', activeRefresh = null;
  /* settled：已經知道「有沒有登入」（含讀完會員資料）。還不知道時先顯示「確認登入狀態中」，不急著送去登入頁。 */
  var settled = false, settleTimer = null, roleOff=null, roleWrites = new Map();
  var C = window.LUNCH_MEMBERS_CONFIG || window.LUNCH_MEMBER_CONFIG || {};
  // 2026-11-18 內建頭貼改成 7 個部門的簡易可愛圖（順序對應 departments：設計、企劃、影相、會計、工程、廣告、BOSS們）
  var avatars = ["<svg viewBox=\"0 0 40 40\" width=\"1.15em\" height=\"1.15em\" aria-hidden=\"true\" focusable=\"false\"><rect x=\"12\" y=\"3.5\" width=\"16\" height=\"5.5\" rx=\"2.6\" fill=\"currentColor\"/><rect x=\"12\" y=\"9\" width=\"16\" height=\"3.5\" fill=\"#fff\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linejoin=\"round\"/><rect x=\"12\" y=\"12.5\" width=\"16\" height=\"15\" fill=\"#fff\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linejoin=\"round\"/><path d=\"M12 27.5 20 37.5 28 27.5Z\" fill=\"#fff\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linejoin=\"round\"/><path d=\"M17.6 34.5 20 37.5 22.4 34.5Z\" fill=\"currentColor\"/><circle cx=\"17\" cy=\"19\" r=\"1.3\" fill=\"#3b2b20\"/><circle cx=\"23\" cy=\"19\" r=\"1.3\" fill=\"#3b2b20\"/><path d=\"M18.2 21.3q1.8 1.9 3.6 0\" fill=\"none\" stroke=\"#3b2b20\" stroke-width=\"1.3\" stroke-linecap=\"round\"/><circle cx=\"14.7\" cy=\"21.2\" r=\"1.2\" fill=\"#ff9d6b\" opacity=\".6\"/><circle cx=\"25.3\" cy=\"21.2\" r=\"1.2\" fill=\"#ff9d6b\" opacity=\".6\"/></svg>", "<svg viewBox=\"0 0 40 40\" width=\"1.15em\" height=\"1.15em\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M7 6.5l2.6 2.6M33 6.5l-2.6 2.6M20 1.8v3\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\"/><circle cx=\"20\" cy=\"17.5\" r=\"10.5\" fill=\"#fff\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linejoin=\"round\"/><rect x=\"15\" y=\"27\" width=\"10\" height=\"4\" rx=\"1.6\" fill=\"currentColor\"/><rect x=\"16.5\" y=\"32.2\" width=\"7\" height=\"3.4\" rx=\"1.6\" fill=\"currentColor\"/><circle cx=\"16.8\" cy=\"17.5\" r=\"1.35\" fill=\"#3b2b20\"/><circle cx=\"23.2\" cy=\"17.5\" r=\"1.35\" fill=\"#3b2b20\"/><path d=\"M18.2 19.8q1.8 1.9 3.6 0\" fill=\"none\" stroke=\"#3b2b20\" stroke-width=\"1.3\" stroke-linecap=\"round\"/><circle cx=\"14\" cy=\"19.7\" r=\"1.4\" fill=\"#ff9d6b\" opacity=\".6\"/><circle cx=\"26\" cy=\"19.7\" r=\"1.4\" fill=\"#ff9d6b\" opacity=\".6\"/></svg>", "<svg viewBox=\"0 0 40 40\" width=\"1.15em\" height=\"1.15em\" aria-hidden=\"true\" focusable=\"false\"><rect x=\"12.5\" y=\"7\" width=\"9\" height=\"6\" rx=\"1.8\" fill=\"currentColor\"/><rect x=\"4.5\" y=\"11\" width=\"31\" height=\"21.5\" rx=\"5.5\" fill=\"#fff\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linejoin=\"round\"/><circle cx=\"20\" cy=\"21.8\" r=\"7.6\" fill=\"#fff\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linejoin=\"round\"/><circle cx=\"30.2\" cy=\"15.6\" r=\"1.5\" fill=\"currentColor\"/><circle cx=\"17.3\" cy=\"21.2\" r=\"1.25\" fill=\"#3b2b20\"/><circle cx=\"22.7\" cy=\"21.2\" r=\"1.25\" fill=\"#3b2b20\"/><path d=\"M18.2 23.5q1.8 1.9 3.6 0\" fill=\"none\" stroke=\"#3b2b20\" stroke-width=\"1.3\" stroke-linecap=\"round\"/></svg>", "<svg viewBox=\"0 0 40 40\" width=\"1.15em\" height=\"1.15em\" aria-hidden=\"true\" focusable=\"false\"><rect x=\"8.5\" y=\"3.5\" width=\"23\" height=\"33\" rx=\"5.5\" fill=\"#fff\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linejoin=\"round\"/><rect x=\"12\" y=\"7\" width=\"16\" height=\"11\" rx=\"2.6\" fill=\"currentColor\" opacity=\".2\"/><circle cx=\"14.5\" cy=\"24\" r=\"1.7\" fill=\"currentColor\"/><circle cx=\"20\" cy=\"24\" r=\"1.7\" fill=\"currentColor\"/><circle cx=\"25.5\" cy=\"24\" r=\"1.7\" fill=\"currentColor\"/><circle cx=\"14.5\" cy=\"30\" r=\"1.7\" fill=\"currentColor\"/><circle cx=\"20\" cy=\"30\" r=\"1.7\" fill=\"currentColor\"/><circle cx=\"25.5\" cy=\"30\" r=\"1.7\" fill=\"currentColor\"/><circle cx=\"17\" cy=\"12\" r=\"1.25\" fill=\"#3b2b20\"/><circle cx=\"23\" cy=\"12\" r=\"1.25\" fill=\"#3b2b20\"/><path d=\"M18.2 14.3q1.8 1.9 3.6 0\" fill=\"none\" stroke=\"#3b2b20\" stroke-width=\"1.3\" stroke-linecap=\"round\"/><circle cx=\"14.4\" cy=\"14.2\" r=\"1.1\" fill=\"#ff9d6b\" opacity=\".6\"/><circle cx=\"25.6\" cy=\"14.2\" r=\"1.1\" fill=\"#ff9d6b\" opacity=\".6\"/></svg>", "<svg viewBox=\"0 0 40 40\" width=\"1.15em\" height=\"1.15em\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M20 4.5v4\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\"/><circle cx=\"20\" cy=\"3.6\" r=\"2.2\" fill=\"currentColor\"/><rect x=\"3.8\" y=\"16.5\" width=\"4.6\" height=\"9\" rx=\"2.2\" fill=\"currentColor\"/><rect x=\"31.6\" y=\"16.5\" width=\"4.6\" height=\"9\" rx=\"2.2\" fill=\"currentColor\"/><rect x=\"8\" y=\"8.5\" width=\"24\" height=\"23\" rx=\"7.5\" fill=\"#fff\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linejoin=\"round\"/><circle cx=\"16.2\" cy=\"19.5\" r=\"1.6\" fill=\"#3b2b20\"/><circle cx=\"23.8\" cy=\"19.5\" r=\"1.6\" fill=\"#3b2b20\"/><path d=\"M18.2 21.8q1.8 1.9 3.6 0\" fill=\"none\" stroke=\"#3b2b20\" stroke-width=\"1.3\" stroke-linecap=\"round\"/><circle cx=\"13\" cy=\"21.7\" r=\"1.4\" fill=\"#ff9d6b\" opacity=\".6\"/><circle cx=\"27\" cy=\"21.7\" r=\"1.4\" fill=\"#ff9d6b\" opacity=\".6\"/></svg>", "<svg viewBox=\"0 0 40 40\" width=\"1.15em\" height=\"1.15em\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M29 13.5q3.2 6.5 0 13M32.8 10.2q5.4 9.8 0 19.6\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\"/><path d=\"M13.8 26.5l1.8 7.2h4.2l-1.6-6.4\" fill=\"currentColor\"/><path d=\"M8 14.2 25 7.5v25L8 25.8Z\" fill=\"#fff\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linejoin=\"round\"/><rect x=\"3.6\" y=\"13.6\" width=\"6\" height=\"12.8\" rx=\"2.2\" fill=\"currentColor\"/><circle cx=\"14.3\" cy=\"20\" r=\"1.25\" fill=\"#3b2b20\"/><circle cx=\"19.7\" cy=\"20\" r=\"1.25\" fill=\"#3b2b20\"/><path d=\"M15.2 22.3q1.8 1.9 3.6 0\" fill=\"none\" stroke=\"#3b2b20\" stroke-width=\"1.3\" stroke-linecap=\"round\"/></svg>", "<svg viewBox=\"0 0 40 40\" width=\"1.15em\" height=\"1.15em\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M6 14.5l7.2 6.3L20 9.5l6.8 11.3 7.2-6.3-2.6 15.5H8.6Z\" fill=\"#fff\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linejoin=\"round\"/><circle cx=\"6\" cy=\"13.5\" r=\"2.2\" fill=\"currentColor\"/><circle cx=\"20\" cy=\"8.3\" r=\"2.4\" fill=\"currentColor\"/><circle cx=\"34\" cy=\"13.5\" r=\"2.2\" fill=\"currentColor\"/><circle cx=\"16.6\" cy=\"23.5\" r=\"1.3\" fill=\"#3b2b20\"/><circle cx=\"23.4\" cy=\"23.5\" r=\"1.3\" fill=\"#3b2b20\"/><path d=\"M18.2 25.8q1.8 1.9 3.6 0\" fill=\"none\" stroke=\"#3b2b20\" stroke-width=\"1.3\" stroke-linecap=\"round\"/><circle cx=\"13.8\" cy=\"25.7\" r=\"1.3\" fill=\"#ff9d6b\" opacity=\".6\"/><circle cx=\"26.2\" cy=\"25.7\" r=\"1.3\" fill=\"#ff9d6b\" opacity=\".6\"/></svg>"];
  var departments = ['設計部', '企劃部', '影相部', '會計部', '工程部', '廣告部', 'BOSS們'];
  function departmentInput(value) {
    return '<input name="department" value="'+A.esc(value,true)+'" required maxlength="40" list="departmentSuggestions" autocomplete="organization" placeholder="輸入或選擇部門">'+
      '<datalist id="departmentSuggestions">'+departments.map(function(d){return '<option value="'+esc(d)+'"></option>';}).join('')+'</datalist>';
  }
  function esc(v) { return A.esc(String(v == null ? '' : v)); }
  function path(v) { return /^[A-Za-z0-9_-]{1,160}$/.test(String(v)); }
  function config() { return C.firebase || (A && Object.prototype.hasOwnProperty.call(A,'firebaseConfig') ? A.firebaseConfig : (typeof FIREBASE_CONFIG !== 'undefined' ? FIREBASE_CONFIG : null)); }
  function demo() { return C.demo === true && !config(); }
  function configured() { var c = config(); return !!(c && c.apiKey && c.authDomain && c.projectId && c.databaseURL); }
  function secure() { return (configured() || demo()) && (C.requireAuth === true || C.required === true); }
  function user() { return verified; }
  function go(h) { location.hash = h.indexOf('#/') === 0 ? h : '#/' + h.replace(/^\//, ''); }
  function safeNext(value) { return /^#\/(?!members\/login)[A-Za-z0-9_/?=&%+.#-]*$/.test(value || '') ? value : '#/'; }
  function errorText(e) {
    var code = e && e.code;
    return ({'auth/user-cancelled':'你已取消登入，可隨時再試。','auth/cancelled-popup-request':'登入已取消，可隨時再試。','auth/popup-closed-by-user':'登入視窗已關閉，尚未登入。','auth/popup-blocked':'瀏覽器擋住登入視窗，請允許彈出視窗後重試。','auth/unauthorized-domain':'此網址尚未加入登入授權網域，請聯絡站長。','auth/operation-not-allowed':'此登入方式尚未由站長啟用。','auth/invalid-credential':'電子郵件或密碼不正確。','auth/email-already-in-use':'此電子郵件已註冊，請直接登入。','auth/weak-password':'請使用至少 8 個字元的密碼。','auth/too-many-requests':'嘗試次數過多，請稍後重試。','auth/network-request-failed':'網路連線失敗，請稍後重試。','PERMISSION_DENIED':'目前沒有讀取這些資料的權限。','permission_denied':'目前沒有讀取這些資料的權限。'})[code] || '操作未成功，請稍後重試；若持續發生，請聯絡站長確認登入設定與資料權限。';
  }
  // 返回連結統一放在大標上方的小膠囊（2026-11-18）；back＝[網址, 文字]，沒給就回首頁。
  var BACK_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  function shell(title, body, hint, back) {
    back = back || ['#/', '回首頁'];
    return '<div class="page member-page"><a class="backlink member-backlink" href="'+esc(back[0])+'">'+BACK_ICON+esc(back[1])+'</a><div class="member-kicker">FOODJUN／會員專區</div><div class="member-heading"><div><h1>'+esc(title)+'</h1>'+(hint?'<p>'+esc(hint)+'</p>':'')+'</div></div>'+body+'</div>';
  }
  // 2026-11-25 使用者畫的專屬頭貼（橘底線稿）：依姓名對應，只出現在「本人」的頭貼選單；選了才把圖存進自己的 avatarImage。
  // 新增一位：assets/ 放 160×160 webp，下面 map 加一行；要當他的預設頭貼，另外把圖寫進他的 members／memberAvatars（見專案 CLAUDE.md）。
  function memberPhotoByName(name) { var n=String(name||'').trim().toLowerCase().replace(/\s+/g,' ');var map={'江':'jiang','毛子':'maozi','eason':'eason','eason liu':'eason','eason（哥）':'eason','eason(哥)':'eason','哥':'eason'};var key=map[n]||(isJunDoodle(n)?'jun':'');return key?'./assets/'+key+'.webp?v=20261125own1':''; }
  var ownAvatarCache={};
  function ownAvatarData(name) { var src=memberPhotoByName(name);if(!src)return Promise.resolve('');if(!ownAvatarCache[src])ownAvatarCache[src]=fetch(src).then(function(r){if(!r.ok)throw new Error('專屬頭貼載入失敗');return r.arrayBuffer();}).then(function(buf){var b=new Uint8Array(buf),s='';for(var i=0;i<b.length;i+=8192)s+=String.fromCharCode.apply(null,b.subarray(i,i+8192));return 'data:image/webp;base64,'+btoa(s);}).catch(function(e){delete ownAvatarCache[src];throw e;});return ownAvatarCache[src]; }
  // Only replace an older fluorescent-green uploaded image. Other user-selected photos remain untouched.
  // Recolor the logged-in Jun's existing fluorescent-green avatar without recreating the artwork.
  function isJunDoodle(name) { return /^jun(?:$|[\s(（]|胖達)/i.test(String(name||'').trim()); }
  // Presets use lossless source recolors; Jun's uploaded image can be recolored locally if not in the repo.
  function recolorIfGreen(img) {
    if(!img)return;
    var preset=img.getAttribute('data-orange-avatar')||'';
    try {
      if(/^data:image\//.test(img.getAttribute('src')||'')) {
        var sw=document.createElement('canvas'),sc=sw.getContext('2d');
        sw.width=1;sw.height=1;
        if(sc && img.naturalWidth>0 && img.naturalHeight>0) {
          var sample=Math.max(1,Math.min(12,img.naturalWidth,img.naturalHeight));
          sc.drawImage(img,0,0,sample,sample,0,0,1,1);
          var pix=sc.getImageData(0,0,1,1).data;
          if(pix[1]>185 && pix[1]>pix[0]*1.13 && pix[0]>90 && pix[2]<110) {
            img.removeAttribute('onload');
            if(preset) {
              img.src=preset;
            } else if(img.hasAttribute('data-orange-jun')) {
              var canvas=document.createElement('canvas'),scale=Math.min(1,512/img.naturalWidth);
              canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
              canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
              var ctx=canvas.getContext('2d',{willReadFrequently:true});
              if(ctx) {
                ctx.drawImage(img,0,0,canvas.width,canvas.height);
                var pixels=ctx.getImageData(0,0,canvas.width,canvas.height),arr=pixels.data;
                for(var k=0;k<arr.length;k+=4) {
                  var visible=Math.min(1,arr[k+1]/pix[1]);
                  arr[k]=Math.round(255*visible);
                  arr[k+1]=Math.round(193*visible);
                  arr[k+2]=Math.round(138*visible);
                }
                ctx.putImageData(pixels,0,0);
                img.src=canvas.toDataURL('image/png');
              }
            }
          }
        }
      }
    } catch(ignore) {}
    img.style.visibility='visible';
  }
  function avatar(u, cls) { var preset=memberPhotoByName(u&&u.name);var data=u&&typeof u.avatarImage==='string'?u.avatarImage:'';if(data && data.length<=40000 && /^data:image\/(webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(data))return '<span class="member-avatar member-avatar-photo '+(cls||'')+'"><img src="'+esc(data)+'" alt="個人頭貼"'+(preset||isJunDoodle(u&&u.name)?' data-orange-avatar="'+esc(preset)+'"'+(isJunDoodle(u&&u.name)?' data-orange-jun="1"':'')+' style="visibility:hidden" onload="window.LunchMembers&&window.LunchMembers.recolorIfGreen(this)" onerror="this.style.visibility=\'visible\'"':'')+'></span>';var av=Number(u&&u.avatar);av=Number.isInteger(av)&&av>=0&&av<avatars.length?av:0;return '<span class="member-avatar '+(cls||'')+' tone-'+av+'" aria-hidden="true">'+avatars[av]+'</span>'; }
  function notify(root, message) { var el = root.querySelector('[data-member-status]'); if (el) { el.textContent = message; el.hidden = false; } }
  function waitView(root) { root.innerHTML = '<div class="page member-page" aria-busy="true"></div>'; } // 2026-11-18 使用者要求拿掉 loading 畫面：確認登入時留白
  function finishSignIn(fn){var m=window.LunchMascot;if(m){m.show('Hi！要來點什麼');return m.finish().then(fn);}fn();return Promise.resolve();}
  function settle() { settled = true; if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; } }
  function messageBox() { return '<p class="member-status" data-member-status role="status" aria-live="polite" hidden></p>'; }
  function money(n) { return '$' + Math.round(Number(n) || 0).toLocaleString('zh-TW'); }
  function total(o) { return Number(A.orderTotal(o)) || 0; }
  function loginView(root, query) {
    if (demo()) return demoView(root,query);
    if (verified) { go(safeNext(query.next || pendingNext)); return; }
    var ready = configured();
    root.innerHTML = shell('會員登入', '<section class="member-login"><div class="member-art" aria-hidden="true"><span>一起</span><span>吃飯</span><i>午餐有人作伴</i><div class="member-art-orb">✦</div></div><div class="member-login-form"><h2>會員登入</h2><p class="member-muted">查看餐點、訂單與個人資料。</p>'+(!ready ? '<div class="member-notice"><strong>會員登入尚待啟用</strong><p>站長仍需完成帳戶登入設定與存取權限。現在仍可返回公開團訂頁。</p></div>' : '<button class="btn primary member-google" type="button" data-google>登入</button>'+(C.providers && C.providers.indexOf('email') >= 0 ? '<details class="member-email"><summary>使用電子郵件與密碼</summary><form data-email><label>電子郵件<input name="email" type="email" autocomplete="email" required maxlength="200"></label><label>密碼<input name="password" type="password" autocomplete="current-password" minlength="8" required maxlength="128"></label><div class="actions"><button class="btn primary" type="submit">登入</button><button class="btn" type="button" data-signup>註冊帳戶</button></div></form><button class="member-link" type="button" data-reset>忘記密碼</button></details>' : '') )+messageBox()+'</div></section>');
    // 2026-11-18 使用者要求：「會員登入」標題移進卡片，頁面上方那組標題拿掉
    var loginHead = root.querySelector('.member-heading'); if (loginHead) loginHead.parentNode.removeChild(loginHead);
    if (!ready) return;
    if (startupError) notify(root, startupError);
    function run(fn,login) { if (!authReady || !auth) { notify(root, startupError || '登入服務載入中，請稍後再試。'); return; } if(login&&window.LunchMascot)window.LunchMascot.show('Hi！要來點什麼');Array.from(root.querySelectorAll('button')).forEach(function(b) { b.disabled = true; }); Promise.resolve().then(fn).catch(function(e) { if(login&&window.LunchMascot)window.LunchMascot.hide();notify(root, errorText(e)); }).finally(function() { Array.from(root.querySelectorAll('button')).forEach(function(b) { b.disabled = false; }); }); }
    root.querySelector('[data-google]').onclick = function() { pendingNext = safeNext(query.next || pendingNext); run(function() { return auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); },true); };
    var f = root.querySelector('[data-email]');
    if (f) {
      f.onsubmit = function(e) { e.preventDefault(); pendingNext = safeNext(query.next || pendingNext); run(function() { return auth.signInWithEmailAndPassword(f.email.value.trim(), f.password.value); },true); };
      root.querySelector('[data-signup]').onclick = function() { if (!f.reportValidity()) return; pendingNext = safeNext(query.next || pendingNext); run(function() { return auth.createUserWithEmailAndPassword(f.email.value.trim(), f.password.value).then(function(r) { return r.user.sendEmailVerification(); }); },true); };
      root.querySelector('[data-reset]').onclick = function() { if (!f.email.value.trim()) { notify(root, '請先填寫電子郵件。'); return; } run(function() { return auth.sendPasswordResetEmail(f.email.value.trim()).then(function() { notify(root, '若此電子郵件可重設密碼，你將收到重設信。'); }); }); };
    }
  }
  function demoView(root,query) {
    root.innerHTML=shell('會員登入', '<section class="member-login"><div class="member-art" aria-hidden="true"><span>一起</span><span>吃飯</span><i>午餐有人作伴</i><div class="member-art-orb">✦</div></div><form class="member-login-form member-editor" data-demo><p class="member-kicker">本機示範</p><h2>選擇個人頭像</h2><div class="member-notice"><strong>本機示範會員，不是真實登入</strong><p>資料只存在這個瀏覽器，無法跨裝置同步。正式網站必須完成帳戶身分驗證。</p></div><fieldset class="member-avatars"><legend>選擇頭像</legend>'+avatars.map(function(a,i){return '<label><input type="radio" name="avatar" value="'+i+'" '+(!i?'checked':'')+'><span class="member-avatar tone-'+i+'" aria-label="頭像 '+(i+1)+'">'+a+'</span></label>';}).join('')+'</fieldset><label>顯示名字<input name="displayName" required maxlength="30" autocomplete="name" placeholder="怎麼稱呼你？"></label><label>部門'+departmentInput('')+'</label><button class="btn primary" type="submit">進入本機示範 →</button></form></section>');
    root.querySelector('[data-demo]').onsubmit=function(e){e.preventDefault();var f=e.currentTarget,identity=window.LunchIdentity.fields(f.displayName.value,f.department.value);if(!identity)return;var uid='demo-member';try{uid=localStorage.getItem('lunch_demo_member_uid') || ('demo-'+Date.now().toString(36));localStorage.setItem('lunch_demo_member_uid',uid);}catch(ignore){}verified={uid:uid,id:uid,name:identity.name,department:identity.department,avatar:Number(f.avatar.value),demo:true,authenticated:false,admin:true};var demoUser=verified;verified=null;f.querySelector('button[type=submit]').disabled=true;finishSignIn(function(){verified=demoUser;A.setUser(verified);go(safeNext(query.next || pendingNext));pendingNext='';});};
  }
  function compressAvatar(file) {
    return new Promise(function(resolve,reject) {
      if(!file || file.size>12*1024*1024){reject(new Error('請選擇小於 12MB 的照片'));return;}
      var url=URL.createObjectURL(file),img=new Image();
      img.onload=function(){
        URL.revokeObjectURL(url);
        try{
          var scale=Math.min(1,192/Math.max(img.naturalWidth,img.naturalHeight));
          var cv=document.createElement('canvas');
          cv.width=Math.max(1,Math.round(img.naturalWidth*scale));
          cv.height=Math.max(1,Math.round(img.naturalHeight*scale));
          var ctx=cv.getContext('2d');
          ctx.fillStyle='#fff';ctx.fillRect(0,0,cv.width,cv.height);
          ctx.drawImage(img,0,0,cv.width,cv.height);
          var result='';
          for(var quality=.85;quality>=.3;quality-=.1){
            var data=cv.toDataURL('image/jpeg',quality);
            if(data.length<=39000){result=data;break;}
          }
          if(!result)throw new Error('照片無法壓縮，請換一張照片');
          resolve(result);
        }catch(e){reject(e);}
      };
      img.onerror=function(){URL.revokeObjectURL(url);reject(new Error('無法讀取圖片，請改用 JPG 或 PNG'))};
      img.src=url;
    });
  }
  function profileView(root) {
    var u = verified, firstSetup = !!u.needsProfile, avatarImage=u.avatarImage||'', imageBusy=false,imageJob=0,savingProfile=false,ownSrc=memberPhotoByName(u.name),ownUrl='',avatarTouched=false;
    root.innerHTML = shell('我的帳號',
      '<div class="member-dashboard"><section class="member-profile">'+
      '<button type="button" class="member-avatar-edit" data-edit-avatar aria-label="修改自己的頭貼"><span data-profile-avatar>'+avatar(u, 'member-avatar-large')+'</span><span class="member-avatar-edit-caption">更換頭貼 ✎</span></button><hr class="member-sep" aria-hidden="true">'+
      '<p class="member-kicker">個人資料</p><h2 data-profile-name>'+esc(u.name || '午餐夥伴')+'</h2>'+
      '<button type="button" class="member-edit-name" data-edit-name>修改姓名 ✎</button>'+
      '<p>'+esc(u.department || '尚未設定部門')+'</p><span class="member-verified">'+(u.demo ? '本機示範會員，不是真實登入' : (u.roleOwner ? '✓ 最高管理者' : u.admin ? '✓ 管理者' : '✓ 帳號已驗證'))+'</span><hr class="member-sep" aria-hidden="true">'+
      '<p class="member-fine">'+esc(auth && auth.currentUser && auth.currentUser.email || '')+'</p><hr class="member-sep" aria-hidden="true">'+
      '<div class="actions"><button class="btn" type="button" data-logout>登出</button></div></section>'+
      '<dialog class="profile-dialog" aria-labelledby="profileTitle"><button type="button" class="profile-close" data-profile-close aria-label="關閉">×</button><form class="member-editor" data-profile id="profileEdit"><h2 id="profileTitle">修改頭貼與姓名</h2><div class="profile-draft" data-draft-avatar>'+avatar(u,'member-avatar-large')+'</div>'+
      '<label class="member-upload-label" for="avatarUpload">上傳自己的頭貼</label><input id="avatarUpload" type="file" accept="image/*" data-avatar-upload><p class="member-muted" data-avatar-status>選擇照片後先預覽，儲存才會更換</p>'+ '<fieldset class="member-avatars" data-avatar-choices><legend>或選內建頭貼</legend>'+
      avatars.map(function(a,i){return '<label><input type="radio" name="avatar" value="'+i+'" '+(!u.avatarImage&&Number(u.avatar || 0)===i ? 'checked' : '')+'><span class="member-avatar tone-'+i+'" aria-label="'+esc(departments[i] || ('頭貼 '+(i+1)))+'頭貼" title="'+esc(departments[i] || '')+'">'+a+'</span></label>';}).join('')+
      (ownSrc?'<label><input type="radio" name="avatar" value="own"><span class="member-avatar member-avatar-photo" aria-label="我的專屬頭貼" title="我的專屬頭貼"><img src="'+esc(ownSrc)+'" alt=""></span></label>':'')+
      '</fieldset><label>顯示姓名<input name="displayName" required maxlength="30" autocomplete="name" value="'+A.esc(u.name,true)+'"></label>'+
      '<label>部門'+departmentInput(u.department)+'</label>'+(firstSetup?'<p class="member-muted">請先確認姓名與部門，再開始點餐。</p>':'')+
      '<p class="member-muted member-unsaved" data-unsaved hidden>上方為預覽，尚未儲存</p>'+
      '<button class="btn primary" type="submit">儲存修改</button>'+messageBox()+'</form></dialog>'+
      // 2026-11-18 收款資料：當負責人時，參加的人按「付款」會看到（pay.js）
      '<form class="member-editor member-payinfo" data-payinfo novalidate><h2>收款資料</h2>'+
      '<p class="member-muted">你當團購負責人時，參加的人按「付款」會看到這裡的銀行帳號。登入本站的會員都看得到，請只填可以給同事看的資料；不填就不會顯示。</p>'+
      '<label>銀行（代碼和名稱）<input name="bank" maxlength="40" placeholder="例如：822 中國信託" autocomplete="off"></label>'+
      '<label>帳號<input name="account" maxlength="30" inputmode="numeric" placeholder="例如：1234-5678-9012" autocomplete="off"></label>'+
      '<p class="payinfo-status" data-pay-status role="status" aria-live="polite" hidden></p>'+
      '<button class="btn primary" type="submit" disabled>儲存收款資料</button></form></div>');
    var form = root.querySelector('[data-profile]');
    root.querySelector('[data-logout]').onclick = function() { if(demo()){verified=null;A.setUser(null);go('#/members/login');}else auth.signOut().catch(function(e){notify(root,errorText(e));}); };
    var dialog=root.querySelector('.profile-dialog');
    dialog.addEventListener('close',function(){imageJob++;imageBusy=false;form.querySelector('button[type="submit"]').disabled=savingProfile;form.querySelector('[data-avatar-status]').textContent='選擇照片後先預覽，儲存才會更換';form.reset();avatarImage=u.avatarImage||'';form.querySelector('[data-avatar-upload]').value='';form.querySelector('[data-unsaved]').hidden=true;form.querySelector('[data-draft-avatar]').innerHTML=avatar(u,'member-avatar-large');});
    root.querySelector('[data-profile-close]').onclick=function(){dialog.close();};
    dialog.addEventListener('click',function(e){if(e.target===dialog){var r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
    function openProfile(focusName){dialog.showModal();form.scrollTop=0;if(focusName){form.elements.displayName.focus();form.elements.displayName.select();}}
    root.querySelector('[data-edit-avatar]').onclick=function(){openProfile(false);};
    root.querySelector('[data-edit-name]').onclick=function(){openProfile(true);};
    if(firstSetup)openProfile(true);
    // 專屬頭貼：目前存的就是這張時，選單預設勾它（不是勾內建編號）
    if(ownSrc)ownAvatarData(u.name).then(function(url){ownUrl=url;if(!form.isConnected||u.avatarImage!==url)return;form.querySelectorAll('input[name="avatar"]').forEach(function(r){r.defaultChecked=r.value==='own';if(!avatarTouched)r.checked=r.defaultChecked;});}).catch(function(){});
    function previewChanges(){
      var selected=form.querySelector('input[name="avatar"]:checked');
      var index=selected&&selected.value!=='own' ? Number(selected.value) : 0;
      form.querySelector('[data-draft-avatar]').innerHTML=avatar({avatar:index,avatarImage:avatarImage},'member-avatar-large');
      root.querySelector('[data-unsaved]').hidden=false;
    }
    form.querySelector('[data-avatar-upload]').addEventListener('change',function() {
      var file=this.files&&this.files[0],status=form.querySelector('[data-avatar-status]');
      if(!file)return;
      imageBusy=true;var job=++imageJob;
      var submit=form.querySelector('button[type="submit"]');submit.disabled=true;
      status.textContent='正在壓縮照片…';
      compressAvatar(file).then(function(data){
        if(!form.isConnected||!dialog.open||job!==imageJob)return;
        avatarImage=data;
        form.querySelectorAll('input[name="avatar"]').forEach(function(radio){radio.checked=false;});
        status.textContent='預覽完成（約 '+Math.ceil(data.length*.75/1024)+' KB），請按儲存修改';
        previewChanges();
      }).catch(function(e){if(form.isConnected&&job===imageJob)status.textContent=e.message;}).finally(function(){if(job!==imageJob)return;imageBusy=false;if(form.isConnected)submit.disabled=savingProfile;});
    });
    form.querySelectorAll('input[name="avatar"]').forEach(function(radio){
      radio.addEventListener('change',function(){if(!radio.checked)return;avatarTouched=true;var status=form.querySelector('[data-avatar-status]');form.querySelector('[data-avatar-upload]').value='';
        if(radio.value==='own'){
          if(ownUrl){avatarImage=ownUrl;status.textContent='已選專屬頭貼，按儲存才會更換';previewChanges();return;}
          avatarImage='';status.textContent='正在載入專屬頭貼…';
          ownAvatarData(u.name).then(function(url){ownUrl=url;if(!form.isConnected||!radio.checked)return;avatarImage=url;status.textContent='已選專屬頭貼，按儲存才會更換';previewChanges();}).catch(function(){if(form.isConnected&&radio.checked)status.textContent='專屬頭貼載入失敗，請重新整理再試';});
          return;
        }
        avatarImage='';status.textContent='已選內建頭貼，儲存後移除舊照片';previewChanges();});
    });
    form.elements.displayName.addEventListener('input',previewChanges);
    form.elements.department.addEventListener('input',previewChanges);
    form.onsubmit = function(e) {
      e.preventDefault();
      var submit=form.querySelector('button[type="submit"]');
      if(savingProfile||imageBusy||!form.reportValidity())return;
      var identity=window.LunchIdentity.fields(form.elements.displayName.value,form.elements.department.value);
      if(!identity){notify(root,'請填寫姓名與部門，並確認沒有換行或控制字元。');return;}
      var selected=form.querySelector('input[name="avatar"]:checked');
      if(!selected&&!avatarImage){notify(root,'請選一個內建頭貼，或上傳自己的照片。');return;}
      var own=!!selected&&selected.value==='own';
      if(own&&(!ownUrl||avatarImage!==ownUrl)){notify(root,'專屬頭貼還在載入，請稍候再按儲存。');return;}
      var oldAvatar=Number(u.avatar);oldAvatar=Number.isInteger(oldAvatar)&&oldAvatar>=0&&oldAvatar<avatars.length?oldAvatar:0;
      var p=Object.assign({},identity,{avatar:selected&&!own?Number(selected.value):oldAvatar,avatarImage:avatarImage||'',updatedAt:A.now()});
      savingProfile=true;submit.disabled=true;
      var saving=u.demo?A.DB.update('members/'+u.uid,p):window.LunchIdentity.save(A.DB,u.uid,p,u);
      saving.then(function(){
        if(!verified||verified.uid!==u.uid)return;
        Object.assign(verified,p,{needsProfile:false});
        A.setUser(verified);
        // 關視窗會 form.reset()，先把「預設勾選」改成剛存的那個，下次打開才不會勾回舊的
        form.querySelectorAll('input[name="avatar"]').forEach(function(r){r.defaultChecked=r===selected;});
        if(dialog.open)dialog.close();A.toast('頭貼與姓名已更新');
        if(firstSetup){var next=pendingNext;pendingNext='';go(next||'#/');}
      }).catch(function(er){
        if(!form.isConnected)return;
        if(er&&er.code==='member/name-taken'){notify(root,er.message);form.elements.displayName.focus();}
        else if(er&&er.code==='member/identity-registry-updating'){notify(root,er.message);}
        else if(/permission[_-]denied/i.test(String(er&&er.code||'')))notify(root,'無法儲存會員資料。請重新整理確認目前資料再試。');
        else notify(root,errorText(er));
      }).finally(function(){savingProfile=false;submit.disabled=imageBusy;});
    };
    wirePayInfo(root,u);if(u.roleManager)wireRoles(root);if(window.LunchAccount)window.LunchAccount.mount(root,u);
  }
  // 2026-11-18 收款資料表單：讀不到舊資料時不給存，免得用空白蓋掉原本的帳號。
  function wirePayInfo(root,u) {
    var f=root.querySelector('[data-payinfo]'),LP=window.LunchPay;if(!f)return;
    var busy=false,ready=false,status=f.querySelector('[data-pay-status]'),submit=f.querySelector('button[type="submit"]');
    function say(t,bad){status.textContent=t;status.classList.toggle('is-bad',!!bad);status.hidden=!t;if(t&&status.scrollIntoView)status.scrollIntoView({block:'nearest'});}
    if(!LP){say('收款功能沒有載入，請重新整理頁面。',true);return;}
    A.DB.get('payInfo/'+u.uid).then(function(v){if(!f.isConnected)return;var p=LP.clean(v);f.elements.bank.value=p.bank;f.elements.account.value=p.account;ready=true;submit.disabled=false;}).catch(function(){if(f.isConnected)say('暫時讀不到收款資料，請重新整理後再試。',true);});
    f.onsubmit=function(e){
      e.preventDefault();if(busy||!ready)return;
      var bank=f.elements.bank.value.trim().replace(/\s+/g,' '),account=f.elements.account.value.trim().replace(/\s+/g,' ');
      if(account&&!/^[0-9][0-9 -]*$/.test(account)){say('帳號只能填數字，可以用空格或 - 分段',true);return;}
      if(account&&LP.digits(account).length<6){say('帳號看起來太短，請再確認',true);return;}
      if(account&&!bank){say('請填銀行代碼和名稱，付款的人才知道要轉到哪家銀行',true);return;}
      if(bank&&!account){say('填了銀行也要填帳號',true);return;}
      var p={updatedAt:A.now()};if(bank)p.bank=bank;p.bank=bank;p.account=account;
      submit.disabled=true;say('儲存中…');
      A.DB.update('payInfo/'+u.uid,p).then(function(){
        LP.forget(u.uid);if(!f.isConnected)return;
        say(LP.hasInfo(p)?'已儲存，參加的人按「付款」就看得到。':'已儲存；目前沒有收款資料，付款視窗會請大家直接找你付款。');A.toast('收款資料已儲存');
      }).catch(function(er){if(f.isConnected)say(errorText(er),true);}).finally(function(){if(f.isConnected)submit.disabled=false;});
    };
  }
  function wireRoles(root){
    if(!verified || !verified.roleManager)return;
    var managerUid=verified.uid,route=location.hash,loadedOwner='',revision=0,members={},roles={};
    var rosterMarkup=null,loadSequence=0;
    var panel=document.createElement('section');panel.className='card member-role-admin';
    panel.innerHTML='<div class="member-management-heading"><h2>會員管理</h2><span class="member-total" data-member-total></span></div><p class="member-muted">搜尋會員、查看部門，並管理帳號的使用權限。</p><div class="member-management-filters"><label>搜尋會員<input type="search" data-member-search placeholder="姓名或部門" autocomplete="off"></label><label>部門<select data-member-department><option value="">全部部門</option></select></label></div><p data-role-status role="status">讀取會員中…</p><p class="member-result-count" data-member-results role="status"></p><div class="member-list-heading" aria-hidden="true"><span>會員</span><span>部門</span><span>權限</span></div><div data-role-list></div>';
    root.querySelector('.member-dashboard').appendChild(panel);
    var status=panel.querySelector('[data-role-status]'),list=panel.querySelector('[data-role-list]');
    function active(){return panel.isConnected&&location.hash===route&&verified&&verified.uid===managerUid&&verified.roleManager;}
    var search=panel.querySelector('[data-member-search]'),department=panel.querySelector('[data-member-department]');
    function normalize(value){return String(value||'').normalize('NFKC').trim().toLocaleLowerCase('zh-TW');}
    search.disabled=department.disabled=true;
    search.oninput=draw;department.onchange=draw;
    function draw(){
      if(!active())return;
      var focusedRole=list.contains(document.activeElement)&&document.activeElement.dataset.roleUser;
      var all=Object.keys(members).filter(path),query=normalize(search.value);
      var filtered=all.filter(function(id){var m=members[id];return (!department.value||(m.department||'')===department.value)&&(!query||normalize((m.name||'')+' '+(m.department||'')).includes(query));});
      panel.querySelector('[data-member-total]').textContent=all.length+' 位會員';
      panel.querySelector('[data-member-results]').textContent=(query||department.value)?'顯示 '+filtered.length+' / '+all.length+' 位會員':'';
      var markup=filtered.map(function(id){
        var member=members[id],isOwner=id===loadedOwner,name=esc(member.name||'午餐夥伴');
        var choices=verified.roleOwner?['member','admin','owner']:['member','admin'];
        var control=isOwner?'<span class="role-owner-badge">最高管理者</span>':'<select class="member-role-select" data-role-user="'+esc(id)+'" aria-label="'+name+'的權限">'+choices.map(function(choice){var label={member:'會員',admin:'管理者',owner:'最高管理者'}[choice];return '<option value="'+choice+'">'+label+'</option>';}).join('')+'</select>';
        return '<div class="role-row">'+avatar(member)+'<div class="member-list-name"><b>'+name+'</b></div><span class="member-list-department">'+esc(member.department||'未設定部門')+'</span>'+control+'</div>';
      }).join('') || '<p class="member-list-empty">沒有符合條件的會員，試試其他姓名或部門。</p>';
      if(markup!==rosterMarkup){list.innerHTML=markup;rosterMarkup=markup;}
      list.querySelectorAll('[data-role-user]').forEach(function(segment){
        var id=segment.dataset.roleUser,pending=roleWrites.get(id),isOwner=id===loadedOwner;
        var role=isOwner?'owner':pending?pending.previous:roles[id]==='admin'?'admin':'member';
        var row=segment.closest('.role-row');
        if(pending)row.setAttribute('aria-busy','true');else row.removeAttribute('aria-busy');
        segment.dataset.role=role;
        segment.disabled=isOwner||Boolean(pending);
        segment.value=role;
      });
      if(focusedRole)restoreFocus(focusedRole);
    }
    function load(){
      var sequence=++loadSequence;
      return Promise.all([A.DB.get('members'),A.DB.get('roles'),A.DB.get('administration')]).then(function(values){
        if(!active()||sequence!==loadSequence)return;
        members=values[0]||{};roles=values[1]||{};loadedOwner=values[2]&&values[2].ownerUid;revision=values[2]&&values[2].revision;
        if(!loadedOwner||!Number.isInteger(revision))throw new Error('權限設定尚未完成');
        status.textContent='';status.hidden=true;search.disabled=department.disabled=false;
        var previousDepartment=department.value;
        var departments=Array.from(new Set(Object.keys(members).filter(path).map(function(id){return members[id].department||'';}).filter(Boolean))).sort(function(a,b){return a.localeCompare(b,'zh-TW');});
        department.innerHTML='<option value="">全部部門</option>'+departments.map(function(d){return '<option value="'+esc(d)+'">'+esc(d)+'</option>';}).join('');
        department.value=departments.includes(previousDepartment)?previousDepartment:'';
        draw();
      });
    }
    function restoreFocus(id){if(!active())return;var control=Array.from(list.querySelectorAll('[data-role-user]')).find(function(el){return el.dataset.roleUser===id;});if(control&&!control.disabled&&control.getClientRects().length)control.focus({preventScroll:true});}
    function error(){if(!active())return;status.hidden=false;status.textContent='權限未更新，請重新整理後再試。';}
    load().catch(error);
    list.onchange=function(event){
      var segment=event.target.closest('select[data-role-user]');if(!segment||segment.disabled||!active())return;
      var id=segment.dataset.roleUser,next=segment.value,previous=segment.dataset.role;
      segment.value=previous;
      if(next===previous||id===loadedOwner||roleWrites.has(id)||!['member','admin','owner'].includes(next))return;
      if(next==='owner'&&!verified.roleOwner)return;
      var write={next:next,previous:previous};roleWrites.set(id,write);segment.closest('.role-row').setAttribute('aria-busy','true');segment.disabled=true;
      var confirmation=next==='owner'?A.ask({title:'轉讓最高管理者？',body:'將最高管理者轉讓給「'+(members[id].name||'午餐夥伴')+'」'+(members[id].department?'（'+members[id].department+'）':'')+'。轉讓後，你會成為一般管理者，無法自行取回最高管理者權限。',okText:'確認轉讓',cancelText:'取消'}):A.ask({title:'確認變更會員權限？',body:'將「'+(members[id].name||'午餐夥伴')+'」的權限由「'+({member:'會員',admin:'管理者'}[previous])+'」改為「'+({member:'會員',admin:'管理者'}[next])+'」。',okText:'確認變更',cancelText:'取消'});
      write.done=confirmation.then(function(ok){
        if(!ok)return false;
        if(!active()||!verified.roleManager)throw new Error('權限已變更');
        if(next==='owner'){
          if(!verified.roleOwner||loadedOwner!==managerUid)throw new Error('最高管理者已變更');
          var update={administration:{ownerUid:id,revision:revision+1}};update['roles/'+id]='admin';
          return A.DB.update('',update).then(function(){A.toast('已轉讓最高管理者，你現在是管理者');return true;});
        }
        return A.DB.set('roles/'+id,next).then(function(){A.toast('會員權限已更新');return true;});
      }).then(function(saved){
        roleWrites.delete(id);
        if(!active())return;
        if(saved&&next!=='owner')roles[id]=next;
        draw();
        restoreFocus(id);
        load().catch(error);
      },function(){
        roleWrites.delete(id);
        if(!active())return;
        draw();
        restoreFocus(id);
        error();
        load().catch(error);
      });
    };
  }
  function orderView(root) {
    var alive = true, uid = verified.uid, entries = Object.create(null), groupWatches = Object.create(null);
    var pending = 0, started = false, paymentGroup = '', paymentOrder = '';
    var access = window.LunchGroupAccess;
    var orderFilter = 'unpaid';
    var orderFilters = [
      {key:'all',label:'全部'},
      {key:'unpaid',label:'未付',empty:'目前沒有未付款訂單'},
      {key:'paid',label:'已付',empty:'目前沒有已付款訂單'}
    ];
    function canPayRow(row) {
      if (!row || !row.group || row.order.cancelled || row.pending <= 0 || !window.LunchPay) return false;
      var receiver = A.collectionReceiver(row.group,row.oid);
      return Boolean(receiver && receiver !== uid && row.bill.due > 0);
    }
    root.innerHTML = shell('我的訂單', '<div data-order-content class="member-loading" role="status">正在讀取你的訂單…</div>'+messageBox(), null, ['#/members', '回個人資料']);
    var content = root.querySelector('[data-order-content]');
    function closePayment(gid) {
      if (paymentGroup !== gid) return;
      paymentGroup = '';paymentOrder = '';
      var close = document.querySelector('.pay-ov [data-pay-close]');
      if (close) close.click();
    }
    function formatItems(order) {
      return Object.values(order.items || {}).map(function(item) {
        return '<li>'+esc(typeof A.lineLabel === 'function' ? A.lineLabel(item) : item.name || item.item || '餐點')+' × '+esc(item.qty || 0)+(item.note?'<span class="member-item-note">備註：'+esc(item.note)+'</span>':'')+'</li>';
      }).join('');
    }
    function draw() {
      if (!alive || !started || pending) return;
      content.classList.remove('member-loading');
      var allRows = Object.values(entries).flat().filter(function(row){return row&&row.order&&!row.order.cancelled;}).sort(function(a,b) { return (b.order.createdAt || 0) - (a.order.createdAt || 0); });
      if (!allRows.length) {
        content.innerHTML = '<div class="member-empty"><span data-lunch-kaomoji="noHistory" data-kaomoji-size="block"></span><h2>目前沒有訂單</h2><p>此會員帳號尚無訂單。</p><a class="btn primary" href="#/">去看看開放中的團購</a></div>';
        content.onclick = null;
        return;
      }
      var buckets = {all:allRows,unpaid:[],paid:[]};
      allRows.forEach(function(row) {
        if (!row.group || !row.bill) return;
        if (row.pending > 0) buckets.unpaid.push(row);
        else if (row.pending === 0) buckets.paid.push(row);
      });
      var filters = content.querySelector('.member-order-filters');
      if (!filters) {
        content.innerHTML = '<div class="member-order-filters" role="group" aria-label="依付款狀態篩選">'+orderFilters.map(function(filter) {
          return '<button type="button" data-order-filter="'+filter.key+'" aria-pressed="false" aria-controls="member-order-results">'+filter.label+' <span class="member-order-filter-count"></span></button>';
        }).join('')+'</div><div id="member-order-results"></div>';
        filters = content.querySelector('.member-order-filters');
      }
      filters.dataset.active = orderFilter;
      filters.querySelectorAll('[data-order-filter]').forEach(function(button) {
        var key = button.dataset.orderFilter;
        button.setAttribute('aria-pressed',String(orderFilter === key));
        button.querySelector('.member-order-filter-count').textContent = buckets[key].length;
      });
      var rows = buckets[orderFilter];
      var results = content.querySelector('#member-order-results');
      results.innerHTML = rows.length ? '<div class="member-orders">'+rows.map(function(row, index) {
        var order = row.order;
        var date = '<p>'+esc(new Date(order.createdAt || 0).toLocaleString('zh-TW'))+'</p>';
        var identity = order.department ? '<small class="order-department">'+esc(order.name)+' · '+esc(order.department)+'</small>' : '';
        var items = '<div class="member-order-items"><ul>'+formatItems(order)+'</ul></div>';
        if (!row.group) {
          return '<article class="member-order '+'is-pending'+'"><div><span class="member-kicker">'+'團購已不可查看'+'</span><h2>我的餐點</h2>'+date+identity+'</div><strong>餐點原價 '+money(total(order))+'</strong>'+items+
            '<p class="member-fine">收款及分攤金額請向團主確認。</p><div class="member-order-actions"><button type="button" class="btn sm member-pay" data-cancel-row="'+index+'">刪除訂單（截止前）</button></div>'+'</article>';
        }
        var bill = row.bill;
        var state = row.pending === 0 ? '已收齊' : row.received > 0 ? '部分收款' : '待付款';
        var payButton = bill.due > 0 && row.pending <= 0 ? '<button type="button" class="btn sm member-pay is-paid" disabled>已收款</button>' : canPayRow(row) ? '<button type="button" class="btn sm primary member-pay" data-pay-row="'+index+'">付款</button>' : '';
        var groupLink = '<a class="member-group-link" href="#/g/'+esc(row.gid)+'" aria-label="查看團購" title="查看團購">'+
          '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12l8-8M4 4h8v8"/></svg></a>';
        var charges = '餐點原價 '+money(bill.base);
        if (bill.shipping) charges+=' · 運費 '+money(bill.shipping);
        if (bill.discount) charges+=' · 折扣 '+money(bill.discount);
        return '<article class="member-order is-linked '+(row.pending===0?'is-ok':'is-pending')+'"><div><span class="member-kicker">'+state+'</span><h2>'+esc(row.group.title || '未命名團購')+'</h2>'+date+identity+'</div><strong>應付 '+money(bill.due)+'</strong>'+items+'<p class="member-fine">'+charges+'</p><p>已收 '+money(row.received)+' · 待付 '+money(row.pending)+'</p>'+
          '<div class="member-order-actions">'+payButton+groupLink+'</div></article>';
      }).join('')+'</div>' : '<div class="member-empty member-order-filter-empty"><h2>'+orderFilters.find(function(filter) {return filter.key===orderFilter;}).empty+'</h2><button type="button" class="btn" data-order-all>查看全部訂單</button></div>';
      content.onclick = function(event) {
        var filter = event.target.closest('[data-order-filter]');
        var showAll = event.target.closest('[data-order-all]');
        if (filter || showAll) {
          var next = showAll ? 'all' : filter.dataset.orderFilter;
          if (next !== orderFilter) {
            orderFilter = next;
            draw();
            if (showAll) filters.querySelector('[data-order-filter="all"]').focus();
          }
          return;
        }
        var cancel = event.target.closest('[data-cancel-row]');
        var pay = event.target.closest('[data-pay-row]');
        var row = cancel ? rows[Number(cancel.dataset.cancelRow)] : pay && rows[Number(pay.dataset.payRow)];
        if (cancel && row && !row.group && !row.order.cancelled) {
          cancel.disabled = true;
          A.ask({title:'刪除這筆餐點？',body:'刪除後會從訂單清單移除，團主不會幫你叫餐。',okText:'刪除餐點',cancelText:'先不要',danger:true}).then(function(ok) {
            if (!ok || !alive) return;
            var patch = {};
            patch['orders/'+row.gid+'/'+row.oid+'/cancelled'] = true;
            patch['orders/'+row.gid+'/'+row.oid+'/updatedAt'] = A.now();
            patch['userOrders/'+uid+'/'+row.gid+'/'+row.oid] = {cancelled:true};
            patch['paid/'+row.gid+'/'+row.oid] = false;
            return A.DB.update('',patch).then(function(){
              if (!alive) return;
              row.order.cancelled = true;draw();A.toast('餐點已從訂單清單移除');
            });
          }).catch(function() {
            if (alive) notify(root,'無法取消這筆訂單，團購可能已截止。若有疑問請聯絡團主。');
          }).finally(function(){cancel.disabled=false;});
          return;
        }
        if (!canPayRow(row)) return;
        paymentGroup = row.gid;paymentOrder = row.oid;
        window.LunchPay.open({
          groupId:row.gid,orderId:row.oid,payerUid:uid,paidPath:'paid/'+row.gid+'/'+row.oid,
          title:row.group.title,due:row.bill.due,closed:A.groupClosed(row.group),
          paidState:row.pending <= 0 ? 'ok' : (row.received > 0 ? 'part' : 'none')
        });
      };
    }
    function ownRows(gid, ids) {
      return Promise.all(ids.map(function(oid) {
        return A.DB.get('orders/'+gid+'/'+oid).then(function(order){
          return order&&order.userId===uid?{gid:gid,oid:oid,order:order,group:null}:null;
        }).catch(function(error){if (!access.permissionDenied(error)) throw error;return null;});
      })).then(function(rows){return rows.filter(Boolean);});
    }
    function groupRows(gid, ids, group, isCurrent) {
      return A.DB.get('orders/'+gid).then(function(orders){
        if(!isCurrent())return [];
        orders=orders||{};
        var settled=A.settlement(orders,group);
        return Promise.all(ids.map(function(oid) {
          var order=orders[oid];
          if (!isCurrent()||!order||order.userId!==uid) return null;
          var bill=order.cancelled?{base:total(order),shipping:0,discount:0,due:0,lineDues:[]}:settled.orders[oid];
          if (!bill&&!Object.keys(order.items||{}).length) bill={base:0,shipping:0,discount:0,due:0,lineDues:[]};
          if (!bill) throw new Error('SETTLEMENT_MISSING');
          return A.DB.get('paid/'+gid+'/'+oid).then(function(paid){
            if(!isCurrent())return null;
            var received=bill.lineDues.reduce(function(sum,n,i){return sum+(paid&&paid[i]?Number(n):0);},0);
            return {gid:gid,oid:oid,order:order,group:group,bill:bill,received:received,pending:bill.due-received};
          });
        })).then(function(rows){return rows.filter(Boolean);});
      });
    }
    function watch(gid, ids) {
      var revision = 0, first = true, watching = true, listeners = [], paidValues = Object.create(null);
      function applyReceipt(row){
        if(!row.group||!row.bill||!Object.prototype.hasOwnProperty.call(paidValues,row.oid))return;
        var p=paidValues[row.oid];
        row.received=row.bill.lineDues.reduce(function(sum,n,i){return sum+(p&&p[i]===true?Number(n):0);},0);
        row.pending=row.bill.due-row.received;
        if(paymentGroup===gid&&paymentOrder===row.oid&&row.pending<=0)closePayment(gid);
      }
      function receivePaid(oid,value){
        paidValues[oid]=value||{};
        (entries[gid]||[]).forEach(function(row){if(row.oid===oid)applyReceipt(row);});
        draw();
      }
      function refresh(group, error) {
        if (!alive || !watching) return;
        var job = ++revision;
        if ((!group&&!error)||(group&&group.deleted)) {
          closePayment(gid);entries[gid]=[];if(first){first=false;pending--;}draw();return;
        }
        if (!access.canView(group,verified)) {
          closePayment(gid);delete entries[gid];draw();
        }
        if (error && !access.permissionDenied(error)) notify(root,'有一筆訂單暫時無法確認團購資料。');
        var load = access.canView(group,verified) ? groupRows(gid,ids,group,function(){return alive&&watching&&revision===job;}).catch(function(failure){
          if(!alive||!watching||revision!==job)return [];
          if (!access.permissionDenied(failure)) throw failure;
          if (alive && revision===job) {closePayment(gid);delete entries[gid];draw();}
          return ownRows(gid,ids);
        }) : ownRows(gid,ids);
        load.then(function(rows){
          if (alive && watching && revision===job) {rows.forEach(applyReceipt);entries[gid]=rows;}
        }).catch(function(){
          if (alive && watching && revision===job) {
            closePayment(gid);delete entries[gid];notify(root,'有一筆訂單暫時無法確認金額。');
          }
        }).finally(function(){
          if (!alive || !watching || revision!==job) return;
          if (first) {first=false;pending--;}
          draw();
        });
      }
      listeners.push(A.DB.on('groups/'+gid,refresh,{onError:function(error){refresh(null,error);}}));
      ids.forEach(function(oid){
        listeners.push(A.DB.on('paid/'+gid+'/'+oid,function(value){if(alive&&watching)receivePaid(oid,value);},{onError:function(){if(alive&&watching)receivePaid(oid,null);}}));
      });
      return function(){watching=false;if(first){first=false;pending--;}listeners.forEach(function(off){off();});};
    }
    var stopIndex=A.DB.on('userOrders/'+uid,function(index) {
      if (!alive) return;
      var groups=Object.create(null);
      Object.keys(index||{}).filter(path).forEach(function(gid){
        var ids=Object.keys(index[gid]||{}).filter(function(oid){return path(oid)&&index[gid][oid]&&index[gid][oid].cancelled!==true;}).sort();
        if(ids.length)groups[gid]=ids;
      });
      Object.keys(groupWatches).forEach(function(gid){
        var previous=groupWatches[gid],ids=groups[gid];
        if(ids&&previous.key===JSON.stringify(ids))return;
        if(paymentGroup===gid&&(!ids||ids.indexOf(paymentOrder)<0))closePayment(gid);
        previous.stop();delete groupWatches[gid];delete entries[gid];
      });
      var fresh=Object.keys(groups).filter(function(gid){return !groupWatches[gid];});
      pending+=fresh.length;started=true;
      fresh.forEach(function(gid){groupWatches[gid]={key:JSON.stringify(groups[gid]),stop:watch(gid,groups[gid])};});
      draw();
    },{onError:function(error) {
      if (!alive) return;
      if(paymentGroup)closePayment(paymentGroup);
      content.textContent='目前無法讀取你的訂單。';
      notify(root,errorText(error));
    }});
    return function(){alive=false;stopIndex();Object.keys(groupWatches).forEach(function(gid){groupWatches[gid].stop();});if(paymentGroup)closePayment(paymentGroup);};
  }
  function collectionView(root,gid) {
    var alive=true; if (!path(gid)) { root.innerHTML=shell('找不到這個團購','<p>請從團購管理頁重新開啟。</p>'); return; }
    var back=['#/g/'+gid+'/admin','回團購管理'];
    root.innerHTML=shell('會員收款統計','<p role="status">正在核對團主權限…</p>',null,back);
    A.DB.get('groups/'+gid).then(function(g) { if (!g || g.ownerUserId !== verified.uid && !verified.admin) throw new Error('OWNER'); return Promise.all([Promise.resolve(g), A.DB.get('orders/'+gid), A.DB.get('paid/'+gid)]); }).then(function(v) {
      if (!alive) return; var g=v[0],orders=v[1] || {},paid=v[2] || {},members={},sum=0,received=0,settled=typeof A.settlement === 'function' ? A.settlement(orders,g) : null;
      Object.keys(orders).forEach(function(id) { var o=orders[id]; if (!o || o.cancelled) return; var key=o.userId || 'legacy:'+id; if(!members[key])members[key]={name:o.name || '未填名字',uid:o.userId,amount:0,received:0,count:0}; var m=members[key]; m.count++; Object.values(o.items || {}).forEach(function(it,i) { var bill=settled && settled.orders && settled.orders[id]; var n = bill && bill.lineDues && bill.lineDues[i] != null ? Number(bill.lineDues[i]) : (typeof A.lineTotal === 'function' ? A.lineTotal(it) : Number(it.price || 0)*Number(it.qty || 0)); m.amount+=n;sum+=n;if(paid[id] && paid[id][i]) {m.received+=n;received+=n;} }); });
      root.innerHTML=shell('會員收款統計','<div class="member-toolbar"><span>'+esc(g.title)+'</span></div><div class="member-metrics"><div><span>應收</span><b>'+money(sum)+'</b></div><div><span>已收</span><b>'+money(received)+'</b></div><div><span>待收</span><b>'+money(sum-received)+'</b></div></div><div class="member-table-wrap"><table class="member-table"><thead><tr><th>會員 / 訂購人</th><th>訂單數</th><th>應收</th><th>已收</th><th>待收</th></tr></thead><tbody>'+Object.keys(members).map(function(k) { var m=members[k]; return '<tr><td>'+esc(m.name)+'<small>'+(m.uid ? '會員訂單' : '舊版匿名訂單 · 未認領')+'</small></td><td>'+m.count+'</td><td>'+money(m.amount)+'</td><td>'+money(m.received)+'</td><td>'+money(m.amount-m.received)+'</td></tr>'; }).join('')+'</tbody></table></div><p class="member-fine">依專屬會員識別彙整；同名帳號不會合併。收款狀態請於團購管理更新。</p>',null,back);
    }).catch(function(e) { if(alive) root.innerHTML=shell('無法開啟收款統計','<div class="member-notice">'+(e.message === 'OWNER' ? '僅此團已驗證的團主可以查看。舊團不會自動由同名帳號接管。' : esc(errorText(e)))+'</div>',null,back); });
    return function(){alive=false;};
  }
  function guardRoute(_,parts,query,href) {
    if (!secure() || parts[0] === 'members') return true;
    if (verified && !verified.needsProfile) return true;
    pendingNext=safeNext(href);
    if (verified) { go('#/members'); return false; }
    if (!settled) { waitView(_); return false; }
    go('#/members/login?next='+encodeURIComponent(pendingNext)); return false;
  }
  function render(root,parts,query) {
    query=query || {}; if (!(query instanceof Object)) query={};
    if (query instanceof URLSearchParams) { var q={}; query.forEach(function(v,k){q[k]=v;});query=q; }
    var page=parts[1] || '';
    if (!verified) { if (!query.next && location.hash.indexOf('/members/login') < 0) pendingNext=safeNext(location.hash); if (!settled) return waitView(root); return loginView(root,query); }
    if (page === 'orders') return orderView(root);
    if (page === 'collection') return collectionView(root,parts[2]);
    return profileView(root);
  }
  function loadScript(src) { return new Promise(function(resolve,reject){var s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=function(){reject(new Error('SDK'));};document.head.appendChild(s);}); }
  function initAuth() {
    if (!configured()) return;
    var SLOW='登入服務回應較慢，可稍候重新整理再試。';
    settleTimer=setTimeout(function(){settleTimer=null;if(settled)return;settled=true;startupError=SLOW;updateNav();A.route();},12000);
    var appReady=typeof A.firebaseReady === 'function' ? A.firebaseReady() : Promise.resolve();
    appReady.then(function(){ if(!window.firebase) return loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js'); }).then(function(){if(!firebase.apps.length)firebase.initializeApp(config());return typeof firebase.auth === 'function' ? null : loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js');}).then(function(){auth=firebase.auth();return auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);}).then(function(){auth.onAuthStateChanged(function(fu){if(roleOff){roleOff();roleOff=null;}authReady=true;var expected=fu&&fu.uid; verified=null;
      if (!fu) { if(window.LunchMascot)window.LunchMascot.hide();settle(); if(startupError===SLOW)startupError=''; A.setUser(null); return; }
      settled=false;if(window.LunchMascot)window.LunchMascot.show('Hi！要來點什麼');
      Promise.all([A.DB.get('members/'+fu.uid),fu.getIdTokenResult(),A.DB.get('roles/'+fu.uid).catch(function(){return null;}),A.DB.get('administration')]).then(function(values){var p=values[0],claims=values[1].claims || {}; if(!auth.currentUser || auth.currentUser.uid!==expected)return;p=p||{};var signedMember={uid:fu.uid,id:fu.uid,name:p.name || fu.displayName || '午餐夥伴',department:p.department || '',departmentKey:p.departmentKey||'',nameKey:p.nameKey||'',avatar:p.avatar || 0,avatarImage:p.avatarImage || '',authenticated:true,needsProfile:!p.updatedAt || !window.LunchIdentity.claimPath(p),ownerUid:values[3]&&values[3].ownerUid,roleOwner:!!(values[3]&&values[3].ownerUid===fu.uid),roleManager:!!(values[3]&&values[3].ownerUid===fu.uid)||values[2]==='admin',admin:!!(values[3]&&values[3].ownerUid===fu.uid)||values[2]==='admin'};var next=pendingNext;if(!signedMember.needsProfile)pendingNext='';return finishSignIn(function(){if(!auth.currentUser||auth.currentUser.uid!==expected)return;verified=signedMember;settle();if(startupError===SLOW)startupError='';if(verified.needsProfile){if(location.hash!=='#/members')go('#/members');}else if(next&&location.hash.indexOf('#/members')===0)go(next);A.setUser(verified);var liveRole=values[2],liveOwner=values[3]&&values[3].ownerUid;
            function syncAuthority(){if(!verified||verified.uid!==fu.uid)return;var owner=liveOwner===fu.uid,admin=owner||liveRole==='admin';if(verified.ownerUid!==liveOwner||verified.roleOwner!==owner||verified.admin!==admin||verified.roleManager!==admin){verified.ownerUid=liveOwner;verified.roleOwner=owner;verified.admin=verified.roleManager=admin;A.setUser(verified);}}
            var roleUnsub=A.DB.on('roles/'+fu.uid,function(role){liveRole=role;syncAuthority();}),ownerUnsub=A.DB.on('administration',function(state){liveOwner=state&&state.ownerUid;syncAuthority();});roleOff=function(){roleUnsub();ownerUnsub();};});}).catch(function(){if(!auth.currentUser||auth.currentUser.uid!==expected)return;if(window.LunchMascot)window.LunchMascot.hide();startupError='無法確認帳號權限，請重新登入。';verified=null;settle();A.setUser(null);});
    });}).catch(function(){if(window.LunchMascot)window.LunchMascot.hide();startupError='會員登入載入失敗，請聯絡站長檢查登入設定與授權網域。';settle();updateNav();A.route();});
  }
  function updateNav() {
    var nav=document.querySelector('header .nav');if(!nav)return;
    var el=nav.querySelector('[data-members-nav]');if(!el){el=document.createElement('span');el.setAttribute('data-members-nav','');el.className='member-nav';nav.appendChild(el);}
    el.innerHTML=!verified && !settled ? '' : verified ?'<a class="btn sm" href="#/members/orders">我的訂單</a><a class="member-nav-profile" href="#/members" aria-label="我的會員資料">'+avatar(verified)+'<span>'+esc(verified.name)+'</span></a><button type="button" class="member-nav-logout" data-member-nav-logout>登出</button>' : '<a class="btn sm primary" href="#/members/login">會員登入</a>';
    var b=el.querySelector('[data-member-nav-logout]');if(b)b.onclick=function(){if(demo()){verified=null;A.setUser(null);go('#/members/login');}else if(auth)auth.signOut().catch(function(){A.toast('登出未成功，請稍後重試');});};
  }
  function start() {
    A=window.LunchApp; if(!A)return;
    A.registerRoute('members',render);
    if(typeof A.setRouteGuard==='function')A.setRouteGuard(guardRoute);
    window.LunchMembers={guardRoute:guardRoute,getUser:user,isConfigured:configured,isSecure:secure,avatarHtml:avatar,recolorIfGreen:recolorIfGreen};
    window.addEventListener('lunch:userchange',updateNav);
    settled = !configured();
    updateNav();
    A.route();
    initAuth();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();

