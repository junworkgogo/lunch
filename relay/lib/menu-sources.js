'use strict';

const dns = require('node:dns').promises;
const https = require('node:https');
const net = require('node:net');
const iding = require('./iding-menu');

const LIMIT_BYTES = 2 * 1024 * 1024;
const LIMIT_MS = 5500;
const REDIRECTS = 3;
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36';
const MENU_LABEL = /菜單|價目表|餐點|點餐|訂餐|產品介紹|美味專區|\bmenu\b|\border online\b/i;
const SEARCH_LABELS = { ichef: 'iCHEF', quickclick: '快一點', oddle: 'Oddle', website: '店家官網' };
const SEARCH_CACHE = new Map();
const SEARCH_INFLIGHT = new Map();

function urlOf(value, base) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value, base);
    if (url.protocol !== 'https:' || url.port || url.username || url.password) return null;
    const host = url.hostname;
    if (!host.includes('.') || host.endsWith('.') || net.isIP(host) || host.startsWith('[') ||
        /(?:^|\.)(?:local|localhost|home|internal|test|invalid|example|onion|arpa)$/.test(host)) return null;
    url.hash = '';
    return url;
  } catch { return null; }
}

function publicAddress(address) {
  const version = net.isIP(address);
  if (version === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113));
  }
  if (version !== 6 || address.includes('%')) return false;
  const [first, second] = address.split(':').map(x => parseInt(x || '0', 16));
  return first >= 0x2000 && first <= 0x3fff &&
    !(first === 0x2001 && (second < 0x200 || second === 0xdb8)) &&
    first !== 0x2002 && first !== 0x3fff;
}

function withinDeadline(promise, deadline) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('逾時')), Math.max(0, deadline - Date.now()));
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); }
    );
  });
}

function unsafeUrl() {
  return Object.assign(new Error('無法安全讀取這個網址'), { code: 'unsafe-url' });
}

async function requestPage(url, deadline, data) {
  const addresses = await withinDeadline(dns.lookup(url.hostname, { all: true }), deadline);
  if (!addresses.length || addresses.some(answer => !publicAddress(answer.address))) {
    throw unsafeUrl();
  }
  const target = addresses.find(answer => answer.family === 4) || addresses[0];
  return new Promise((resolve, reject) => {
    // 固定使用已驗證的解析結果，同時保留原網域供 Host 與 TLS 憑證查驗。
    const request = https.request(url, {
      agent: false,
      family: target.family,
      method: data ? 'POST' : 'GET',
      lookup: (_host, options, callback) => options.all
        ? callback(null, [target])
        : callback(null, target.address, target.family),
      headers: {
        'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,application/json',
        'Accept-Language': 'zh-TW,zh;q=0.9', 'Accept-Encoding': 'identity',
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, response => {
      const status = response.statusCode;
      if ([301, 302, 303, 307, 308].includes(status)) {
        response.destroy();
        if (data) {
          reject(new Error('資料端點不接受轉址'));
          return;
        }
        resolve({ redirect: response.headers.location });
        return;
      }
      if (status !== 200) {
        response.destroy();
        reject(new Error('網站回應 ' + status));
        return;
      }
      if (!/^(?:text\/html|application\/(?:xhtml\+xml|json))(?:\s*;|$)/i.test(response.headers['content-type'] || '') ||
          (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity')) {
        response.destroy();
        reject(new Error('網站回傳的格式無法讀取'));
        return;
      }
      const chunks = [];
      let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > LIMIT_BYTES) request.destroy(new Error('網頁超過可讀取大小'));
        else chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('aborted', () => reject(new Error('網站中斷連線')));
      response.on('end', () => resolve({ body: Buffer.concat(chunks).toString('utf8') }));
    });
    const timer = setTimeout(() => request.destroy(new Error('逾時')), Math.max(0, deadline - Date.now()));
    request.on('error', reject);
    request.on('close', () => clearTimeout(timer));
    request.end(data);
  });
}

async function getPage(value, allowed, deadline = Date.now() + LIMIT_MS, data) {
  let url = urlOf(value);
  for (let hop = 0; hop <= REDIRECTS; hop++) {
    if (!url || (allowed && !allowed(url))) throw unsafeUrl();
    const result = await requestPage(url, deadline, data);
    if (result.body !== undefined) return { ...result, url };
    url = urlOf(result.redirect, url);
  }
  throw new Error('網站轉址次數過多');
}

async function getJson(url, allowed, deadline, data) {
  const response = await getPage(url, allowed, deadline, data && JSON.stringify(data));
  return JSON.parse(response.body);
}

function decode(value) {
  const entity = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return String(value ?? '').replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (token, key) => {
    if (key[0] !== '#') return entity[key.toLowerCase()] || token;
    const point = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1));
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : token;
  });
}

