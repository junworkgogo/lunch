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
const PROMPT='你是台灣餐廳菜單資料擷取助手。只根據照片上實際看得見的字與價格辨識菜單，不得猜測或補造品名、價格、選項，不要把地址、電話、營業時間或折扣當作餐點。以繁體中文輸出 JSON 物件，格式 {"categories":[{"name":"分類名稱","items":[{"name":"品名","price":80,"soldOut":false,"options":[{"name":"尺寸","required":true,"choices":[{"name":"小份","add":0},{"name":"大份","add":20}]}]}]}],"warnings":["無法辨識的品項或價格"]}。分類沒有標示時用「其他」。price 只允許確定的整數新台幣，價格不清楚就略過該品項並放 warnings。規格或加料只有照片明確列出選項及加價時才填 options；不要猜測共同選項。多個完整價格：將最便宜價格寫 price，options 各選項 add 為與最低價之差；不要把原價誤作折扣價。多張圖重複品項要去重。保持菜單原始分類、名稱順序。不要 markdown。';
const SCHEMA={type:'OBJECT',properties:{
 categories:{type:'ARRAY',items:{type:'OBJECT',properties:{
  name:{type:'STRING'},
  items:{type:'ARRAY',items:{type:'OBJECT',properties:{
   name:{type:'STRING'},price:{type:'INTEGER'},soldOut:{type:'BOOLEAN'},
   options:{type:'ARRAY',items:{type:'OBJECT',properties:{
    name:{type:'STRING'},required:{type:'BOOLEAN'},
    choices:{type:'ARRAY',items:{type:'OBJECT',properties:{name:{type:'STRING'},add:{type:'INTEGER'}},required:['name','add']}}
   },required:['name','choices']}}
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
const KINDS={
 menu:{prompt:PROMPT,schema:SCHEMA,ok:p=>Array.isArray(p.categories)},
 hours:{prompt:HOURS_PROMPT,schema:HOURS_SCHEMA,ok:p=>Array.isArray(p.days)}
};
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
  const images=body&&body.images,kind=body&&body.kind==='hours'?'hours':'menu';
  if(!Array.isArray(images)||images.length<1||images.length>5||images.some(x=>typeof x!=='string'||x.length>3500000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(x))){
   response(res,400,{message:kind==='hours'?'請上傳 1–5 張有效的營業時間圖片':'請上傳 1–5 張有效的菜單照片'});return;
  }
  if(geminiKey){
   const g=await callGemini(images,geminiKey,deadline,kind);
   const tried=g.tried.map(t=>t.model+' '+t.status+' '+t.ms+'ms');
   console.log('gemini vision result',kind,g.parsed?'ok '+g.model:'fail '+g.fail,tried.join(' | '));
   if(g.parsed){response(res,200,Object.assign(kind==='hours'?{days:g.parsed.days}:{categories:g.parsed.categories},{warnings:g.parsed.warnings||[],engine:'Gemini',model:g.model,tried}));return;}
   if(!openaiKey){const f=GEMINI_FAIL[g.fail]||GEMINI_FAIL.other;response(res,f[0],{message:f[1],tried});return;}
  }
  const o=await callOpenAI(images,openaiKey,deadline,kind);
  if(!o.parsed){response(res,o.status,{message:o.message});return;}
  response(res,200,Object.assign(kind==='hours'?{days:o.parsed.days}:{categories:o.parsed.categories},{warnings:o.parsed.warnings||[],engine:'GPT'}));
 }catch(e){response(res,500,{message:'圖片辨識遇到問題，請稍後重試或使用 OCR'});}
};
