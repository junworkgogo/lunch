(function (window) {
  'use strict';

  const weekdays = ['一', '二', '三', '四', '五', '六', '日'];
  const allDays = weekdays.map((_, index) => index);
  const dayToken = /^(?:(?:週|周|星期|禮拜|礼拜)\s*)?([一二三四五六日天])(?:\s*[-–—－~～〜至到]\s*(?:(?:週|周|星期|禮拜|礼拜)\s*)?([一二三四五六日天]))?/;
  const timeRange = /^(\d{1,2})[:：](\d{2})\s*[-–—－~～〜至到]\s*(\d{1,2})[:：](\d{2})$/;
  const selectionError = '請輸入至少一筆營業時段。';

  function parseDays(text) {
    let rest = text.trim().replace(/[:：]$/, '').trim();
    if (rest === '每天' || rest === '每日') return allDays;
    if (rest === '平日') return allDays.slice(0, 5);
    const days = new Set();
    while (rest) {
      const token = dayToken.exec(rest);
      if (!token) return null;
      const first = weekdays.indexOf(token[1] === '天' ? '日' : token[1]);
      const last = token[2] ? weekdays.indexOf(token[2] === '天' ? '日' : token[2]) : first;
      for (let day = first; ; day = (day + 1) % weekdays.length) {
        days.add(day);
        if (day === last) break;
      }
      rest = rest.slice(token[0].length).trim();
      const separator = /^[、,，\/／．・]+\s*/.exec(rest);
      if (separator) {
        rest = rest.slice(separator[0].length);
        if (!rest) return null;
      }
    }
    return days.size ? [...days] : null;
  }

  function formatTime(hour, minute) {
    if (+hour > 23 || +minute > 59) return null;
    return hour.padStart(2, '0') + ':' + minute;
  }

  function parseHours(value) {
    if (!value.trim()) return { days: [], ranges: [] };

    const groups = [];
    let group;
    const segments = value.trim().replace(/(\d{2})\s*[、,，]/g, '$1；').split(/[；;\n]+/);
    for (const segment of segments) {
      const firstTime = segment.search(/\d{1,2}[:：]\d{2}/);
      if (firstTime < 0) return null;
      const prefix = segment.slice(0, firstTime).trim();
      const match = timeRange.exec(segment.slice(firstTime).trim());
      if (!match) return null;
      const start = formatTime(match[1], match[2]);
      const end = formatTime(match[3], match[4]);
      if (!start || !end) return null;
      if (prefix || !group) {
        const days = prefix ? parseDays(prefix) : allDays;
        if (!days) return null;
        group = { days, ranges: [] };
        groups.push(group);
      }
      group.ranges.push({ start, end });
    }

    const ranges = groups[0].ranges;
    const days = new Set(groups[0].days);
    for (const other of groups.slice(1)) {
      if (serializeRanges(other.ranges) !== serializeRanges(ranges)) return null;
      other.days.forEach(day => days.add(day));
    }
    return { days: allDays.filter(day => days.has(day)), ranges };
  }

  function serializeRanges(ranges) {
    return ranges.map(range => range.start + '–' + range.end).join('；');
  }

  function serializeHours(days, ranges) {
    if (!days.length || !ranges.length) return '';
    return days.map(day => '週' + weekdays[day]).join('、') + ' ' + serializeRanges(ranges);
  }

  function make(tag, className, text) {
    const node = window.document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function action(symbol, label, className, handler) {
    const button = make('button', className, symbol);
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.addEventListener('click', handler);
    return button;
  }

  function mount(source) {
    if (!source || source.dataset.hoursEditor) return;
    source.dataset.hoursEditor = 'true';
    source.required = false;
    source.readOnly = true;
    source.setCustomValidity('');
    source.hidden = true;

    const panel = make('div', 'lh-editor');
    const dayGroup = make('div', 'lh-days');
    dayGroup.setAttribute('role', 'group');
    dayGroup.setAttribute('aria-label', '營業星期');
    const rangeList = make('div', 'lh-ranges');
    const startHeading = make('span', null, '開始時間');
    const endHeading = make('span', null, '結束時間');
    const headings = make('div', 'lh-headings');
    headings.setAttribute('aria-hidden', 'true');
    headings.append(startHeading, endHeading);
    const previous = make('div', 'lh-previous');
    const previousText = make('p');
    const error = make('p', 'lh-error');
    error.id = source.id + '-hours-error';
    error.setAttribute('role', 'status');
    error.hidden = true;
    const dayButtons = weekdays.map((day, index) => {
      const button = action(day, '週' + day, 'lh-day', () => {
        if (days.has(index)) days.delete(index);
        else days.add(index);
        button.setAttribute('aria-pressed', String(days.has(index)));
        commit();
      });
      dayGroup.append(button);
      return button;
    });

    const title = source.labels && source.labels[0];
    let days = new Set();
    let rows = [];
    let original = '';
    let currentValue;
    let writing = false;
    let rowId = 0;

    function setOriginal(value) {
      original = value;
      previous.hidden = !value;
      previousText.textContent = value ? '原有營業時間：' + value : '';
    }

    function timeInput(titleText, id, value) {
      const input = make('input', 'lh-time');
      input.id = id;
      input.type = 'time';
      input.dataset.hoursNative = 'true';
      input.setAttribute('aria-label', titleText);
      input.setAttribute('aria-describedby', error.id);
      input.value = value;
      input.addEventListener('input', commit);
      input.addEventListener('change', commit);
      return input;
    }

    function showActions() {
      rows.forEach((row, index) => {
        const label = '第 ' + (index + 1) + ' 筆';
        row.start.setAttribute('aria-label', label + '開始時間');
        row.end.setAttribute('aria-label', label + '結束時間');
        row.remove.setAttribute('aria-label', '移除' + label + '營業時段');
        row.remove.hidden = rows.length === 1 && !row.start.value && !row.end.value && !row.start.validity.badInput && !row.end.validity.badInput;
        row.add.hidden = index !== rows.length - 1;
      });
      if (title) title.htmlFor = rows[0].start.id;
    }

    function addRange(range) {
      const id = source.id + '-range-' + (++rowId);
      const node = make('div', 'lh-range');
      const start = timeInput('開始時間', id + '-start', range ? range.start : '');
      const end = timeInput('結束時間', id + '-end', range ? range.end : '');
      const actions = make('div', 'lh-actions');
      const add = action('＋', '新增營業時段', 'lh-action lh-add', () => {
        const next = addRange();
        showActions();
        next.start.focus();
      });
      const remove = action('×', '移除營業時段', 'lh-action lh-remove', () => {
        const index = rows.indexOf(row);
        rows.splice(index, 1);
        node.remove();
        if (!rows.length) addRange();
        commit();
        rows[Math.min(index, rows.length - 1)].start.focus();
      });
      const row = { start, end, add, remove };
      actions.append(add, remove);
      node.append(start, end, actions);
      rangeList.append(node);
      rows.push(row);
      return row;
    }

    function validate() {
      let invalid = null;
      rows.forEach(row => {
        let startError = '';
        let endError = '';
        if (row.start.validity.badInput || (row.end.value && !row.start.value)) startError = '請選好開始時間。';
        if (row.end.validity.badInput || (row.start.value && !row.end.value)) endError = '請選好結束時間。';
        row.start.setCustomValidity(startError);
        row.end.setCustomValidity(endError);
        if (!invalid && (startError || endError)) invalid = startError ? row.start : row.end;
      });
      const ranges = rows.filter(row => row.start.value && row.end.value)
        .map(row => ({ start: row.start.value, end: row.end.value }));
      if (!invalid && ranges.length && !days.size) {
        invalid=rows[0].start;invalid.setCustomValidity('請選擇營業星期。');
      }
      if (!invalid && days.size && !ranges.length) {
        invalid = rows[0].start;
        invalid.setCustomValidity(selectionError);
      }
      error.hidden = !invalid;
      error.textContent = invalid ? invalid.validationMessage : '';
      return { invalid, ranges };
    }

    function commit() {
      showActions();
      const { invalid, ranges } = validate();
      if (invalid || (original && (!days.size || !ranges.length))) return;
      const value = serializeHours(allDays.filter(day => days.has(day)), ranges);
      setOriginal('');
      writeSource(value);
    }

    function writeSource(value) {
      if (value === source.value) return;
      writing = true;
      try {
        source.value = currentValue = value;
        source.dispatchEvent(new window.Event('input', { bubbles: true }));
        source.dispatchEvent(new window.Event('change', { bubbles: true }));
      } finally {
        writing = false;
      }
    }

    function load() {
      if (writing) return;
      currentValue = source.value;
      const parsed = parseHours(currentValue);
      setOriginal(parsed ? '' : currentValue);
      days = new Set(parsed ? parsed.days : []);
      dayButtons.forEach((button, index) => button.setAttribute('aria-pressed', String(days.has(index))));
      rangeList.replaceChildren();
      rows = [];
      if (parsed && parsed.ranges.length) parsed.ranges.forEach(addRange);
      else addRange();
      showActions();
      validate();
    }

    const clearOriginal = action('×', '移除原有營業時間', 'lh-action lh-remove', () => {
      // Remove unparsed data only through an explicit action or a complete replacement.
      setOriginal('');
      writeSource('');
      validate();
      dayButtons[0].focus();
    });
    previous.append(previousText, clearOriginal);
    panel.append(previous, dayGroup, headings, rangeList, error);
    source.after(panel);

    // Assignments made by the existing menu importer do not dispatch input events.
    const value = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(source), 'value');
    Object.defineProperty(source, 'value', {
      configurable: true,
      get() { return value.get.call(this); },
      set(next) {
        value.set.call(this, next);
        load();
      },
    });
    function sourceChanged() {
      if (source.value !== currentValue) load();
    }
    source.addEventListener('input', sourceChanged);
    source.addEventListener('change', sourceChanged);
    if (source.form) {
      source.form.addEventListener('reset', event => {
        window.setTimeout(() => {
          if (!event.defaultPrevented) load();
        }, 0);
      });
      // The existing editor uses novalidate and installs its save listener on this form.
      source.form.addEventListener('submit', event => {
        sourceChanged();
        const { invalid } = validate();
        if (!invalid) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        invalid.focus();
        invalid.reportValidity();
      }, true);
    }
    load();
  }

  window.LunchHours = { mount, parseHours, serializeHours };
})(typeof window === 'undefined' ? globalThis : window);
