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

async function upstreamJson(url) {
  const r = await fetchT(url);
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

async function geocode(text) {
  const qs = new URLSearchParams({ f: 'json', maxLocations: '1', countryCode: 'TWN', outFields: 'PlaceName,Place_addr,Addr_type', SingleLine: text });
  const r = await upstreamJson(ARCGIS + '?' + qs.toString());
  const c = r.json && r.json.candidates && r.json.candidates[0];
  if (!c || !c.location || !(c.score >= 80)) return null;
  const lat = num(c.location.y, 20, 27), lng = num(c.location.x, 117, 123);
  if (lat == null || lng == null) return null;
  const a = c.attributes || {};
  return { lat: lat, lng: lng, placeName: a.Addr_type === 'POI' ? (a.PlaceName || null) : null, address: a.Place_addr || c.address || null, kind: a.Addr_type || null };
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
  const g = await geocode(q);
  if (g) {
    info.lat = g.lat; info.lng = g.lng; info.address = g.address; info.how = 'geocode';
    if (g.placeName) info.name = g.placeName;
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
      else { out = await lookup(t); cache = 'private, max-age=3600'; }
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
