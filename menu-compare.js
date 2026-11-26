(function(root,factory){'use strict';var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.LunchMenuCompare=api;api.mount(root);}})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  function flatten(cats){var out=[],counts={};(cats||[]).forEach(function(cat){(cat.items||[]).forEach(function(item){var base=cat.c+'\u001f'+item.n,occurrence=counts[base]||0;counts[base]=occurrence+1;out.push({key:base+'\u001f'+occurrence,category:cat.c,name:item.n,price:item.p,sold:!!item.so,options:JSON.stringify(item.g||[]),note:JSON.stringify([cat.d,cat.h,item.d,item.h])});});});return out;}
  function compare(before,after,pairs){var old=flatten(before),next=flatten(after),used={},changes=[];pairs=pairs||{};
    next.forEach(function(n){var oldKey=pairs[n.key]||n.key,o=old.find(function(row){return row.key===oldKey&&!used[row.key];});if(!o){changes.push({kind:'added',next:n});return;}used[o.key]=true;
      var kinds=[];if(o.name!==n.name||o.category!==n.category)kinds.push('renamed');if(o.price!==n.price)kinds.push('price');if(o.options!==n.options)kinds.push('options');if(o.note!==n.note)kinds.push('note');if(o.sold!==n.sold)kinds.push('supply');changes.push({kind:kinds.length?kinds.join(','):'same',old:o,next:n});
    });old.filter(function(o){return !used[o.key];}).forEach(function(o){changes.push({kind:'removed',old:o});});return changes;
  }
  function mount(window){var A=window.LunchApp;if(!A)return;var installed=new WeakSet();
    function scan(){document.querySelectorAll('form#f').forEach(function(form){var sm=form.querySelector('#sm');if(!sm||installed.has(form))return;installed.add(form);
      var initial=sm.defaultValue||sm.value,previous=A.parseMenu(initial).cats,pairs={},signature='',box=document.createElement('section');box.className='menu-comparison';box.hidden=true;sm.closest('.fld').after(box);
      function draw(){var current=A.parseMenu(sm.value);signature=sm.value;box.hidden=sm.value===initial;if(box.hidden)return;
        var rows=compare(previous,current.cats,pairs),changed=rows.filter(function(row){return row.kind!=='same';}),removed=rows.filter(function(row){return row.kind==='removed';});
        box.innerHTML='<h3>儲存前核對菜單變更</h3><p class="hint">此處只比對草稿，尚未修改正式菜單。名稱不同時先列為新增與疑似移除，可人工配對；歷史訂單不受影響。</p>'+
          (current.errors&&current.errors.length?'<p class="err">請先修正菜單格式錯誤。</p>':'')+
          '<p>新增 '+rows.filter(function(r){return r.kind==='added';}).length+'・疑似移除 '+removed.length+'・其他變更 '+rows.filter(function(r){return !['same','added','removed'].includes(r.kind);}).length+'・未變動 '+rows.filter(function(r){return r.kind==='same';}).length+'</p>'+
          (changed.length?'<ul>'+changed.map(function(row){var item=row.next||row.old,label=row.kind==='added'?'新增':row.kind==='removed'?'疑似移除':row.kind.split(',').map(function(k){return {renamed:'名稱／分類',price:'價格',options:'選項',note:'說明',supply:'供應狀態'}[k];}).join('、')+'變更';
            return '<li>'+A.esc(label+'｜'+item.category+'・'+item.name)+(row.old&&row.next&&row.old.price!==row.next.price?'：'+A.money(row.old.price)+' → '+A.money(row.next.price):'')+(row.kind==='added'&&removed.length?'<label class="hint"> 人工配對原品項<select data-pair="'+A.esc(row.next.key)+'"><option value="">視為新增</option>'+removed.map(function(r){return '<option value="'+A.esc(r.old.key)+'">'+A.esc(r.old.category+'・'+r.old.name)+'</option>';}).join('')+'</select></label>':'')+'</li>';
          }).join('')+'</ul>':'<p>解析後品項相同，僅文字格式變更。</p>')+
          (Object.keys(pairs).length?'<button type="button" class="btn sm" data-clear-pairs>撤回人工配對</button>':'')+'<label><input type="checkbox" data-compare-confirm> 我已核對餐點、價格、選項及移除項目，確認儲存。</label><p data-compare-error class="err" role="alert" hidden>請先核對菜單變更並勾選確認。</p>';
        var undo=box.querySelector('[data-clear-pairs]');if(undo)undo.onclick=function(){pairs={};draw();};box.querySelectorAll('[data-pair]').forEach(function(select){select.onchange=function(){if(select.value)pairs[select.dataset.pair]=select.value;else delete pairs[select.dataset.pair];draw();};});
      }
      sm.addEventListener('input',draw);sm.addEventListener('change',draw);
      form.addEventListener('submit',function(event){if(sm.value===initial)return;if(signature!==sm.value)draw();var check=box.querySelector('[data-compare-confirm]');if(!check||!check.checked){event.preventDefault();event.stopImmediatePropagation();box.querySelector('[data-compare-error]').hidden=false;box.scrollIntoView({block:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}},true);
      draw();
    });}
    new MutationObserver(scan).observe(document.getElementById('app'),{subtree:true,childList:true});scan();
  }
  return {flatten:flatten,compare:compare,mount:mount};
});
