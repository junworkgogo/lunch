(function(){
'use strict';
var app=document.getElementById('app'),active=null;
function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;}
function btn(text,fn,cls){var b=el('button',cls||'dt-cell',text);b.type='button';b.addEventListener('click',fn);return b;}
function pad(n){return String(n).padStart(2,'0');}
function local(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function mount(source){
 if(source.dataset.dateTimePicker||!['date','time'].includes(source.type))return;
 source.dataset.dateTimePicker='1';var isDate=source.type==='date',label=source.id&&app.querySelector('label[for="'+source.id+'"]'),title=label?label.textContent:(source.getAttribute('aria-label')||'時間');
 var trigger=btn('',open,'dt-trigger');trigger.id=(source.id||'dt-'+Math.random().toString(36).slice(2))+'-picker';trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-label',title);if(source.hasAttribute('aria-describedby'))trigger.setAttribute('aria-describedby',source.getAttribute('aria-describedby'));source.after(trigger);source.hidden=true;if(label)label.htmlFor=trigger.id;
 function sync(){var text=source.value?(isDate?source.value.replace(/-/g,' / '):source.value):'選擇'+(isDate?'日期':'時間');if(trigger.textContent!==text)trigger.textContent=text;trigger.disabled=source.disabled;trigger.setAttribute('aria-label',title+'：'+text);trigger.setAttribute('aria-invalid',String(!source.validity.valid));trigger.classList.toggle('dt-placeholder',!source.value);}
 source.addEventListener('input',sync);source.addEventListener('change',sync);
 var own=Object.getOwnPropertyDescriptor(source,'value'),desc=own||Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
 if(desc&&desc.get&&desc.set&&desc.configurable!==false)Object.defineProperty(source,'value',{configurable:true,get:function(){return desc.get.call(this);},set:function(v){desc.set.call(this,v);sync();}});
 var setValidity=source.setCustomValidity.bind(source);source.setCustomValidity=function(message){setValidity(message);sync();};source.focus=function(){trigger.focus();};source.reportValidity=function(){if(!source.validity.valid)trigger.focus();return source.validity.valid;};
 if(source.form)source.form.addEventListener('reset',function(){setTimeout(sync,0);});sync();
 function open(){
  if(source.disabled||!source.isConnected)return;if(active)active.close();
  var d=el('dialog','dt-dialog'),head=el('div','dt-head'),heading=el('h2',null,title),content=el('div','dt-content');heading.id=trigger.id+'-title';d.setAttribute('aria-labelledby',heading.id);head.append(heading,btn('×',function(){close();},'dt-close'));d.append(head,content);document.body.append(d);active={dialog:d,source:source,close:close};trigger.setAttribute('aria-expanded','true');
  var cleaned=false;function cleanup(){if(cleaned)return;cleaned=true;trigger.setAttribute('aria-expanded','false');if(active&&active.dialog===d)active=null;d.remove();if(trigger.isConnected)trigger.focus();}
  function close(){if(d.open)d.close();cleanup();}
  function commit(value){source.value=value;source.dispatchEvent(new Event('input',{bubbles:true}));source.dispatchEvent(new Event('change',{bubbles:true}));close();}
  d.addEventListener('close',cleanup);d.addEventListener('cancel',function(e){e.preventDefault();close();});d.addEventListener('click',function(e){if(e.target===d){var r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
  if(isDate){
   var selected=/^\d{4}-\d{2}-\d{2}$/.test(source.value)?source.value:local(new Date()),parts=selected.split('-').map(Number),year=parts[0],month=parts[1]-1;
   function allowed(value){return (!source.min||value>=source.min)&&(!source.max||value<=source.max);}
   function render(focus){var restore=content.contains(document.activeElement);content.replaceChildren();var quick=el('div','dt-quick');['今天','明天'].forEach(function(t,i){var day=new Date();day.setDate(day.getDate()+i);var value=local(day),b=btn(t,function(){commit(value);},'dt-quick-btn');b.disabled=!allowed(value);quick.append(b);});var nav=el('div','dt-month'),prev=btn('‹',function(){month--;if(month<0){month=11;year--;}render('prev');}),next=btn('›',function(){month++;if(month>11){month=0;year++;}render('next');});prev.setAttribute('aria-label','上一個月');next.setAttribute('aria-label','下一個月');nav.append(prev,el('strong',null,year+' 年 '+(month+1)+' 月'),next);var grid=el('div','dt-calendar');['日','一','二','三','四','五','六'].forEach(function(t){grid.append(el('span','dt-week',t));});var offset=new Date(year,month,1).getDay(),count=new Date(year,month+1,0).getDate();for(var i=0;i<offset;i++)grid.append(el('span'));for(var day=1;day<=count;day++)(function(day){var value=year+'-'+pad(month+1)+'-'+pad(day),b=btn(String(day),function(){commit(value);});b.disabled=!allowed(value);b.setAttribute('aria-label',year+'年'+(month+1)+'月'+day+'日');b.setAttribute('aria-pressed',String(value===selected));if(value===local(new Date()))b.classList.add('dt-today');grid.append(b);})(day);content.append(quick,nav,grid);if(restore)(focus==='next'?next:focus==='prev'?prev:grid.querySelector('[aria-pressed=true]')||prev).focus();}
   render();
  }else{
   var value=/^(\d{2}):(\d{2})$/.exec(source.value),hour=value?+value[1]:12,minute=value?+value[2]:0,part='hour';
   function render(){var restore=content.contains(document.activeElement);content.replaceChildren();var display=el('div','dt-time-display'),hb=btn(pad(hour),function(){part='hour';render();},'dt-value'),mb=btn(pad(minute),function(){part='minute';render();},'dt-value');hb.setAttribute('aria-label','選擇小時');mb.setAttribute('aria-label','選擇分鐘');hb.setAttribute('aria-pressed',String(part==='hour'));mb.setAttribute('aria-pressed',String(part==='minute'));display.append(hb,el('span',null,':'),mb);var title=el('p','dt-unit',part==='hour'?'時':'分'),grid=el('div','dt-time-grid');for(var i=0;i<(part==='hour'?24:60);i++)(function(n){var b=btn(pad(n),function(){if(part==='hour'){hour=n;part='minute';}else minute=n;render();});b.setAttribute('aria-pressed',String(n===(part==='hour'?hour:minute)));grid.append(b);})(i);var quick=el('div','dt-quick');['11:30','12:00','12:30','18:00'].forEach(function(t){quick.append(btn(t,function(){commit(t);},'dt-quick-btn'));});content.append(display,title,grid,quick,btn('確定 '+pad(hour)+':'+pad(minute),function(){commit(pad(hour)+':'+pad(minute));},'dt-confirm'));if(restore)(grid.querySelector('[aria-pressed=true]')||grid.firstElementChild).focus();}
   render();
  }
  d.showModal();
 }
}
function scan(){if(!app)return;app.querySelectorAll('input[type=date],input[type=time]').forEach(mount);if(active&&!active.source.isConnected)active.close();}
window.LunchDateTime={mount:mount};if(app){new MutationObserver(scan).observe(app,{childList:true,subtree:true});scan();}
})();
