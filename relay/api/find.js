// 午餐團「從 Google 地圖帶入」中繼站（Vercel Serverless Function）
// 只做固定幾件事，不是任意網址的轉送器：
//   op=lookup       q=Google 地圖連結／地址／店名 → 座標與店名
//   op=dbd-map      lat,lng → dinbendon 這個點附近的店
//   op=dbd-search   term    → dinbendon 用名字找店
//   op=dbd-detail   id      → dinbendon 一家店的完整菜單
//   op=nidin-near   lat,lng → nidin 這個點附近的店
//   op=nidin-menu   id      → nidin 一家店的完整菜單
// dinbendon 不允許其他網站直接讀（沒有 CORS），所以要經過這裡；其他來源一起走這裡，網站只需要認一個地方。
'use strict';

const UA = 'Mozilla/5.0 (compatible; lunch-menu-relay/1.0)';
const ALLOW_ORIGINS = [/^https:\/\/junworkgogo\.github\.io$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
const DBD = 'https://dinbendon.net/mvc/api/';
const NIDIN = 'https://loctw-service-api.nidin.shop/shopper/v2/';
const ARCGIS = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates';
// 可以跟著轉址走的 Google 網域（避免被拿來連到任意網站）
const GOOGLE_HOST = /^(?:maps\.app\.goo\.gl|goo\.gl|g\.co|(?:www\.|maps\.)?google\.com(?:\.tw)?|(?:www\.)?google\.com\.hk)$/i;

function setCors(req, res) {
  const o = String(req.headers.origin || '');
  // 每個回應都要 Vary: Origin；快取一律只放在使用者瀏覽器（private），
  // 否則 Vercel 共用快取會把「沒有 Access-Control-Allow-Origin 的那份」發給網站，瀏覽器就擋掉（2026-11-11 實測踩到）
  res.setHeader('Vary', 'Origin');
  if (ALLOW_ORIGINS.some(function (r) { return r.test(o); })) {
    res.setHeader('Access-Control-Allow-Origin', o);
  }
}

async function fetchT(url, opt) {
  opt = opt || {};
  const ac = new AbortController();
  const t = setTimeout(function () { ac.abort(); }, opt.timeout || 8000);
  try {
    return await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': opt.accept || 'application/json', 'Accept-Language': 'zh-TW,zh;q=0.9' },
      redirect: opt.redirect || 'follow',
      signal: ac.signal
    });
  } finally { clearTimeout(t); }
}

async function upstreamJson(url, timeout) {
  const r = await fetchT(url, { timeout: timeout });
  const text = await r.text();
  try { return { status: r.status, json: JSON.parse(text) }; }
  catch (e) { return { status: 502, json: { error: 'upstream-not-json', upstreamStatus: r.status } }; }
}

function num(v, lo, hi) {
  const n = Number(v);
  return isFinite(n) && n >= lo && n <= hi ? n : null;
}
function idOf(v) { return /^\d{1,12}$/.test(String(v || '')) ? String(v) : null; }
function textOf(v) {
  const s = String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim();
  return s && s.length <= 300 ? s : null;
}

// ---------- Google 地圖連結 ----------
function safeDecode(s) { try { return decodeURIComponent(String(s).replace(/\+/g, ' ')); } catch (e) { return String(s); } }

