/* 會員登入的 IP 迎賓動畫；不改動驗證流程或會員資料。 */
(function(){
  'use strict';
  var overlay=null,started=0,failSafe=null;
  var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function html(text,inline){return '<div class="mascot-scene'+(inline?' mascot-inline':'')+'"><div class="mascot-orbit" aria-hidden="true"><span></span><span></span><span></span></div><img class="mascot-image" src="assets/jun-mascot-360.jpg" alt="戴著橘色帽子的 JUN 午餐貓" width="180" height="180"><h2>JUN胖達</h2><p>'+String(text||'準備好，一起吃頓好午餐。')+'</p><span class="mascot-dots" aria-hidden="true"><i></i><i></i><i></i></span></div>';}
  function hide(){if(failSafe)clearTimeout(failSafe);failSafe=null;if(overlay){overlay.remove();overlay=null;}}
  function show(text){if(overlay)return;started=Date.now();overlay=document.createElement('div');overlay.className='mascot-welcome';overlay.setAttribute('role','status');overlay.setAttribute('aria-live','polite');overlay.innerHTML=html(text,false);document.body.appendChild(overlay);failSafe=setTimeout(hide,15000);}
  function finish(){if(!overlay)show();var target=overlay,delay=reduced?0:Math.max(0,950-(Date.now()-started));return new Promise(function(resolve){setTimeout(function(){if(overlay!==target){resolve();return;}target.classList.add('leaving');setTimeout(function(){if(overlay===target)hide();resolve();},reduced?0:180);},delay);});}
  window.LunchMascot={show:show,hide:hide,finish:finish,loadingHtml:function(){return '<div class="page member-page mascot-loading" role="status" aria-live="polite">'+html('正在確認會員，準備開始點餐。',true)+'</div>';}};
})();
