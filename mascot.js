/* 會員登入的 IP 迎賓動畫；不改動驗證流程或會員資料。 */
(function(){
  'use strict';
  var overlay=null,started=0,failSafe=null,sceneId=0;
  var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function html(text,inline){
    var mask='cat-arm-mask-'+(++sceneId);
    // One closed hand-and-arm silhouette pivots at the shoulder; the original static arm is masked out.
    return '<div class="mascot-scene'+(inline?' mascot-inline':'')+'"><div class="cat-greeting" aria-hidden="true"><svg class="cat-logo" viewBox="0 0 102 120" width="153" height="180" fill="none"><defs><mask id="'+mask+'" maskUnits="userSpaceOnUse" x="0" y="0" width="102" height="120"><rect width="102" height="120" fill="white"/><path d="M0 80H14V86L26 90L35 99V120H0Z" fill="black"/></mask></defs><image href="assets/jun-cat-vector.svg" width="102" height="120" mask="url(#'+mask+')"/><g class="cat-arm"><path d="M34 116C28 114 23 110 20 104L12 89C9 84 10 80 13 80L15 82L13 76C12 72 16 71 18 75L20 79L20 72C20 68 24 68 25 72L26 79L29 75C32 72 35 75 33 79L30 85L34 83C38 82 40 86 36 89L30 94C31 99 36 103 42 107L43 113L39 118Z" fill="#fff9f3" stroke="#232422" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 86Q23 82 27 86" stroke="#232422" stroke-width="2.5" stroke-linecap="round"/></g></svg></div><h2>Hi！要來點什麼</h2></div>';
  }
  function hide(){if(failSafe)clearTimeout(failSafe);failSafe=null;if(overlay){overlay.remove();overlay=null;}}
  function show(text){if(overlay)return;started=Date.now();overlay=document.createElement('div');overlay.className='mascot-welcome';overlay.setAttribute('role','status');overlay.setAttribute('aria-live','polite');overlay.innerHTML=html(text,false);document.body.appendChild(overlay);failSafe=setTimeout(hide,15000);}
  function finish(){if(!overlay)show();var target=overlay,delay=reduced?0:Math.max(0,1500-(Date.now()-started));return new Promise(function(resolve){setTimeout(function(){if(overlay!==target){resolve();return;}target.classList.add('leaving');setTimeout(function(){if(overlay===target)hide();resolve();},reduced?0:180);},delay);});}
  window.LunchMascot={show:show,hide:hide,finish:finish,loadingHtml:function(){return '<div class="page member-page mascot-loading" role="status" aria-live="polite">'+html('正在確認會員，準備開始點餐。',true)+'</div>';}};
})();