function parseMapsUrl(href) {
  const out = { name: null, text: null, lat: null, lng: null };
  let u;
  try { u = new URL(href); } catch (e) { return out; }
  const path = u.pathname || '';
  const full = href;
  let m = /\/maps\/place\/([^/@?]+)/.exec(path);
  if (m) out.name = safeDecode(m[1]).trim() || null;
  m = /\/maps\/search\/([^/@?]+)/.exec(path);
  if (m) out.text = safeDecode(m[1]).trim() || null;
  // 店家本身的座標（!3d緯度!4d經度），比 @ 後面的畫面中心準
  const pins = full.match(/!3d-?\d+(?:\.\d+)?!4d-?\d+(?:\.\d+)?/g);
  if (pins && pins.length) {
    const p = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(pins[pins.length - 1]);
    out.lat = Number(p[1]); out.lng = Number(p[2]);
  }
  if (out.lat == null) {
    m = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(path);
    if (m) { out.lat = Number(m[1]); out.lng = Number(m[2]); }
  }
  ['q', 'query', 'daddr', 'destination'].forEach(function (k) {
    const v = u.searchParams.get(k);
    if (!v) return;
    const c = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(v);
    if (c) { if (out.lat == null) { out.lat = Number(c[1]); out.lng = Number(c[2]); } }
    else if (!out.text) out.text = v.trim();
  });
  if (out.lat == null) {
    const ll = u.searchParams.get('ll') || u.searchParams.get('center');
    const c = ll && /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(ll);
    if (c) { out.lat = Number(c[1]); out.lng = Number(c[2]); }
  }
  if (out.lat != null && (num(out.lat, 20, 27) == null || num(out.lng, 117, 123) == null)) { out.lat = null; out.lng = null; }
  return out;
}

function isGoogleUrl(href) {
  try { const u = new URL(href); return (u.protocol === 'https:' || u.protocol === 'http:') && GOOGLE_HOST.test(u.hostname); }
  catch (e) { return false; }
}

// 台灣範圍（含金門、馬祖；經度 118.19 以西是廈門）
function inTaiwan(lat, lng) { return lat >= 21.8 && lat <= 26.5 && lng >= 118.19 && lng <= 122.3; }
function kmBetween(a1, o1, a2, o2) {
  const R = 6371, d = Math.PI / 180, x = (o2 - o1) * d * Math.cos((a1 + a2) / 2 * d), y = (a2 - a1) * d;
  return Math.sqrt(x * x + y * y) * R;
}

async function arcgis(text, timeout) {
  const qs = new URLSearchParams({ f: 'json', maxLocations: '1', countryCode: 'TWN', outFields: 'PlaceName,Place_addr,Addr_type,Type,Country', SingleLine: text });
  const r = await upstreamJson(ARCGIS + '?' + qs.toString(), timeout);
  const c = r.json && r.json.candidates && r.json.candidates[0];
  if (!c || !c.location || !(c.score >= 80)) return null;
  const a = c.attributes || {};
  if (a.Country && a.Country !== 'TWN') return null; // 例：「老虎城」會找到廈門的
  const lat = Number(c.location.y), lng = Number(c.location.x);
  if (!inTaiwan(lat, lng)) return null;
  return { lat: lat, lng: lng, placeName: a.Addr_type === 'POI' ? (a.PlaceName || null) : null, address: a.Place_addr || c.address || null, kind: a.Addr_type || null, type: a.Type || null };
}
// 整句地址／店名（原本的做法）；只認出「台中市」「西屯區」這種大範圍的不算找到（中心點附近不是使用者要的地方）
const WHOLE_OK = /^(POI|PointAddress|StreetAddress|StreetAddressExt|Subaddress|BuildingName|StreetInt|StreetName)$/;
async function geocode(text) {
  const g = await arcgis(text, 6000);
  return g && WHOLE_OK.test(g.kind || '') ? g : null;
}

// ---------- 整句找不到時：拆開找「地點」那一段（商場、車站、地標、地址），剩下的字當店名 ----------
// 例：「台中老虎城 六堆」→ 地點＝老虎城購物中心，店名＝六堆
// 只接受「地點類」的結果；餐廳、飲料店這類店名不拿來定位（「八方雲集 朝富店」不會被定到隨便一家八方雲集）
const PHOTON = 'https://photon.komoot.io/api/';
const CITIES = [['台北', 25.04, 121.56], ['新北', 25.01, 121.46], ['桃園', 24.99, 121.30], ['台中', 24.15, 120.67], ['台南', 22.99, 120.21],
  ['高雄', 22.63, 120.30], ['基隆', 25.13, 121.74], ['新竹', 24.80, 120.97], ['苗栗', 24.56, 120.82], ['彰化', 24.08, 120.54],
  ['南投', 23.91, 120.68], ['雲林', 23.71, 120.43], ['嘉義', 23.48, 120.45], ['屏東', 22.67, 120.49], ['宜蘭', 24.75, 121.75],
  ['花蓮', 23.99, 121.60], ['台東', 22.76, 121.14], ['澎湖', 23.57, 119.58], ['金門', 24.43, 118.32], ['連江', 26.16, 119.95], ['馬祖', 26.16, 119.95]];
