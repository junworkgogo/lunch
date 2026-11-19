(function(){
  'use strict';
  var app=document.getElementById('app');if(!app)return;
  // 2026-11-18 每次刪除都先跳確認視窗（共用 index.html 的 ask，同一個橘色卡片樣式）
  function confirmDel(o,fn){var A=window.LunchApp;if(A&&typeof A.ask==='function'){A.ask({title:o.title,body:o.body,okText:o.okText||'刪除',cancelText:'先不要',danger:true}).then(function(ok){if(ok)fn();});}else if(window.confirm(o.title))fn();}
  function el(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}
  function button(text,fn){var b=el('button','btn sm',text);b.type='button';if(fn)b.addEventListener('click',fn);return b;}
  function numericDisplay(value){return String(value).replace(/[０-９]/g,function(c){return String.fromCharCode(c.charCodeAt(0)-0xfee0);});}
  function parse(text){var api=window.LunchApp||window.__lunch;return api&&api.parseMenu?api.parseMenu(text):null;}
  function padTime(n){return String(n).padStart(2,'0');}
  // The original input remains the source read by existing save handlers.
  function timeSelect(source){
    if(window.LunchDateTime){window.LunchDateTime.mount(source);return;}
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
    var source=app.querySelector('#sh');
    if(source&&window.LunchHours)window.LunchHours.mount(source);
  }
  function times(){businessHours();app.querySelectorAll('input[type="time"]:not([data-hours-native])').forEach(timeSelect);}
  function home(){
    var hero=app.querySelector('.hero');if(!hero||hero.dataset.interfaceHome)return;hero.dataset.interfaceHome='true';
    var h=hero.querySelector('h1'),p=hero.querySelector('p'),actions=hero.querySelector('.hero-actions');if(h)h.textContent='今天吃什麼？';if(p)p.textContent='點進開放中的團就能點餐，想自己揪團就按「開新團」';
    // 拿掉「查看今日團購」（就在本頁，使用者 2026-11-18 指定），只留「開新團」並改成主按鈕。
    if(actions){var create=el('a','btn primary','＋開新團');create.href='#/new';actions.replaceChildren(create);}
  }
  var homeSwitchController=null;
  function homeSwitch(){
    var nav=app.querySelector('.home-switch');
    if(homeSwitchController&&homeSwitchController.nav===nav)return;
    if(homeSwitchController)homeSwitchController.destroy();
    homeSwitchController=null;
    if(!nav)return;

    var drop=el('span','home-switch-drop');
    if(typeof drop.animate!=='function')return;
    drop.setAttribute('aria-hidden','true');
    var selected=nav.querySelector('a[aria-current="page"]');
    if(!selected)return;
    var animation=null,targetBox=null;
    var reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');

    function box(element){
      var frame=nav.getBoundingClientRect(),rect=element.getBoundingClientRect();
      return {x:rect.left-frame.left-nav.clientLeft,y:rect.top-frame.top-nav.clientTop,w:rect.width,h:rect.height};
    }
    function move(animate){
      var next=nav.querySelector('a[aria-current="page"]');
      if(!next)return;
      var to=box(next),from=animate?box(drop):null;
      selected=next;
      targetBox=to;
      if(animation){animation.cancel();animation=null;}
      drop.style.width=to.w+'px';
      drop.style.height=to.h+'px';
      function transform(x,y,sx,sy){return 'translate('+x+'px,'+y+'px) scale('+sx+','+sy+')';}
      drop.style.transform=transform(to.x,to.y,1,1);
      if(!from||reducedMotion.matches||!from.w||!from.h||!to.w||!to.h)return;

      var fromCenter=from.x+from.w/2,toCenter=to.x+to.w/2;
      var travel=toCenter-fromCenter,stretch=Math.min(1,Math.abs(travel)/to.w);
      if(!stretch)return;
      function shape(progress,width,height){
        var w=to.w*width,h=to.h*height;
        return transform(fromCenter+travel*progress-w/2,to.y+(to.h-h)/2,width,height);
      }
      // Starting at the current rendered shape lets a second tap turn the same drop around.
      animation=drop.animate([
        {transform:transform(from.x,from.y,from.w/to.w,from.h/to.h),offset:0,easing:'cubic-bezier(.32,0,.22,1)'},
        {transform:shape(.38,1+.23*stretch,1-.07*stretch),offset:.34,easing:'cubic-bezier(.15,.76,.3,1)'},
        {transform:shape(.96,1+.04*stretch,1-.015*stretch),offset:.73,easing:'ease-out'},
        {transform:shape(1,1-.045*stretch,1+.025*stretch),offset:.87,easing:'ease-out'},
        {transform:drop.style.transform,offset:1}
      ],{duration:Math.round(290+190*stretch)});
    }

    nav.prepend(drop);
    nav.classList.add('home-switch-liquid');
    move(false);
    var selectionObserver=new MutationObserver(function(){
      if(nav.querySelector('a[aria-current="page"]')!==selected)move(true);
    });
    selectionObserver.observe(nav,{subtree:true,attributes:true,attributeFilter:['aria-current']});
    var sizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(function(){
      // The first size notification is only a baseline, so it must not interrupt a tap.
      var current=box(selected);
      if(current.x!==targetBox.x||current.y!==targetBox.y||current.w!==targetBox.w||current.h!==targetBox.h)move(false);
    }):null;
    if(sizeObserver)nav.querySelectorAll('a').forEach(function(link){sizeObserver.observe(link);});
    function motionChanged(){if(reducedMotion.matches)move(false);}
    if(reducedMotion.addEventListener)reducedMotion.addEventListener('change',motionChanged);
    homeSwitchController={nav:nav,destroy:function(){
      selectionObserver.disconnect();
      if(sizeObserver)sizeObserver.disconnect();
      if(animation)animation.cancel();
      if(reducedMotion.removeEventListener)reducedMotion.removeEventListener('change',motionChanged);
    }};
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
  function isOptionLine(raw){return /^(?:[ \t　]{2,}|[ \t　]*[\t　]|[ \t　]*-[ \t　]+)/.test(raw);}
  function sourceModel(text,errors){
    var invalid=new Set((errors||[]).map(function(e){return e.line-1;}));
    var lines=text.split(/\r?\n/),cats=[],cat=null,item=null;
    lines.forEach(function(raw,i){var s=raw.trim();if(!s)return;
      if(isOptionLine(raw)){if(item){item.options.push(raw);item.optionLines.push(i);}else if(cat)cat.options.push(raw);return;}
      if(invalid.has(i))return;
      var m=/^[{｛](.*?)[}｝]$/.exec(s);if(m){cat={name:m[1].trim(),line:i,items:[],options:[]};cats.push(cat);item=null;return;}
      var parts=s.split(/[,，﹐､]/);if(parts.length<2)return;var sold=parts[parts.length-1].trim()==='停售';if(sold)parts.pop();if(parts.length<2)return;
      if(!cat){cat={name:'其他',line:-1,items:[],options:[]};cats.push(cat);}var base=parts[1].trim(),normal=parts.length===2&&/^[$＄]?[0-9０-９]+元?$/.test(base);
      item={line:i,name:parts[0].trim(),parts:parts,normal:normal,price:base.replace(/[^0-9０-９]/g,''),sold:sold,options:[],optionLines:[]};cat.items.push(item);
    });return {lines:lines,cats:cats};
  }
  function editor(){
    var ta=app.querySelector('#sm');if(!ta||ta.dataset.visualEditor)return;ta.dataset.visualEditor='true';
    var field=ta.closest('.fld'),details=el('details','menu-editor-details'),summary=el('summary','menu-editor-summary'),toolbar=el('div','editor-toolbar'),panel=el('div','menu-editor'),undo=button('復原上一步');
    var history=[],lastValue=ta.value,syncing=false;
    field.querySelectorAll('label[for="sm"], .hint, .insrow').forEach(function(e){e.hidden=true;});
    toolbar.append(undo);details.append(summary,toolbar,panel);ta.before(details);ta.hidden=true;

    function remember(value){history.push(value);if(history.length>30)history.shift();}
    function setSource(value){
      syncing=true;
      try{
        ta.value=value;
        lastValue=ta.value;
        ta.dispatchEvent(new Event('input',{bubbles:true}));
      }finally{syncing=false;}
      draw();
    }
    function commit(value){if(value===ta.value)return;remember(ta.value);setSource(value);}
    undo.addEventListener('click',function(){if(history.length)setSource(history.pop());});
    function updateItem(model,it,key,value){
      var line=model.lines[it.line],parts=line.split(/([,，﹐､])/);
      if(key==='name')parts[0]=parts[0].replace(/\S(?:.*\S)?/,function(){return value;});
      else if(key==='sold'){
        if(value&&!it.sold){model.lines[it.line]=line.replace(/\s*$/,function(space){return ', 停售'+space;});}
        if(!value&&it.sold){
          var suffix=/\s*$/.exec(parts.pop())[0];
          parts.pop();
          model.lines[it.line]=parts.join('')+suffix;
        }
        commit(model.lines.join('\n'));return;
      }else parts[key]=parts[key].replace(/[0-9０-９]+(?=元?\s*$)/,value);
      model.lines[it.line]=parts.join('');
      commit(model.lines.join('\n'));
    }
    function input(value,label,change,type,allowEmpty){var wrap=el('label',null,label),x=el('input');x.type=type||'text';x.value=type==='number'?numericDisplay(value):value;x.setAttribute('aria-label',label);if(type==='number'){x.min='0';x.step='1';}x.addEventListener('change',function(){if(!x.checkValidity()||(!allowEmpty&&!x.value.trim())){x.reportValidity();return;}change(x.value);});wrap.append(x);return wrap;}
    function draw(){
      var source=ta.value,validation=parse(source),errors=validation?validation.errors:[],model=sourceModel(source,errors);
      var count=validation?validation.count:model.cats.reduce(function(total,cat){return total+cat.items.length;},0);
      summary.textContent='菜單內容 · '+model.cats.length+' 個分類、'+count+' 個品項';
      undo.disabled=!history.length;
      panel.replaceChildren();
      if(errors.length){
        details.open=true;
        panel.append(el('p','editor-error','有 '+errors.length+' 行需要修正。可直接修改下方標示的行，原因列在菜單內容下方。'));
        errors.forEach(function(error){
          var line=error.line-1;
          panel.append(input(model.lines[line],'修正第 '+error.line+' 行',function(v){model.lines[line]=v;commit(model.lines.join('\n'));},undefined,true));
        });
      }
      model.cats.forEach(function(cat){
        var section=el('section','editor-cat'),head=el('div','editor-cat-head');head.append(input(cat.name,'分類名稱',function(v){if(/[{}｛｝\r\n]/.test(v))return;if(cat.line<0)model.lines.unshift('{'+v+'}');else model.lines[cat.line]=model.lines[cat.line].replace(/^(\s*[{｛]\s*).*?(\s*[}｝]\s*)$/,function(_,before,after){return before+v+after;});commit(model.lines.join('\n'));}));
        head.append(button('刪除分類',function(){confirmDel({title:'刪除分類「'+(cat.name||'未命名')+'」？',body:'這個分類和裡面 '+cat.items.length+' 道餐點會一起移除；按「儲存店家」才會正式存檔。'},function(){if(ta.value!==source)return;var next=model.cats[model.cats.indexOf(cat)+1],start=cat.line<0?0:cat.line;model.lines.splice(start,(next?next.line:model.lines.length)-start);commit(model.lines.join('\n'));});}));section.append(head);
        if(cat.options.length)section.append(el('p','editor-cat-options','共用選項（保留）\n'+cat.options.join('\n')));
        cat.items.forEach(function(it){var row=el('div','editor-item');row.append(input(it.name,'餐點名稱',function(v){if(/[,，﹐､{}｛｝\r\n]/.test(v))return;updateItem(model,it,'name',v);}));
          if(it.normal)row.append(input(it.price,'價格',function(v){updateItem(model,it,2,v);},'number'));else{
            var variants=el('div','editor-variants');it.parts.slice(1).forEach(function(part,vi){var match=/^(.*?)\s+[$＄]?([0-9０-９]+)元?$/.exec(part.trim());if(!match){variants.append(el('p','editor-note',part));return;}variants.append(input(match[2],match[1]+'價格',function(v){updateItem(model,it,(vi+1)*2,v);},'number'));});row.append(variants);
          }
          var status=el('label','editor-status'),check=el('input');check.type='checkbox';check.checked=it.sold;status.append(check,document.createTextNode(it.sold?'已售完':'供應中'));check.addEventListener('change',function(){updateItem(model,it,'sold',check.checked);});row.append(status,button('刪除',function(){confirmDel({title:'刪除「'+(it.name||'這道餐點')+'」？',body:'這道餐點會從菜單移除；按「儲存店家」才會正式存檔。'},function(){if(ta.value!==source)return;var remove=new Set([it.line].concat(it.optionLines));model.lines=model.lines.filter(function(_,line){return !remove.has(line);});commit(model.lines.join('\n'));});}));
          if(it.options.length)row.append(el('p','editor-options','規格選項（保留）\n'+it.options.join('\n')));section.append(row);
        });
        section.append(button('＋ 新增餐點',function(){var next=model.cats[model.cats.indexOf(cat)+1],at=next?next.line:model.lines.length;model.lines.splice(at,0,'新餐點, 0');commit(model.lines.join('\n'));}));panel.append(section);
      });
      panel.append(button('＋ 新增分類',function(){commit(ta.value+(ta.value?'\n':'')+'{新分類}\n');}));
    }
    function receive(force){
      if(syncing||(!force&&ta.value===lastValue))return;
      if(ta.value!==lastValue){remember(lastValue);lastValue=ta.value;}
      details.open=false;
      draw();
    }
    ta.addEventListener('input',function(){receive(true);});
    // The linked-menu importer assigns .value and refreshes preview without emitting input.
    var value=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value');
    if(value&&value.get&&value.set)Object.defineProperty(ta,'value',{configurable:true,get:function(){return value.get.call(this);},set:function(v){
      value.set.call(this,v);
      if(!syncing)queueMicrotask(function(){receive(true);});
    }});
    if(ta.form)ta.form.addEventListener('submit',function(){
      var validation=parse(ta.value);
      if(validation&&validation.errors.length){details.open=true;summary.focus();}
    },true);
    draw();
  }
  // 「大家點了什麼」改由團購卡「已有 N 人訂購」旁的按鈕開視窗（使用者 2026-11-18）。
  // 區塊本身留在點餐頁裡、照舊即時更新，平時隱藏；開啟時加 is-open 由 CSS 浮成置中視窗，另放一層半透明背景。
  var allOpener=null;
  function openAll(btn){var s=document.getElementById('all');if(!s)return;closeAll(true);allOpener=btn;var bd=el('div','all-backdrop');bd.setAttribute('data-all-close','');document.body.appendChild(bd);s.classList.add('is-open');s.setAttribute('role','dialog');s.setAttribute('aria-modal','true');s.setAttribute('aria-labelledby','allTitle');document.body.classList.add('all-locked');var c=s.querySelector('.all-close');if(c)c.focus();}
  function closeAll(quiet){var s=document.getElementById('all');if(s){s.classList.remove('is-open');s.removeAttribute('role');s.removeAttribute('aria-modal');}document.querySelectorAll('.all-backdrop').forEach(function(b){b.remove();});document.body.classList.remove('all-locked');if(quiet)return;var back=allOpener&&document.contains(allOpener)?allOpener:document.querySelector('[data-all-open]');if(back)back.focus();allOpener=null;}
  document.addEventListener('click',function(e){var t=e.target;if(!t||!t.closest)return;var o=t.closest('[data-all-open]');if(o){openAll(o);return;}if(t.closest('[data-all-close]'))closeAll();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&document.querySelector('#all.is-open'))closeAll();});
  window.addEventListener('hashchange',function(){closeAll(true);});
  var queued=false,observer=new MutationObserver(function(){if(queued)return;queued=true;setTimeout(function(){queued=false;enhance();},0);});
  function enhance(){observer.disconnect();try{home();homeSwitch();ordering();settings();editor();times();}finally{observer.observe(app,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-checked']});}}
  window.LunchInterface={enhance:enhance,sourceModel:sourceModel,numericDisplay:numericDisplay,timeSelect:timeSelect};enhance();
})();

/* 2026-11-18 文字小動態「逐字跳動」（使用者選 A）：「開新團」按鈕平常每隔幾秒逐字輕跳一次；上方選單滑鼠移過去時逐字跳一次。
   做法：把這些按鈕裡「直接放的文字」拆成一個字一個 <span class="hop-c">，跳動全由 glass.css 控制。
   只拆還沒拆過的文字，拆完就沒有可拆的文字，不會自己一直觸發。 */
(function(){
  'use strict';
  var SEL='a.btn.primary[href="#/new"],.nav a.btn';
  function wrap(a){
    var kids=Array.prototype.slice.call(a.childNodes),i=0;
    kids.forEach(function(n){
      if(n.nodeType!==3||!/\S/.test(n.nodeValue))return;
      // 整段字先包一層 hop-w：按鈕是 flex，字若直接當 flex 子項目，按鈕的 gap 會把每個字拉開
      var f=document.createElement('span');f.className='hop-w';
      Array.from(n.nodeValue).forEach(function(ch){
        if(/\s/.test(ch)){f.appendChild(document.createTextNode(ch));return;}
        var s=document.createElement('span');s.className='hop-c';s.style.setProperty('--i',i++);s.textContent=ch;f.appendChild(s);
      });
      a.replaceChild(f,n);
    });
    // 拆成一字一格後，有些讀屏軟體會一個字一個字唸；補上整段文字當名稱（只蓋自己補的，不動原本就有的 aria-label）
    if(!a.hasAttribute('aria-label')||a.dataset.hopLabel){a.setAttribute('aria-label',a.textContent.replace(/\s+/g,' ').trim());a.dataset.hopLabel='1';}
  }
  function needs(a){return Array.prototype.some.call(a.childNodes,function(n){return n.nodeType===3&&/\S/.test(n.nodeValue);});}
  function run(){try{document.querySelectorAll(SEL).forEach(function(a){if(needs(a))wrap(a);});}catch(e){}}
  // 直接在觀察回呼裡跑（不用 requestAnimationFrame：分頁沒在畫面上時它會停住，按鈕就拆不到字）
  new MutationObserver(run).observe(document.body,{childList:true,subtree:true,characterData:true});
  run();
})();
