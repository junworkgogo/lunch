(function () {
  'use strict';

  var maxImageLength = 96000;
  var imageTypes = ['image/png', 'image/jpeg', 'image/webp'];
  var cuisines = [
    {key: 'bento', label: '便當', icon: 'shopBento'},
    {key: 'noodle', label: '麵食', icon: 'shopNoodle'},
    {key: 'drink', label: '飲料', icon: 'shopDrink'},
    {key: 'breakfast', label: '早午餐', icon: 'shopBreakfast'},
    {key: 'dessert', label: '甜點', icon: 'shopDessert'},
    {key: 'healthy', label: '健康餐', icon: 'shopHealthy'},
    {key: 'other', label: '其他', icon: 'store'}
  ];
  var states = {
    active: '營業中',
    resting: '目前休息',
    unknown: '營業時間待確認'
  };
  var deliveryFields = [
    {key: 'deliveryMinimum', label: '最低外送金額', placeholder: '外送最低金額'},
    {key: 'deliveryFee', label: '外送運費', placeholder: '填 0 表示免運費'},
    {key: 'deliveryNote', label: '外送注意事項', note: true}
  ];
  var fields = [
    {key: 'lineId', label: 'LINE ID', limit: 80, placeholder: '例如 @foodshop'},
    {key: 'lineUrl', label: 'LINE 官方連結', limit: 1000, url: true},
    {key: 'closedDays', label: '公休日', limit: 120, placeholder: '例如 每週一、國定假日'},
    {key: 'mapsUrl', label: 'Google Maps 連結', limit: 1000, url: true},
    {key: 'websiteUrl', label: '官網', limit: 1000, url: true},
    {key: 'facebookUrl', label: 'Facebook', limit: 1000, url: true},
    {key: 'instagramUrl', label: 'Instagram', limit: 1000, url: true},
    {key: 'orderUrl', label: '線上訂餐網址', limit: 1000, url: true},
    {key: 'contactNote', label: '訂餐注意事項', limit: 500, multiline: true}
  ];

  function valueOf(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function cuisineOf(value) {
    return cuisines.find(function (cuisine) { return cuisine.key === value; }) || cuisines[cuisines.length - 1];
  }

  function cuisinesOf(shop) {
    var values=shop&&Array.isArray(shop.cuisines)?shop.cuisines:[];
    var keys=values.filter(function(key,i){return cuisines.some(function(c){return c.key===key;})&&values.indexOf(key)===i;});
    return keys.length?keys:[cuisineOf(shop&&shop.cuisine).key];
  }

  function cuisineLabel(shop,key) {
    var detail=shop&&typeof shop.otherCuisine==='string'?shop.otherCuisine.trim().slice(0,20):'';
    return cuisineOf(key).label+(key==='other'&&detail?'・'+detail:'');
  }

  function stateOf(shop, timestamp) {
    var clock=window.LunchApp&&window.LunchApp.now;
    if (timestamp === undefined) timestamp = clock ? clock() : Date.now();
    return window.LunchShopHours ? window.LunchShopHours.stateOf(shop, timestamp) : 'unknown';
  }

  function isOrderable(shop, timestamp) {
    return !!shop && !shop.deleted && stateOf(shop, timestamp) !== 'resting';
  }

  function deliveryAmount(value) {
    var text = typeof value === 'number' ? String(value) : valueOf(value);
    if (!text) return '';
    var amount = Number(text);
    return /^\d+$/.test(text) && Number.isInteger(amount) && amount <= 1000000 ? amount : NaN;
  }

  function deliveryEditorHtml(shop, esc) {
    return '<div class="shop-delivery-fields">' + deliveryFields.map(function (field) {
      var id = 'shop-' + field.key, label = '<label for="' + id + '">' + field.label + '</label>';
      var value = field.note ? valueOf(shop[field.key]) : deliveryAmount(shop[field.key]);
      if (Number.isNaN(value)) value = '';
      var control = field.note ? '<textarea id="' + id + '" rows="2" maxlength="500">' + esc(value) + '</textarea>' :
        '<input id="' + id + '" inputmode="numeric" maxlength="7" value="' + esc(value) + '" placeholder="' + field.placeholder + '">';
      return '<div class="fld">' + label + control + '</div>';
    }).join('') + '</div>';
  }

  function deliveryPatch(form, saveError) {
    var patch = {};
    for (var field of deliveryFields) {
      var input = form.querySelector('#shop-' + field.key), text = valueOf(input.value);
      if (input.value === input.defaultValue) continue;
      var value = field.note ? text : deliveryAmount(text);
      if (Number.isNaN(value)) {
        saveError.textContent = field.label + '請填 0–1,000,000 的整數，或留白。';
        saveError.hidden = false;
        input.focus();
        return null;
      }
      patch[field.key] = value;
    }
    return patch;
  }

  function deliveryInfo(shop, money) {
    var lines = [], minimum = deliveryAmount(shop.deliveryMinimum), fee = deliveryAmount(shop.deliveryFee);
    var threshold = deliveryAmount(shop.freeShippingThreshold);
    if (Number.isFinite(minimum)) lines.push('最低外送金額 ' + money(minimum));
    if (Number.isFinite(fee)) lines.push(fee === 0 ? '免運費' : '外送運費 ' + money(fee));
    if (threshold > 0) lines.push('滿 ' + money(threshold) + ' 免運');
    return lines;
  }

  function deliverySnapshot(shop) {
    var result = {};
    deliveryFields.forEach(function (field) {
      var value = field.note ? valueOf(shop[field.key]).slice(0, 500) : deliveryAmount(shop[field.key]);
      if (value !== '' && !Number.isNaN(value)) result[field.key] = value;
    });
    return result;
  }

  function safeUrl(value, type) {
    var text = valueOf(value), url;
    if (text.length > 1000 || !/^https?:\/\/(?!\/)/i.test(text) || /[\s\u0000-\u001f\u007f\\]/.test(text)) return '';
    if (text.split(/[/?#]/)[2].includes('@')) return '';
    try { url = new URL(text); } catch (error) { return ''; }
    if (!url.hostname || url.username || url.password || !/^https?:$/.test(url.protocol)) return '';
    if (type === 'lineUrl') {
      if (url.protocol !== 'https:' || url.port) return '';
      var path = url.pathname, host = url.hostname;
      var isShort = host === 'lin.ee' && /^\/[a-z0-9_-]+\/?$/i.test(path);
      var isAccount = host === 'line.me' && /^\/(?:R\/)?ti\/p\/(?:@|%40|~)?[a-z0-9_.+-]+\/?$/i.test(path);
      var isPage = host === 'page.line.me' && /^\/(?:@|%40)?[a-z0-9_.-]+\/?$/i.test(path);
      if (!isShort && !isAccount && !isPage) return '';
    }
    if (type === 'mapsUrl') {
      var host = url.hostname, path = url.pathname;
      var isMap = (host === 'www.google.com' || host === 'www.google.com.tw' || host === 'google.com') && /^\/maps(?:\/|$)/.test(path);
      var isShare = (host === 'maps.app.goo.gl' || host === 'goo.gl' && /^\/maps\//.test(path)) && path !== '/';
      if (url.protocol !== 'https:' || url.port || !isMap && !isShare && host !== 'maps.google.com') return '';
    }
    return url.href;
  }

  function qrData(value) {
    return typeof value === 'string' && value.length <= maxImageLength &&
      /^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : '';
  }

  function imageMime(bytes) {
    if ([137, 80, 78, 71, 13, 10, 26, 10].every(function (b, i) { return bytes[i] === b; })) return 'image/png';
    if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
    if (bytes.length === 12 && String.fromCharCode.apply(null, bytes.subarray(0, 4)) === 'RIFF' &&
      String.fromCharCode.apply(null, bytes.subarray(8)) === 'WEBP') return 'image/webp';
    return '';
  }

  function encodeQr(file) {
    if (!file || !imageTypes.includes(file.type) || !file.size || file.size > 5 * 1024 * 1024) {
      return Promise.reject(new Error('請選擇 5 MB 以內的 PNG、JPG 或 WebP 圖片'));
    }
    return file.slice(0, 12).arrayBuffer().then(function (buffer) {
      if (imageMime(new Uint8Array(buffer)) !== file.type) throw new Error('圖片格式不符，請換一張 PNG、JPG 或 WebP');
      return new Promise(function (resolve, reject) {
        var src = URL.createObjectURL(file), image = new Image();
        image.onerror = function () {
          URL.revokeObjectURL(src);
          reject(new Error('無法開啟這張圖片，請換一張'));
        };
        image.onload = function () {
          URL.revokeObjectURL(src);
          try {
            var width = image.naturalWidth, height = image.naturalHeight;
            if (!width || !height || width * height > 16000000) throw new Error('圖片尺寸過大，請先裁切 QR Code 周圍的空白');
            var canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
            for (var edge of [768, 640, 512, 384]) {
              var scale = Math.min(1, edge / Math.max(width, height));
              canvas.width = Math.max(1, Math.round(width * scale));
              canvas.height = Math.max(1, Math.round(height * scale));
              ctx.fillStyle = '#fff';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
              var data = qrData(canvas.toDataURL('image/png'));
              if (data) { resolve(data); return; }
            }
            throw new Error('圖片資料過大，請裁切後再上傳');
          } catch (error) { reject(error); }
        };
        image.src = src;
      });
    });
  }

  function editorHtml(shop, esc) {
    return '<fieldset class="fld shop-contact-editor" data-shop-contact-editor><legend>店家聯絡資訊（選填）</legend>' +
      '<div class="shop-contact-fields">' + fields.map(function (field) {
        var id = 'shop-' + field.key, text = esc(valueOf(shop[field.key]), true);
        var control = field.multiline ? '<textarea id="' + id + '" rows="3" maxlength="' + field.limit + '">' + text + '</textarea>' :
          '<input id="' + id + '" maxlength="' + field.limit + '" value="' + text + '" autocomplete="off"' +
          (field.url ? ' type="url" placeholder="https://"' : field.placeholder ? ' placeholder="' + field.placeholder + '"' : '') + '>';
        return '<div class="fld"><label for="' + id + '">' + field.label + '</label>' + control + '</div>';
      }).join('') + '</div>' +
      '<div class="fld shop-contact-qr-editor"><label for="shop-line-qr">LINE QR Code</label>' +
      '<input id="shop-line-qr" type="file" accept="image/png,image/jpeg,image/webp" aria-describedby="shop-line-qr-status">' +
      '<p class="hint" id="shop-line-qr-status" role="status">PNG、JPG 或 WebP，5 MB 以內。儲存後才會更新。</p>' +
      '<div class="shop-contact-qr-preview" data-shop-qr-preview hidden><img alt="LINE QR Code 預覽">' +
      '<button class="btn sm" type="button" data-shop-qr-remove>移除 QR Code</button></div></div></fieldset>';
  }

  function bindEditor(root, shop) {
    var editor = root.querySelector('[data-shop-contact-editor]');
    var inputs = fields.map(function (field) {
      var initial = valueOf(shop[field.key]);
      if (field.multiline) initial = initial.replace(/\r\n?/g, '\n');
      return {field: field, input: editor.querySelector('#shop-' + field.key), initial: initial};
    });
    var input = editor.querySelector('#shop-line-qr'), preview = editor.querySelector('[data-shop-qr-preview]');
    var image = preview.querySelector('img'), remove = preview.querySelector('button'), status = editor.querySelector('[role=status]');
    var initialQr = qrData(shop.lineQrImage), draft = initialQr, pending = false, job = 0;
    function render() {
      preview.hidden = !draft;
      if (draft) image.src = draft;
      else image.removeAttribute('src');
    }
    render();
    input.addEventListener('change', function () {
      var file = input.files[0];
      if (!file) return;
      input.value = '';
      var current = ++job;
      pending = true;
      status.textContent = '正在處理 QR Code…';
      encodeQr(file).then(function (imageData) {
        if (current !== job) return;
        draft = imageData;
        render();
        status.textContent = '已預覽新圖片，儲存後會更新。';
      }).catch(function (error) {
        if (current !== job) return;
        status.textContent = error.message + (draft ? '。目前的 QR Code 已保留。' : '。');
      }).finally(function () {
        if (current === job) pending = false;
      });
    });
    remove.addEventListener('click', function () {
      ++job;
      pending = false;
      draft = '';
      render();
      status.textContent = initialQr ? '儲存後會移除原本的 QR Code。' : '已移除 QR Code 預覽。';
      input.focus();
    });
    return {
      setSaving: function (saving) { editor.disabled = saving; },
      collect: function (saveError) {
        function reject(message, field) {
          saveError.textContent = message;
          saveError.hidden = false;
          field.focus();
          return null;
        }
        if (pending) return reject('QR Code 正在處理，請稍候再儲存。', input);
        var patch = {};
        for (var entry of inputs) {
          var field = entry.field, text = valueOf(entry.input.value);
          if (text === entry.initial) continue;
          if (text.length > field.limit) return reject(field.label + ' 請縮短到 ' + field.limit + ' 個字以內。', entry.input);
          if (field.url && text) {
            var url = safeUrl(text, field.key);
            if (!url) {
              var message = field.key === 'lineUrl' ? '請填入有效的 HTTPS LINE 官方連結。' :
                field.key === 'mapsUrl' ? '請填入有效的 HTTPS Google Maps 網址。' : field.label + ' 請填入完整的 http:// 或 https:// 網址。';
              return reject(message, entry.input);
            }
            text = url;
          }
          patch[field.key] = text;
        }
        if (draft !== initialQr) patch.lineQrImage = draft;
        return patch;
      }
    };
  }

  function snapshot(shop) {
    var contact = {};
    fields.forEach(function (field) {
      var text = valueOf(shop[field.key]);
      if (text.length > field.limit) return;
      if (field.url) text = safeUrl(text, field.key);
      if (text) contact[field.key] = text;
    });
    var qr = qrData(shop.lineQrImage);
    if (qr) contact.lineQrImage = qr;
    return contact;
  }

  function telephone(value) {
    var raw = valueOf(value).normalize('NFKC');
    var parts = raw.match(/^(\+?[\d\s().-]+?)(?:\s*(?:分機|#|ext\.?|x)\s*(\d+))?$/i);
    if (!parts) return '';
    var digits = parts[1].replace(/[^0-9]/g, '');
    return digits.length >= 3 ? 'tel:' + (raw[0] === '+' ? '+' : '') + digits + (parts[2] ? ';ext=' + parts[2] : '') : '';
  }

  function phoneHtml(value, esc, asButton) {
    var text = valueOf(Number.isFinite(value) ? String(value) : value);
    var href = telephone(text), label = (asButton ? '店家電話 ' : '') + esc(text, true);
    if (!text) return '';
    return href ? '<a' + (asButton ? ' class="btn sm"' : '') + ' href="' + esc(href, true) + '">' + label + '</a>' :
      '<span>' + label + '</span>';
  }

  function copyButton(value, label, description, esc) {
    return '<button class="btn sm" type="button" data-shop-copy="' + esc(value, true) +
      '" data-shop-copy-label="' + description + '">' + label + '</button>';
  }

  function contactHtml(shop, esc, options) {
    var contact = snapshot(shop), actions = '', info = '';
    var summary = options && options.summary, phone = valueOf(Number.isFinite(shop.phone) ? String(shop.phone) : shop.phone);
    var address = valueOf(shop.address);
    if (phone || address) {
      info += '<div class="shop-contact-actions">';
      if (phone) info += (summary ? phoneHtml(phone, esc, true) : '') + copyButton(phone, '複製電話', '電話', esc);
      if (address) info += (summary ? '<span>' + esc(address) + '</span>' : '') + copyButton(address, '複製地址', '地址', esc);
      info += '</div>';
    }
    if (contact.lineId) {
      info += '<p class="shop-contact-line-id">LINE ID <code>' + esc(contact.lineId, true) + '</code>' +
        copyButton(contact.lineId, '複製 ID', 'LINE ID', esc) + '</p>';
    }
    if (contact.closedDays) info += '<p>公休日 <span>' + esc(contact.closedDays) + '</span></p>';
    if (contact.contactNote) info += '<p class="shop-contact-note">訂餐注意事項 <span>' + esc(contact.contactNote) + '</span></p>';
    var mapUrl = !(options && options.hideMap) && (contact.mapsUrl || options && safeUrl(options.mapUrl, 'mapsUrl'));
    if (mapUrl) actions += externalLink(mapUrl, '開啟店家地圖', esc);
    if (contact.lineUrl) actions += externalLink(contact.lineUrl, '開啟 LINE', esc) + copyButton(contact.lineUrl, '複製 LINE 連結', 'LINE 連結', esc);
    if (contact.lineQrImage) {
      var source = esc(contact.lineQrImage, true);
      actions += '<button type="button" class="btn sm" data-shop-show-qr aria-haspopup="dialog">查看 LINE QR Code</button>' +
        '<dialog class="shop-contact-dialog" aria-label="店家 LINE QR Code"><h3>店家 LINE QR Code</h3>' +
        '<img src="' + source + '" alt="店家 LINE QR Code" loading="lazy">' +
        '<div class="shop-contact-actions"><a class="btn primary" download="line-qr.png" href="' + source + '">下載 QR Code</a>' +
        '<button type="button" class="btn" data-shop-close-qr autofocus>關閉</button></div></dialog>';
    }
    fields.filter(function (field) { return field.url && field.key !== 'lineUrl' && field.key !== 'mapsUrl'; }).forEach(function (field) {
      if (contact[field.key]) actions += externalLink(contact[field.key], field.key === 'orderUrl' ? '線上訂餐' : field.label, esc);
    });
    if (!info && !actions) return '';
    return '<div class="shop-contact-details">' + (summary ? '<h3>店家聯絡方式</h3>' : '') + info +
      (actions ? '<div class="shop-contact-actions">' + actions + '</div>' : '') + '</div>';
  }

  function externalLink(url, label, esc) {
    return '<a class="btn sm" href="' + esc(url, true) + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
  }

  function bindActions(root, copy, toast) {
    root.addEventListener('click', function (event) {
      var button = event.target.closest('[data-shop-copy],[data-shop-show-qr],[data-shop-close-qr]');
      if (!button) return;
      if (button.hasAttribute('data-shop-copy')) {
        var value = button.getAttribute('data-shop-copy'), label = button.getAttribute('data-shop-copy-label');
        copy(value).then(function (ok) {
          if (!ok) {
            var field = document.createElement('input');
            field.readOnly = true;
            field.value = value;
            field.setAttribute('aria-label', label);
            field.className = 'shop-contact-copy-fallback';
            button.replaceWith(field);
            field.focus();
            field.select();
          }
          toast(ok ? '已複製' + label : '請手動複製已選取的' + label, !ok);
        });
      } else if (button.hasAttribute('data-shop-show-qr')) {
        var dialog = button.nextElementSibling;
        if (!dialog.open) dialog.showModal();
      } else {
        button.closest('dialog').close();
      }
    });
  }

  window.LunchShopContact = {
    editorHtml: editorHtml, bindEditor: bindEditor, snapshot: snapshot,
    phoneHtml: phoneHtml, contactHtml: contactHtml, bindActions: bindActions,
    cuisines: cuisines, cuisineOf: cuisineOf, cuisinesOf: cuisinesOf, cuisineLabel: cuisineLabel, states: states, stateOf: stateOf, isOrderable: isOrderable,
    deliveryEditorHtml: deliveryEditorHtml, deliveryPatch: deliveryPatch, deliveryInfo: deliveryInfo, deliverySnapshot: deliverySnapshot,
    mapUrl: function (value) { return safeUrl(value, 'mapsUrl'); }
  };
}());