const CITY_KM = 40; // 寫了城市就只收這個範圍內的（「台中新光三越」不會跑到台北那家）
const ARC_PLACE = /^(Shopping Center|Department Store|Building|Tourist Attraction|Landmark|Historical Monument|Train Station|Metro Station|Bus Station|Airport|College|University|School|Hospital|Convention Center|Exhibition Center|Government Office|City Hall|Court House|Museum|Park|Stadium|Sports Center|Market|Industrial Zone|Science Park)$/i;
const ARC_ADDR = /^(PointAddress|StreetAddress|Subaddress|BuildingName)$/;
const PHOTON_PLACE = { shop: /^(mall|department_store)$/, amenity: /^(marketplace|university|college|school|hospital|townhall|bus_station|courthouse|exhibition_centre|conference_centre)$/,
  tourism: /^(attraction|museum)$/, railway: /^(station|halt)$/, public_transport: /^station$/, building: /./,
  leisure: /^(park|stadium|sports_centre)$/, aeroway: /^aerodrome$/, highway: /^bus_stop$/ };
// 不收 office、landuse（「麥當勞 逢甲店」曾被定到台南一塊叫「麥當勞」的商業區土地）；建築只收名稱像大樓、商場的
const PLACE_WORD = /(大樓|大廈|廣場|中心|商場|百貨|購物|園區|大廳|101)/;

