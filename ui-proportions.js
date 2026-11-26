/* Measure selected labels instead of assuming equal-width segments. No data writes. */
(function(){
  'use strict';
  var selector='.home-switch,.shop-categories,.member-order-filters,.shop-category-choice,.tabsx,.tabs,.account-tab-list';
  var pending=false,observed=new Set();
  var resize=typeof ResizeObserver==='function'?new ResizeObserver(schedule):null;
  function compactCopyButtons(){
    document.querySelectorAll('[data-shop-copy],#copyLink,#copySum,.pay-copy[data-copy],[data-waiting-copy]').forEach(function(button){
      if(button.childElementCount===1&&button.firstElementChild.matches('svg[data-copy-icon]'))return;
      var text=button.textContent.trim(),what=button.getAttribute('data-copy-what'),label=button.dataset.copyLabel||(what?'複製'+what:'')||button.getAttribute('aria-label')||button.getAttribute('title')||text||'複製';
      button.dataset.copyLabel=label;
      var done=/^已複製/.test(text)||button.classList.contains('is-done');
      button.setAttribute('aria-label',done?'已複製':label);button.title=done?'已複製':label;
      button.classList.add('copy-icon');
      button.innerHTML='<svg data-copy-icon viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(done?'<path d="M5 12.5l4.5 4.5L19 7.5"/>':'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>')+'</svg>';
    });
  }
  function measure(){
    pending=false;compactCopyButtons();
    observed.forEach(function(group){if(!group.isConnected){if(resize)resize.unobserve(group);observed.delete(group);}});
    document.querySelectorAll(selector).forEach(function(group){
      if(resize&&!observed.has(group)){resize.observe(group);observed.add(group);}
      var selected=group.querySelector('[aria-selected="true"],[aria-current="page"],[aria-current="true"],[aria-pressed="true"],input:checked+span')||group.querySelector('.btn.primary');
      if(!selected||!group.getClientRects().length)return;
      var box=selected.getBoundingClientRect(),parent=group.getBoundingClientRect();
      group.style.setProperty('--segment-width',box.width+'px');
      group.style.setProperty('--segment-x',(box.left-parent.left+group.scrollLeft)+'px');
    });
  }
  function schedule(){if(!pending){pending=true;requestAnimationFrame(measure);}}
  var observer=new MutationObserver(schedule);
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-selected','aria-current','aria-pressed','data-active','checked']});
  document.addEventListener('change',schedule);
  window.addEventListener('resize',schedule);
  if(document.fonts)document.fonts.ready.then(schedule);
  schedule();
})();
