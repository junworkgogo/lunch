/* 2026-11-18 付款：負責人的收款資料（銀行帳號＋LINE Pay 收款碼）與參加者的「付款」視窗。
   資料存在 payInfo/<會員uid>：{bank, account, linePayQr, updatedAt}；只有本人能寫，登入會員可讀（規則見 database.rules.json）。
   公開的方式沒辦法一鍵打開 LINE Pay 或銀行 App 並帶入金額（研究見 研究-付款導流-20261118.md），所以這裡做「複製」與「收款碼圖片」。 */
(function(){
  'use strict';
  var A=window.LunchApp;
  var QR_LIMIT=280000;
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
  function hasInfo(p){return !!(p&&(p.account||p.linePayQr));}
  function get(uid){
    if(!uid||!A||!A.DB)return Promise.resolve(null);
    var user=A.getUser();
    if(!user||(user.uid!==uid&&!user.admin))return Promise.resolve(null);
    return A.DB.get('payInfo/'+uid).then(function(v){return v?clean(v):null;});
  }
  // Existing account callers can keep calling this after saving.
  function forget(){}

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

  function copyText(text,isCurrent){
    function fallback(){return isCurrent()?legacyCopy(text):Promise.reject(new Error('付款資料已更新'));}
    if(navigator.clipboard&&window.isSecureContext&&navigator.clipboard.writeText)return navigator.clipboard.writeText(text).catch(fallback);
    return fallback();
  }
  function legacyCopy(text){
    return new Promise(function(resolve,reject){
      var ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;top:0;left:0;width:1px;height:1px;opacity:0';
      (document.querySelector('.pay-ov')||document.body).appendChild(ta);ta.select();ta.setSelectionRange(0,text.length);
      var ok=false;try{ok=document.execCommand('copy');}catch(e){}
      ta.parentNode.removeChild(ta);ok?resolve():reject(new Error('copy'));
    });
  }

  var closeOpen=null;
  function open(o){
    if(closeOpen)closeOpen();
    var route=location.hash,alive=true,off=[],view=null,quote=null,deadlineTimer=null;
    var data={},ready=new Set(),resolveOpen;
    var opened=new Promise(function(resolve){resolveOpen=resolve;});
    function current(){return alive&&location.hash===route&&A.getUser()?.uid===o.payerUid;}
    function verifyContext(){if(!current())close();}
    function close(message){
      if(!alive)return;
      var notify=current();
      alive=false;closeOpen=null;
      off.forEach(function(stop){stop();});
      clearTimeout(deadlineTimer);
      window.removeEventListener('hashchange',verifyContext);
      window.removeEventListener('lunch:userchange',verifyContext);
      if(view)view.remove();
      resolveOpen();
      if(notify&&message)A.toast(message,true);
    }
    function readFailed(){close('暫時無法確認付款資料，請稍後重試');}
    function watch(path,receive){
      if(!alive)return;
      var stop=A.DB.on(path,function(value){
        if(!current()){close();return;}
        receive(value);
      },{onError:readFailed});
      if(alive)off.push(stop);else stop();
    }
    function checkDeadline(){
      if(!current()){close();return;}
      if(A.groupClosed(data.group)){
        close('團購已截止，請重新開啟付款確認金額');
        return;
      }
      var remaining=Number(data.group.deadline)-A.now();
      if(Number.isFinite(remaining))deadlineTimer=setTimeout(checkDeadline,Math.min(2147483647,Math.max(1,remaining)));
    }
    function check(){
      if(ready.size!==3)return;
      var group=data.group,order=data.orders&&data.orders[o.orderId];
      if(!group||group.deleted||group.cancelled)return close('團購已取消或無法查看');
      if(!order||order.cancelled||order.userId!==o.payerUid)return close('這筆訂單已無法付款');
      var uid=A.collectionReceiver(group,o.orderId);
      if(quote&&uid!==quote.ownerUid)return close('收款設定已變更，請重新開啟付款');
      if(!uid||uid===o.payerUid)return close(uid?'你是這團的收款人':'這團尚未設定收款人');
      var bill;
      try{bill=A.settlement(data.orders,group).orders[o.orderId];}catch(error){return readFailed();}
      if(!bill)return readFailed();
      var received=bill.lineDues.reduce(function(sum,amount,i){return sum+(data.paid&&data.paid[i]===true?amount:0);},0);
      var pending=bill.due-received,closed=A.groupClosed(group);
      if(pending<=0)return close('這筆訂單目前沒有待付款項');
      var flags=bill.lineDues.map(function(_,i){return !!(data.paid&&data.paid[i]===true);});
      var signature=JSON.stringify([order,bill,flags,closed,group.deadline]);
      if(quote){
        if(signature!==quote.signature)close('付款資料已更新，請重新開啟確認金額');
        return;
      }
      quote={ownerUid:uid,signature:signature};
      var paymentInfo=Promise.resolve().then(function(){
        if(!current())return null;
        return A.DB.get('payInfo/'+uid).then(function(value){return value?clean(value):null;});
      }).then(function(info){return {info:info||null};},function(error){return {info:null,infoError:error};});
      Promise.all([A.DB.get('memberDirectory/'+uid),paymentInfo]).then(function(values){
        if(!current()){close();return;}
        if(closed!==A.groupClosed(data.group))return check();
        var profile=values[0],result=values[1];
        var name=profile&&profile.name||(uid===group.ownerUserId?group.owner:'收款人');
        var detail={groupId:o.groupId,orderId:o.orderId,payerUid:o.payerUid,ownerUid:uid,ownerName:name,
          title:group.title||o.title,due:bill.due,received:received,pending:pending,closed:closed,
          info:result.info,infoError:result.infoError||null};
        view=showPayment(detail,A.memberAvSlot(uid,name,'pay-dlg-av'),close,current);
        if(!closed)checkDeadline();
        if(current())window.dispatchEvent(new CustomEvent('lunch:paymentopen',{detail:Object.assign({element:view.element,close:close},detail)}));
        resolveOpen();
      }).catch(readFailed);
    }
    function watchInput(key,path){
      watch(path,function(value){data[key]=value;ready.add(key);check();});
    }
    closeOpen=close;
    if(!current()){close();return opened;}
    window.addEventListener('hashchange',verifyContext);
    window.addEventListener('lunch:userchange',verifyContext);
    watchInput('group','groups/'+o.groupId);
    watchInput('orders','orders/'+o.groupId);
    watchInput('paid','paid/'+o.groupId+'/'+o.orderId);
    return opened;
  }
  function showPayment(o,avatarHtml,close,current){
    if(A.dismissInfoToast)A.dismissInfoToast();
    var prevFocus=document.activeElement,prevOverflow=document.body.style.overflow;
    var ov=document.createElement('div');ov.className='pay-ov';
    ov.innerHTML='<section class="pay-dlg" role="dialog" aria-modal="true" aria-labelledby="payDlgT">'+
      '<button type="button" class="pay-x" data-pay-close aria-label="關閉">×</button>'+
      '<div class="pay-to">'+(avatarHtml||'')+'<div><p class="pay-kicker">付款給</p><h2 id="payDlgT">'+esc(o.ownerName||'負責人')+'</h2></div></div>'+
      (o.title?'<p class="pay-group">'+esc(o.title)+'</p>':'')+
      '<div class="pay-amt"><div><span>'+(o.closed?'待付金額':'預估待付金額')+'</span><b>'+money(o.pending)+'</b></div><button type="button" class="pay-copy" data-copy="'+o.pending+'" data-copy-what="金額">複製金額</button></div>'+
      '<p class="pay-state" data-pay-state>應付 '+money(o.due)+' · 已收 '+money(o.received)+'</p>'+
      (o.closed?'':'<p class="pay-note">團購還沒截止；截止後如果加了運費或折扣，金額可能會變。</p>')+
      '<div data-pay-body class="pay-loading" role="status">正在讀取收款資料…</div>'+
      '<div class="pay-actions"><button type="button" class="btn primary" data-pay-close>完成</button></div>'+
      '</section>';
    document.body.appendChild(ov);document.body.style.overflow='hidden';
    var dlg=ov.querySelector('.pay-dlg'),body=ov.querySelector('[data-pay-body]'),alive=true;
    function remove(){
      alive=false;
      document.removeEventListener('keydown',key,true);
      if(ov.parentNode)ov.parentNode.removeChild(ov);
      document.body.style.overflow=prevOverflow;
      if(prevFocus&&prevFocus.focus&&prevFocus.isConnected)prevFocus.focus();
    }
    function key(e){
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();return;}
      if(e.key==='Tab'){
        var f=Array.prototype.filter.call(dlg.querySelectorAll('button,a[href],summary,input,select,textarea,[tabindex]'),function(x){return !x.disabled&&x.tabIndex>=0&&x.offsetParent!==null;});
        if(!f.length)return;var first=f[0],last=f[f.length-1];
        if(!dlg.contains(document.activeElement)){e.preventDefault();(e.shiftKey?last:first).focus();}
        else if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
    }
    document.addEventListener('keydown',key,true);
    ov.addEventListener('click',function(e){
      if(e.target.closest('[data-pay-close]')){close();return;}
      var cp=e.target.closest('[data-copy]');
      if(cp){
        if(!current()){close();return;}
        var what=cp.getAttribute('data-copy-what')||'';
        copyText(cp.getAttribute('data-copy'),function(){return current()&&cp.isConnected;}).then(function(){
          if(!alive||!cp.isConnected)return;cp.classList.add('is-done');cp.textContent='已複製';
          setTimeout(function(){if(cp.isConnected){cp.classList.remove('is-done');cp.textContent=what==='金額'?'複製金額':'複製';}},1600);
        },function(){if(alive&&cp.isConnected)A.toast('沒辦法自動複製，請長按文字自己選取',true);});
        return;
      }
      var zoom=e.target.closest('[data-qr-zoom]');
      if(zoom){var large=dlg.classList.toggle('is-big');zoom.setAttribute('aria-pressed',String(large));zoom.setAttribute('aria-label',large?'縮小 QR Code':'放大 QR Code');}
    });
    (ov.querySelector('[data-pay-close]:not(.pay-x)')||dlg).focus();

    var p=clean(o.info);
    body.className='';
    if(o.infoError){
      var message=o.infoError.code==='collection/snapshot-unavailable'?o.infoError.message:'暫時讀不到收款資料，請稍後再試，或直接找 '+(o.ownerName||'負責人')+' 付款。';
      body.innerHTML='<p class="pay-empty">'+esc(message)+'</p>';
    }else if(!o.info||!hasInfo(p)){
      body.innerHTML='<p class="pay-empty">'+esc(o.ownerName||'負責人')+' 還沒有設定收款資料，請直接找這位收款人付款。</p>';
    }else if(hasInfo(p)){
      var html='';
      if(p.account)html+='<div class="pay-block"><h3>銀行轉帳</h3>'+
        (p.bank?'<div class="pay-row"><span>銀行</span><b>'+esc(p.bank)+'</b></div>':'')+
        '<div class="pay-row"><span>帳號</span><b class="pay-acct">'+esc(p.account)+'</b><button type="button" class="pay-copy" data-copy="'+esc(digits(p.account))+'" data-copy-what="帳號">複製</button></div></div>';
      if(p.linePayQr)html+='<div class="pay-block"><h3>收款人提供的 QR Code</h3><p class="pay-note">請在付款服務核對收款人；掃碼或開啟圖片不代表已付款。</p><button type="button" class="pay-copy" data-qr-zoom aria-pressed="false" aria-label="放大 QR Code">放大／縮小</button><img class="pay-qr" style="height:auto;max-width:100%" src="'+esc(p.linePayQr)+'" alt="收款人提供的 QR Code"><a class="btn sm" download="foodjun-payment-qr.png" href="'+esc(p.linePayQr)+'">儲存圖片</a></div>';
      body.innerHTML=html;
    }else{
      body.innerHTML='';
    }
    return {element:ov,remove:remove};
  }

  window.LunchPay={get:get,forget:forget,clean:clean,hasInfo:hasInfo,compressQr:compressQr,open:open,isQr:isQr,digits:digits};
})();
