(function(){
  'use strict';
  var app=document.getElementById('app');if(!app)return;
  function el(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}
  function button(text,fn){var b=el('button','btn sm',text);b.type='button';if(fn)b.addEventListener('click',fn);return b;}
  function numericDisplay(value){return String(value).replace(/[０-９]/g,function(c){return String.fromCharCode(c.charCodeAt(0)-0xfee0);});}
  function parse(text){var api=window.LunchApp||window.__lunch;return api&&api.parseMenu?api.parseMenu(text):null;}
  function padTime(n){return String(n).padStart(2,'0');}
  // The original input remains the source read by existing save handlers.
  function timeSelect(source){
    if(source.dataset.timeSelect)return;source.dataset.timeSelect='true';
    var label=app.querySelector('label[for="'+source.id+'"]'),name=label?label.textContent.trim():(source.getAttribute('aria-label')||'時間');
    var group=el('div','time-select'),hour=el('select'),minute=el('select'),committing=false;
    group.setAttribute('role','group');group.setAttribute('aria-label',name);
    hour.id=source.id+'-hour';minute.id=source.id+'-minute';
    hour.setAttribute('aria-label',name+'：時');minute.setAttribute('aria-label',name+'：分');
    function options(select,count,unit){var blank=el('option',null,unit);blank.value='';select.append(blank);for(var i=0;i<count;i++){var o=el('option',null,padTime(i)+' '+unit);o.value=padTime(i);select.append(o);}}
    options(hour,24,'時');options(minute,60,'分');
    function sync(){if(committing)return;var parts=/^(\d{2}):(\d{2})$/.exec(source.value);hour.value=parts?parts[1]:'';minute.value=parts?parts[2]:'';hour.disabled=minute.disabled=source.disabled;}
    function change(){committing=true;source.value=hour.value!==''&&minute.value!==''?hour.value+':'+minute.value:'';source.dispatchEvent(new Event('input',{bubbles:true}));source.dispatchEvent(new Event('change',{bubbles:true}));committing=false;}
    hour.addEventListener('change',change);minute.addEventListener('change',change);
    source.addEventListener('input',sync);source.addEventListener('change',sync);
    // Programmatic .value changes do not emit DOM events; keep both selects in sync.
    var value=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
    if(value&&value.get&&value.set)Object.defineProperty(source,'value',{configurable:true,get:function(){return value.get.call(this);},set:function(v){value.set.call(this,v);sync();}});
    group.append(hour,el('span','time-colon','：'),minute);source.after(group);source.hidden=true;
    if(label)label.htmlFor=hour.id;sync();
    if(source.form)source.form.addEventListener('reset',function(){setTimeout(sync,0);});
  }
  function businessHours(){
    var source=app.querySelector('#sh');if(!source||source.dataset.hoursPicker)return;source.dataset.hoursPicker='true';
    var panel=el('div','hours-picker'),row=el('div','hours-range');
    function endpoint(id,title,value){var wrap=el('div','hours-endpoint'),label=el('label',null,title),input=el('input');label.htmlFor=id;input.id=id;input.type='time';input.value=value;wrap.append(label,input);row.append(wrap);return input;}
    var start=endpoint('hours-start','開始時間','09:00'),end=endpoint('hours-end','結束時間','18:00');
    var status=el('p','editor-note');status.setAttribute('role','status');
    var add=button('加入營業時段',function(){if(!start.value||!end.value){status.textContent='請選好開始與結束的時、分。';return;}var period=start.value+'–'+end.value;source.value=source.value+(source.value.trim()?'；':'')+period;source.dispatchEvent(new Event('input',{bubbles:true}));source.dispatchEvent(new Event('change',{bubbles:true}));status.textContent='已加入 '+period+'。請按「儲存店家」保存。';});
    panel.append(row,add,el('p','editor-note','選好時間後按「加入營業時段」，才會加入上方文字。原有與匯入的營業資訊會保留；修改或刪除既有時段，請直接編輯上方文字。跨午夜可將結束時間設為隔日較早時間。'),status);source.after(panel);
  }
  function times(){businessHours();app.querySelectorAll('input[type="time"]').forEach(timeSelect);}
  function home(){
    var hero=app.querySelector('.hero');if(!hero||hero.dataset.interfaceHome)return;hero.dataset.interfaceHome='true';
    var h=hero.querySelector('h1'),p=hero.querySelector('p'),actions=hero.querySelector('.hero-actions');if(h)h.textContent='今日團購';if(p)p.textContent='選擇開放中的團購，登入後即可點餐。';
    // 拿掉「查看今日團購」（就在本頁，使用者 2026-11-18 指定），只留「開新團」並改成主按鈕。
    if(actions){var create=el('a','btn primary','開新團');create.href='#/new';actions.replaceChildren(create);}
  }
  function simplify(name,shop){if(!shop)return name;var escaped=shop.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return name.replace(new RegExp('^'+escaped+'\\s*[-－—–:：/／]\\s*'),'')||name;}
  function ordering(){
    var shop=app.querySelector('.shop');
    // 店家資訊一律展開、不提供收合（使用者 2026-11-17 指定）。
    if(shop&&!shop.classList.contains('shop-open')){
      var details=el('section','shop shop-open'),summary=el('h2','shop-head','店家資訊'),body=el('div','shop-details');
      while(shop.firstChild)body.appendChild(shop.firstChild);
      var heading=body.querySelector('h2');if(heading)heading.remove();details.append(summary,body);shop.replaceWith(details);shop=details;
    }
    var menu=app.querySelector('.menu'),menuList=app.querySelector('#menu');if(!menu||!menuList)return;
    var promos=app.querySelector('.promos');if(promos&&!promos.querySelector('.promo-price-note')){var note=el('p','promo-price-note editor-note','優惠僅供參考，尚未折抵金額');promos.append(note);}
    var sum=app.querySelector('#cart .sum');if(promos&&sum&&!app.querySelector('#cart .promo-price-note'))sum.after(el('p','promo-price-note editor-note','優惠僅供參考，尚未折抵金額'));
    var shopName=shop&&shop.querySelector('.sname');shopName=shopName?shopName.textContent.trim():'';
    app.querySelectorAll('#tabs .tab').forEach(function(tab){var text=simplify(tab.textContent,shopName);if(tab.textContent!==text)tab.textContent=text;});
    menuList.querySelectorAll('.cat h2').forEach(function(h){var first=h.firstChild;if(first&&first.nodeType===3){var text=simplify(first.nodeValue,shopName);if(first.nodeValue!==text)first.nodeValue=text;}});
    if(!menu.querySelector('.menu-search')){
      var search=el('div','menu-search'),input=el('input'),clear=button('清除'),empty=el('p','search-empty','找不到符合的餐點，試試其他關鍵字。');input.type='search';input.placeholder='搜尋餐點';input.setAttribute('aria-label','搜尋餐點');empty.hidden=true;empty.setAttribute('role','status');
      function filter(){var q=input.value.trim().toLocaleLowerCase(),count=0;menuList.querySelectorAll('.cat').forEach(function(cat){var visible=0;cat.querySelectorAll('.item').forEach(function(item){var name=item.querySelector('.iname');var match=!q||(name?name.textContent:item.textContent).toLocaleLowerCase().includes(q);item.hidden=!match;if(match)visible++;});cat.hidden=!visible;count+=visible;});empty.hidden=count>0;clear.hidden=!input.value;}
      input.addEventListener('input',filter);clear.addEventListener('click',function(){input.value='';filter();input.focus();});
      var tabs=app.querySelector('#tabs');if(tabs)tabs.addEventListener('click',function(e){if(e.target.closest('.tab')&&input.value){input.value='';filter();}},true);
      clear.hidden=true;search.append(input,clear);menu.prepend(search);menuList.after(empty);
    }
  }
  var soldOpen=false;
  function settings(){
    var solds=app.querySelector('#solds'),share=app.querySelector('#body .share');
    if(solds&&share){var card=solds.closest('.card');
      // 分享連結搬到供應狀態前面，連同原本的 16px 間隔一起搬，兩張卡不再黏在一起（2026-11-18）。
      if(card&&!share.dataset.moved){var gap=share.previousElementSibling;card.before(share);if(gap&&gap.getAttribute('style')==='height:16px')share.after(gap);share.dataset.moved='1';}
      var p=card&&card.querySelector('p');if(p&&p.textContent!=='切換為已售完後，同事將無法再加入這項餐點。')p.textContent='切換為已售完後，同事將無法再加入這項餐點。';
      // 供應狀態平時收起，點標題才展開（使用者 2026-11-18 指定）；同一頁內記住開關，重畫時不會自己收回去。
      var h=card&&card.querySelector('h2');
      if(h&&!card.dataset.fold){card.dataset.fold='1';card.classList.add('sold-card');
        var head=el('button','sold-toggle'),body=el('div','sold-body'),chev=el('span','sold-chev');head.type='button';head.setAttribute('aria-controls','soldsBody');body.id='soldsBody';
        chev.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
        head.append(el('span','sold-title','餐點供應狀態'),el('span','sold-count'),chev);h.replaceChildren(head);
        if(p)body.append(p);body.append(solds);h.after(body);
        head.addEventListener('click',function(){soldOpen=!soldOpen;settings();});
      }
      var tog=card&&card.querySelector('.sold-toggle'),sb=card&&card.querySelector('.sold-body');
      if(tog&&sb){var open=String(soldOpen);if(tog.getAttribute('aria-expanded')!==open)tog.setAttribute('aria-expanded',open);if(sb.hidden===soldOpen)sb.hidden=!soldOpen;
        var n=card.querySelectorAll('[data-sold][aria-checked="true"]').length,c=tog.querySelector('.sold-count'),txt=n?'已售完 '+n+' 項':'全部供應中';if(c.textContent!==txt)c.textContent=txt;c.classList.toggle('has',n>0);}
    }
    app.querySelectorAll('[data-sold]').forEach(function(b){var lab=b.querySelector('.lab'),text=b.getAttribute('aria-checked')==='true'?'已售完':'供應中';if(lab&&lab.textContent!==text)lab.textContent=text;});
    app.querySelectorAll('.soldtag').forEach(function(t){if(t.textContent!=='已售完')t.textContent='已售完';});
  }
  // Keep the original source lines. Only fields explicitly changed by the user are rewritten.
  // Category option lines and item option lines are never reserialized or dropped.
  function sourceModel(text){
    var lines=text.split(/\r?\n/),cats=[],cat=null,item=null;
    lines.forEach(function(raw,i){var s=raw.trim(),m=/^[{｛](.*?)[}｝]$/.exec(s);if(m){cat={name:m[1],line:i,items:[],options:[]};cats.push(cat);item=null;return;}if(!s)return;
      if(/^(?:[ \t　]{2,}|\t|[ \t　]*-[ \t　]+)/.test(raw)){if(item)item.options.push(raw);else if(cat)cat.options.push(raw);return;}
      var parts=s.split(/[,，﹐､]/);if(parts.length<2)return;if(!cat){cat={name:'其他',line:-1,items:[],options:[]};cats.push(cat);}var sold=parts[parts.length-1].trim()==='停售';if(sold)parts.pop();var base=parts[1].trim(),normal=parts.length===2&&/^[$＄]?[0-9０-９]+元?$/.test(base);
      item={line:i,name:parts[0].trim(),parts:parts,normal:normal,price:base.replace(/[^0-9０-９]/g,''),sold:sold,options:[]};cat.items.push(item);
    });return {lines:lines,cats:cats};
  }
  function editor(){
    var ta=app.querySelector('#sm');if(!ta||ta.dataset.visualEditor)return;ta.dataset.visualEditor='true';
    var field=ta.closest('.fld'),toolbar=el('div','editor-toolbar'),panel=el('div','menu-editor'),visual=button('可視化編輯'),raw=button('進階原始格式'),undo=button('復原上一步'),history=[],syncing=false;
    visual.setAttribute('aria-pressed','true');raw.setAttribute('aria-pressed','false');undo.disabled=true;
    var guide=el('p','editor-note','分類與餐點可直接編輯。原有尺寸、甜度及加價選項會完整保留；要調整選項，請切換「進階原始格式」。');toolbar.append(visual,raw,undo);ta.before(toolbar,panel);ta.hidden=true;
    var instructions=Array.from(field.children).filter(function(e){return e!==toolbar&&e!==panel&&e!==ta&&e.id!=='smE'&&e.tagName!=='LABEL';});
    function mode(isRaw){ta.hidden=!isRaw;panel.hidden=isRaw;visual.setAttribute('aria-pressed',String(!isRaw));raw.setAttribute('aria-pressed',String(isRaw));instructions.forEach(function(e){e.hidden=!isRaw;});if(!isRaw)draw();}
    visual.addEventListener('click',function(){mode(false);});raw.addEventListener('click',function(){mode(true);ta.focus();});
    function commit(value){if(value===ta.value)return;history.push(ta.value);if(history.length>30)history.shift();undo.disabled=false;syncing=true;ta.value=value;ta.dispatchEvent(new Event('input',{bubbles:true}));syncing=false;draw();}
    undo.addEventListener('click',function(){if(!history.length)return;syncing=true;ta.value=history.pop();ta.dispatchEvent(new Event('input',{bubbles:true}));syncing=false;undo.disabled=!history.length;draw();});
    function updateItem(model,it,key,value){var parts=it.parts.slice();if(key==='name')parts[0]=value;else if(key==='price')parts[1]=value;var sold=key==='sold'?value:it.sold;model.lines[it.line]=parts.join(', ')+(sold?', 停售':'');commit(model.lines.join('\n'));}
    function input(value,label,change,type){var wrap=el('label',null,label),x=el('input');x.type=type||'text';x.value=type==='number'?numericDisplay(value):value;x.setAttribute('aria-label',label);if(type==='number'){x.min='0';x.step='1';}x.addEventListener('change',function(){if(!x.checkValidity()||!x.value.trim()){x.reportValidity();return;}change(x.value);});wrap.append(x);return wrap;}
    function draw(){
      panel.replaceChildren(guide);var model=sourceModel(ta.value),validation=parse(ta.value);
      if(validation&&validation.errors.length)panel.append(el('p','editor-error','原始菜單有 '+validation.errors.length+' 處格式待修正，請切換進階原始格式查看下方提示。未識別的原文仍會保留。'));
      model.cats.forEach(function(cat){
        var section=el('section','editor-cat'),head=el('div','editor-cat-head');head.append(input(cat.name,'分類名稱',function(v){if(/[{}｛｝\r\n]/.test(v))return;if(cat.line<0)model.lines.unshift('{'+v+'}');else model.lines[cat.line]='{'+v+'}';commit(model.lines.join('\n'));}));
        head.append(button('刪除分類',function(){var next=model.cats[model.cats.indexOf(cat)+1],start=cat.line<0?0:cat.line;model.lines.splice(start,(next?next.line:model.lines.length)-start);commit(model.lines.join('\n'));}));section.append(head);
        if(cat.options.length)section.append(el('p','editor-cat-options','共用選項（保留）\n'+cat.options.join('\n')));
        cat.items.forEach(function(it){var row=el('div','editor-item');row.append(input(it.name,'餐點名稱',function(v){if(/[,，{}\r\n]/.test(v))return;updateItem(model,it,'name',v);}));
          if(it.normal)row.append(input(it.price,'價格',function(v){updateItem(model,it,'price',v);},'number'));else{
            var variants=el('div','editor-variants');it.parts.slice(1).forEach(function(part,vi){var match=/^(.*?)\s+[$＄]?([0-9０-９]+)元?$/.exec(part.trim());if(!match){variants.append(el('p','editor-note',part));return;}variants.append(input(match[2],match[1]+'價格',function(v){var parts=it.parts.slice();parts[vi+1]=match[1]+' '+v;model.lines[it.line]=parts.join(', ')+(it.sold?', 停售':'');commit(model.lines.join('\n'));},'number'));});row.append(variants);
          }
          var status=el('label','editor-status'),check=el('input');check.type='checkbox';check.checked=it.sold;status.append(check,document.createTextNode(it.sold?'已售完':'供應中'));check.addEventListener('change',function(){updateItem(model,it,'sold',check.checked);});row.append(status,button('刪除',function(){var end=it.line+1;while(end<model.lines.length&&(!model.lines[end].trim()||/^(?:[ \t　]{2,}|\t|[ \t　]*-[ \t　]+)/.test(model.lines[end])))end++;model.lines.splice(it.line,end-it.line);commit(model.lines.join('\n'));}));
          if(it.options.length)row.append(el('p','editor-options','規格選項（保留）\n'+it.options.join('\n')));section.append(row);
        });
        section.append(button('＋ 新增餐點',function(){var next=model.cats[model.cats.indexOf(cat)+1],at=next?next.line:model.lines.length;model.lines.splice(at,0,'新餐點, 0');commit(model.lines.join('\n'));}));panel.append(section);
      });
      panel.append(button('＋ 新增分類',function(){commit(ta.value+(ta.value?'\n':'')+'{新分類}\n');}));
    }
    ta.addEventListener('input',function(){if(!syncing)draw();});mode(false);
  }
  // 「大家點了什麼」改由團購卡「已有 N 人訂購」旁的按鈕開視窗（使用者 2026-11-18）。
  // 區塊本身留在點餐頁裡、照舊即時更新，平時隱藏；開啟時加 is-open 由 CSS 浮成置中視窗，另放一層半透明背景。
  var allOpener=null;
  function openAll(btn){var s=document.getElementById('all');if(!s)return;closeAll(true);allOpener=btn;var bd=el('div','all-backdrop');bd.setAttribute('data-all-close','');document.body.appendChild(bd);s.classList.add('is-open');s.setAttribute('role','dialog');s.setAttribute('aria-modal','true');s.setAttribute('aria-labelledby','allTitle');document.body.classList.add('all-locked');var c=s.querySelector('.all-close');if(c)c.focus();}
  function closeAll(quiet){var s=document.getElementById('all');if(s){s.classList.remove('is-open');s.removeAttribute('role');s.removeAttribute('aria-modal');}document.querySelectorAll('.all-backdrop').forEach(function(b){b.remove();});document.body.classList.remove('all-locked');if(quiet)return;var back=allOpener&&document.contains(allOpener)?allOpener:document.querySelector('[data-all-open]');if(back)back.focus();allOpener=null;}
  document.addEventListener('click',function(e){var t=e.target;if(!t||!t.closest)return;var o=t.closest('[data-all-open]');if(o){openAll(o);return;}if(t.closest('[data-all-close]'))closeAll();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&document.querySelector('#all.is-open'))closeAll();});
  window.addEventListener('hashchange',function(){closeAll(true);});
  var queued=false,observer=new MutationObserver(function(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;enhance();});});
  function enhance(){observer.disconnect();try{home();ordering();settings();editor();times();}finally{observer.observe(app,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-checked']});}}
  window.LunchInterface={enhance:enhance,sourceModel:sourceModel,numericDisplay:numericDisplay,timeSelect:timeSelect};enhance();
})();
