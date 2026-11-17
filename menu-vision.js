/* JUN胖達 菜單相片辨識：AI 優先，OCR 備援；永不直接寫入 Firebase */
(function(){
'use strict';
// 2026-11-18 每次刪除都先跳確認視窗（共用 index.html 的 ask）
function confirmDel(o,fn){var A=window.LunchApp;if(A&&typeof A.ask==='function'){A.ask({title:o.title,body:o.body,okText:o.okText||'移除',cancelText:'先不要',danger:true}).then(function(ok){if(ok)fn();});}else if(window.confirm(o.title))fn();}
var MAX_FILES=5, MAX_FILE_BYTES=12*1024*1024, MAX_EDGE=1800;
var OCR_SRC='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
var API='https://lunch-relay.vercel.app/api/vision';
var loadOcrPromise=null;
function $ (node,selector){return node.querySelector(selector);}
function parse(s){return window.LunchApp&&window.LunchApp.parseMenu(s);}
function alive(el){return !!el.isConnected;}
function status(box,message,bad){
  var el=$(box,'[data-mv-status]');if(!el)return;
  el.textContent=message;el.classList.toggle('error',!!bad);
}
function cleanName(s){return String(s||'').replace(/[\r\n\t,，{}]/g,' ').replace(/\s+/g,' ').trim().slice(0,90);}
function fileToData(file){
  return new Promise(function(resolve,reject){
    if(!file||!/^image\/(jpeg|png|webp|gif|heic|heif)$/i.test(file.type||'')&&!/\.(jpe?g|png|webp|gif|heic)$/i.test(file.name)){reject(new Error('請使用 JPG、PNG 或 WebP 菜單圖片'));return;}
    if(file.size>MAX_FILE_BYTES){reject(new Error('單張圖片不可超過 12MB'));return;}
    var url=URL.createObjectURL(file),img=new Image();
    img.onload=function(){
      URL.revokeObjectURL(url);
      try{
        var size=Math.min(1,MAX_EDGE/Math.max(img.naturalWidth,img.naturalHeight));
        var canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(img.naturalWidth*size));canvas.height=Math.max(1,Math.round(img.naturalHeight*size));
        var ctx=canvas.getContext('2d',{willReadFrequently:true});
        ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL('image/jpeg',0.88));
      }catch(e){reject(new Error('圖片處理失敗，請換一張照片'));}
    };
    img.onerror=function(){URL.revokeObjectURL(url);reject(new Error('無法開啟圖片，HEIC 可先轉為 JPG'));};
    img.src=url;
  });
}
function loadOCR(){
  if(window.Tesseract)return Promise.resolve(window.Tesseract);
  if(loadOcrPromise)return loadOcrPromise;
  loadOcrPromise=new Promise(function(resolve,reject){
    var tag=document.createElement('script');tag.src=OCR_SRC;tag.async=true;
    tag.onload=function(){window.Tesseract?resolve(window.Tesseract):reject(new Error('OCR 載入失敗'));};
    tag.onerror=function(){reject(new Error('OCR 元件無法載入，請確認網路連線'));};
    document.head.appendChild(tag);
  }).catch(function(e){loadOcrPromise=null;throw e;});
  return loadOcrPromise;
}
function ocrToMenu(text){
  var lines=String(text||'').split(/\r?\n/),out=[],category='',items=0,unknown=[],seen={};
  var section=/^(便當|飯類|麵類|湯類|小菜|主食|飲料|茶類|咖啡|果汁|點心|甜點|早餐|套餐|單點|炸物|鍋物|蔬食|沙拉|人氣推薦|熱銷推薦|招牌|其他|餐點|飲品)(?:系列|區)?$/;
  lines.forEach(function(raw){
    var line=raw.replace(/[|｜]/g,' ').replace(/[＄]/g,'$').replace(/[０-９]/g,function(c){return String.fromCharCode(c.charCodeAt(0)-65248);}).replace(/[，]/g,',').replace(/\s+/g,' ').trim();
    if(!line||line.length>100)return;
    line=line.replace(/^[●•◦▪■★☆\-–—]+\s*/,'').trim();
    if(!line)return;
    if(section.test(line)){category=line;return;}
    if(/(電話|地址|營業時間|訂購專線|外送|LINE|facebook|instagram|統編|客服|折扣碼|掃描|QR\s*CODE|優惠活動)/i.test(line))return;
    var match=/^(.{2,65}?)\s*(?:[.:：\-－]{0,2}\s*)?(?:NT\$?|\$|＄)?\s*(\d{2,4})(?:\s*元)?\s*$/.exec(line);
    if(!match){if(/[一-龥]/.test(line)&&unknown.length<8)unknown.push(line);return;}
    var name=cleanName(match[1]).replace(/[.。:：\-－]+$/,'').trim(),price=Number(match[2]);
    if(!name||!/[一-龥A-Za-z]/.test(name)||/^(NO|編號|編碼|電話|折扣|總計|小計)$/i.test(name)||price>9999)return;
    var key=(category||'其他')+'|'+name+'|'+price;if(seen[key])return;seen[key]=1;
    var cat=category||'其他';if(out.length===0||out[out.length-1]!=='{'+cat+'}'&&out._lastCat!==cat){out.push('{'+cat+'}');out._lastCat=cat;}
    out.push(name+', '+price);items++;
  });
  return {text:out.join('\n'),count:items,warnings:unknown};
}
function safeResult(json){
  if(!json||typeof json!=='object')throw new Error('辨識回應格式不正確');
  var cats=Array.isArray(json.categories)?json.categories:[],out=[],total=0;
  cats.slice(0,60).forEach(function(cat){
    var rows=[],items=Array.isArray(cat.items)?cat.items:[];
    items.slice(0,160).forEach(function(it){
      var n=cleanName(it.name),p=Number(it.price);
      if(!n||!Number.isInteger(p)||p<0||p>9999)return;
      rows.push(n+', '+p+(it.soldOut?', 停售':''));
      var opts=Array.isArray(it.options)?it.options:[];
      opts.slice(0,8).forEach(function(g){
        var gn=cleanName(g.name).replace(/[:*+]/g,'');
        var choices=Array.isArray(g.choices)?g.choices:[];
        var values=choices.slice(0,15).map(function(o){
          var label=cleanName(o.name).replace(/[+]/g,'加'),add=Number(o.add)||0;
          return label&&Number.isInteger(add)&&add>=0&&add<=9999?label+(add?'+'+add:''):null;
        }).filter(Boolean);
        if(gn&&values.length)rows.push('  '+gn+(g.required?'*':'')+': '+values.join(', '));
      });
    });
    if(rows.length){out.push('{'+cleanName(cat.name||'其他')+'}');out.push.apply(out,rows);total+=items.length;}
  });
  var text=out.join('\n'),parsed=parse(text);
  if(!parsed||!parsed.count)throw new Error('圖片中沒有辨識到可用的餐點與價格，請換清晰照片');
  if(parsed.errors.length)throw new Error('AI 結果包含不支援的菜單格式，請改用文字辨識');
  return {text:text,count:parsed.count,source:'AI',warnings:Array.isArray(json.warnings)?json.warnings.slice(0,8):[]};
}
async function callAI(images){
  if(!window.firebase||!firebase.auth||!firebase.auth().currentUser)throw new Error('尚未登入');
  var token=await firebase.auth().currentUser.getIdToken();
  var response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({images:images}),cache:'no-store'});
  var result=await response.json().catch(function(){return {};});
  if(!response.ok)throw new Error(result.message||'AI 服務暫時不可用');
  return safeResult(result);
}
async function callOCR(images,onProgress){
  var T=await loadOCR(),worker=null,all=[],warnings=[];
  try{
    worker=await T.createWorker('chi_tra+eng',1,{logger:function(m){if(m.status==='recognizing text'&&onProgress)onProgress(Math.round((m.progress||0)*100));}});
    for(var i=0;i<images.length;i++){
      var r=await worker.recognize(images[i]);all.push(ocrToMenu(r.data.text));
    }
  }finally{if(worker)await worker.terminate();}
  var merged=[],last='';
  all.forEach(function(r){if(r.count){var s=r.text;if(last&&s.indexOf('{'+last+'}')===0)s=s.replace(/^\{[^}]+\}\n/,'');merged.push(s);var cats=s.match(/\{([^}]+)\}/g);if(cats&&cats.length)last=cats[cats.length-1].slice(1,-1);}warnings=warnings.concat(r.warnings||[]);});
  var text=merged.join('\n');var p=parse(text);
  if(!p||!p.count)throw new Error('沒有辨識到完整的「品名＋價格」，請換清晰、正面拍攝的圖片，或改用手動編輯');
  return {text:text,count:p.count,source:'OCR',warnings:warnings.slice(0,6)};
}
function mount(form){
  if(form.dataset.menuVisionReady)return;
  var sm=$(form,'#sm');if(!sm)return;
  form.dataset.menuVisionReady='1';
  var target=sm.closest('.fld'),box=document.createElement('div');
  box.className='menu-vision';
  box.innerHTML='<h3>✦ AI 圖片辨識菜單</h3>'+
    '<p class="mv-sub">上傳店家菜單照片，辨識餐點名稱、分類、價格及選項。支援最多 5 張照片，辨識後可檢查與修改，不會直接覆蓋已儲存資料。</p>'+
    '<div class="mv-choose"><label for="mvFile" class="btn">＋ 上傳菜單照片</label><span class="mv-hint">JPG / PNG / WebP，每張 12 MB 以下</span><input class="mv-file" id="mvFile" type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple></div>'+
    '<div class="mv-photos" data-mv-photos hidden></div>'+
    '<div class="mv-actions"><button type="button" class="btn primary" data-mv-run disabled>✦ 開始 AI 辨識</button><button type="button" class="btn" data-mv-clear disabled>清空照片</button></div>'+
    '<div data-mv-status class="mv-progress" role="status" aria-live="polite">選擇菜單照片即可開始</div>'+
    '<div class="mv-result" data-mv-result hidden><h4 data-mv-title>辨識結果</h4><div class="mv-list" data-mv-preview></div><p class="mv-warnings" data-mv-warning></p><div class="mv-actions"><button type="button" class="btn primary" data-mv-apply>✓ 帶入菜單欄位</button><button type="button" class="btn" data-mv-dismiss>取消</button></div><p class="mv-hint">帶入後可繼續修改，只有按下原本的「儲存店家」才會更新資料庫</p></div>';
  target.parentNode.insertBefore(box,target);
  var file=$(box,'#mvFile'),photos=$(box,'[data-mv-photos]'),run=$(box,'[data-mv-run]'),clear=$(box,'[data-mv-clear]'),result=$(box,'[data-mv-result]');
  var items=[],working=false,recognized=null;
  function update(){
    photos.hidden=!items.length;run.disabled=working||!items.length;clear.disabled=working||!items.length;
    file.disabled=working;
    photos.innerHTML=items.map(function(it,i){return '<div class="mv-photo"><img src="'+it.data+'" alt="菜單照片 '+(i+1)+'"><button type="button" class="mv-remove" data-mv-del="'+i+'" aria-label="移除照片 '+(i+1)+'">×</button><span>'+String(it.name).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];})+'</span></div>';}).join('');
  }
  file.addEventListener('change',async function(){
    var selected=Array.from(file.files||[]);file.value='';
    if(!selected.length)return;
    if(items.length+selected.length>MAX_FILES){status(box,'最多只能上傳 5 張照片',true);return;}
    working=true;update();result.hidden=true;recognized=null;
    for(var i=0;i<selected.length;i++){
      try{status(box,'正在處理第 '+(i+1)+' / '+selected.length+' 張照片…');var data=await fileToData(selected[i]);if(!alive(box))return;items.push({name:selected[i].name,data:data});}
      catch(e){status(box,e.message,true);}
    }
    working=false;update();if(items.length)status(box,'已選取 '+items.length+' 張照片，按「開始 AI 辨識」');
  });
  photos.addEventListener('click',function(e){
    var b=e.target.closest('[data-mv-del]');if(!b||working)return;
    var it=items[Number(b.getAttribute('data-mv-del'))];if(!it)return;
    confirmDel({title:'移除這張菜單照片？',body:'只會從這次辨識拿掉，不影響原本菜單。'},function(){
      var at=items.indexOf(it);if(working||at<0)return;
      items.splice(at,1);recognized=null;result.hidden=true;update();status(box,items.length?'剩下 '+items.length+' 張照片':'請上傳菜單照片');
    });
  });
  clear.addEventListener('click',function(){if(working||!items.length)return;
    confirmDel({title:'清空全部 '+items.length+' 張照片？',body:'只會從這次辨識拿掉，不影響原本菜單。',okText:'清空'},function(){if(working)return;items=[];recognized=null;result.hidden=true;update();status(box,'已清空照片，不影響原本菜單');});
  });
  run.addEventListener('click',async function(){
    if(working||!items.length)return;
    working=true;update();result.hidden=true;status(box,'正在使用 AI 辨識 '+items.length+' 張菜單…');
    var images=items.map(function(it){return it.data;});
    try{
      var data;
      try{data=await callAI(images);}
      catch(err){
        if(!alive(box))return;
        status(box,'AI 未完成（'+String(err.message||'服務不可用').slice(0,60)+'），改用圖片文字辨識…');
        data=await callOCR(images,function(p){if(alive(box))status(box,'OCR 文字辨識中 '+p+'%…');});
      }
      if(!alive(box))return;
      recognized=data;
      $(box,'[data-mv-title]').textContent='✓ '+data.source+' 辨識完成，共 '+data.count+' 個品項';
      $(box,'[data-mv-preview]').textContent=data.text;
      var warnings=(data.warnings||[]).map(function(w){return typeof w==='string'?w:String(w&&w.message||'');}).filter(Boolean);
      $(box,'[data-mv-warning]').textContent=warnings.length?'請再確認不清楚的文字／價格：'+warnings.join('、'):'請確認餐點與價格是否與原圖相符，特別是規格及加價';
      result.hidden=false;
      status(box,'已辨識 '+data.count+' 個品項，請檢查下方結果再帶入');
    }catch(e){if(alive(box))status(box,'辨識失敗：'+(e.message||'請換較清晰的照片'),true);}
    finally{working=false;if(alive(box))update();}
  });
  $(box,'[data-mv-dismiss]').addEventListener('click',function(){recognized=null;result.hidden=true;status(box,'已取消帶入，原本菜單沒有變更');});
  $(box,'[data-mv-apply]').addEventListener('click',async function(){
    if(!recognized)return;
    var old=sm.value.trim();
    if(old&&old!=='{主食}\n範例便當, 80\n範例麵, 50\n  尺寸*: 小碗, 大碗+20'){
      if(!window.confirm('要以圖片辨識結果取代目前編輯中的菜單嗎？尚未儲存，不會立即覆蓋資料庫。'))return;
    }
    sm.value=recognized.text;
    sm.dispatchEvent(new Event('input',{bubbles:true}));
    result.hidden=true;
    status(box,'✓ 已帶入 '+recognized.count+' 個品項，請檢查預覽，再按「儲存店家」');
    if(window.LunchApp&&window.LunchApp.toast)window.LunchApp.toast('✓ 菜單已自動填入，確認後記得儲存店家');
  });
  update();
}
function scan(){
  document.querySelectorAll('#app form#f').forEach(function(form){if(form.querySelector('#sm'))mount(form);});
}
var observer=new MutationObserver(scan);
var app=document.getElementById('app');if(app)observer.observe(app,{childList:true,subtree:true});
scan();
})();