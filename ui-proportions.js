/* Measure selected labels instead of assuming equal-width segments. No data writes. */
(function(){
  'use strict';
  var selector='.home-switch,.shop-categories,.member-order-filters,.shop-category-choice,.tabsx,.tabs,.account-tab-list';
  var pending=false,observed=new Set();
  var resize=typeof ResizeObserver==='function'?new ResizeObserver(schedule):null;
  function measure(){
    pending=false;
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
  observer.observe(document.getElementById('app'),{subtree:true,childList:true,attributes:true,attributeFilter:['aria-selected','aria-current','aria-pressed','data-active','checked']});
  document.addEventListener('change',schedule);
  window.addEventListener('resize',schedule);
  if(document.fonts)document.fonts.ready.then(schedule);
  schedule();
})();