function tw(s) { return String(s).replace(/臺/g, '台'); }
function splitCity(t) { // 「台中老虎城」→ { city:['台中',…], core:'老虎城' }；「台中」→ core ''
  const s = tw(t);
  for (let i = 0; i < CITIES.length; i++) {
    if (s.indexOf(CITIES[i][0]) === 0) return { city: CITIES[i], core: s.slice(CITIES[i][0].length).replace(/^[市縣]/, '') };
  }
  return { city: null, core: String(t) };
}
// 寫了城市：地址／行政區開頭就是那個縣市，或離縣市中心 40 公里內，才算（「屏東縣恆春鎮…」離屏東市很遠但地址寫明了，照樣算）
function okCity(city, lat, lng, admins) {
  if (!city) return true;
  if ((admins || []).some(function (a) { return tw(String(a || '')).replace(/^[\d\s]+/, '').indexOf(city[0]) === 0; })) return true;
  return kmBetween(city[1], city[2], lat, lng) <= CITY_KM;
}
// 找到的地點名稱要跟打的字對得上（「老虎城」↔「老虎城購物中心」），避免模糊比對亂抓
function nkey(s) { return tw(s).toLowerCase().replace(/[\s\-_.,，、。:：;；'"()（）\[\]【】「」|｜·•・\/]/g, ''); }
function nameFits(name, text) {
  const a = nkey(name || ''), b = nkey(text || '');
  return a.length >= 2 && b.length >= 2 && (a.indexOf(b) >= 0 || b.indexOf(a) >= 0);
}

async function arcPlace(text, city) {
  const g = await arcgis(text, 4000);
  if (!g || !okCity(city, g.lat, g.lng, [g.address])) return null;
  const isAddr = ARC_ADDR.test(g.kind || '');
  if (!(isAddr || (g.kind === 'POI' && ARC_PLACE.test(g.type || '') && nameFits(g.placeName, text)))) return null;
  return { lat: g.lat, lng: g.lng, place: g.placeName || g.address, address: g.address, rank: 1 };
}
async function photonPlace(text, city) {
  const qs = new URLSearchParams({ q: text, limit: '6', bbox: '118.19,21.8,122.3,26.5' });
  if (city) { qs.set('lat', String(city[1])); qs.set('lon', String(city[2])); }
  const r = await upstreamJson(PHOTON + '?' + qs.toString(), 4000);
  const fs = (r.json && r.json.features) || [];
  let best = null;
  fs.forEach(function (f) {
    const p = (f && f.properties) || {}, g = f && f.geometry && f.geometry.coordinates;
    if (!g || (p.countrycode && p.countrycode !== 'TW')) return;
    const lat = Number(g[1]), lng = Number(g[0]);
    if (!inTaiwan(lat, lng) || !okCity(city, lat, lng, [p.state, p.county, p.city])) return;
    const re = PHOTON_PLACE[p.osm_key];
    if (!re || !re.test(String(p.osm_value || '')) || !nameFits(p.name, text)) return;
    if (p.osm_key === 'building' && !PLACE_WORD.test(String(p.name || ''))) return;
    const rank = p.osm_key === 'highway' ? 3 : 2; // 公車站牌只在沒有別的時候用
    if (best && best.rank <= rank) return;
    const addr = [p.city || p.county, p.district, p.street, p.housenumber].filter(Boolean).join('');
    best = { lat: lat, lng: lng, place: p.name || addr || text, address: addr || null, rank: rank };
  });
  return best;
}

async function locateByParts(q) {
  const tokens = q.split(/[\s,，、/]+/).filter(Boolean).slice(0, 4);
  let city = null;
  tokens.forEach(function (t) { const s = splitCity(t); if (!city && s.city) city = s.city; });
  // 要試的字：整句、每一段、每一段去掉開頭的城市名；只有城市名的那段（「台中」）不拿來定位
  const tries = [];
  function add(text, idx) {
    text = String(text || '').trim();
    if (text.length < 2 || tries.some(function (x) { return x.text === text; })) return;
    tries.push({ text: text, idx: idx });
  }
  add(q, -1);
  tokens.forEach(function (t, i) { const s = splitCity(t); if (!s.core) return; add(t, i); add(s.core, i); });
  const found = await Promise.all(tries.slice(0, 6).map(function (x) {
    return Promise.all([
      x.idx === -1 ? null : arcPlace(x.text, city).catch(function () { return null; }), // 整句已經用 ArcGIS 找過
      photonPlace(x.text, city).catch(function () { return null; })
    ]).then(function (a) { return a[0] && a[1] ? (a[0].rank <= a[1].rank ? a[0] : a[1]) : (a[0] || a[1]); });
  }));
  let pick = -1;
  for (let i = 0; i < found.length; i++) {
    if (found[i] && (pick < 0 || found[i].rank < found[pick].rank)) pick = i;
  }
  if (pick < 0) return null;
  const hit = found[pick], at = tries[pick].idx;
  const rest = at < 0 ? '' : tokens.filter(function (t, i) { return i !== at && splitCity(t).core && t !== '附近'; }).join(' ');
  return { lat: hit.lat, lng: hit.lng, place: hit.place, address: hit.address, rest: rest };
}

async function lookup(q) {
  const info = { input: q, name: null, text: null, lat: null, lng: null, address: null, how: null, hops: 0 };
  if (/^https?:\/\//i.test(q)) {
    if (!isGoogleUrl(q)) return { status: 400, json: { error: 'not-google-maps-link' } };
    let url = q;
    for (let hop = 0; hop < 6 && url && isGoogleUrl(url); hop++) {
      const p = parseMapsUrl(url);
      if (p.name && !info.name) info.name = p.name;
      if (p.text && !info.text) info.text = p.text;
      if (p.lat != null) { info.lat = p.lat; info.lng = p.lng; info.how = 'link'; break; }
      const r = await fetchT(url, { redirect: 'manual', accept: 'text/html' });
      const loc = r.headers.get('location');
      if (r.status >= 300 && r.status < 400 && loc) { url = new URL(loc, url).href; info.hops++; continue; }
      break;
    }
    // 連結沒帶座標（例如 ?q=店名,地址）→ 用文字找位置
    if (info.lat == null && (info.text || info.name)) {
      const t = info.text || info.name;
      const parts = t.split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
      let g = await geocode(t);
      if (!g && parts.length > 1) g = await geocode(parts.slice(1).join(' '));
      if (!info.name && parts.length > 1) info.name = parts[0];
      if (g) { info.lat = g.lat; info.lng = g.lng; info.address = g.address; info.how = 'link-text'; }
    }
    if (info.lat == null && !info.name && !info.text) return { status: 404, json: Object.assign({ error: 'link-without-place' }, info) };
    return { status: 200, json: info };
  }
  // 一般文字：地址或店名
  info.text = q;
  const city = splitCity(q).city;
  let g = await geocode(q);
  if (g && !okCity(city, g.lat, g.lng, [g.address])) g = null; // 開頭寫了城市、卻找到別的縣市 → 不算
  if (g) {
    info.lat = g.lat; info.lng = g.lng; info.address = g.address; info.how = 'geocode';
    if (g.placeName) info.name = g.placeName;
    return { status: 200, json: info };
  }
  // 整句找不到 → 拆開找地點那一段（例：「台中老虎城 六堆」）
  const p = await locateByParts(q);
  if (p) {
    info.lat = p.lat; info.lng = p.lng; info.address = p.address; info.place = p.place; info.rest = p.rest; info.how = 'place-part';
  }
  return { status: 200, json: info };
}

// ---------- 主程式 ----------
module.exports = async function (req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'GET') { res.statusCode = 405; return res.end(); }
  const q = req.query || {};
  const op = String(q.op || '');
  let out = null, cache = 'no-store';
  try {
    if (op === 'lookup') {
      const t = textOf(q.q);
      if (!t) out = { status: 400, json: { error: 'bad-q' } };
      else {
        out = await lookup(t);
        // 定不出位置的不快取：可能只是查詢服務一時逾時，下一次要能重新查
        cache = out.json && out.json.lat != null ? 'private, max-age=3600' : 'no-store';
      }
    } else if (op === 'dbd-map' || op === 'nidin-near') {
      const lat = num(q.lat, 20, 27), lng = num(q.lng, 117, 123);
      if (lat == null || lng == null) out = { status: 400, json: { error: 'bad-latlng' } };
      else if (op === 'dbd-map') {
        const d = 0.0035;
        const qs = new URLSearchParams({ northLat: (lat + d).toFixed(6), southLat: (lat - d).toFixed(6), westLng: (lng - d).toFixed(6), eastLng: (lng + d).toFixed(6), zoom: '17' });
        out = await upstreamJson(DBD + 'shop/idine/map-shops?' + qs.toString());
        cache = 'private, max-age=3600';
      } else {
        const qs = new URLSearchParams({ count: '20', latitude: lat.toFixed(7), longitude: lng.toFixed(7), page: '1' });
        out = await upstreamJson(NIDIN + 'store/listByPositionNew?' + qs.toString());
        cache = 'private, max-age=3600';
      }
    } else if (op === 'dbd-search') {
      const t = textOf(q.term);
      if (!t) out = { status: 400, json: { error: 'bad-term' } };
      else { out = await upstreamJson(DBD + 'shop/idine/search?' + new URLSearchParams({ term: t.slice(0, 60) }).toString()); cache = 'private, max-age=3600'; }
    } else if (op === 'dbd-detail' || op === 'nidin-menu') {
      const id = idOf(q.id);
      if (!id) out = { status: 400, json: { error: 'bad-id' } };
      else if (op === 'dbd-detail') { out = await upstreamJson(DBD + 'shop/idine/detail?shopId=' + id); cache = 'private, max-age=600'; }
      else { out = await upstreamJson(NIDIN + 'store/' + id + '/onShelfMenu'); cache = 'private, max-age=600'; }
    } else {
      out = { status: 400, json: { error: 'bad-op' } };
    }
  } catch (e) {
    out = { status: 502, json: { error: e && e.name === 'AbortError' ? 'upstream-timeout' : 'upstream-failed' } };
  }
  res.statusCode = out.status >= 200 && out.status < 600 ? out.status : 502;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', res.statusCode === 200 ? cache : 'no-store');
  res.end(JSON.stringify(out.json));
};

module.exports.parseMapsUrl = parseMapsUrl;
module.exports.isGoogleUrl = isGoogleUrl;
