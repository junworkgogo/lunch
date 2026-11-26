(function () {
  'use strict';

  const faces = {
    noGroups: [
      ["(´;ω;`)", '午餐隊友還在路上。'],
      ["(´･ω･`)", '先想想今天要吃什麼。'],
      ['( ˘ω˘ )', '安靜等一聲開團。']
    ],
    noOrder: [
      ['(・ω・)', '購物車還在等第一道菜。'],
      ['(・∀・)', '從想吃的那道開始。'],
      ['( ˘ω˘ )', '慢慢挑，午餐由你決定。']
    ],
    groupOpen: [
      ['(・∀・)ノ', '開放點餐。'],
      ['(＾ω＾)', '今天也一起吃飯吧。'],
      ['(・ω・)ノ', '午餐隊友集合。']
    ],
    groupCreated: [
      ['(＾▽＾)', '揪飯成功。'],
      ['(・∀・)ノ', '午餐隊友可以集合了。'],
      ['(＾ω＾)', '謝謝你揪大家吃飯。']
    ],
    orderSuccess: [
      ['(＾▽＾)', '餐點點好啦。'],
      ['(＾ω＾)', '可以開始期待午餐了。'],
      ['(・∀・)ノ', '期待今天這一餐。'],
      ['ヽ(•‿•)ノ', '餐點點好啦。'],
      ['(๑´ㅂ`๑)', '可以開始期待午餐了。'],
      ['(｡◕‿◕｡)', '期待今天這一餐。'],
      ['(o´罒`o)', '餐點點好啦。'],
      ['٩(ˊᗜˋ*)و', '可以開始期待午餐了。'],
      ['(*´ω`*)', '期待今天這一餐。'],
      ['(ﾉ◕ヮ◕)ﾉ', '餐點點好啦。'],
      ['(⁰▿⁰)', '可以開始期待午餐了。'],
      ['(๑˃̵ᴗ˂̵)', '期待今天這一餐。']
    ],
    closed: [
      ['( ˘ω˘ )', '下次開團再見。'],
      ['(・ω・)', '這一團先到這裡。'],
      ['(・_・)', '等下一次一起吃飯。']
    ],
    noHistory: [
      ['(・ω・)', '這裡還很安靜。'],
      ['( ˘ω˘ )', '等第一筆午餐紀錄。'],
      ['(・_・)', '午餐紀錄會留在這裡。']
    ],
    unpaid: [
      ['(・ω・)', '付款後可向收款人確認。'],
      ['(・_・)', '付款前請核對金額。'],
      ['( ˘ω˘ )', '付款前請確認收款人。']
    ],
    paymentReported: [
      ['(・ω・)ノ', '已回報，等待收款人核對。'],
      ['(・_・)', '收款人確認後會更新狀態。'],
      ['( ˘ω˘ )', '先讓收款人核對一下。']
    ],
    paymentConfirmed: [
      ['(＾ω＾)', '收款已確認。'],
      ['(＾▽＾)', '這筆款項已確認。'],
      ['(・∀・)ノ', '已完成收款核對。']
    ],
    noNotifications: [
      ['( ˘ω˘ )', '今天的通知欄很安靜。'],
      ['(・ω・)', '有新通知會出現在這裡。'],
      ['(・_・)', '可以先去看看午餐。']
    ],
    noResults: [
      ['(・_・)', '可以試試較短的品名。'],
      ['(・ω・)', '換個關鍵字再找找。'],
      ['( ˘ω˘ )', '也可以清除搜尋，看看完整菜單。']
    ],
    offline: [
      ['(・_・)', '網路連線已中斷。'],
      ['( ˘ω˘ )', '連線後再試一次。'],
      ['(・ω・)', '請確認網路連線。']
    ],
    maintenance: [
      ['(・_・)', '系統維護中。'],
      ['( ˘ω˘ )', '維護期間請稍候。'],
      ['(・ω・)', '請稍後再回來。']
    ]
  };

  const weekdayGreetings = {
    Mon: ['(・ω・)ノ', '星期一也要好好吃飯。'],
    Wed: ['( ˘ω˘ )', '星期三，這個星期過一半了。'],
    Fri: ['(＾▽＾)ノ', '星期五，再吃一餐就迎接週末。'],
    Weekend: ['(－ω－)', '週末也別忘了好好休息。']
  };
  const solarGreetings = {
    '12/25': ['(＾ω＾)☆', '聖誕快樂，今天吃點喜歡的。'],
    '12/31': ['(＾▽＾)ノ', '跨年愉快，今晚也要好好吃飯。']
  };
  const lunarGreetings = {
    '1/1': ['(＾▽＾)ノ', '新年快樂，祝你每一餐都吃得開心。'],
    '1/15': ['(・ω・)', '元宵快樂，今天想吃哪種湯圓？'],
    '5/5': ['(＾ω＾)', '端午安康，今天吃顆喜歡的粽子。'],
    '8/15': ['( ˘ω˘ )', '中秋快樂，記得留點肚子吃月餅。']
  };
  const easterEgg = ['(＾ω－)☆', '被你發現了！'];

  const slot = '[data-lunch-kaomoji]';
  const greetingSlot = '[data-kaomoji-greeting]';
  const daypartSlot = '[data-kaomoji-daypart]';
  const markers = `${slot},${greetingSlot},${daypartSlot}`;
  const success = new Set(['groupCreated', 'orderSuccess', 'paymentConfirmed']);

  function calendarParts(date, calendar, options, DateTimeFormat) {
    const formatter = new DateTimeFormat(`en-u-ca-${calendar}-nu-latn`, {
      timeZone: 'Asia/Taipei', ...options
    });
    if (formatter.resolvedOptions().calendar !== calendar) return {};
    return Object.fromEntries(formatter.formatToParts(date).map(({ type, value }) => [type, value]));
  }

  function greeting(date = new Date(), DateTimeFormat = typeof Intl === 'object' && Intl.DateTimeFormat) {
    let solar;
    try {
      solar = calendarParts(date, 'gregory', { weekday: 'short', month: 'numeric', day: 'numeric' }, DateTimeFormat);
    } catch (_) {
      return undefined;
    }
    const holiday = solarGreetings[`${solar.month}/${solar.day}`];
    if (holiday) return holiday;

    try {
      const lunar = calendarParts(date, 'chinese', { month: 'numeric', day: 'numeric' }, DateTimeFormat);
      // Exact numeric matches skip leap months, which Intl labels separately (e.g. 8bis).
      const lunarHoliday = lunarGreetings[`${lunar.month}/${lunar.day}`];
      if (lunarHoliday) return lunarHoliday;
    } catch (_) {
      // Some engines have Gregorian support but lack the Chinese calendar.
    }

    if (solar.weekday === 'Sat' || solar.weekday === 'Sun') return weekdayGreetings.Weekend;
    return weekdayGreetings[solar.weekday];
  }

  function daypart(date = new Date(), DateTimeFormat = typeof Intl === 'object' && Intl.DateTimeFormat) {
    let hour;
    try {
      hour = Number(calendarParts(date, 'gregory', { hour: 'numeric', hourCycle: 'h23' }, DateTimeFormat).hour);
    } catch (_) {
      return '';
    }
    if (!Number.isInteger(hour)) return '';
    if (hour < 5 || hour >= 23) return '這麼晚了，明天再吃吧。';
    if (hour < 11) return '早安！今天想吃什麼？';
    if (hour < 14) return '午安！今天有好好吃飯嗎？';
    if (hour < 18) return '辛苦了，休息一下吧！';
    return '今天辛苦了，明天也要好好吃飯！';
  }

  function createSelection(random = Math.random) {
    let route;
    let choices = new Map();
    let firstHomeFace = true;

    function get(kind) {
      if (!Object.prototype.hasOwnProperty.call(faces, kind)) return undefined;
      if (!choices.has(kind)) {
        const useOriginal = kind === 'noGroups' && firstHomeFace;
        if (kind === 'noGroups') firstHomeFace = false;
        const index = useOriginal ? 0 : Math.floor(random() * faces[kind].length);
        choices.set(kind, { index, entry: faces[kind][index], changed: false });
      }
      return choices.get(kind);
    }

    return {
      enter(nextRoute) {
        if (nextRoute === route) return false;
        route = nextRoute;
        choices = new Map();
        return true;
      },
      get,
      next(kind) {
        const current = get(kind);
        if (!current) return undefined;
        const entries = faces[kind];
        const spread = random();
        const mayShowEgg = kind === 'noGroups' && current.index !== -1;
        const chance = mayShowEgg ? 0.08 : 0;
        const alternatives = entries.map((_, index) => index).filter(index => index !== current.index);
        const sample = (spread - chance) / (1 - chance);
        const index = spread < chance ? -1 : alternatives[Math.floor(sample * alternatives.length)];
        const choice = { index, entry: index === -1 ? easterEgg : entries[index], changed: true };
        choices.set(kind, choice);
        return choice;
      }
    };
  }

  function install(window) {
    const { document, location, MutationObserver } = window;
    if (!MutationObserver) return;
    const selection = createSelection();
    const mounted = new WeakMap();
    let lastOrderSuccess = '';
    try { lastOrderSuccess = window.sessionStorage.getItem('lunch_last_success_face') || ''; } catch (_) {}
    function nextOrderSuccess() {
      const candidates = faces.orderSuccess.filter(entry => entry[0] !== lastOrderSuccess);
      const entry = candidates[Math.floor(Math.random() * candidates.length)];
      lastOrderSuccess = entry[0];
      try { window.sessionStorage.setItem('lunch_last_success_face', lastOrderSuccess); } catch (_) {}
      return { entry, changed: false };
    }

    function show(element, animate = false) {
      if (element.matches(greetingSlot)) {
        const [face, message] = greeting() || [];
        const text = face ? `${face} ${message}` : '';
        if (element.textContent === text) return;
        if (!face) {
          element.replaceChildren();
          return;
        }
        const decorative = document.createElement('span');
        decorative.className = 'kaomoji-face';
        decorative.setAttribute('aria-hidden', 'true');
        decorative.textContent = face;
        element.replaceChildren(decorative, ` ${message}`);
        return;
      }
      if (element.matches(daypartSlot)) {
        const text = daypart();
        if (element.textContent !== text) element.textContent = text;
        return;
      }
      const kind = element.getAttribute('data-lunch-kaomoji');
      let view = mounted.get(element);
      const choice = kind === 'orderSuccess' ? (view?.kind === kind ? view.choice : nextOrderSuccess()) : selection.get(kind);
      if (!choice) {
        if (view) {
          mounted.delete(element);
          element.classList.remove('kaomoji-widget', 'kaomoji-success');
          element.replaceChildren();
        }
        return;
      }
      const interactive = element.hasAttribute('data-kaomoji-interactive');
      if (view?.kind !== kind || view.interactive !== interactive) {
        const face = document.createElement('span');
        face.className = 'kaomoji-face';
        face.setAttribute('aria-hidden', 'true');
        let control, copy;
        if (interactive) {
          copy = document.createElement('span');
          copy.className = 'kaomoji-copy';
          copy.setAttribute('role', 'status');
          control = document.createElement('button');
          control.className = 'kaomoji-interaction';
          control.type = 'button';
          control.setAttribute('aria-label', '換個表情');
          control.append(face);
          control.addEventListener('click', () => {
            selection.next(kind);
            show(element, true);
          });
          face.addEventListener('animationend', () => face.classList.remove('kaomoji-swap'));
        }
        element.classList.add('kaomoji-widget');
        element.classList.toggle('kaomoji-success', success.has(kind));
        if (control) element.replaceChildren(control, copy);
        else element.replaceChildren(face);
        view = { kind, interactive, face, copy, choice };
        mounted.set(element, view);
      }

      const [face, copy] = choice.entry;
      const message = choice.changed ? copy : '';
      if (view.face.textContent !== face) view.face.textContent = face;
      if (view.copy && view.copy.textContent !== message) view.copy.textContent = message;
      if (animate) view.face.classList.add('kaomoji-swap');
    }

    function enterRoute() {
      if (selection.enter(location.hash || '#/')) document.querySelectorAll(markers).forEach(element => show(element));
    }

    function addedMarkers(records) {
      const elements = new Set();
      for (const record of records) {
        if (record.type === 'attributes') elements.add(record.target);
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches(markers)) elements.add(node);
          node.querySelectorAll(markers).forEach(element => elements.add(element));
        }
      }
      return elements;
    }

    function start() {
      enterRoute();
      new MutationObserver(records => {
        const elements = addedMarkers(records);
        if (!elements.size) return;
        enterRoute();
        elements.forEach(element => {
          if (element.isConnected) show(element);
        });
      }).observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['data-lunch-kaomoji', 'data-kaomoji-interactive']
      });
      window.addEventListener('hashchange', enterRoute);
      window.addEventListener('popstate', enterRoute);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) return;
        document.querySelectorAll(`${greetingSlot},${daypartSlot}`).forEach(element => show(element));
      });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
  }

  if (typeof module === 'object' && module.exports) module.exports = { createSelection, daypart, greeting, install };
  else if (typeof window === 'object') install(window);
})();
