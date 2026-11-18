/* 會員模組：只有 Firebase Auth 驗證後才建立會員身分。 */
(function () {
  'use strict';
  var A, auth = null, verified = null, authReady = false, startupError = '', pendingNext = '', activeRefresh = null;
  /* settled：已經知道「有沒有登入」（含讀完會員資料）。還不知道時先顯示「確認登入狀態中」，不急著送去登入頁。 */
  var settled = false, settleTimer = null;
  var C = window.LUNCH_MEMBERS_CONFIG || window.LUNCH_MEMBER_CONFIG || {};
  // 2026-11-18 內建頭貼改成 7 個部門的簡易可愛圖（順序對應 departments：設計、企劃、影相、會計、工程、廣告、BOSS們）
  var avatars = ["<svg viewBox=\"0 0 40 40\" width=\"1.15em\" height=\"1.15em\" aria-hidden=\"true\" focusable=\"false\"><rect x=\"12\" y=\"3.5\" width=\"16\" height=\"5.5\" rx=\"2.6\" fill=\"currentColor\"/><rect x=\"12\" y=\"9\" width=\"16\" height=\"3.5\" fill=\"#fff\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linejoin=\"round\"/><rect x=\"12\" y=\"12.5\" width=\"16\" height=\"15\" fill=\"#fff\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linejoin=\"round\"/><path d=\"M12 27.5 20 37.5 28 27.5Z\" fill=\"#fff\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linejoin=\"round\"/><path d=\"M17.6 34.5 20 37.5 22.4 34.5Z\" fill=\"currentColor\"/><circle cx=\"17\" cy=\"19\" r=\"1.3\" fill=\"#3b2b20\"/><circle cx=\"23\" cy=\"19\" r=\"1.3\" fill=\"#3b2b20\"/><path d=\"M18.2 21.3q1.8 1.9 3.6 0\" fill=\"none\" stroke=\"#3b2b20\" stroke-width=\"1.3\" stroke-linecap=\"round\"/><circle cx=\"14.7\" cy=\"21.2\" r=\"1.2\" fill=\"#ff9d6b\" opacity=\".6\"/><circle cx=\"25.3\" cy=\"21.2\" r=\"1.2\" fill=\"#ff9d6b\" opacity=\".6\"/></svg>", "<svg viewBox=\"0 0 40 40\" width=\"1.15em\" height=\"1.15em\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M7 6.5l2.6 2.6M33 6.5l-2.6 2.6M20 1.8v3\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\"/><circle cx=\"20\" cy=\"17.5\" r=\"10.5\" fill=\"#fff\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linejoin=\"round\"/><rect x=\"15\" y=\"27\" width=\"10\" height=\"4\" rx=\"1.6\" fill=\"currentColor\"/><rect x=\"16.5\" y=\"32.2\" width=\"7\" height=\"3.4\" rx=\"1.6\" fill=\"currentColor\"/><circle cx=\"16.8\" cy=\"17.5\" r=\"1.35\" fill=\"#3b2b20\"/><circle cx=\"23.2\" cy=\"17.5\" r=\"1.35\" fill=\"#3b2b20\"/><path d=\"M18.2 19.8q1.8 1.9 3.6 0\" fill=\"none\" stroke=\"#3b2b20\" stroke-width=\"1.3\" stroke-linecap=\"round\"/><circle cx=\"14\" cy=\"19.7\" r=\"1.4\" fill=\"#ff9d6b\" opacity=\".6\"/><circle cx=\"26\" cy=\"19.7\" r=\"1.4\" fill=\"#ff9d6b\" opacity=\".6\"/></svg>", "<svg viewBox=\"0 0 40 40\" width=\"1.15em\" height=\"1.15em\" aria-hidden=\"true\" focusable=\"false\"><rect x=\"12.5\" y=\"7\" width=\"9\" height=\"6\" rx=\"1.8\" fill=\"currentColor\"/><rect x=\"4.5\" y=\"11\" width=\"31\" height=\"21.5\" rx=\"5.5\" fill=\"#fff\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linejoin=\"round\"/><circle cx=\"20\" cy=\"21.8\" r=\"7.6\" fill=\"#fff\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linejoin=\"round\"/><circle cx=\"30.2\" cy=\"15.6\" r=\"1.5\" fill=\"currentColor\"/><circle cx=\"17.3\" cy=\"21.2\" r=\"1.25\" fill=\"#3b2b20\"/><circle cx=\"22.7\" cy=\"21.2\" r=\"1.25\" fill=\"#3b2b20\"/><path d=\"M18.2 23.5q1.8 1.9 3.6 0\" fill=\"none\" stroke=\"#3b2b20\" stroke-width=\"1.3\" stroke-linecap=\"round\"/></svg>", "<svg viewBox=\"0 0 40 40\" width=\"1.15em\" height=\"1.15em\" aria-hidden=\"true\" focusable=\"false\"><rect x=\"8.5\" y=\"3.5\" width=\"23\" height=\"33\" rx=\"5.5\" fill=\"#fff\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linejoin=\"round\"/><rect x=\"12\" y=\"7\" width=\"16\" height=\"11\" rx=\"2.6\" fill=\"currentColor\" opacity=\".2\"/><circle cx=\"14.5\" cy=\"24\" r=\"1.7\" fill=\"currentColor\"/><circle cx=\"20\" cy=\"24\" r=\"1.7\" fill=\"currentColor\"/><circle cx=\"25.5\" cy=\"24\" r=\"1.7\" fill=\"currentColor\"/><circle cx=\"14.5\" cy=\"30\" r=\"1.7\" fill=\"currentColor\"/><circle cx=\"20\" cy=\"30\" r=\"1.7\" fill=\"currentColor\"/><circle cx=\"25.5\" cy=\"30\" r=\"1.7\" fill=\"currentColor\"/><circle cx=\"17\" cy=\"12\" r=\"1.25\" fill=\"#3b2b20\"/><circle cx=\"23\" cy=\"12\" r=\"1.25\" fill=\"#3b2b20\"/><path d=\"M18.2 14.3q1.8 1.9 3.6 0\" fill=\"none\" stroke=\"#3b2b20\" stroke-width=\"1.3\" stroke-linecap=\"round\"/><circle cx=\"14.4\" cy=\"14.2\" r=\"1.1\" fill=\"#ff9d6b\" opacity=\".6\"/><circle cx=\"25.6\" cy=\"14.2\" r=\"1.1\" fill=\"#ff9d6b\" opacity=\".6\"/></svg>", "<svg viewBox=\"0 0 40 40\" width=\"1.15em\" height=\"1.15em\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M20 4.5v4\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\"/><circle cx=\"20\" cy=\"3.6\" r=\"2.2\" fill=\"currentColor\"/><rect x=\"3.8\" y=\"16.5\" width=\"4.6\" height=\"9\" rx=\"2.2\" fill=\"currentColor\"/><rect x=\"31.6\" y=\"16.5\" width=\"4.6\" height=\"9\" rx=\"2.2\" fill=\"currentColor\"/><rect x=\"8\" y=\"8.5\" width=\"24\" height=\"23\" rx=\"7.5\" fill=\"#fff\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linejoin=\"round\"/><circle cx=\"16.2\" cy=\"19.5\" r=\"1.6\" fill=\"#3b2b20\"/><circle cx=\"23.8\" cy=\"19.5\" r=\"1.6\" fill=\"#3b2b20\"/><path d=\"M18.2 21.8q1.8 1.9 3.6 0\" fill=\"none\" stroke=\"#3b2b20\" stroke-width=\"1.3\" stroke-linecap=\"round\"/><circle cx=\"13\" cy=\"21.7\" r=\"1.4\" fill=\"#ff9d6b\" opacity=\".6\"/><circle cx=\"27\" cy=\"21.7\" r=\"1.4\" fill=\"#ff9d6b\" opacity=\".6\"/></svg>", "<svg viewBox=\"0 0 40 40\" width=\"1.15em\" height=\"1.15em\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M29 13.5q3.2 6.5 0 13M32.8 10.2q5.4 9.8 0 19.6\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\"/><path d=\"M13.8 26.5l1.8 7.2h4.2l-1.6-6.4\" fill=\"currentColor\"/><path d=\"M8 14.2 25 7.5v25L8 25.8Z\" fill=\"#fff\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linejoin=\"round\"/><rect x=\"3.6\" y=\"13.6\" width=\"6\" height=\"12.8\" rx=\"2.2\" fill=\"currentColor\"/><circle cx=\"14.3\" cy=\"20\" r=\"1.25\" fill=\"#3b2b20\"/><circle cx=\"19.7\" cy=\"20\" r=\"1.25\" fill=\"#3b2b20\"/><path d=\"M15.2 22.3q1.8 1.9 3.6 0\" fill=\"none\" stroke=\"#3b2b20\" stroke-width=\"1.3\" stroke-linecap=\"round\"/></svg>", "<svg viewBox=\"0 0 40 40\" width=\"1.15em\" height=\"1.15em\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M6 14.5l7.2 6.3L20 9.5l6.8 11.3 7.2-6.3-2.6 15.5H8.6Z\" fill=\"#fff\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linejoin=\"round\"/><circle cx=\"6\" cy=\"13.5\" r=\"2.2\" fill=\"currentColor\"/><circle cx=\"20\" cy=\"8.3\" r=\"2.4\" fill=\"currentColor\"/><circle cx=\"34\" cy=\"13.5\" r=\"2.2\" fill=\"currentColor\"/><circle cx=\"16.6\" cy=\"23.5\" r=\"1.3\" fill=\"#3b2b20\"/><circle cx=\"23.4\" cy=\"23.5\" r=\"1.3\" fill=\"#3b2b20\"/><path d=\"M18.2 25.8q1.8 1.9 3.6 0\" fill=\"none\" stroke=\"#3b2b20\" stroke-width=\"1.3\" stroke-linecap=\"round\"/><circle cx=\"13.8\" cy=\"25.7\" r=\"1.3\" fill=\"#ff9d6b\" opacity=\".6\"/><circle cx=\"26.2\" cy=\"25.7\" r=\"1.3\" fill=\"#ff9d6b\" opacity=\".6\"/></svg>"];
  var departments = ['設計部', '企劃部', '影相部', '會計部', '工程部', '廣告部', 'BOSS們'];
  function departmentSelect(value) { return '<select name="department" required autocomplete="organization"><option value="" disabled '+(departments.indexOf(value)<0?'selected':'')+'>請選擇部門</option>'+departments.map(function(d){return '<option value="'+d+'" '+(d===value?'selected':'')+'>'+d+'</option>';}).join('')+'</select>'; }
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
  // 返回連結統一放在大標上方的小膠囊（2026-11-18）；back＝[網址, 文字]，沒給就回首頁。
  var BACK_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  function shell(title, body, hint, back) {
    back = back || ['#/', '回首頁'];
    return '<div class="page member-page"><a class="backlink member-backlink" href="'+esc(back[0])+'">'+BACK_ICON+esc(back[1])+'</a><div class="member-kicker">JUN胖達／會員專區</div><div class="member-heading"><div><h1>'+esc(title)+'</h1><p>'+esc(hint || '查看餐點、訂單與個人資料。')+'</p></div></div>'+body+'</div>';
  }
  // User-provided default photos. User-uploaded avatarImage always takes precedence.
  function memberPhotoByName(name) { var n=String(name||'').trim().toLowerCase().replace(/\s+/g,' ');var map={'江':'jiang','毛子':'maozi','eason':'eason','eason liu':'eason','eason（哥）':'eason','eason(哥)':'eason','哥':'eason'};var key=map[n];return key?'./assets/'+key+'.webp?v=20261118orange3':''; }
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
                  arr[k]=Math.round(245*visible);
                  arr[k+1]=Math.round(130*visible);
                  arr[k+2]=Math.round(32*visible);
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
  function avatar(u, cls) { var preset=memberPhotoByName(u&&u.name);var data=u&&typeof u.avatarImage==='string'?u.avatarImage:'';if(data && data.length<=40000 && /^data:image\/(webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(data))return '<span class="member-avatar member-avatar-photo '+(cls||'')+'"><img src="'+esc(data)+'" alt="個人頭貼"'+(preset||isJunDoodle(u&&u.name)?' data-orange-avatar="'+esc(preset)+'"'+(isJunDoodle(u&&u.name)?' data-orange-jun="1"':'')+' style="visibility:hidden" onload="window.LunchMembers&&window.LunchMembers.recolorIfGreen(this)" onerror="this.style.visibility=\'visible\'"':'')+'></span>';if(preset)return '<span class="member-avatar member-avatar-photo '+(cls||'')+'"><img src="'+esc(preset)+'" alt="個人頭貼"></span>';var av=Number(u&&u.avatar);av=Number.isInteger(av)&&av>=0&&av<avatars.length?av:0;return '<span class="member-avatar '+(cls||'')+' tone-'+av+'" aria-hidden="true">'+avatars[av]+'</span>'; }
  function notify(root, message) { var el = root.querySelector('[data-member-status]'); if (el) { el.textContent = message; el.hidden = false; } }
  function waitView(root) { root.innerHTML = '<div class="page member-page" aria-busy="true"></div>'; } // 2026-11-18 使用者要求拿掉 loading 畫面：確認登入時留白
  function finishSignIn(fn){var m=window.LunchMascot;if(m){m.show('準備好，一起吃頓好午餐。');return m.finish().then(fn);}fn();return Promise.resolve();}
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
    function run(fn,login) { if (!authReady || !auth) { notify(root, startupError || '登入服務載入中，請稍後再試。'); return; } if(login&&window.LunchMascot)window.LunchMascot.show('正在確認會員，準備開始點餐。');Array.from(root.querySelectorAll('button')).forEach(function(b) { b.disabled = true; }); Promise.resolve().then(fn).catch(function(e) { if(login&&window.LunchMascot)window.LunchMascot.hide();notify(root, errorText(e)); }).finally(function() { Array.from(root.querySelectorAll('button')).forEach(function(b) { b.disabled = false; }); }); }
    root.querySelector('[data-google]').onclick = function() { pendingNext = safeNext(query.next || pendingNext); run(function() { return auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); },true); };
    var f = root.querySelector('[data-email]');
    if (f) {
      f.onsubmit = function(e) { e.preventDefault(); pendingNext = safeNext(query.next || pendingNext); run(function() { return auth.signInWithEmailAndPassword(f.email.value.trim(), f.password.value); },true); };
      root.querySelector('[data-signup]').onclick = function() { if (!f.reportValidity()) return; pendingNext = safeNext(query.next || pendingNext); run(function() { return auth.createUserWithEmailAndPassword(f.email.value.trim(), f.password.value).then(function(r) { return r.user.sendEmailVerification(); }); },true); };
      root.querySelector('[data-reset]').onclick = function() { if (!f.email.value.trim()) { notify(root, '請先填寫電子郵件。'); return; } run(function() { return auth.sendPasswordResetEmail(f.email.value.trim()).then(function() { notify(root, '若此電子郵件可重設密碼，你將收到重設信。'); }); }); };
    }
  }
  function demoView(root,query) {
    root.innerHTML=shell('會員登入', '<section class="member-login"><div class="member-art" aria-hidden="true"><span>一起</span><span>吃飯</span><i>午餐有人作伴</i><div class="member-art-orb">✦</div></div><form class="member-login-form member-editor" data-demo><p class="member-kicker">本機示範</p><h2>選擇個人頭像</h2><div class="member-notice"><strong>本機示範會員，不是真實登入</strong><p>資料只存在這個瀏覽器，無法跨裝置同步。正式網站必須完成帳戶身分驗證。</p></div><fieldset class="member-avatars"><legend>選擇頭像</legend>'+avatars.map(function(a,i){return '<label><input type="radio" name="avatar" value="'+i+'" '+(!i?'checked':'')+'><span class="member-avatar tone-'+i+'" aria-label="頭像 '+(i+1)+'">'+a+'</span></label>';}).join('')+'</fieldset><label>顯示名字<input name="displayName" required maxlength="30" autocomplete="name" placeholder="怎麼稱呼你？"></label><label>部門'+departmentSelect('')+'</label><button class="btn primary" type="submit">進入本機示範 →</button></form></section>');
    root.querySelector('[data-demo]').onsubmit=function(e){e.preventDefault();var f=e.currentTarget,name=f.displayName.value.trim();if(!name)return;var uid='demo-member';try{uid=localStorage.getItem('lunch_demo_member_uid') || ('demo-'+Date.now().toString(36));localStorage.setItem('lunch_demo_member_uid',uid);}catch(ignore){}verified={uid:uid,id:uid,name:name,department:f.department.value.trim(),avatar:Number(f.avatar.value),demo:true,authenticated:false,admin:true};var demoUser=verified;verified=null;f.querySelector('button[type=submit]').disabled=true;finishSignIn(function(){verified=demoUser;A.setUser(verified);go(safeNext(query.next || pendingNext));pendingNext='';});};
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
    var u = verified, firstSetup = !!u.needsProfile, avatarImage=u.avatarImage||'', imageBusy=false;
    root.innerHTML = shell('我的帳號',
      '<div class="member-dashboard"><section class="member-profile">'+
      '<button type="button" class="member-avatar-edit" data-edit-avatar aria-label="修改自己的頭貼"><span data-profile-avatar>'+avatar(u, 'member-avatar-large')+'</span><span class="member-avatar-edit-caption">更換頭貼 ✎</span></button><hr class="member-sep" aria-hidden="true">'+
      '<p class="member-kicker">個人資料</p><h2 data-profile-name>'+esc(u.name || '午餐夥伴')+'</h2>'+
      '<button type="button" class="member-edit-name" data-edit-name>修改姓名 ✎</button>'+
      '<p>'+esc(u.department || '尚未設定部門')+'</p><span class="member-verified">'+(u.demo ? '本機示範會員，不是真實登入' : (u.admin ? '✓ 管理員' : '✓ 帳號已驗證'))+'</span><hr class="member-sep" aria-hidden="true">'+
      '<p class="member-fine">'+esc(auth && auth.currentUser && auth.currentUser.email || '')+'</p><hr class="member-sep" aria-hidden="true">'+
      '<div class="actions"><a class="btn primary" href="#/members/orders">我的訂單 ↗</a><button class="btn" type="button" data-logout>登出</button></div></section>'+
      '<form class="member-editor" data-profile id="profileEdit"><h2>修改頭貼與姓名</h2>'+
      '<label class="member-upload-label" for="avatarUpload">上傳自己的頭貼</label><input id="avatarUpload" type="file" accept="image/*" data-avatar-upload><p class="member-muted" data-avatar-status>選擇照片後先預覽，儲存才會更換</p>'+ '<fieldset class="member-avatars" data-avatar-choices><legend>或選內建頭貼</legend>'+
      avatars.map(function(a,i){return '<label><input type="radio" name="avatar" value="'+i+'" '+(Number(u.avatar || 0)===i ? 'checked' : '')+'><span class="member-avatar tone-'+i+'" aria-label="'+esc(departments[i] || ('頭貼 '+(i+1)))+'頭貼" title="'+esc(departments[i] || '')+'">'+a+'</span></label>';}).join('')+
      '</fieldset><label>顯示姓名<input name="displayName" required maxlength="30" autocomplete="name" value="'+esc(u.name)+'"></label>'+
      '<label>部門'+departmentSelect(u.department)+'</label>'+
      '<p class="member-muted member-unsaved" data-unsaved hidden>上方為預覽，尚未儲存</p>'+
      '<button class="btn primary" type="submit">儲存修改</button>'+messageBox()+'</form>'+
      // 2026-11-18 收款資料：當負責人時，參加的人按「付款」會看到（pay.js）
      '<form class="member-editor member-payinfo" data-payinfo novalidate><h2>收款資料</h2>'+
      '<p class="member-muted">你當團購負責人時，參加的人按「付款」會看到這裡的帳號和收款碼。登入本站的會員都看得到，請只填可以給同事看的資料；不填就不會顯示。</p>'+
      '<label>銀行（代碼和名稱）<input name="bank" maxlength="40" placeholder="例如：822 中國信託" autocomplete="off"></label>'+
      '<label>帳號<input name="account" maxlength="30" inputmode="numeric" placeholder="例如：1234-5678-9012" autocomplete="off"></label>'+
      '<label class="member-upload-label" for="qrUpload">LINE Pay 收款碼</label>'+
      '<p class="member-muted">把 LINE Pay 的收款碼截圖上傳，會自動縮小；先裁到只剩收款碼最清楚。</p>'+
      '<div class="payinfo-qr" data-qr-box><span class="payinfo-qr-empty">讀取中…</span></div>'+
      '<input id="qrUpload" type="file" accept="image/*" data-qr-upload>'+
      '<p class="payinfo-status" data-pay-status role="status" aria-live="polite" hidden></p>'+
      '<button class="btn primary" type="submit" disabled>儲存收款資料</button></form></div>');
    var form = root.querySelector('[data-profile]');
    root.querySelector('[data-logout]').onclick = function() { if(demo()){verified=null;A.setUser(null);go('#/members/login');}else auth.signOut().catch(function(e){notify(root,errorText(e));}); };
    root.querySelector('[data-edit-avatar]').onclick = function() {
      var target=form.querySelector('[data-avatar-upload]');
      target.scrollIntoView({behavior:'smooth',block:'center'});
      target.click();
    };
    root.querySelector('[data-edit-name]').onclick = function() {
      var input=form.elements.displayName;
      input.scrollIntoView({behavior:'smooth',block:'center'});
      input.focus();
      input.select();
    };
    function previewChanges(){
      var selected=form.querySelector('input[name="avatar"]:checked');
      var index=selected ? Number(selected.value) : 0;
      root.querySelector('[data-profile-avatar]').innerHTML=avatar({avatar:index,avatarImage:avatarImage},'member-avatar-large');
      root.querySelector('[data-profile-name]').textContent=form.elements.displayName.value.trim()||'午餐夥伴';
      root.querySelector('[data-unsaved]').hidden=false;
    }
    form.querySelector('[data-avatar-upload]').addEventListener('change',function() {
      var file=this.files&&this.files[0],status=form.querySelector('[data-avatar-status]');
      if(!file)return;
      imageBusy=true;
      var submit=form.querySelector('button[type="submit"]');submit.disabled=true;
      status.textContent='正在壓縮照片…';
      compressAvatar(file).then(function(data){
        if(!form.isConnected)return;
        avatarImage=data;
        form.querySelectorAll('input[name="avatar"]').forEach(function(radio){radio.checked=false;});
        status.textContent='預覽完成（約 '+Math.ceil(data.length*.75/1024)+' KB），請按儲存修改';
        previewChanges();
      }).catch(function(e){if(form.isConnected)status.textContent=e.message;}).finally(function(){imageBusy=false;if(form.isConnected)submit.disabled=false;});
    });
    form.querySelectorAll('input[name="avatar"]').forEach(function(radio){
      radio.addEventListener('change',function(){if(radio.checked){avatarImage='';form.querySelector('[data-avatar-upload]').value='';form.querySelector('[data-avatar-status]').textContent='已選內建頭貼，儲存後移除舊照片';previewChanges();}});
    });
    form.elements.displayName.addEventListener('input',previewChanges);
    form.onsubmit = function(e) {
      e.preventDefault();
      if(imageBusy||!form.reportValidity())return;
      var name=form.elements.displayName.value.trim();
      var selected=form.querySelector('input[name="avatar"]:checked');
      if(!name||departments.indexOf(form.elements.department.value)<0)return;
      if(!selected&&!avatarImage){notify(root,'請選一個內建頭貼，或上傳自己的照片。');return;}
      var oldAvatar=Number(u.avatar);oldAvatar=Number.isInteger(oldAvatar)&&oldAvatar>=0&&oldAvatar<avatars.length?oldAvatar:0;
      var p={name:name,department:form.elements.department.value.trim(),avatar:selected?Number(selected.value):oldAvatar,avatarImage:avatarImage||'',updatedAt:A.now()};
      var b=form.querySelector('button[type="submit"]');b.disabled=true;
      A.DB.update('members/'+u.uid,p).then(function(){
        Object.assign(verified,p,{needsProfile:false});
        A.setUser(verified);
        A.toast('頭貼與姓名已更新');
        if(firstSetup)go('#/');
      }).catch(function(er){notify(root,errorText(er));}).finally(function(){b.disabled=false;});
    };
    wirePayInfo(root,u);
  }
  // 2026-11-18 收款資料表單：讀不到舊資料時不給存，免得用空白蓋掉原本的帳號。
  function wirePayInfo(root,u) {
    var f=root.querySelector('[data-payinfo]'),LP=window.LunchPay;if(!f)return;
    var qr='',busy=false,ready=false,status=f.querySelector('[data-pay-status]'),submit=f.querySelector('button[type="submit"]'),upload=f.querySelector('[data-qr-upload]');
    function say(t,bad){status.textContent=t;status.classList.toggle('is-bad',!!bad);status.hidden=!t;}
    function preview(){f.querySelector('[data-qr-box]').innerHTML=qr?'<img src="'+qr+'" alt="LINE Pay 收款碼預覽"><button type="button" class="btn sm" data-qr-remove>移除收款碼</button>':'<span class="payinfo-qr-empty">還沒有上傳收款碼</span>';}
    if(!LP){say('收款功能沒有載入，請重新整理頁面。',true);return;}
    A.DB.get('payInfo/'+u.uid).then(function(v){
      if(!f.isConnected)return;var p=LP.clean(v);
      f.elements.bank.value=p.bank;f.elements.account.value=p.account;qr=p.linePayQr;preview();ready=true;submit.disabled=false;
    }).catch(function(){if(f.isConnected){f.querySelector('[data-qr-box]').innerHTML='';say('暫時讀不到收款資料，請重新整理後再試。',true);}});
    upload.addEventListener('change',function(){
      var file=this.files&&this.files[0];if(!file||!ready)return;
      busy=true;submit.disabled=true;say('正在處理收款碼…');
      LP.compressQr(file).then(function(d){if(!f.isConnected)return;qr=d;preview();say('收款碼已放進預覽（約 '+Math.ceil(d.length*.75/1024)+' KB），按「儲存收款資料」才會生效');})
        .catch(function(e){if(f.isConnected){upload.value='';say(e.message,true);}})
        .finally(function(){busy=false;if(f.isConnected)submit.disabled=!ready;});
    });
    f.addEventListener('click',function(e){
      if(!e.target.closest('[data-qr-remove]'))return;
      function drop(){if(!f.isConnected)return;qr='';upload.value='';preview();say('已從預覽移除收款碼，按「儲存收款資料」才會生效');}
      if(typeof A.ask==='function')A.ask({title:'移除 LINE Pay 收款碼？',body:'按「儲存收款資料」後，大家就看不到這張收款碼。',okText:'移除',cancelText:'先不要',danger:true}).then(function(ok){if(ok)drop();});else if(window.confirm('移除 LINE Pay 收款碼？'))drop();
    });
    f.onsubmit=function(e){
      e.preventDefault();if(busy||!ready)return;
      var bank=f.elements.bank.value.trim().replace(/\s+/g,' '),account=f.elements.account.value.trim().replace(/\s+/g,' ');
      if(account&&!/^[0-9][0-9 -]*$/.test(account)){say('帳號只能填數字，可以用空格或 - 分段',true);return;}
      if(account&&LP.digits(account).length<6){say('帳號看起來太短，請再確認',true);return;}
      if(account&&!bank){say('請填銀行代碼和名稱，付款的人才知道要轉到哪家銀行',true);return;}
      if(bank&&!account){say('填了銀行也要填帳號',true);return;}
      var p={updatedAt:A.now()};if(bank)p.bank=bank;if(account)p.account=account;if(qr)p.linePayQr=qr;
      submit.disabled=true;say('儲存中…');
      A.DB.set('payInfo/'+u.uid,p).then(function(){
        LP.forget(u.uid);if(!f.isConnected)return;
        say(LP.hasInfo(p)?'已儲存，參加的人按「付款」就看得到。':'已儲存；目前沒有收款資料，付款視窗會請大家直接找你付款。');A.toast('收款資料已儲存');
      }).catch(function(er){if(f.isConnected)say(errorText(er),true);}).finally(function(){if(f.isConnected)submit.disabled=false;});
    };
  }
  function orderView(root) {
    var alive = true, uid = verified.uid, groups = Object.create(null);
    function canPayRow(r) { return !!(r && !r.order.cancelled && !r.group.deleted && r.group.ownerUserId && r.group.ownerUserId !== uid && r.bill.due > 0 && window.LunchPay); }
    root.innerHTML = shell('我的訂單', '<div data-order-content class="member-loading" role="status">正在讀取你的訂單…</div>'+messageBox(), null, ['#/members', '回個人資料']);
    function groupData(gid) {
      if (!groups[gid]) groups[gid] = Promise.all([A.DB.get('groups/'+gid), A.DB.get('orders/'+gid)]).then(function(v) {
        // 2026-11-18 團和訂單都不在＝這團已被刪除，略過不顯示（不讓整頁讀取失敗）；只剩訂單沒有團才算資料有缺
        if (!v[0]) { if (!v[1]) return null; throw new Error('GROUP_MISSING'); }
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
          if (!alive || !data) return [];
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
      root.querySelector('[data-order-content]').innerHTML = '<div class="member-metrics">'+metrics.map(function(m) { return '<div><span>'+m[0]+'</span><b>'+m[1]+'</b></div>'; }).join('')+'</div>'+(rows.length ? '<div class="member-orders">'+rows.map(function(r,ri) {
        var o = r.order, bill = r.bill;
        var state = o.cancelled ? '已取消 · 不計入總計' : r.pending === 0 ? '已收齊' : r.received > 0 ? '部分收款' : '待付款';
        return '<article class="member-order"><div><span class="member-kicker">'+state+'</span><h2>'+esc(r.group.title || '未命名團購')+'</h2><p>'+esc(new Date(o.createdAt || 0).toLocaleString('zh-TW'))+'</p></div><strong>應付 '+money(bill.due)+'</strong><ul>'+Object.values(o.items || {}).map(function(it) { return '<li>'+esc(typeof A.lineLabel === 'function' ? A.lineLabel(it) : it.name || it.item || '餐點')+' × '+esc(it.qty || 0)+'</li>'; }).join('')+'</ul><p class="member-fine">餐點原價 '+money(bill.base)+' · 運費 '+money(bill.shipping)+' · 折扣 '+money(bill.discount)+'</p><p>已收 '+money(r.received)+' · 待付 '+money(r.pending)+'</p>'+(canPayRow(r) ? '<button type="button" class="btn sm primary member-pay" data-pay-row="'+ri+'">付款</button>' : '')+(!r.group.deleted ? '<a class="member-link" href="#/g/'+esc(r.gid)+'">查看團購 ↗</a>' : '')+'</article>';
      }).join('')+'</div>' : '<div class="member-empty"><span>◒</span><h2>目前沒有訂單</h2><p>此會員帳號尚無訂單。</p><a class="btn primary" href="#/">去看看開放中的團購</a></div>');
      root.querySelector('[data-order-content]').onclick = function(e) {
        var b = e.target.closest('[data-pay-row]'), r = b && rows[Number(b.getAttribute('data-pay-row'))];
        if (!r || !canPayRow(r)) return;
        window.LunchPay.open({ownerUid:r.group.ownerUserId,ownerName:r.group.owner,title:r.group.title,due:r.bill.due,closed:typeof A.groupClosed === 'function' ? A.groupClosed(r.group) : true,paidState:r.pending <= 0 ? 'ok' : (r.received > 0 ? 'part' : 'none'),avatarHtml:typeof A.memberAvSlot === 'function' ? A.memberAvSlot(r.group.ownerUserId,r.group.owner,'pay-dlg-av') : ''});
      };
    }).catch(function(e) {
      if (!alive) return;
      root.querySelector('[data-order-content]').textContent = '目前無法完整讀取訂單與收款資料，金額尚未確認。';
      notify(root,e.message === 'GROUP_MISSING' ? '部分團購資料已不存在，無法確認運費與折扣，請聯絡團主。' : e.message === 'SETTLEMENT_MISSING' ? '部分訂單無法結算，請聯絡團主確認餐點資料。' : errorText(e));
    });
    return function() { alive=false; };
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
    if (verified) return true;
    pendingNext=safeNext(href);
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
    appReady.then(function(){ if(!window.firebase) return loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js'); }).then(function(){if(!firebase.apps.length)firebase.initializeApp(config());return typeof firebase.auth === 'function' ? null : loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js');}).then(function(){auth=firebase.auth();return auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);}).then(function(){auth.onAuthStateChanged(function(fu){authReady=true;var expected=fu&&fu.uid; verified=null;
      if (!fu) { if(window.LunchMascot)window.LunchMascot.hide();settle(); if(startupError===SLOW)startupError=''; A.setUser(null); return; }
      settled=false;if(window.LunchMascot)window.LunchMascot.show('正在確認會員，準備開始點餐。');
      Promise.all([A.DB.get('members/'+fu.uid),fu.getIdTokenResult()]).then(function(values){var p=values[0],claims=values[1].claims || {}; if(!auth.currentUser || auth.currentUser.uid!==expected)return;p=p||{};var signedMember={uid:fu.uid,id:fu.uid,name:p.name || fu.displayName || '午餐夥伴',department:p.department || '',avatar:p.avatar || 0,avatarImage:p.avatarImage || '',authenticated:true,needsProfile:!p.updatedAt || !p.name || !p.department,admin:claims.email_verified === true && ['junworkgogo@gmail.com','jun@adholic.com.tw','ruuu@adholic.com.tw'].indexOf(claims.email)>=0};var next=pendingNext;pendingNext='';return finishSignIn(function(){if(!auth.currentUser||auth.currentUser.uid!==expected)return;verified=signedMember;settle();if(startupError===SLOW)startupError='';if(verified.needsProfile){if(location.hash!=='#/members')go('#/members');}else if(next&&location.hash.indexOf('#/members')===0)go(next);A.setUser(verified);});}).catch(function(){if(!auth.currentUser||auth.currentUser.uid!==expected)return;if(window.LunchMascot)window.LunchMascot.hide();startupError='無法確認帳號權限，請重新登入。';verified=null;settle();A.setUser(null);});
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
