/* 2026-11-18 付款：負責人的收款資料（銀行帳號＋LINE Pay 收款碼）與參加者的「付款」視窗。
   資料存在 payInfo/<會員uid>：{bank, account, linePayQr, updatedAt}；只有本人能寫，登入會員可讀（規則見 database.rules.json）。
   公開的方式沒辦法一鍵打開 LINE Pay 或銀行 App 並帶入金額（研究見 研究-付款導流-20261118.md），所以這裡做「複製」與「收款碼圖片」。 */
(function(){
  'use strict';
  var A=window.LunchApp;
  var QR_LIMIT=280000,cache=Object.create(null);
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function money(n){return '$'+(Number(n)||0).toLocaleString('en-US');}
  function digits(s){return String(s||'').replace(/\D/g,'');}
  function isQr(v){return typeof v==='string'&&v.length<=300000&&/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(v);}
  function clean(v){
    v=v&&typeof v==='object'?v:{};
    var bank=typeof v.bank==='string'?v.bank.trim().slice(0,40):'';
    var account=typeof v.account==='string'&&/^[0-9 -]{1,30}$/.test(v.account.trim())?v.account.trim():'';
    return {bank:bank,account:account,linePayQr:isQr(v.linePayQr)?v.linePayQr:''};
  }
  function hasInfo(p){return !!(p&&p.account);}
  function get(uid){
    if(!uid||!A||!A.DB)return Promise.resolve(null);
    if(!cache[uid])cache[uid]=A.DB.get('payInfo/'+uid).then(function(v){return v?clean(v):null;},function(e){delete cache[uid];throw e;});
    return cache[uid];
  }
  function forget(uid){delete cache[uid];}

  // 收款碼壓縮：先試 PNG（QR 是黑白，PNG 最清楚），太大才改 JPEG；最長邊不放大。
  function compressQr(file){
    return new Promise(function(resolve,reject){
      if(!file||!/^image\//.test(file.type||''))return reject(new Error('請選擇圖片檔（JPG 或 PNG）'));
      if(file.size>15*1024*1024)return reject(new Error('圖片超過 15MB，請先縮小或裁切'));
      var url=URL.createObjectURL(file),img=new Image();
      img.onload=function(){
        URL.revokeObjectURL(url);
        var w0=img.naturalWidth,h0=img.naturalHeight;
        if(!w0||!h0)return reject(new Error('讀不到這張圖片，請改用 JPG 或 PNG'));
        var tries=[[1000,'image/png'],[1000,'image/jpeg',.92],[900,'image/jpeg',.86],[760,'image/jpeg',.8]];
        for(var i=0;i<tries.length;i++){
          var t=tries[i],k=Math.min(1,t[0]/Math.max(w0,h0)),w=Math.max(1,Math.round(w0*k)),h=Math.max(1,Math.round(h0*k));
          var c=document.createElement('canvas');c.width=w;c.height=h;
          var g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,w,h);g.drawImage(img,0,0,w,h);
          var d=c.toDataURL(t[1],t[2]);
          if(isQr(d)&&d.length<=QR_LIMIT)return resolve(d);
        }
        reject(new Error('圖片太大，請先裁切到只剩收款碼再上傳'));
      };
      img.onerror=function(){URL.revokeObjectURL(url);reject(new Error('讀不到這張圖片，請改用 JPG 或 PNG'));};
      img.src=url;
    });
  }

  function copyText(text){
    if(navigator.clipboard&&window.isSecureContext&&navigator.clipboard.writeText)return navigator.clipboard.writeText(text).catch(function(){return legacyCopy(text);});
    return legacyCopy(text);
  }
  function legacyCopy(text){
    return new Promise(function(resolve,reject){
      var ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;top:0;left:0;width:1px;height:1px;opacity:0';
      (document.querySelector('.pay-ov')||document.body).appendChild(ta);ta.select();ta.setSelectionRange(0,text.length);
      var ok=false;try{ok=document.execCommand('copy');}catch(e){}
      ta.parentNode.removeChild(ta);ok?resolve():reject(new Error('copy'));
    });
  }

  var closeOpen=null,openSequence=0;
  function open(o){
    var sequence=++openSequence,route=location.hash,groupPath='groups/'+o.groupId;
    function current(){return sequence===openSequence&&location.hash===route&&A.getUser()?.uid===o.payerUid;}
    return A.DB.get(groupPath).then(function(group){
      if(!current())return;
      if(!group||group.deleted)throw new Error('團購已無法查看');
      var uid=A.collectionReceiver(group,o.orderId);
      if(!uid||uid===o.payerUid){
        A.toast(uid?'你是這團的收款人':'這團尚未設定收款人');
        return;
      }
      return A.DB.get('memberDirectory/'+uid).then(function(profile){
        if(!current())return;
        var name=profile&&profile.name||(uid===group.ownerUserId?group.owner:'收款人');
        showPayment(Object.assign({},o,{
          groupPath:groupPath,ownerUid:uid,ownerName:name,avatarHtml:A.memberAvSlot(uid,name,'pay-dlg-av')
        }));
      });
    }).catch(function(){if(current())A.toast('讀不到實際收款人，請稍後重試',true);});
  }
  function showPayment(o){
    if(closeOpen)closeOpen();
    var prevFocus=document.activeElement,prevOverflow=document.body.style.overflow;
    var ov=document.createElement('div');ov.className='pay-ov';
    ov.innerHTML='<section class="pay-dlg" role="dialog" aria-modal="true" aria-labelledby="payDlgT">'+
      '<button type="button" class="pay-x" data-pay-close aria-label="關閉">×</button>'+
      '<div class="pay-to">'+(o.avatarHtml||'')+'<div><p class="pay-kicker">付款給</p><h2 id="payDlgT">'+esc(o.ownerName||'負責人')+'</h2></div></div>'+
      (o.title?'<p class="pay-group">'+esc(o.title)+'</p>':'')+
      '<div class="pay-amt"><div><span>應付金額</span><b>'+money(o.due)+'</b></div><button type="button" class="pay-copy" data-copy="'+esc(String(Math.max(0,Number(o.due)||0)))+'" data-copy-what="金額">複製金額</button></div>'+
      '<p class="pay-state" data-pay-state hidden></p>'+
      (o.closed?'':'<p class="pay-note">團購還沒截止；截止後如果加了運費或折扣，金額可能會變。</p>')+
      '<div data-pay-body class="pay-loading" role="status">正在讀取收款資料…</div>'+
      '<div class="pay-actions"><button type="button" class="btn primary" data-pay-close>完成</button></div>'+
      '</section>';
    document.body.appendChild(ov);document.body.style.overflow='hidden';
    var dlg=ov.querySelector('.pay-dlg'),body=ov.querySelector('[data-pay-body]'),alive=true,offGroup=null;
    function close(){
      if(!alive)return;alive=false;closeOpen=null;openSequence++;
      if(offGroup)offGroup();
      document.removeEventListener('keydown',key,true);
      if(ov.parentNode)ov.parentNode.removeChild(ov);
      document.body.style.overflow=prevOverflow;
      if(prevFocus&&prevFocus.focus&&prevFocus.isConnected)prevFocus.focus();
    }
    closeOpen=close;
    function key(e){
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();return;}
      if(e.key==='Tab'){
        var f=Array.prototype.filter.call(dlg.querySelectorAll('button,a[href]'),function(x){return !x.disabled&&x.offsetParent!==null;});
        if(!f.length)return;var first=f[0],last=f[f.length-1];
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
    }
    document.addEventListener('keydown',key,true);
    ov.addEventListener('click',function(e){
      if(e.target.closest('[data-pay-close]')){close();return;}
      var cp=e.target.closest('[data-copy]');
      if(cp){
        var what=cp.getAttribute('data-copy-what')||'';
        copyText(cp.getAttribute('data-copy')).then(function(){
          if(!alive)return;cp.classList.add('is-done');cp.textContent='已複製';
          setTimeout(function(){if(cp.isConnected){cp.classList.remove('is-done');cp.textContent=what==='金額'?'複製金額':'複製';}},1600);
        },function(){if(A&&A.toast)A.toast('沒辦法自動複製，請長按文字自己選取',true);});
        return;
      }
      if(e.target.closest('[data-qr-zoom]')){dlg.classList.toggle('is-big');return;}
    });
    (ov.querySelector('[data-pay-close]:not(.pay-x)')||dlg).focus();

    function clearRecipient(){
      if(!alive)return;
      close();
      A.toast('收款設定已變更，請重新開啟付款');
    }
    offGroup=A.DB.on(o.groupPath,function(group){
      if(!group||group.deleted||A.collectionReceiver(group,o.orderId)!==o.ownerUid)clearRecipient();
    },{onError:clearRecipient});
    if(!alive){offGroup();return;}

    function setState(st){
      var el=ov.querySelector('[data-pay-state]');if(!el)return;
      if(st==='ok'){el.textContent='✓ 負責人已標記收到這筆款項';el.className='pay-state is-ok';el.hidden=false;}
      else if(st==='part'){el.textContent='負責人已標記收到部分款項';el.className='pay-state';el.hidden=false;}
      else el.hidden=true;
    }
    if(o.paidState)setState(o.paidState);
    else if(o.paidPath&&A&&A.DB){
      A.DB.get(o.paidPath).then(function(p){
        if(!alive||!p||typeof p!=='object')return;
        var n=Math.max(0,Number(o.lineCount)||0),c=0;for(var i=0;i<n;i++)if(p[i]===true)c++;
        setState(n&&c===n?'ok':(c?'part':'none'));
      }).catch(function(){});
    }

    if(!o.ownerUid){body.className='';body.innerHTML='<p class="pay-empty">這一團沒有記錄負責人的帳號，請直接找 '+esc(o.ownerName||'負責人')+' 付款。</p>';return;}
    get(o.ownerUid).then(function(p){
      if(!alive)return;body.className='';
      if(!hasInfo(p)){body.innerHTML='<p class="pay-empty">'+esc(o.ownerName||'負責人')+' 還沒有設定收款資料，請直接找這位收款人付款。</p>';return;}
      var h='';
      if(p.account)h+='<div class="pay-block"><h3>銀行轉帳</h3>'+
        (p.bank?'<div class="pay-row"><span>銀行</span><b>'+esc(p.bank)+'</b></div>':'')+
        '<div class="pay-row"><span>帳號</span><b class="pay-acct">'+esc(p.account)+'</b><button type="button" class="pay-copy" data-copy="'+esc(digits(p.account))+'" data-copy-what="帳號">複製</button></div></div>';
      body.innerHTML=h;
    }).catch(function(){
      if(!alive)return;body.className='';
      body.innerHTML='<p class="pay-empty">暫時讀不到收款資料，請稍後再試，或直接找 '+esc(o.ownerName||'負責人')+' 付款。</p>';
    });
  }

  window.LunchPay={get:get,forget:forget,clean:clean,hasInfo:hasInfo,compressQr:compressQr,open:open,isQr:isQr,digits:digits};
})();
