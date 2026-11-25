/* JUN胖達／AI 菜單圖片辨識，Vercel relay/api/vision.js
 * Server env（2026-11-19 起 Gemini 優先）：
 *   GEMINI_API_KEY（有設就用 Gemini 讀圖）、GEMINI_VISION_MODEL（選填，預設 gemini-3.6-flash）
 *   OPENAI_API_KEY、OPENAI_VISION_MODEL（沒設 Gemini 金鑰、或 Gemini 全部失敗時才用；兩者共用 55 秒總時限）
 * Gemini 只用免費額度。先請主模型；它失敗就馬上換下一個，超過 HEDGE_MS 還沒回就同時請下一個，
 * 先拿到有效結果的就用、其餘中止（2026-11-19 實測：主模型回 503 後，第二個模型吃光剩餘時間，第三個沒輪到）。
 * 每次呼叫都在 Vercel log 留「模型、狀態、毫秒」，方便量測。
 * Admin access checked with Firebase Identity Toolkit; image bytes held in memory only.
 */
'use strict';
const ORIGIN='https://junworkgogo.github.io';
const FIREBASE_KEY='AIzaSyCLzpiNkFesQYvTiS9e9Jh4fMVRr6riQ74'; // Firebase client config, not secret
const PROJECT_ID='lunch-8ebca';
const TOTAL_MS=55000;   // 留在一分鐘內回應
const HEDGE_MS=20000;   // 一個模型 20 秒還沒回，就同時請下一個
const MIN_START_MS=6000; // 剩不到 6 秒就不再開新的呼叫
const GEMINI_URL='https://generativelanguage.googleapis.com/v1beta/models/';
const GEMINI_FALLBACKS=['gemini-3.5-flash-lite','gemini-flash-lite-latest','gemini-flash-latest'];
// 2026-11-24 共用選項與分類/單品限制一起辨識，不根據品名猜供應條件。
const PROMPT='你是台灣餐廳菜單資料擷取助手。只根據照片上實際看得見的文字、圖例和價格，不得猜測或補造品名、價格、選項，不要把地址、電話、營業時間或折扣當作餐點。輸出繁體中文JSON，格式 {"sharedOptions":[{"name":"甜度","required":true,"choices":[{"name":"無糖","add":0}]}],"categories":[{"name":"分類名稱","options":[],"note":"","hint":"","items":[{"name":"品名","price":80,"soldOut":false,"note":"","hint":"","options":[]}]}],"warnings":[]}。所有options與sharedOptions都採用相同群組格式name/required/choices；choices每筆name/add。全店明確共用的甜度、冰量、冷熱、加料放sharedOptions；只適用某分類的放該分類options，不得將飲料選項套到餐點分類。品項的例外限制放該品項options，以同名群組覆寫共用選項。糖度/糖量統一叫甜度，冰量/冰塊統一叫冰塊，冷熱/溫度統一叫溫度。圖例明示可冷可熱時溫度選項是冷、熱；只有冷飲或只有熱飲的品項只能放對應的一個溫度選項且required=true，不得一律給所有品項冷熱。固定糖或固定冰請用同名群組只有一個選項required=true；不提供加料的品項加上同名加料群組僅一個不加料選項add=0以覆寫共用。加料旁有限冷飲等限制必保留在選項名稱括號內，價格標在整排前即適用該排每一項。只有明確列出選項及加價時才填，未列糖冰溫度不可猜，放warnings請使用者補確認；一般糖冰與冷熱沒有加價標示時add=0，有價差則照實。price只允許確定的整數新台幣，價格不清楚略過品項並警告。多個完整價格將最低價寫price，各規格add是與最低價差額。不要把原價當折扣價。多圖重複品項去重；保留原分類和品名順序，分類沒有標示用其他。品項或分類的資訊放note：品項旁或下方的小字說明放該品項note，例如季節限定（夏季限定）、計價單位（每包、每斤）、套餐內容（素肉燥+大陸妹+油豆腐+泡菜）、辣或甜的小圖示（寫成辣味、甜味）；店家告知事項（例如本店採用非基改豆腐）放該分類note；只適用其中幾個品項的就分別放進那幾個品項的note。請客人點餐時要另外備註告知的提醒放hint，例如需要飯一半或不需加海苔另外備註、不辣請先告知、去奶請先告知；只適用其中幾個品項的就分別放進那幾個品項的hint，整個分類共用的放該分類hint。同一句不要同時放note和hint。只寫照片上看得到的字，不得自己補；note和hint不要重複品名和價格；沒有就填空字串。不要markdown。';
const OPTION_SCHEMA={type:'OBJECT',properties:{name:{type:'STRING'},required:{type:'BOOLEAN'},choices:{type:'ARRAY',items:{type:'OBJECT',properties:{name:{type:'STRING'},add:{type:'INTEGER'}},required:['name','add']}}},required:['name','choices']};
const SCHEMA={type:'OBJECT',properties:{
 sharedOptions:{type:'ARRAY',items:OPTION_SCHEMA},
 categories:{type:'ARRAY',items:{type:'OBJECT',properties:{
  name:{type:'STRING'},note:{type:'STRING'},hint:{type:'STRING'},options:{type:'ARRAY',items:OPTION_SCHEMA},
  items:{type:'ARRAY',items:{type:'OBJECT',properties:{
   name:{type:'STRING'},price:{type:'INTEGER'},soldOut:{type:'BOOLEAN'},note:{type:'STRING'},hint:{type:'STRING'},options:{type:'ARRAY',items:OPTION_SCHEMA}
  },required:['name','price']}}
 },required:['name','items']}},
 warnings:{type:'ARRAY',items:{type:'STRING'}}
},required:['categories']};
// 2026-11-23 營業時間模式（body.kind==='hours'）：同一套金鑰、模型接力與管理員驗證，只換提示詞與輸出格式
const HOURS_PROMPT='你是台灣店家營業時間擷取助手。只根據圖片上實際看得見的文字，讀出星期一到星期日每天的營業時段，不得猜測或補造。以 JSON 物件輸出，格式 {"days":[{"day":"一","closed":false,"ranges":[{"start":"09:00","end":"21:50"}]}],"warnings":["看不清楚的地方"]}。day 只能是「一二三四五六日」其中一個字。時間一律 24 小時制 HH:MM（下午 5 點寫 17:00）。一天有中午休息就分成多段 ranges。寫「休息」「公休」「未營業」「Closed」的那天 closed=true、ranges 為空陣列。「24 小時營業」寫 00:00 到 23:59。圖上寫「週一至週五」「每日」這類範圍要展開成每一天各一筆。圖上沒有出現的星期不要列出。看不清楚的時間不要猜，寫進 warnings。';
const HOURS_SCHEMA={type:'OBJECT',properties:{
 days:{type:'ARRAY',items:{type:'OBJECT',properties:{
  day:{type:'STRING'},closed:{type:'BOOLEAN'},
  ranges:{type:'ARRAY',items:{type:'OBJECT',properties:{start:{type:'STRING'},end:{type:'STRING'}},required:['start','end']}}
 },required:['day','ranges']}},
 warnings:{type:'ARRAY',items:{type:'STRING'}}
},required:['days']};
// 2026-11-23 加料模式（body.kind==='toppings'）：讀飲料店菜單上的加料區（例如「+$10 珍珠 椰果」），給店家編輯頁的「加料區」用
const TOPPINGS_PROMPT='你是台灣飲料店菜單擷取助手。只擷取圖片上「加料」「配料」「Toppings」「加購」這類可以加進飲料裡的配料，每一種配料的名稱與加價，不得猜測或補造。以 JSON 物件輸出，格式 {"toppings":[{"name":"珍珠","add":10,"note":""}],"warnings":["看不清楚的地方"]}。add 是加價的整數新台幣，圖上寫「+$10」「加10元」都填 10；一個價錢標在一整排配料前面時，那一排每一項都是這個價錢。name 只寫配料名稱，不含價錢、不含英文翻譯；名稱旁邊或下面的小字限制（例如「限冷飲」）寫在 note，沒有就填空字串。飲料品項本身、杯型、甜度、冰塊都不是配料，不要列。看不清楚價錢的配料不要猜，寫進 warnings。按圖上的順序輸出。';
const TOPPINGS_SCHEMA={type:'OBJECT',properties:{
 toppings:{type:'ARRAY',items:{type:'OBJECT',properties:{name:{type:'STRING'},add:{type:'INTEGER'},note:{type:'STRING'}},required:['name','add']}},
 warnings:{type:'ARRAY',items:{type:'STRING'}}
},required:['toppings']};
const KINDS={
 menu:{prompt:PROMPT,schema:SCHEMA,ok:p=>Array.isArray(p.categories),key:'categories',bad:'請上傳 1–5 張有效的菜單照片'},
 hours:{prompt:HOURS_PROMPT,schema:HOURS_SCHEMA,ok:p=>Array.isArray(p.days),key:'days',bad:'請上傳 1–5 張有效的營業時間圖片'},
 toppings:{prompt:TOPPINGS_PROMPT,schema:TOPPINGS_SCHEMA,ok:p=>Array.isArray(p.toppings),key:'toppings',bad:'請上傳 1–5 張有效的加料圖片'}
};
function pickResult(kind,parsed){const o={};o[KINDS[kind].key]=parsed[KINDS[kind].key];if(kind==='menu'&&Array.isArray(parsed.sharedOptions))o.sharedOptions=parsed.sharedOptions;return o;}
function response(res,status,json){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(json));}
function cors(req,res){
 const origin=String(req.headers.origin||'');
 res.setHeader('Vary','Origin');
 if(origin===ORIGIN||/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))res.setHeader('Access-Control-Allow-Origin',origin);
 res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');
 res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
 return !origin||origin===ORIGIN||/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}
