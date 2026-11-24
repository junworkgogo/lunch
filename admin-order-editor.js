(function () {
  'use strict';

  var A = window.LunchApp;
  var openEditor = null;
  var cancelEditor = null;
  var maxQuantity = 999;
  var maxUnit = 1000000;

  function menuEntries(group) {
    var menu = A.menuOf(group.shop);
    return menu.flatMap(function (category, ci) {
      return category.items.map(function (item, ii) {
        var key = ci + '-' + ii;
        return { key: key, cat: category.c, item: item, sold: A.isSoldOut(group, menu, key) };
      });
    });
  }

  function selectedGroups(ref, originalOptions) {
    var groups = (ref ? ref.item.g : []).map(function (group) {
      return {
        n: group.n,
        req: group.req,
        choices: group.o.map(function (choice) {
          return { group: group.n, choice: choice.n, add: choice.add };
        }),
        selected: []
      };
    });
    originalOptions.forEach(function (option) {
      var group = groups.find(function (g) { return g.n === option.group; }) ||
        groups.find(function (g) { return A.optionGroupKey(g.n) === A.optionGroupKey(option.group); });
      if (!group) {
        group = { n: option.group, req: false, choices: [], selected: [] };
        groups.push(group);
      }
      var index = group.choices.findIndex(function (choice, i) {
        return choice.choice === option.choice && !group.selected.includes(i);
      });
      if (index < 0) index = group.choices.length;
      group.choices[index] = option;
      group.selected.push(index);
    });
    return groups;
  }

  function sameItem(ref, item) {
    return ref && item && ref.cat === item.cat && ref.item.n === item.item;
  }

  function staysOriginal(row) {
    return row.original && (!row.ref || sameItem(row.ref, row.original));
  }

  function isHot(row) {
    return row.groups.some(function (group) {
      return A.optionGroupKey(group.n) === '溫度' && group.selected.some(function (index) {
        return /^(熱|熱飲|熱的)$/.test(group.choices[index].choice.trim());
      });
    });
  }

  function isBlocked(group, choice, hot) {
    return hot && (A.optionGroupKey(group.n) === '冰塊' ||
      (/^(加料|配料|加點|加購|toppings?)(區|\s|[（(：:]|$)/i.test(group.n) &&
       /限\s*冷\s*飲|冷\s*飲\s*限定/.test(choice.choice)));
  }

  function selectItem(row, ref) {
    row.ref = ref;
    var original = staysOriginal(row) ? row.original : null;
    row.originalOptions = original ? A.lineOpts(original).map(function (option) {
      return { group: option.group, choice: option.choice, add: Number(option.add) || 0 };
    }) : [];
    var originalAdd = row.originalOptions.reduce(function (sum, option) { return sum + option.add; }, 0);
    row.base = original ? (original.base == null ? A.lineUnit(original) - originalAdd : Number(original.base)) : ref ? ref.item.p : 0;
    row.groups = selectedGroups(ref, row.originalOptions);
    row.startsHot = isHot(row);
    row.originalSelection = selectionKey(row);
    row.groups.forEach(function (group) { group.hadSelection = group.selected.length > 0; });
  }

  function makeRow(original, ref) {
    var row = {
      original: original,
      originalRef: ref,
      qty: original ? Number(original.qty) || 1 : 1,
      note: original && original.note != null ? String(original.note) : ''
    };
    selectItem(row, ref);
    return row;
  }

  function selectionKey(row) {
    return JSON.stringify(row.groups.map(function (group) { return group.selected.slice().sort(function (a, b) { return a - b; }); }));
  }

  function usesSavedOptions(row) {
    return staysOriginal(row) && selectionKey(row) === row.originalSelection;
  }

  function optionsOf(row) {
    if (usesSavedOptions(row)) return row.originalOptions;
    var hot = isHot(row);
    return row.groups.flatMap(function (group) {
      return group.selected.slice().sort(function (a, b) { return a - b; }).map(function (index) {
        return group.choices[index];
      }).filter(function (choice) { return !isBlocked(group, choice, hot); });
    });
  }

  function unitOf(row) {
    return usesSavedOptions(row) ? A.lineUnit(row.original) : optionsOf(row).reduce(function (sum, option) {
      return sum + option.add;
    }, row.base);
  }

  function needsChoice(row, group, hot) {
    return group.req && (!staysOriginal(row) || group.hadSelection ||
      (!hot && row.startsHot && A.optionGroupKey(group.n) === '冰塊')) &&
      group.choices.some(function (choice) { return !isBlocked(group, choice, hot); });
  }

  function lineValue(row) {
    var original = staysOriginal(row) ? row.original : null;
    var note = original && row.note === String(original.note == null ? '' : original.note) ? row.note : row.note.trim();
    if (original && usesSavedOptions(row) && note === String(original.note == null ? '' : original.note) &&
        row.qty === Number(original.qty) && original.unit != null) {
      return Object.assign({}, original);
    }
    return Object.assign({}, original, {
      cat: original ? original.cat || '' : row.ref.cat,
      item: original ? original.item : row.ref.item.n,
      base: row.base,
      options: optionsOf(row),
      unit: unitOf(row),
      qty: row.qty,
      note: note
    });
  }

  function open(context) {
    var group = context.group;
    var order = context.order;
    if (openEditor || !group || group.deleted || !order || order.cancelled) return Promise.resolve(null);
    var originals = A.arr(order.items);
    if (!originals.length) return Promise.resolve(null);
    var entries = menuEntries(group);
    var available = entries.filter(function (entry) { return !entry.sold; });
    var rows = originals.map(function (item) {
      var matches = entries.filter(function (entry) { return sameItem(entry, item); });
      return makeRow(item, matches.length === 1 ? matches[0] : null);
    });
    var originalTotal = A.orderTotal(order);
    var paid = context.paid && context.paid[context.orderId];
    var paidCount = originals.filter(function (_, index) { return paid && paid[index] === true; }).length;
    var status = paidCount === originals.length ? '已收款' : paidCount ? '部分收款' : '未收款';

    return new Promise(function (resolve) {
      var opener = context.opener || document.activeElement;
      var previousOverflow = document.body.style.overflow;
      var overlay = document.createElement('div');
      overlay.className = 'modal-ov aoe-overlay';
      overlay.innerHTML = '<section class="modal aoe-panel" role="dialog" aria-modal="true" aria-labelledby="aoe-title" tabindex="-1">' +
        '<header class="aoe-head"><h2 id="aoe-title">修改訂單</h2><p>' + A.esc(order.name) + '</p></header>' +
        '<div class="aoe-body"><div data-aoe-rows></div><button type="button" class="btn aoe-add" data-aoe-add' +
        (!available.length ? ' disabled' : '') + '>新增品項</button></div>' +
        '<footer class="aoe-footer"><div class="aoe-totals" aria-live="polite"><span>原餐點金額 <b>' + A.money(originalTotal) + '</b></span>' +
        '<span>新餐點金額 <b data-aoe-total></b></span></div>' +
        '<p>目前' + status + '。金額變動時會重新核對收款。</p>' +
        '<p class="aoe-error" role="alert" data-aoe-error hidden></p>' +
        '<div class="modal-actions aoe-actions"><button type="button" class="btn" data-aoe-cancel>取消</button>' +
        '<button type="button" class="btn primary" data-aoe-review>確認修改</button></div></footer>' +
        '<div class="aoe-confirm" data-aoe-confirm hidden><h3 id="aoe-confirm-title"></h3><p data-aoe-message></p>' +
        '<div class="modal-actions aoe-actions"><button type="button" class="btn" data-aoe-back>返回</button>' +
        '<button type="button" class="btn primary" data-aoe-accept></button></div></div></section>';
      var panel = overlay.querySelector('.aoe-panel');
      var lines = overlay.querySelector('[data-aoe-rows]');
      var error = overlay.querySelector('[data-aoe-error]');
      var confirmation = overlay.querySelector('[data-aoe-confirm]');
      var confirmationButton = overlay.querySelector('[data-aoe-accept]');
      var confirmAction = null;
      var returnFocus = null;
      var main = [overlay.querySelector('.aoe-head'), overlay.querySelector('.aoe-body'), overlay.querySelector('.aoe-footer')];

      function productOptions(row) {
        var original = row.original;
        var originalRef = row.originalRef;
        var placeholder = original ? '' : '<option value="" disabled' + (!row.ref ? ' selected' : '') + '>請選擇餐點</option>';
        var oldOption = original && (!originalRef || originalRef.sold) ? '<option value="original"' + (!row.ref || (staysOriginal(row) && row.ref.sold) ? ' selected' : '') + '>' +
          A.esc(original.item) + '（原品項）</option>' : '';
        return placeholder + oldOption + available.map(function (entry) {
          return '<option value="' + entry.key + '"' + (entry === row.ref ? ' selected' : '') + '>' +
            A.esc(entry.cat) + ' · ' + A.esc(entry.item.n) + '</option>';
        }).join('');
      }

      function renderLine(row, index) {
        var old = staysOriginal(row);
        var label = old ? row.original.item : row.ref ? row.ref.item.n : '待選餐點';
        var description = old && (!row.ref || row.ref.sold) ?
          '<p class="aoe-unavailable">' + (row.ref ? '此原品項已停售。' : '此原品項目前不在菜單中。') + '</p>' : '';
        return '<section class="aoe-line" data-aoe-line><div class="aoe-line-head"><label for="aoe-item-' + index + '">餐點</label>' +
          '<button type="button" class="btn aoe-remove" data-aoe-remove aria-label="移除 ' + A.esc(label) + '"' +
          (rows.length < 2 ? ' disabled' : '') + '>移除</button></div>' +
          '<select id="aoe-item-' + index + '" data-aoe-item>' + productOptions(row) + '</select>' + description +
          row.groups.map(function (group, gi) {
            return '<fieldset data-aoe-group="' + gi + '"><legend>' + A.esc(group.n) + '<small data-aoe-group-kind></small></legend>' +
              '<div class="aoe-chips">' + group.choices.map(function (choice, oi) {
                return '<button type="button" class="chip" data-aoe-choice="' + oi + '" aria-pressed="false">' + A.esc(choice.choice) +
                  (choice.add ? ' <span>+' + A.money(choice.add) + '</span>' : '') + '</button>';
              }).join('') + '</div></fieldset>';
          }).join('') + '<p class="aoe-unavailable" data-aoe-cold hidden>熱飲不能選擇標示限冷飲的加料。</p>' +
          '<label for="aoe-note-' + index + '">備註</label><input id="aoe-note-' + index + '" type="text" maxlength="40" autocomplete="off" data-aoe-note>' +
          '<div class="aoe-quantity"><span>數量</span><div class="aoe-step"><button type="button" class="btn" data-aoe-step="-1" aria-label="減少 ' + A.esc(label) + ' 的數量">−</button>' +
          '<output data-aoe-qty></output><button type="button" class="btn" data-aoe-step="1" aria-label="增加 ' + A.esc(label) + ' 的數量">＋</button></div>' +
          '<strong data-aoe-subtotal></strong></div></section>';
      }

      function syncLine(el, row) {
        var hot = isHot(row);
        var coldExtras = false;
        el.querySelectorAll('[data-aoe-group]').forEach(function (field, gi) {
          var group = row.groups[gi];
          var ice = A.optionGroupKey(group.n) === '冰塊';
          field.hidden = hot && ice;
          field.querySelector('[data-aoe-group-kind]').textContent = needsChoice(row, group, hot) ? '必選' : group.req ? '選填' : '可複選';
          field.querySelectorAll('[data-aoe-choice]').forEach(function (button, oi) {
            button.disabled = isBlocked(group, group.choices[oi], hot);
            if (button.disabled && !ice) coldExtras = true;
            button.setAttribute('aria-pressed', String(!button.disabled && group.selected.includes(oi)));
          });
        });
        el.querySelector('[data-aoe-cold]').hidden = !coldExtras;
        el.querySelector('[data-aoe-qty]').textContent = row.qty;
        el.querySelector('[data-aoe-step="-1"]').disabled = row.qty <= 1;
        el.querySelector('[data-aoe-step="1"]').disabled = row.qty >= maxQuantity || !!(row.original && row.ref && row.ref.sold && row.qty >= Number(row.original.qty));
        el.querySelector('[data-aoe-subtotal]').textContent = A.money(unitOf(row) * row.qty);
        overlay.querySelector('[data-aoe-total]').textContent = A.money(rows.reduce(function (sum, line) { return sum + unitOf(line) * line.qty; }, 0));
      }

      function render() {
        lines.innerHTML = rows.map(renderLine).join('');
        Array.prototype.forEach.call(lines.children, function (element, index) {
          var row = rows[index];
          element.querySelector('[data-aoe-note]').value = row.note;
          syncLine(element, row);
        });
      }

      var closed=false;
      function cancel(){close(null);}
      function close(result) {
        if(closed)return;closed=true;
        window.removeEventListener('hashchange',cancel);
        window.removeEventListener('lunch:userchange',cancel);
        cancelEditor=null;
        document.removeEventListener('keydown', onKey);
        document.body.style.overflow = previousOverflow;
        overlay.remove();
        openEditor = null;
        if (opener && opener.isConnected) opener.focus();
        resolve(result);
      }

      function finishConfirmation(accepted) {
        var action = confirmAction;
        var previous = returnFocus;
        confirmAction = null;
        confirmation.hidden = true;
        main.forEach(function (part) { part.hidden = false; });
        panel.setAttribute('aria-labelledby', 'aoe-title');
        if (accepted) action();
        else if (previous && previous.isConnected) previous.focus();
      }

      function confirm(title, message, buttonText, button, action) {
        returnFocus = button;
        confirmAction = action;
        main.forEach(function (part) { part.hidden = true; });
        confirmation.hidden = false;
        confirmation.querySelector('h3').textContent = title;
        confirmation.querySelector('[data-aoe-message]').textContent = message;
        confirmationButton.textContent = buttonText;
        panel.setAttribute('aria-labelledby', 'aoe-confirm-title');
        confirmation.querySelector('[data-aoe-back]').focus();
      }

      function onKey(event) {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (confirmAction) finishConfirmation(false);
          else close(null);
          return;
        }
        if (event.key !== 'Tab') return;
        var active = confirmAction ? confirmation : panel;
        var focusable = Array.from(active.querySelectorAll('button:not(:disabled),select:not(:disabled),input:not(:disabled)')).filter(function (element) {
          return !element.closest('[hidden]');
        });
        var first = focusable[0], last = focusable[focusable.length - 1], focused = document.activeElement;
        if (first && (!focusable.includes(focused) || (event.shiftKey ? focused === first : focused === last))) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }

      function preview(button) {
        var invalid = null;
        rows.some(function (row, index) {
          if (!row.ref && !row.original) {
            invalid = lines.children[index].querySelector('[data-aoe-item]');
            error.textContent = '請選擇新增的餐點。';
            return true;
          }
          var hot = isHot(row);
          var groupIndex = row.groups.findIndex(function (optionGroup) {
            return needsChoice(row, optionGroup, hot) && !optionGroup.selected.some(function (choice) {
              return !isBlocked(optionGroup, optionGroup.choices[choice], hot);
            });
          });
          if (groupIndex === -1) return false;
          invalid = lines.children[index].querySelector('[data-aoe-group="' + groupIndex + '"] button:not(:disabled)');
          error.textContent = '請選擇「' + row.groups[groupIndex].n + '」。';
          return true;
        });
        if (invalid) {
          error.hidden = false;
          invalid.focus();
          return;
        }
        var result = rows.map(lineValue);
        if (result.some(function (line) {
          return !Number.isSafeInteger(line.unit) || line.unit < 0 || line.unit > maxUnit ||
            !Number.isSafeInteger(line.qty) || line.qty < 1 || line.qty > maxQuantity;
        })) {
          error.textContent = '餐點金額或數量超出可儲存的範圍。';
          error.hidden = false;
          return;
        }
        if (JSON.stringify(result) === JSON.stringify(originals)) {
          error.textContent = '請先修改餐點、備註或數量。';
          error.hidden = false;
          return;
        }
        var newTotal = result.reduce(function (sum, line) { return sum + A.lineTotal(line); }, 0);
        confirm('儲存訂單修改？', '原餐點金額 ' + A.money(originalTotal) + '，新餐點金額 ' + A.money(newTotal) +
          '。目前' + status + '，金額變動時會重新核對收款。', '儲存修改', button, function () { close(result); });
      }

      function rowIndex(element) {
        return Array.prototype.indexOf.call(lines.children, element.closest('[data-aoe-line]'));
      }

      overlay.addEventListener('input', function (event) {
        if (!event.target.matches('[data-aoe-note]')) return;
        rows[rowIndex(event.target)].note = event.target.value;
        error.hidden = true;
      });
      overlay.addEventListener('change', function (event) {
        if (!event.target.matches('[data-aoe-item]')) return;
        var index = rowIndex(event.target);
        var row = rows[index];
        var ref = available.find(function (entry) { return entry.key === event.target.value; });
        if (event.target.value === 'original') {
          ref = row.originalRef;
          if (ref && ref.sold) row.qty = Math.min(row.qty, Number(row.original.qty));
        }
        selectItem(row, ref);
        render();
        lines.children[index].querySelector('[data-aoe-item]').focus();
        error.hidden = true;
      });
      overlay.addEventListener('click', function (event) {
        var button = event.target.closest('button');
        if (!button || button.disabled) return;
        if (button.matches('[data-aoe-cancel]')) return close(null);
        if (button.matches('[data-aoe-back]')) return finishConfirmation(false);
        if (button.matches('[data-aoe-accept]')) return finishConfirmation(true);
        if (button.matches('[data-aoe-review]')) return preview(button);
        error.hidden = true;
        if (button.matches('[data-aoe-add]')) {
          rows.push(makeRow(null, null));
          render();
          lines.lastElementChild.querySelector('[data-aoe-item]').focus();
          return;
        }
        var index = rowIndex(button);
        if (index < 0) return;
        var row = rows[index];
        if (button.matches('[data-aoe-remove]')) {
          var name = staysOriginal(row) ? row.original.item : row.ref ? row.ref.item.n : '待選餐點';
          return confirm('移除此品項？', '將從這張訂單移除「' + name + '」。', '移除品項', button, function () {
            rows.splice(index, 1);
            render();
            lines.children[Math.min(index, rows.length - 1)].querySelector('[data-aoe-item]').focus();
          });
        }
        if (button.matches('[data-aoe-choice]')) {
          var optGroup = row.groups[Number(button.closest('fieldset').dataset.aoeGroup)];
          var choice = Number(button.dataset.aoeChoice), position = optGroup.selected.indexOf(choice);
          if (optGroup.req) optGroup.selected = position >= 0 && !needsChoice(row, optGroup, isHot(row)) ? [] : [choice];
          else if (position >= 0) optGroup.selected.splice(position, 1);
          else optGroup.selected.push(choice);
        }
        if (button.matches('[data-aoe-step]')) row.qty += Number(button.dataset.aoeStep);
        syncLine(lines.children[index], row);
      });
      render();
      openEditor = overlay;
      cancelEditor=cancel;
      window.addEventListener('hashchange',cancel);
      window.addEventListener('lunch:userchange',cancel);
      document.body.appendChild(overlay);
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', onKey);
      panel.focus();
    });
  }

  window.LunchAdminOrderEditor = { open: open, close: function(){if(cancelEditor)cancelEditor();} };
})();
