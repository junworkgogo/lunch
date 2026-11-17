/* JUN胖達／AI 菜單圖片辨識，Vercel relay/api/vision.js
 * Server env: OPENAI_API_KEY (required), OPENAI_VISION_MODEL (optional).
 * Admin access checked with Firebase Identity Toolkit; image bytes held in memory only.
 */
'use strict';
const ORIGIN='https://junworkgogo.github.io';
const FIREBASE_KEY='AIzaSyCLzpiNkFesQYvTiS9e9Jh4fMVRr6riQ74'; // Firebase client config, not secret
const PROJECT_ID='lunch-8ebca';
const ADMINS=new Set(['junworkgogo@gmail.com','jun@adholic.com.tw','ruuu@adholic.com.tw']);
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
 return !!(user&&user.localId&&user.emailVerified===true&&ADMINS.has(String(user.email||'').toLowerCase()));
}
module.exports=async function(req,res){
 if(!cors(req,res)){response(res,403,{message:'網域不允許'});return;}
 if(req.method==='OPTIONS'){res.statusCode=204;res.end();return;}
 if(req.method!=='POST'){response(res,405,{message:'只支援 POST'});return;}
 if(!process.env.OPENAI_API_KEY){response(res,503,{message:'AI 服務尚未設定，已可改用 OCR'});return;}
 const bearer=/^Bearer\s+(.+)$/i.exec(String(req.headers.authorization||''));
 try{
  if(!bearer||!await verifyAdmin(bearer[1])){response(res,403,{message:'只有已驗證管理員能使用雲端 AI 辨識'});return;}
  let body=req.body;
  if(typeof body==='string'){if(body.length>18000000){response(res,413,{message:'圖片過大'});return;}body=JSON.parse(body);}
  const images=body&&body.images;
  if(!Array.isArray(images)||images.length<1||images.length>5||images.some(x=>typeof x!=='string'||x.length>3500000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(x))){
   response(res,400,{message:'請上傳 1–5 張有效的菜單照片'});return;
  }
  const prompt='你是台灣餐廳菜單資料擷取助手。只根據照片上實際看得見的字與價格辨識菜單，不得猜測或補造品名、價格、選項，不要把地址、電話、營業時間或折扣當作餐點。以繁體中文輸出 JSON 物件，格式 {"categories":[{"name":"分類名稱","items":[{"name":"品名","price":80,"soldOut":false,"options":[{"name":"尺寸","required":true,"choices":[{"name":"小份","add":0},{"name":"大份","add":20}]}]}]}],"warnings":["無法辨識的品項或價格"]}。分類沒有標示時用「其他」。price 只允許確定的整數新台幣，價格不清楚就略過該品項並放 warnings。規格或加料只有照片明確列出選項及加價時才填 options；不要猜測共同選項。多個完整價格：將最便宜價格寫 price，options 各選項 add 為與最低價之差；不要把原價誤作折扣價。多張圖重複品項要去重。保持菜單原始分類、名稱順序。不要 markdown。';
  const payload={model:process.env.OPENAI_VISION_MODEL||'gpt-4o-mini',temperature:0,max_tokens:6000,response_format:{type:'json_object'},messages:[{role:'user',content:[{type:'text',text:prompt},...images.map(url=>({type:'image_url',image_url:{url,detail:'high'}}))]}]};
  const upstream=await fetch('https://api.openai.com/v1/chat/completions',{
   method:'POST',headers:{'Authorization':'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},
   body:JSON.stringify(payload),signal:AbortSignal.timeout(55000)
  });
  if(!upstream.ok){response(res,502,{message:'AI 服務暫時無法辨識，已可改用 OCR'});return;}
  const result=await upstream.json();
  const content=result.choices&&result.choices[0]&&result.choices[0].message&&result.choices[0].message.content;
  const parsed=JSON.parse(content||'{}');
  if(!Array.isArray(parsed.categories)){response(res,502,{message:'AI 結果格式不符，請重試'});return;}
  response(res,200,{categories:parsed.categories,warnings:parsed.warnings||[]});
 }catch(e){response(res,500,{message:'圖片辨識遇到問題，請稍後重試或使用 OCR'});}
};