async function verifyAdmin(token){
 if(!token||token.length>5000)return false;
 const r=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+encodeURIComponent(FIREBASE_KEY),{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({idToken:token}),signal:AbortSignal.timeout(8000)
 });
 if(!r.ok)return false;
 const json=await r.json(),user=json.users&&json.users[0];
 if(!user||typeof user.localId!=='string'||!user.localId||user.emailVerified!==true||!/^[A-Za-z0-9_-]{1,160}$/.test(user.localId))return false;
 const database='https://lunch-8ebca-default-rtdb.asia-southeast1.firebasedatabase.app/';
 const paths=['roles/'+user.localId,'administration/ownerUid'];
 const values=await Promise.all(paths.map(async path=>{
  const reply=await fetch(database+path+'.json?auth='+encodeURIComponent(token),{signal:AbortSignal.timeout(8000),cache:'no-store'});
  if(!reply.ok)throw new Error('Role verification unavailable');
  return reply.json();
 }));
 return values[0]==='admin'||values[1]===user.localId;
}
// Gemini：照片直接放進 inlineData；不支援的設定（thinking／高解析／schema）被 400 退回時拿掉重送
function geminiPayload(images,opt,kind){
 const gen={temperature:0,maxOutputTokens:16384,responseMimeType:'application/json'};
 if(opt.schema)gen.responseSchema=KINDS[kind].schema;
 if(opt.thinking)gen.thinkingConfig={thinkingLevel:'MINIMAL'};
 if(opt.hires)gen.mediaResolution='MEDIA_RESOLUTION_HIGH';
 return {contents:[{role:'user',parts:[{text:KINDS[kind].prompt}].concat(images.map(u=>({inlineData:{mimeType:'image/jpeg',data:u.slice(u.indexOf(',')+1)}})))}],generationConfig:gen};
}
function geminiJson(data,kind){
 const parts=(data&&data.candidates&&data.candidates[0]&&data.candidates[0].content&&data.candidates[0].content.parts)||[];
 const text=parts.filter(p=>p&&!p.thought&&typeof p.text==='string').map(p=>p.text).join('').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
 const parsed=JSON.parse(text||'{}');
 return parsed&&KINDS[kind].ok(parsed)?parsed:null;
}
function geminiNote(tried,model,status,t0,msg){
 const ms=Date.now()-t0;
 tried.push({model,status,ms});
 console.log('gemini vision',model,status,ms+'ms',String(msg||'').slice(0,160));
}
// 單一模型：不支援的設定被 400 退回時拿掉重送；回 {parsed} 或 {fail}
async function geminiModel(model,images,key,signal,tried,kind){
 const opt={schema:true,thinking:true,hires:true};
 for(let attempt=0;attempt<4;attempt++){
  const t0=Date.now();
  let r,data=null;
  try{
   r=await fetch(GEMINI_URL+encodeURIComponent(model)+':generateContent',{
    method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},
    body:JSON.stringify(geminiPayload(images,opt,kind)),signal
   });
   try{data=await r.json();}catch(e){data=null;}
  }catch(e){geminiNote(tried,model,signal&&signal.aborted?'aborted':'network',t0);return {fail:'timeout'};}
  const msg=String((data&&data.error&&data.error.message)||'');
  geminiNote(tried,model,r.status,t0,r.status===200?'':msg);
  if(r.status===200){
   let parsed=null;try{parsed=geminiJson(data,kind);}catch(e){parsed=null;}
   if(parsed)return {parsed};
   console.log('gemini vision bad json',model);return {fail:'other'};
  }
  const low=msg.toLowerCase();
  if(r.status===429)return {fail:'quota'};
  if(/api key not valid|api_key_invalid|unregistered callers/.test(low)||r.status===401)return {fail:'key',global:true};
  if(r.status===403||/api key|api_key|permission_denied/.test(low))return {fail:'key'};
  if(r.status===400){
   if(opt.thinking&&/thinking/.test(low)){opt.thinking=false;continue;}
   if(opt.hires&&/media.?resolution/.test(low)){opt.hires=false;continue;}
   if(opt.schema&&/schema|response_mime|responsemime/.test(low)){opt.schema=false;continue;}
  }
  return {fail:'other'};
 }
 return {fail:'other'};
}
// 多個模型接力＋逾時加開：失敗立刻換下一個；HEDGE_MS 還沒回就同時請下一個（最多同時 2 個）
function callGemini(images,key,deadline,kind){
 const models=[...new Set([String(process.env.GEMINI_VISION_MODEL||'gemini-3.6-flash').trim()].concat(GEMINI_FALLBACKS))];
 const tried=[],ctrls=[];
 return new Promise(resolve=>{
  let next=0,running=0,done=false,quota=false,keyBad=false,hedgeTimer=null;
  const failKind=()=>keyBad?'key':quota?'quota':'other';
  const finish=v=>{
   if(done)return;done=true;
   clearTimeout(hedgeTimer);clearTimeout(deadTimer);
   ctrls.forEach(c=>{try{c.abort();}catch(e){}});
   v.tried=tried;resolve(v);
  };
  const deadTimer=setTimeout(()=>finish({fail:quota?'quota':'timeout'}),Math.max(0,deadline-Date.now()-500));
  const launch=()=>{
   if(done)return;
   if(next>=models.length||deadline-Date.now()<MIN_START_MS){
    if(running===0)finish({fail:next>=models.length?failKind():(quota?'quota':'timeout')});
    return;
   }
   const model=models[next++];running++;
   const c=new AbortController();ctrls.push(c);
   clearTimeout(hedgeTimer);
   hedgeTimer=setTimeout(()=>{if(running<2)launch();},HEDGE_MS);
   geminiModel(model,images,key,c.signal,tried,kind).then(res=>{
    running--;
    if(done)return;
    if(res.parsed){finish({parsed:res.parsed,model});return;}
    if(res.fail==='key'){keyBad=true;if(res.global){finish({fail:'key'});return;}}
    if(res.fail==='quota')quota=true;
    launch();
   },()=>{running--;if(!done)launch();});
  };
  launch();
 });
}
const GEMINI_FAIL={
 quota:[429,'Gemini 免費額度暫時用完，已可改用 OCR'],
 key:[502,'Gemini 金鑰無效或沒有權限，請檢查 Vercel 的 GEMINI_API_KEY'],
 timeout:[504,'AI 辨識逾時，請少放幾張照片再試，已可改用 OCR'],
 other:[502,'AI 服務暫時無法辨識，已可改用 OCR']
};
async function callOpenAI(images,key,deadline,kind){
 const remain=deadline-Date.now();
 if(remain<4000)return {status:504,message:'AI 辨識逾時，請少放幾張照片再試，已可改用 OCR'};
 const payload={model:process.env.OPENAI_VISION_MODEL||'gpt-4o-mini',temperature:0,max_tokens:6000,response_format:{type:'json_object'},messages:[{role:'user',content:[{type:'text',text:KINDS[kind].prompt},...images.map(url=>({type:'image_url',image_url:{url,detail:'high'}}))]}]};
 const upstream=await fetch('https://api.openai.com/v1/chat/completions',{
  method:'POST',headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},
  body:JSON.stringify(payload),signal:AbortSignal.timeout(remain-1000)
 });
 if(!upstream.ok)return {status:502,message:'AI 服務暫時無法辨識，已可改用 OCR'};
 const result=await upstream.json();
 const content=result.choices&&result.choices[0]&&result.choices[0].message&&result.choices[0].message.content;
 const parsed=JSON.parse(content||'{}');
 if(!parsed||!KINDS[kind].ok(parsed))return {status:502,message:'AI 結果格式不符，請重試'};
 return {parsed};
}
module.exports=async function(req,res){
 if(!cors(req,res)){response(res,403,{message:'網域不允許'});return;}
 if(req.method==='OPTIONS'){res.statusCode=204;res.end();return;}
 if(req.method!=='POST'){response(res,405,{message:'只支援 POST'});return;}
 const geminiKey=String(process.env.GEMINI_API_KEY||'').trim(),openaiKey=process.env.OPENAI_API_KEY;
 if(!geminiKey&&!openaiKey){response(res,503,{message:'AI 服務尚未設定，已可改用 OCR'});return;}
 const deadline=Date.now()+TOTAL_MS;
 const bearer=/^Bearer\s+(.+)$/i.exec(String(req.headers.authorization||''));
 try{
  if(!bearer||!await verifyAdmin(bearer[1])){response(res,403,{message:'只有已驗證管理員能使用雲端 AI 辨識'});return;}
  let body=req.body;
  if(typeof body==='string'){if(body.length>18000000){response(res,413,{message:'圖片過大'});return;}body=JSON.parse(body);}
  const images=body&&body.images,kind=body&&(body.kind==='hours'||body.kind==='toppings')?body.kind:'menu';
  if(!Array.isArray(images)||images.length<1||images.length>5||images.some(x=>typeof x!=='string'||x.length>3500000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(x))){
   response(res,400,{message:KINDS[kind].bad});return;
  }
  if(geminiKey){
   const g=await callGemini(images,geminiKey,deadline,kind);
   const tried=g.tried.map(t=>t.model+' '+t.status+' '+t.ms+'ms');
   console.log('gemini vision result',kind,g.parsed?'ok '+g.model:'fail '+g.fail,tried.join(' | '));
   if(g.parsed){response(res,200,Object.assign(pickResult(kind,g.parsed),{warnings:g.parsed.warnings||[],engine:'Gemini',model:g.model,tried}));return;}
   if(!openaiKey){const f=GEMINI_FAIL[g.fail]||GEMINI_FAIL.other;response(res,f[0],{message:f[1],tried});return;}
  }
  const o=await callOpenAI(images,openaiKey,deadline,kind);
  if(!o.parsed){response(res,o.status,{message:o.message});return;}
  response(res,200,Object.assign(pickResult(kind,o.parsed),{warnings:o.parsed.warnings||[],engine:'GPT'}));
 }catch(e){response(res,500,{message:'圖片辨識遇到問題，請稍後重試或使用 OCR'});}
};