function label(value, limit = 160) {
  return decode(String(value ?? '').replace(/<[^>]*>/g, ' '))
    .replace(/[\s\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]+/g, ' ').trim().slice(0, limit);
}

function attribute(markup, name) {
  const pattern = new RegExp('(?:^|\\s)' + name + '\\s*=\\s*(?:"([^"]*)"|\x27([^\x27]*)\x27|([^\\s"\x27=>\\x60]+))', 'i');
  const match = markup.match(pattern);
  return match ? decode(match[1] || match[2] || match[3]) : '';
}

const values = value => Array.isArray(value) ? value : value == null ? [] : [value];

function hasType(node, types) {
  return values(node?.['@type']).some(value => typeof value === 'string' && types.includes(value.split(/[\/#]/).pop()));
}

function structured(body) {
  const roots = [];
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  for (const match of body.matchAll(pattern)) {
    if (attribute(match[1], 'type').toLowerCase().split(';')[0] !== 'application/ld+json') continue;
    try { roots.push(...values(JSON.parse(match[2].trim()))); } catch { /* 其他 JSON-LD 仍可讀取 */ }
  }
  return roots.flatMap(node => [node, ...values(node?.['@graph'])]).filter(node => node && typeof node === 'object');
}

function itemPrice(item) {
  for (const offer of values(item.offers)) {
    if (offer?.priceCurrency && String(offer.priceCurrency).toUpperCase() !== 'TWD') continue;
    const price = publicPrice(offer?.price);
    if (price !== null) return price;
  }
  return null;
}

function structuredMenu(nodes) {
  const cats = [];
  const seen = new Set();
  let missingPrice = false;
  function add(section, rawItems, allowProduct = true) {
    const items = [];
    for (const raw of values(rawItems)) {
      const item = raw?.item || raw;
      if (!hasType(item, allowProduct ? ['MenuItem', 'Product'] : ['MenuItem'])) continue;
      const n = label(item.name);
      const p = itemPrice(item);
      const key = [section, n, p].join('\u0000');
      if (!n || seen.has(key) || seen.size >= 500) continue;
      if (p === null) {
        missingPrice = true;
        continue;
      }
      seen.add(key);
      items.push({ n, p, g: [] });
    }
    if (items.length) cats.push({ c: section, items });
  }
  function readSection(section, depth = 0) {
    if (!section || typeof section !== 'object' || depth > 6) return;
    add(label(section.name) || '菜單', section.hasMenuItem);
    for (const child of values(section.hasMenuSection)) readSection(child, depth + 1);
  }
  const menus = nodes.flatMap(node => hasType(node, ['Menu']) ? [node] : values(node.hasMenu));
  for (const menu of menus) {
    if (typeof menu !== 'object' || !menu) continue;
    add('菜單', menu.hasMenuItem);
    for (const section of values(menu.hasMenuSection)) readSection(section);
  }
  if (!cats.length) {
    for (const node of nodes) {
      if (hasType(node, ['ItemList'])) add('菜單', node.itemListElement, false);
    }
    add('菜單', nodes.filter(node => hasType(node, ['MenuItem'])));
  }
  return { cats, missingPrice };
}

function source(url) {
  const host = url.hostname;
  if (host === 'shop.ichefpos.com' && /^\/store\/[\w-]+(?:\/ordering)?\/?$/.test(url.pathname)) return 'ichef';
  if ((host === 'order.quickclick.cc' && /^\/tw\/food\/[\w-]+\/?$/.test(url.pathname)) ||
      (host === 'line.quickclick.cc' && url.pathname === '/line/views/web/menu' && url.searchParams.has('accountId'))) return 'quickclick';
  if (/^[a-z0-9-]+\.oddle\.me$/.test(host) && !/^(?:www|tw-eats|eats|shop-assets|docs|support|help|app|business)\./.test(host) &&
      /^\/(?:[a-z]{2}(?:[_-][a-z]{2})?\/?)?$/i.test(url.pathname)) return 'oddle';
  return 'website';
}

function platformHost(host) {
  return /(?:^|\.)(?:ichefpos\.com|quickclick\.cc|oddle\.me)$/.test(host);
}

function menuLinks(body, nodes, base) {
  const links = [];
  const images = [];
  const seen = new Set([base.href]);
  function add(value, name) {
    const url = urlOf(value, base);
    if (!url || seen.has(url.href) || (source(url) === 'website' && platformHost(url.hostname))) return;
    seen.add(url.href);
    if (/\.(?:avif|gif|jpe?g|png|webp)$/i.test(url.pathname)) {
      if (images.length < 6) images.push({ url: url.href, name });
    } else if (links.length < 8) {
      links.push({ url: url.href, name });
    }
  }
  for (const node of nodes) {
    for (const menu of values(node.hasMenu || node.menu)) {
      add(typeof menu === 'string' ? menu : menu?.url || menu?.['@id'], label(menu?.name) || '菜單');
    }
  }
  for (const [, attrs, content] of body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi)) {
    const name = label(content) || label(attribute(attrs, 'aria-label') || attribute(attrs, 'title'));
    if (name.length <= 45 && MENU_LABEL.test(name)) add(attribute(attrs, 'href'), name);
    if (links.length >= 8) break;
  }
  for (const [, attrs] of body.matchAll(/<img\b([^>]*)>/gi)) {
    const name = label(attribute(attrs, 'alt') || attribute(attrs, 'title'));
    if (MENU_LABEL.test(name)) add(attribute(attrs, 'src') || attribute(attrs, 'data-src'), name);
    if (images.length >= 6) break;
  }
  return { links, images };
}

function pageName(body) {
  return label(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(body)?.[1])
    .replace(/\s*[|｜]\s*(?:菜單[＆和與及]?線上點餐|menu\s*&\s*order).*$/i, '');
}

function publicPrice(raw) {
  if (typeof raw !== 'number' && (typeof raw !== 'string' || !/^\d[\d,]*(?:\.\d+)?$/.test(raw.trim()))) return null;
  const price = Number(String(raw).replace(/,/g, ''));
  return Number.isSafeInteger(price) && price >= 0 && price <= 1000000 ? price : null;
}

async function iChefMenu(url, result, deadline) {
  const publicId = /^\/store\/([\w-]{1,60})(?:\/ordering)?\/?$/.exec(url.pathname)?.[1];
  if (url.hostname !== 'shop.ichefpos.com' || !publicId) return;
  const path = '/api/graphql/online_restaurant';
  const base = 'https://shop.ichefpos.com' + path;
  const allowed = target => target.hostname === 'shop.ichefpos.com' && target.pathname === path;
  async function read(operationName, query, variables) {
    const payload = { operationName, query, variables: { publicId, ...variables } };
    const response = await getJson(base + '?op=' + operationName, allowed, deadline, payload);
    return response?.data?.restaurant;
  }
  const [hours, details] = await Promise.all([
    read('menuHoursSnapshotQuery', 'query menuHoursSnapshotQuery($publicId: String!, $platformType: PlatformTypes!) { restaurant(publicId: $publicId) { onlineOrderingMenu(platformType: $platformType) { menuHoursSnapshot { categorySnapshotUuids } } } }', { platformType: 'ICHEF' }),
    read('restaurantInformationQuery', 'query restaurantInformationQuery($publicId: String) { restaurant(publicId: $publicId) { onlineRestaurantInformation { name phone address } } }').catch(() => null)
  ]);
  const shop = details?.onlineRestaurantInformation;
  result.name = label(shop?.name) || result.name;
  result.address = label(shop?.address) || result.address;
  result.phone = label(shop?.phone, 40) || result.phone;
  const ids = [...new Set(values(hours?.onlineOrderingMenu?.menuHoursSnapshot).flatMap(period => values(period?.categorySnapshotUuids))
    .filter(id => typeof id === 'string' && /^[a-f0-9-]{36}$/i.test(id)))].slice(0, 100);
  if (!ids.length) return;
  const data = await read('restaurantMenuItemCategoriesQuery', 'query restaurantMenuItemCategoriesQuery($publicId: String, $categoriesSnapshotUuids: [UUID!]!) { restaurant(publicId: $publicId) { menu { categoriesSnapshot(uuids: $categoriesSnapshotUuids) { name menuItemSnapshot { name price } } } } }', { categoriesSnapshotUuids: ids });
  let missingPrice = false;
  let count = 0;
  for (const category of values(data?.menu?.categoriesSnapshot)) {
    const c = label(category?.name) || '菜單';
    const items = [];
    for (const product of values(category?.menuItemSnapshot)) {
      const n = label(product?.name);
      const p = publicPrice(product?.price);
      if (!n || count >= 500) continue;
      if (p === null) {
        missingPrice = true;
        continue;
      }
      items.push({ n, p, g: [] });
      count++;
    }
    if (items.length) result.cats.push({ c, items });
  }
  if (result.cats.length) result.warnings.push('目前帶入 iCHEF 菜單上的基本價格，供應時段、客製選項與加價請以原頁確認。');
  if (missingPrice) result.warnings.push('已略過原網站未提供有效價格的品項。');
}

async function quickClickMenu(url, result, deadline) {
  const id = /^\/tw\/food\/([\w-]{1,70})\/?$/.exec(url.pathname)?.[1];
  if (url.hostname !== 'order.quickclick.cc' || !id) return;
  const base = 'https://order.quickclick.cc/apis/shops/' + id + '/menu';
  const allowed = target => target.hostname === 'order.quickclick.cc' && target.pathname.startsWith('/apis/shops/' + id + '/menu');
  const params = '?mt=toGo&tn=';
  const menu = await getJson(base + params, allowed, deadline);
  if (!Number.isSafeInteger(menu?.menuId) || menu.isMenuEnabled === 0) return;
  const [categories, products] = await Promise.all([
    getJson(base + '/' + menu.menuId + '/category', allowed, deadline),
    getJson(base + '/' + menu.menuId + '/products' + params, allowed, deadline)
  ]);
  if (!Array.isArray(categories) || !Array.isArray(products)) return;
  const groups = new Map();
  for (const category of categories) {
    if (category?.isCategoryEnabled !== 1) continue;
    const c = label(category.categoryLocale?.['zh-TW']?.name || category.categoryName);
    if (c) groups.set(category.categoryId, { c, items: [] });
  }
  let missingPrice = false;
  for (const product of products.slice(0, 500)) {
    const group = groups.get(product?.productCategoryId);
    if (!group || product.isVisibled !== 1) continue;
    const n = label(product.productLocale?.['zh-TW']?.name || product.productName);
    const p = publicPrice(product.productAmount);
    if (!n) continue;
    if (p === null) {
      missingPrice = true;
      continue;
    }
    group.items.push({ n, p, g: [] });
  }
  result.name = result.name || label(menu.menuName);
  result.cats = [...groups.values()].filter(category => category.items.length);
  if (result.cats.length) result.warnings.push('目前帶入快一點自取菜單上的基本價格，客製選項與加價請以原頁確認。');
  if (missingPrice) result.warnings.push('已略過原網站未提供有效價格的品項。');
}

const MOS_CATEGORIES = {
  'set.aspx': '主餐',
  'breakfast.aspx': '早餐',
  'sidedishes.aspx': '點心',
  'beverage.aspx': '飲品',
  'soup.aspx': '湯品',
  'dessert.aspx': '甜點'
};

async function mosMenu(url, body, result, deadline) {
  if (url.hostname !== 'www.mos.com.tw') return;
  const menuUrl = 'https://www.mos.com.tw/menu/set.aspx';
  const path = url.pathname === '/' ? '/menu/set.aspx' : url.pathname;
  const c = MOS_CATEGORIES[path.slice(6).toLowerCase()];
  if (!path.startsWith('/menu/') || !c) return;
  if (url.pathname === '/') {
    const page = await getPage(menuUrl, target => target.hostname === url.hostname && target.pathname === path, deadline);
    body = page.body;
    result.url = page.url.href;
  }
  const items = [];
  let missingPrice = false;
  for (const [, attrs, content] of body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi)) {
    if (!/^(?:(?:set_|breakfast_)detail|Detail)\.aspx\?id=M\d+$/i.test(attribute(attrs, 'href'))) continue;
    const n = label(/<h1>([\s\S]*?)<\/h1>/i.exec(content)?.[1]);
    const offers = [...content.matchAll(/<span\b([^>]*)>([\s\S]*?)<\/span\s*>/gi)];
    const fields = path.toLowerCase().endsWith('/breakfast.aspx') ? ['single', 'set'] : ['set'];
    if (!n) continue;
    for (const type of fields) {
      const offer = offers.find(([, attrs]) => attribute(attrs, 'class') === type && !/display\s*:\s*none/i.test(attribute(attrs, 'style')));
      const p = publicPrice(offer?.[2]?.trim());
      if (!p) {
        missingPrice = true;
        continue;
      }
      const suffix = fields.length === 2 ? (type === 'single' ? '（單點）' : '（套餐）') : '';
      items.push({ n: n + suffix, p, g: [] });
    }
  }
  if (items.length) {
    result.name = '摩斯漢堡';
    result.cats.push({ c, items });
    result.warnings.push('目前帶入摩斯漢堡官網此分類的標示價格，供應時段與門市價格請以原頁確認。');
  }
  if (missingPrice) result.warnings.push('已略過官網未標示有效價格的品項或規格。');
}

async function readMenu(value) {
  const input = urlOf(value);
  if (!input) return { name: '', address: '', phone: '', cats: [], url: '', warnings: ['請貼上公開的 HTTPS 菜單網址。'], links: [], images: [] };
  const result = { name: '', address: '', phone: '', cats: [], url: input.href, warnings: [], links: [], images: [] };
  try {
    const deadline = Date.now() + LIMIT_MS;
    const { body, url } = await getPage(input.href, undefined, deadline);
    const nodes = structured(body);
    const shop = nodes.find(node => hasType(node, ['Restaurant', 'FoodEstablishment', 'CafeOrCoffeeShop', 'FastFoodRestaurant', 'LocalBusiness'])) ||
      nodes.find(node => hasType(node, ['Organization']));
    const addr = shop?.address;
    result.url = url.href;
    result.name = label(shop?.name) || pageName(body);
    result.address = typeof addr === 'string' ? label(addr) : label([addr?.addressRegion, addr?.addressLocality, addr?.streetAddress].filter(Boolean).join(''));
    result.phone = label(shop?.telephone, 40);
    const { cats, missingPrice } = structuredMenu(nodes);
    result.cats = cats;
    if (cats.length) result.warnings.push('目前帶入公開菜單上的標示價格，客製選項與加價請以原頁確認。');
    if (missingPrice) result.warnings.push('已略過缺少有效台幣價格的品項。');
    Object.assign(result, menuLinks(body, nodes, url));
    if (!result.cats.length && url.hostname === 'iding.tw' && /^\/store\/[A-Za-z0-9_-]{1,80}\/?$/.test(url.pathname)) {
      const id = url.pathname.split('/')[2];
      const menu = await getJson('https://iding.tw/api/stores/menus?identifier=' + encodeURIComponent(id), u => u.hostname === 'iding.tw' && u.pathname === '/api/stores/menus', deadline);
      const converted = iding.convert(menu,label);
      result.cats = converted.cats;
      if(converted.skipped) result.warnings.push('已略過 '+converted.skipped+' 個無法完整保留套餐或複合選項的品項，請核對原頁。');
      if(converted.omittedUpgrades) result.warnings.push('另有 '+converted.omittedUpgrades+' 個餐點的套餐加購尚未帶入，請核對原頁。');
      if(result.cats.length) result.warnings.push('已讀取微碧公開菜單；線上價格可能與紙本不同，帶入前請核對。');
    }
    if (!result.cats.length) {
      if (source(url) === 'quickclick') await quickClickMenu(url, result, deadline);
      if (source(url) === 'ichef') await iChefMenu(url, result, deadline);
      if (source(url) === 'website') await mosMenu(url, body, result, deadline);
    }
    if (!result.cats.length) result.warnings.push('原網站目前無法直接讀取品項與價格，請開啟原頁查看。');
  } catch (error) {
    if (error?.code === 'unsafe-url') {
      result.url = '';
      result.links = [];
      result.images = [];
      result.warnings.push('這個連結或轉址無法安全讀取，請貼上公開的 HTTPS 菜單網址。');
    } else {
      result.warnings.push('目前無法讀取此網址的公開菜單，請開啟原頁查看。');
    }
  }
  return result;
}

function keyOf(value) {
  return label(value).toLowerCase().replace(/臺/g, '台').replace(/[^\p{L}\p{N}]/gu, '');
}

function shopKey(query) {
  const location = /^(?:台北|新北|桃園|台中|台南|高雄|基隆|新竹|苗栗|彰化|南投|雲林|嘉義|屏東|花蓮|台東|宜蘭|澎湖|金門|連江)(?:市|縣)?$/;
  return keyOf(query.split(/\s+/).filter(part => !location.test(part.replace(/臺/g, '台'))).join(' '));
}

function searchResults(body) {
  const results = [];
  for (const [, attrs, content] of body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi)) {
    if (!/(?:^|\s)l1(?:\s|$)/.test(attribute(attrs, 'class'))) continue;
    const title = /<div\b[^>]*class="[^"]*\btitle\b[^"]*"[^>]*>([\s\S]*?)<\/div\s*>/i.exec(content);
    const url = urlOf(attribute(attrs, 'href'));
    const name = label(title?.[1]);
    if (url && name) results.push({ url, name });
  }
  return results;
}

async function search(term, deadline) {
  const params = new URLSearchParams({ q: term, num: '10', hl: 'zh-TW', gl: 'tw', cc: 'tw' });
  const { body } = await getPage('https://search.brave.com/search?' + params, url => url.hostname === 'search.brave.com', deadline);
  const results = searchResults(body);
  if (!results.length && !/no results found|couldn.t find any results|查無結果/i.test(body)) throw new Error('搜尋結果暫時無法讀取');
  return results;
}

async function runDiscovery(query, key) {
  const deadline = Date.now() + LIMIT_MS;
  const warnings = [];
  const list = [];
  const seen = new Set();
  function collect(results, allowed = Object.keys(SEARCH_LABELS)) {
    for (const { url, name } of results) {
      const src = source(url);
      if (!allowed.includes(src) || !keyOf(name).includes(key) || seen.has(url.href) || list.filter(item => item.src === src).length >= 3) continue;
      if (src === 'website' && (platformHost(url.hostname) ||
          /(?:^|\.)(?:facebook\.com|instagram\.com|google\.com|ubereats\.com|foodpanda\.com\.tw|wikipedia\.org|youtube\.com|line\.me|threads\.com|pixnet\.net)$/.test(url.hostname) ||
          (!/官方網站|官方網頁|官網|official website/i.test(name) && !(url.pathname === '/' && keyOf(name).startsWith(key))))) continue;
      seen.add(url.href);
      const canImport = ['ichef', 'oddle'].includes(src) || (src === 'quickclick' && url.hostname === 'order.quickclick.cc');
      list.push({ src, id: url.href, url: url.href, name: pageName('<title>' + name + '</title>'), address: '', ...(canImport ? { canImport } : {}) });
    }
  }
  let unavailable = false;
  try {
    collect(await search(query + ' 線上點餐 菜單', deadline));
    const platforms = { ichef: 'shop.ichefpos.com', quickclick: 'order.quickclick.cc', oddle: 'oddle.me' };
    const missing = Object.keys(platforms).filter(src => !list.some(item => item.src === src));
    if (missing.length) {
      const sites = missing.map(src => 'site:' + platforms[src]).join(' OR ');
      collect(await search(query + ' (' + sites + ')', deadline), missing);
    }
  } catch { unavailable = true; }
  const missingLabels = Object.keys(SEARCH_LABELS).filter(src => !list.some(item => item.src === src)).map(src => SEARCH_LABELS[src]);
  if (unavailable) warnings.push('公開搜尋暫時無法完整取得結果，可直接貼上店家菜單網址。');
  else if (missingLabels.length) warnings.push(missingLabels.join('、') + '未找到可確認的同名連結，可直接貼上店家菜單網址。');
  return { output: { list, warnings }, unavailable };
}

async function discover(value) {
  const query = label(value, 100);
  const key = shopKey(query);
  if (key.length < 2) return { list: [], warnings: ['請輸入店名搜尋。'] };
  const cacheKey = keyOf(query) + '|' + key;
  const cached = SEARCH_CACHE.get(cacheKey);
  if (cached) {
    SEARCH_CACHE.delete(cacheKey);
    if (cached.until > Date.now()) {
      SEARCH_CACHE.set(cacheKey, cached);
      return cached.output;
    }
  }
  if (SEARCH_INFLIGHT.has(cacheKey)) return SEARCH_INFLIGHT.get(cacheKey);
  if (SEARCH_INFLIGHT.size >= 8) return { list: [], warnings: ['公開搜尋目前忙碌，可直接貼上店家菜單網址。'] };
  const pending = runDiscovery(query, key).then(({ output, unavailable }) => {
    SEARCH_CACHE.set(cacheKey, { output, until: Date.now() + (unavailable ? 10000 : 600000) });
    if (SEARCH_CACHE.size > 50) SEARCH_CACHE.delete(SEARCH_CACHE.keys().next().value);
    return output;
  }).finally(() => SEARCH_INFLIGHT.delete(cacheKey));
  SEARCH_INFLIGHT.set(cacheKey, pending);
  return pending;
}

module.exports = { discover, readMenu };
