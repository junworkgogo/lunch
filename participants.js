/* 每團參加名單：以會員 UID 判斷資格與送單進度，不以同名合併。 */
(function(){
  'use strict';
  var A=window.LunchApp;if(!A)return;
  var own=Object.prototype.hasOwnProperty;
  function uid(u){return String(u&&(u.uid||u.id)||'');}
  function canJoin(g,u){return !!g&&(g.audience!=='selected'||!!(uid(u)&&g.participants&&own.call(g.participants,uid(u))&&g.participants[uid(u)]));}
  function validProfile(p){return !!(p&&typeof p.name==='string'&&p.name.trim()&&p.name.length<=30&&typeof p.department==='string'&&p.department.length<=40);}
  function clean(p){return {name:p.name,department:p.department||''};}
  function progress(g,orders){
    var roster=g&&g.participants||{},joined={},outside=[],done=[],waiting=[];
    Object.keys(orders||{}).forEach(function(id){var o=orders[id];if(!o||o.cancelled)return;var items=Array.isArray(o.items)?o.items:Object.values(o.items||{});if(!items.some(function(it){return it&&Number(it.qty)>0;}))return;var key=String(o.userId||'');if(key)joined[key]=true;if(!key||!own.call(roster,key))outside.push({id:id,name:o.name||'舊版訂單',userId:key});});
    Object.keys(roster).forEach(function(id){var entry={uid:id,name:String((roster[id]||{}).name||'會員'),department:String((roster[id]||{}).department||'')};(joined[id]?done:waiting).push(entry);});
    function sort(a,b){return (a.department+a.name).localeCompare(b.department+b.name,'zh-Hant');}done.sort(sort);waiting.sort(sort);
    return {done:done,waiting:waiting,outside:outside,total:done.length+waiting.length};
  }
  function esc(s){return A.esc(s);}
  function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;}
  function picker(mount,initial){
    var alive=true,directory={},chosen=Object.assign({},initial&&initial.participants||{}),mode=initial&&initial.audience==='selected'?'selected':'all',loaded=false,error='',dirty=false;
    // 團主一定在指定名單內、不能取消（使用者 2026-11-18：「自己開團就一定是指定會員之一」）。開新團＝目前登入者；既有團＝該團 ownerUserId（舊團沒有就不自動加）。
    function ownerId(){return initial&&initial.createdAt?String(initial.ownerUserId||''):uid(A.getUser());}
    function ownerProfile(id){if(!id)return null;if(validProfile(directory[id]))return clean(directory[id]);if(validProfile(chosen[id]))return clean(chosen[id]);var u=A.getUser();return uid(u)===id&&validProfile(u)?clean(u):null;}
    function keepOwner(){var id=ownerId(),p=ownerProfile(id);if(p)chosen[id]=p;}
    mount.innerHTML='<fieldset class="audience-picker"><legend>誰可以參加這一團？</legend><div class="audience-modes"><label><input type="radio" name="audience-'+mount.id+'" value="all" '+(mode==='all'?'checked':'')+'>所有會員<span>登入後即可訂餐</span></label><label><input type="radio" name="audience-'+mount.id+'" value="selected" '+(mode==='selected'?'checked':'')+'>指定會員<span>只有名單內的會員可訂餐，管理員可查看</span></label></div><div class="audience-options"'+(mode==='selected'?'':' hidden')+'><div class="audience-filters"><input type="search" placeholder="搜尋姓名或部門" aria-label="搜尋參加會員"><select aria-label="依部門篩選"><option value="">所有部門</option></select></div><div class="audience-tools"><span data-chosen-count role="status"></span><button type="button" class="text-button" data-audience-all>全選符合條件</button><button type="button" class="text-button" data-audience-clear>清除選取</button></div><div class="audience-members"></div><p class="hint audience-load" role="status">載入會員名單中…</p></div></fieldset>';
    var options=mount.querySelector('.audience-options'),list=mount.querySelector('.audience-members'),search=mount.querySelector('input[type=search]'),dept=mount.querySelector('select'),status=mount.querySelector('.audience-load');
    function filtered(){var term=search.value.trim().toLocaleLowerCase();return Object.keys(directory).filter(function(id){var p=directory[id];return validProfile(p)&&(!dept.value||p.department===dept.value)&&(!term||(p.name+' '+p.department).toLocaleLowerCase().includes(term));}).sort(function(a,b){return (directory[a].department+directory[a].name).localeCompare(directory[b].department+directory[b].name,'zh-Hant');});}
    function draw(){if(!alive)return;keepOwner();var ids=filtered();list.innerHTML=ids.map(function(id){var p=directory[id];var isOwner=id===ownerId();return '<label class="audience-person'+(isOwner?' is-owner':'')+'"><input type="checkbox" value="'+esc(id)+'" '+(own.call(chosen,id)||isOwner?'checked':'')+(isOwner?' disabled':'')+'><span class="audience-avatar" aria-hidden="true">'+esc(Array.from(p.name)[0])+'</span><span><b>'+esc(p.name)+(isOwner?'<em class="audience-owner">團主・自動加入</em>':'')+'</b><small>'+esc(p.department||'尚未設定部門')+'</small></span><span class="audience-tick" aria-hidden="true">✓</span></label>';}).join('');mount.querySelector('[data-chosen-count]').textContent='已選 '+Object.keys(chosen).length+' 人';status.textContent=error||(loaded?(ids.length?'尚未出現的會員，請對方先登入一次。':'沒有符合條件的會員。'):'載入會員名單中…');}
    function drawDepartments(){var value=dept.value,departments=[...new Set(Object.values(directory).filter(validProfile).map(function(p){return p.department;}).filter(Boolean))].sort();dept.innerHTML='<option value="">所有部門</option>'+departments.map(function(d){return '<option>'+esc(d)+'</option>';}).join('');dept.value=departments.includes(value)?value:'';}
    var off=A.DB.on('memberDirectory',function(v){if(!alive)return;directory=v||{};var u=A.getUser();if(uid(u)&&validProfile(u)&&!directory[uid(u)])directory[uid(u)]=clean(u);Object.keys(chosen).forEach(function(id){if(!directory[id])directory[id]=chosen[id];});loaded=true;drawDepartments();draw();});
    // get() surfaces permission/network errors; on() remains the live source.
    A.DB.get('memberDirectory').catch(function(){if(alive){error='會員名單暫時無法載入，請重新整理後重試。';draw();}});
    function changeHandler(e){if(!alive)return;if(e.target.type==='radio'){mode=e.target.value;options.hidden=mode!=='selected';dirty=true;draw();}else if(e.target.type==='checkbox'){dirty=true;var id=e.target.value;if(e.target.checked&&validProfile(directory[id]))chosen[id]=clean(directory[id]);else if(id!==ownerId())delete chosen[id];draw();}else if(e.target===dept)draw();}mount.addEventListener('change',changeHandler);
    search.addEventListener('input',draw);
    mount.querySelector('[data-audience-all]').onclick=function(){dirty=true;filtered().forEach(function(id){chosen[id]=clean(directory[id]);});draw();};
    mount.querySelector('[data-audience-clear]').onclick=function(){dirty=true;chosen={};keepOwner();draw();};
    draw();
    return {value:function(){keepOwner();if(mode==='selected'&&!loaded)throw new Error('會員名單載入中，請稍後再試。');if(mode==='selected'&&error)throw new Error(error);if(mode==='selected'&&Object.keys(chosen).length>500)throw new Error('單一團購最多選擇 500 位會員。');if(mode==='selected'&&!Object.keys(chosen).length)throw new Error('請至少選擇一位可參加的會員。');return {audience:mode,participants:mode==='selected'?Object.assign({},chosen):false};},dirty:function(){return dirty;},destroy:function(){alive=false;mount.removeEventListener('change',changeHandler);if(off)off();}};
  }
  function summaryHtml(g,orders,compact){
    var title='<section class="card participation-summary'+(compact?' collection-compact-progress':'')+'"><div><h2>訂餐進度</h2>';
    if(g.audience!=='selected'){
      return title+(compact?'<p class="collection-progress-public">開放所有會員</p>':'<p>本團開放所有會員；指定參加名單後，就能追蹤誰還沒訂餐。</p>')+'</div></section>';
    }
    var s=progress(g,orders);lastWaiting=s.waiting;
    // 資料重畫時維持「未訂餐」名單的開關狀態。
    var n=s.waiting.length,list=n?'<ul>'+s.waiting.map(function(p){
      return '<li><b>'+esc(p.name)+'</b>'+(p.department?'<small>'+esc(p.department)+'</small>':'')+'</li>';
    }).join('')+'</ul>':'<p class="wp-empty">所有參加會員都已訂餐。</p>';
    var waiting='<span class="wp-wrap"><button type="button" class="wp-btn" data-waiting-pop aria-haspopup="dialog" aria-controls="waitingPop" aria-expanded="'+waitPopOpen+'"><b>'+n+'</b><span class="wp-label">未訂餐<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></span></button><div class="waiting-pop" id="waitingPop" role="dialog" aria-label="誰還沒點"'+(waitPopOpen?'':' hidden')+'><div class="wp-head"><strong>誰還沒點</strong><span>'+n+' 人</span><button type="button" class="wp-close" data-waiting-close aria-label="關閉">×</button></div>'+list+(n?'<button type="button" class="text-button wp-copy" data-waiting-copy>複製名單</button>':'')+'</div></span>';
    if(compact){
      return title+'</div><strong class="collection-progress-count" aria-label="已訂餐 '+s.done.length+' 人，共 '+s.total+' 人">'+
        s.done.length+' / '+s.total+' 人</strong><div class="collection-progress-meta">'+waiting+'</div>'+
        '<progress max="'+Math.max(1,s.total)+'" value="'+s.done.length+'" aria-label="訂餐進度"></progress></section>';
    }
    return title+'<p>依有效訂單即時更新，取消後會回到未訂餐。</p></div><div class="participation-numbers">'+
      '<span><b>'+s.done.length+'</b>已訂餐</span>'+waiting+'<span><b>'+s.total+'</b>參加人數</span></div></section>';
  }
  var waitPopOpen=false,lastWaiting=[];
  function syncWaitPop(focusButton){var b=document.querySelector('[data-waiting-pop]'),p=document.getElementById('waitingPop');if(b)b.setAttribute('aria-expanded',String(waitPopOpen));if(p)p.hidden=!waitPopOpen;if(focusButton&&b)b.focus();}
  document.addEventListener('click',function(e){
    var t=e.target;if(!t||!t.closest)return;
    if(t.closest('[data-waiting-pop]')){waitPopOpen=!waitPopOpen;syncWaitPop();return;}
    if(t.closest('[data-waiting-close]')){waitPopOpen=false;syncWaitPop(true);return;}
    if(t.closest('[data-waiting-copy]')){
      var text=lastWaiting.map(function(p){return p.name+(p.department?'（'+p.department+'）':'');}).join('\n');
      function selectForCopy(){
        var pop=document.getElementById('waitingPop');
        if(!pop||pop.hidden)return;
        var field=pop.querySelector('.copyfallback');
        if(!field){
          field=el('textarea','copyfallback');field.readOnly=true;
          field.setAttribute('aria-label','未訂餐名單');pop.appendChild(field);
        }
        field.value=text;field.focus();field.select();
        A.toast('已選取名單，請直接複製');
      }
      if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).then(function(){A.toast('已複製未訂餐名單');}).catch(selectForCopy);
      else selectForCopy();
      return;
    }
    if(waitPopOpen&&!t.closest('.waiting-pop')){waitPopOpen=false;syncWaitPop();}
  });
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&waitPopOpen){waitPopOpen=false;syncWaitPop(true);}});
  window.addEventListener('hashchange',function(){waitPopOpen=false;});
  function rosterSignature(g){return JSON.stringify({audience:g&&g.audience==='selected'?'selected':'all',participants:g&&g.audience==='selected'?Object.keys(g.participants||{}).sort().map(function(id){return [id,g.participants[id]];}):false});}
  function management(mount,g,orders,gid){
    var alive=true,current=g,currentOrders=orders,baseline=rosterSignature(g),saving=false,conflict=false;
    mount.innerHTML='<div data-roster-status></div><section class="card roster-edit"><h2>設定參加名單</h2><p class="muted">更改名單不會刪除任何既有訂單。移出名單的會員無法再新增或修改餐點，仍可在「我的訂單」於截止前取消自己的訂單。</p><div id="adminAudience"></div><div class="actions"><button type="button" class="btn primary" data-save-audience>儲存參加名單</button><button type="button" class="btn" data-reload-audience>重新載入名單</button></div><p data-audience-status role="status" hidden></p></section>';
    var choose=picker(mount.querySelector('#adminAudience'),g),message=mount.querySelector('[data-audience-status]');
    function draw(){
      if(!alive)return;
      var target=mount.querySelector('[data-roster-status]');
      target.innerHTML=summaryHtml(current,currentOrders);
      if(current.audience!=='selected')return;
      var s=progress(current,currentOrders);
      if(s.outside.length)target.insertAdjacentHTML('beforeend','<p class="roster-outside">另有 '+s.outside.length+' 筆名單外既有訂單，仍保留在收錢與叫餐彙整，不計入名單完成數。</p>');
    }
    var saveButton=mount.querySelector('[data-save-audience]');
    function resetPicker(group){choose.destroy();choose=picker(mount.querySelector('#adminAudience'),group);baseline=rosterSignature(group);conflict=false;saveButton.disabled=saving;}
    mount.querySelector('[data-reload-audience]').onclick=function(){if(saving)return;resetPicker(current);message.hidden=true;};
    saveButton.onclick=function(){var value;if(saving)return;if(conflict){message.hidden=false;message.textContent='其他人已更新參加名單，請按「重新載入名單」後再修改。';return;}try{value=choose.value();}catch(e){message.hidden=false;message.textContent=e.message;return;}saving=true;saveButton.disabled=true;var expected=baseline;
      Promise.resolve().then(function(){if(!current||current.deleted||rosterSignature(current)!==expected)throw new Error('名單已由其他人更新，請重新載入後再試。');return A.DB.updateGroupAccess(gid,current,value);}).then(function(saved){if(alive){current=saved;resetPicker(saved);message.hidden=false;message.textContent='參加名單已儲存。';}}).catch(function(e){if(alive){message.hidden=false;message.textContent=e&&e.message&&e.message.indexOf('名單已')>=0?e.message:'儲存未成功，請重新確認權限及網路後再試。';}}).finally(function(){saving=false;if(alive){conflict=rosterSignature(current)!==baseline;saveButton.disabled=conflict;}});
    };
    draw();return {update:function(group,os){var changed=rosterSignature(group)!==baseline;current=group;currentOrders=os;if(changed&&!saving){if(!choose.dirty())resetPicker(group);else{conflict=true;saveButton.disabled=true;message.hidden=false;message.textContent='其他人已更新參加名單，請按「重新載入名單」後再修改。';}}draw();},destroy:function(){alive=false;choose.destroy();}};
  }

  function syncDirectory(u){
    if(!uid(u)||!validProfile(u))return;
    var profiles={};profiles[uid(u)]=clean(u);
    var load=u.admin?A.DB.get('members').then(function(m){Object.keys(m||{}).forEach(function(id){if(validProfile(m[id]))profiles[id]=clean(m[id]);});}):Promise.resolve();
    return load.then(function(){return A.DB.get('memberDirectory');}).then(function(existing){var patch={};Object.keys(profiles).forEach(function(id){if(JSON.stringify(existing&&existing[id])!==JSON.stringify(profiles[id]))patch[id]=profiles[id];});return Object.keys(patch).length?A.DB.update('memberDirectory',patch):null;}).catch(function(){/* Profile/Auth remains usable; the picker reports unavailable directory reads. */});
  }
  // 2026-11-18：收錢頁要顯示會員自己的頭貼，但 members/ 只有本人與管理員讀得到。
  // 另開 memberAvatars/<uid>（登入者可讀，內容須與 members/<uid> 的 avatar／avatarImage 相同），本人登入或改頭貼時同步自己那筆，管理員登入時補齊全部。
  // 規則還沒發布時寫入會被拒，這裡靜默略過，不影響登入與個人資料。
  var AV_IMG=/^data:image\/(webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;
  function avatarRecord(p){var a=Number(p&&p.avatar);if(!Number.isInteger(a)||a<0||a>6)return null;var r={avatar:a},img=p&&typeof p.avatarImage==='string'?p.avatarImage:'';if(img&&img.length<=40000&&AV_IMG.test(img))r.avatarImage=img;return r;}
  function syncAvatars(u){
    var id=uid(u);if(!id||!validProfile(u))return;
    var recs={},own=avatarRecord(u);if(own)recs[id]=own;
    var load=u.admin?A.DB.get('members').then(function(m){Object.keys(m||{}).forEach(function(k){var r=avatarRecord(m[k]);if(r&&validProfile(m[k]))recs[k]=r;});}):Promise.resolve();
    return load.then(function(){return u.admin?A.DB.get('memberAvatars'):A.DB.get('memberAvatars/'+id).then(function(v){var o={};if(v)o[id]=v;return o;});}).then(function(existing){var patch={};Object.keys(recs).forEach(function(k){if(JSON.stringify(existing&&existing[k])!==JSON.stringify(recs[k]))patch[k]=recs[k];});return Object.keys(patch).length?A.DB.update('memberAvatars',patch):null;}).catch(function(){});
  }
  window.LunchParticipants={canJoin:canJoin,progress:progress,picker:picker,summaryHtml:summaryHtml,management:management,syncDirectory:syncDirectory,syncAvatars:syncAvatars};
  window.addEventListener('lunch:userchange',function(e){syncDirectory(e.detail);syncAvatars(e.detail);});
})();
