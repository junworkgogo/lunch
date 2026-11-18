/* 會員登入的 IP 迎賓動畫；不改動驗證流程或會員資料。 */
(function(){
  'use strict';
  var overlay=null,started=0,failSafe=null;
  var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function html(text,inline){return '<div class="mascot-scene'+(inline?' mascot-inline':'')+'"><div class="cat-greeting" aria-hidden="true"><img src="assets/jun-cat-vector.svg" width="153" height="180" alt=""><svg class="cat-paw" viewBox="0 0 44 60" fill="none"><path d="M12 57C11 45 9 38 5 32C1 26 4 20 9 21L8 14C7 7 14 5 17 12L18 7C20 1 27 3 27 10L29 9C35 8 38 13 35 20L39 19C44 19 44 26 40 32L32 44L31 57" fill="#fff7ed" stroke="#252621" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 26C19 22 25 23 28 28" stroke="#252621" stroke-width="3" stroke-linecap="round"/></svg></div><h2>Hi！要來點什麼</h2></div>';}
  function hide(){if(failSafe)clearTimeout(failSafe);failSafe=null;if(overlay){overlay.remove();overlay=null;}}
  function show(text){if(overlay)return;started=Date.now();overlay=document.createElement('div');overlay.className='mascot-welcome';overlay.setAttribute('role','status');overlay.setAttribute('aria-live','polite');overlay.innerHTML=html(text,false);document.body.appendChild(overlay);failSafe=setTimeout(hide,15000);}
  function finish(){if(!overlay)show();var target=overlay,delay=reduced?0:Math.max(0,1500-(Date.now()-started));return new Promise(function(resolve){setTimeout(function(){if(overlay!==target){resolve();return;}target.classList.add('leaving');setTimeout(function(){if(overlay===target)hide();resolve();},reduced?0:180);},delay);});}
  window.LunchMascot={show:show,hide:hide,finish:finish,loadingHtml:function(){return '<div class="page member-page mascot-loading" role="status" aria-live="polite">'+html('正在確認會員，準備開始點餐。',true)+'</div>';}};
})();
