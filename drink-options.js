(function () {
  'use strict';

  var groups = [
    { id: 'sugar', name: '甜度', aliases: ['甜度', '糖度', '糖量'], template: '無糖、一分糖、微糖、半糖、少糖、全糖' },
    { id: 'ice', name: '冰塊', aliases: ['冰塊', '冰量'], template: '去冰、微冰、少冰、正常、常溫' },
    { id: 'temperature', name: '溫度', aliases: ['溫度', '冷熱', '飲品溫度', '飲料溫度', '冷／熱', '冷/熱'], placeholder: '例如 冷、熱' }
  ];
  var bullet = /^[ \t　]*-[ \t　]+/;

  // Match the menu parser's fixed-group qualifiers while keeping the source label.
  function groupName(name) {
    return name.replace(/固定|限定|限制|僅|只|限/g, '').trim();
  }

  function readShared(lines, group) {
    var found = [];
    for (var i = 0; i < lines.length; i += 2) {
      var raw = lines[i];
      if (!raw.trim()) continue;
      var lead = bullet.exec(raw) || /^[ \t　]*/.exec(raw);
      if (!bullet.test(raw) && lead[0].replace(/[\t　]/g, '  ').length < 2) break;
      var colon = raw.search(/[:：]/);
      if (colon < 0) continue;
      var head = raw.slice(0, colon);
      var name = head.slice(lead[0].length).trim();
      var required = /[*＊]$/.test(name);
      name = name.replace(/\s*[*＊]+$/, '').trim();
      var baseName = groupName(name);
      if (group.aliases.indexOf(baseName) !== -1) {
        found.push({
          index: i, raw: raw, head: head, suffix: raw.slice(colon),
          required: required, name: name, fixed: baseName !== name
        });
      }
    }
    return found;
  }

  function splitChoices(value) {
    return value.split(/[、,，﹐､]/).map(function (choice) { return choice.trim(); }).filter(Boolean);
  }

  function writeShared(text, group, choices, required) {
    // Keep the original separators so all other lines stay exactly as entered.
    var lines = text.split(/(\r?\n)/);
    var matches = readShared(lines, group);
    if (matches.length > 1 || (matches[0] && matches[0].fixed)) return text;
    var current = matches[0];
    if (!current) {
      if (!choices || !choices.length) return text;
      var line = '  ' + group.name + (required ? '*' : '') + ': ' + choices.join(', ');
      return text ? line + (lines[1] || '\n') + text : line;
    }
    if (choices && !choices.length) {
      if (current.index + 1 < lines.length) lines.splice(current.index, 2);
      else lines.splice(Math.max(0, current.index - 1), 2);
    } else {
      var head = current.head;
      if (required !== current.required) {
        head = required ? head.replace(/\s*$/, '*$&') : head.replace(/\s*[*＊]+(?=\s*$)/, '');
      }
      var suffix = current.suffix;
      if (choices) suffix = suffix.charAt(0) + ' ' + choices.join(', ');
      lines[current.index] = head + suffix;
    }
    return lines.join('');
  }

  function mount(form) {
    var menu = form.querySelector('#sm');
    if (!menu || form.querySelector('.drink-options')) return;
    var field = menu.closest('.fld');
    if (!field) return;

    var box = document.createElement('section');
    box.className = 'drink-options';
    box.setAttribute('aria-labelledby', 'drink-options-title');
    box.innerHTML = '<h3 id="drink-options-title">甜度／冰量／溫度 <span>全店共用</span></h3>' +
      '<p id="drink-options-hint">用頓號分隔選項，留空可移除該組。店家有提供冷熱選擇時，勾選可供應的溫度。品項的固定糖冰或限冷、限熱，可在菜單文字裡為該品項設定同名選項。</p>' +
      '<div class="drink-options-fields">' + groups.map(function (group) {
        var id = 'drink-options-' + group.id;
        var placeholder = group.placeholder || '例如 ' + group.template;
        return '<div class="drink-options-field">' +
          (group.id === 'temperature' ? '<span class="drink-temperature-label" id="' + id + '-label">溫度</span><input type="hidden" id="' + id + '"><div class="drink-temperature-choices" role="group" aria-labelledby="' + id + '-label"><button type="button" data-temperature="冷" aria-pressed="false">冷</button><button type="button" data-temperature="熱" aria-pressed="false">熱</button></div>' :
          '<label for="' + id + '">' + group.name + '</label><input type="text" id="' + id + '" aria-describedby="drink-options-hint" autocomplete="off" placeholder="' + placeholder + '">') +
          '<label class="drink-options-check"><input type="checkbox" id="' + id + '-required"> ' + group.name + '必選</label>' +
          '<p class="drink-options-warning" id="' + id + '-warning" role="status" hidden></p></div>';
      }).join('') + '</div>' +
      '<button type="button" class="btn sm drink-options-example">填入常用糖冰選項</button>' +
      '<p class="drink-options-note">按「儲存店家」才會存。已開的團需另按「更新菜單」。</p>';
    field.before(box);

    var fields = groups.map(function (group) {
      var id = '#drink-options-' + group.id;
      return {
        group: group,
        input: box.querySelector(id),
        required: box.querySelector(id + '-required'),
        warning: box.querySelector(id + '-warning'),
        signature: null
      };
    });
    var example = box.querySelector('.drink-options-example');
    var writing = [];
    var confirming = false;

    function canFillTemplate(field) {
      return !!field.group.template && !field.input.disabled && !field.input.readOnly &&
        splitChoices(field.input.value).length === 0;
    }

    function syncTemperature(field) {
      if(field.group.id !== 'temperature')return;
      var values=splitChoices(field.input.value),known=field.temperatureChoices||(field.temperatureChoices={});
      values.forEach(function(value){var name=value.replace(/\s*\+\s*\$?\s*\d+\s*元?$/, '').trim();if(name==='冷'||name==='熱')known[name]=value;});
      var unknown=values.some(function(value){return !/^(冷|熱)(?:\s*\+\s*\$?\s*\d+\s*元?)?$/.test(value);});
      box.querySelectorAll('[data-temperature]').forEach(function(button){
        var name=button.getAttribute('data-temperature');
        button.disabled=field.input.disabled||field.input.readOnly||unknown;
        button.setAttribute('aria-pressed',String(values.some(function(value){return value===name||value===known[name];})));
      });
      if(unknown&&!field.warning.textContent){field.warning.textContent='原有溫度包含其他設定，已保留原值，請由菜單來源確認。';field.warning.hidden=false;}
    }

    function sync() {
      var lines = menu.value.split(/(\r?\n)/);
      fields.forEach(function (field) {
        var matches = readShared(lines, field.group);
        var signature = matches.map(function (match) { return match.raw; }).join('\n');
        if (signature === field.signature) return;
        field.signature = signature;
        var current = matches[0];
        var duplicate = matches.length > 1;
        var fixed = !!(current && current.fixed);
        field.input.disabled = duplicate;
        field.input.readOnly = fixed;
        field.required.disabled = duplicate || fixed;
        var message = '';
        if (duplicate) message = '菜單文字有多行全店共用的' + field.group.name + '設定，請先在菜單文字中保留一行。';
        else if (fixed) message = '「' + current.name + '」是固定設定，可在下方的菜單文字編輯。';
        field.warning.textContent = message;
        field.warning.hidden = !message;
        field.input.setAttribute('aria-describedby', 'drink-options-hint' + (message ? ' ' + field.warning.id : ''));
        if (writing.indexOf(field) !== -1) { syncTemperature(field); return; }
        if(field.group.id==='temperature')field.temperatureChoices={};
        field.input.value = current ? splitChoices(current.suffix.slice(1)).join('、') : '';
        field.required.checked = !current || current.required;
        syncTemperature(field);
      });
      example.disabled = !fields.some(canFillTemplate);
    }

    function apply(value, changed) {
      writing = changed;
      try {
        if (menu.value !== value) {
          menu.value = value;
          menu.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          sync();
        }
      } finally {
        writing = [];
      }
    }

    fields.forEach(function (field) {
      function commitChoices() {
        apply(writeShared(menu.value, field.group, splitChoices(field.input.value), field.required.checked), [field]);
      }
      if(field.group.id==='temperature')box.querySelectorAll('[data-temperature]').forEach(function(button){
        button.addEventListener('click',function(){
          if(button.disabled)return;
          var name=button.getAttribute('data-temperature'),choice=(field.temperatureChoices||{})[name]||name;
          var values=splitChoices(field.input.value),at=values.indexOf(choice);
          if(at>=0)values.splice(at,1);else values.push(choice);
          field.input.value=values.join('、');commitChoices();syncTemperature(field);
        });
      });
      field.input.addEventListener('input', function (event) {
        if (!event.isComposing) commitChoices();
      });
      field.input.addEventListener('compositionend', commitChoices);
      field.input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && !event.isComposing && event.keyCode !== 229) event.preventDefault();
      });
      field.required.addEventListener('change', function () {
        apply(writeShared(menu.value, field.group, null, field.required.checked), [field]);
      });
    });

    example.addEventListener('click', async function () {
      if (confirming) return;
      var empty = fields.filter(canFillTemplate);
      if (!empty.length) return;
      confirming = true;
      try {
        var title = '填入常用糖冰選項？';
        var body = '這是範本，只會填入空白的甜度或冰量欄位。請對照店家實際提供的選項，確認後再儲存店家。';
        var app = window.LunchApp;
        var ok = app && typeof app.ask === 'function'
          ? await app.ask({ title: title, body: body, okText: '填入範本' })
          : window.confirm(title + '\n' + body);
        if (!ok || !box.isConnected) return;
        var next = menu.value;
        empty.forEach(function (field) {
          if (canFillTemplate(field)) {
            next = writeShared(next, field.group, splitChoices(field.group.template), field.required.checked);
          }
        });
        apply(next, []);
      } finally {
        confirming = false;
      }
    });

    menu.addEventListener('input', sync);
    sync();
  }

  var app = document.getElementById('app');
  if (!app) return;
  function scan() {
    var form = app.querySelector('form#f');
    if (form) mount(form);
  }
  new MutationObserver(scan).observe(app, { childList: true, subtree: true });
  scan();
})();
