(function () {
  'use strict';

  const weekdays = '一二三四五六日';
  const allDays = Array.from(weekdays, (_, day) => day);
  const englishDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayToken = /^(?:(?:每)?(?:週|周|星期|禮拜|礼拜)\s*)?([一二三四五六日天])(?:\s*[-–—~〜至到]\s*(?:(?:週|周|星期|禮拜|礼拜)\s*)?([一二三四五六日天]))?/;
  const timeRange = /^(\d{1,2}):(\d{2})\s*[-–—~〜至到]\s*(\d{1,2}):(\d{2})$/;
  const hoursValue = /\d{1,2}:\d{2}|24\s*小時|全天(?:營業)?|(?:公休|店休|休息|不營業|未營業)/;
  const closedValue = /^(?:公休|店休|休息|不營業|未營業)$/;
  const taipeiClock = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Taipei', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });

  function parseDays(value) {
    if (value === '每天' || value === '每日') return allDays;
    if (value === '平日') return allDays.slice(0, 5);
    if (value === '週末' || value === '周末') return allDays.slice(5);

    const days = new Set();
    let rest = value;
    while (rest) {
      const token = dayToken.exec(rest);
      if (!token) return null;
      const first = weekdays.indexOf(token[1].replace('天', '日'));
      const last = token[2] ? weekdays.indexOf(token[2].replace('天', '日')) : first;
      for (let day = first; ; day = (day + 1) % 7) {
        days.add(day);
        if (day === last) break;
      }
      rest = rest.slice(token[0].length).trim();
      const separator = /^[、,/·・.]+\s*/.exec(rest);
      if (separator) {
        rest = rest.slice(separator[0].length);
        if (!rest) return null;
      }
    }
    return days.size ? [...days] : null;
  }

  function parseRange(value) {
    if (/^(?:24\s*小時(?:營業)?|全天(?:營業)?)$/.test(value)) return { start: 0, end: 1440 };
    const match = timeRange.exec(value);
    if (!match) return null;

    const [, startHour, startMinute, endHour, endMinute] = match.map(Number);
    if (startHour > 23 || startMinute > 59 || endHour > 24 || endMinute > 59 || (endHour === 24 && endMinute !== 0)) return null;
    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;
    return start === end ? null : { start, end };
  }

  function parseHours(value) {
    if (typeof value !== 'string' || !value.trim()) return null;

    const hoursByDay = allDays.map(() => []);
    const closed = new Set();
    const segments = value.normalize('NFKC').trim()
      .replace(/(\d{1,2}:\d{2}|小時(?:營業)?|全天(?:營業)?|公休|店休|休息|不營業|未營業)\s*[、,]/g, '$1;')
      .split(/(?:\s*;\s*|\s*[\r\n]+\s*)/);
    let days;
    for (const segment of segments) {
      const valueStart = segment.search(hoursValue);
      if (valueStart < 0) return null;
      const prefix = segment.slice(0, valueStart).replace(/:\s*$/, '').trim();
      const slot = segment.slice(valueStart).trim();
      if (prefix || !days) days = prefix ? parseDays(prefix) : allDays;
      if (!days) return null;

      if (closedValue.test(slot)) {
        if (days.some(day => hoursByDay[day].length)) return null;
        days.forEach(day => closed.add(day));
      } else {
        const range = parseRange(slot);
        if (!range || days.some(day => closed.has(day))) return null;
        days.forEach(day => hoursByDay[day].push(range));
      }
    }

    return { hoursByDay, closed };
  }

  function parseClosures(value) {
    const days = new Set();
    if (value == null) return { days, unknown: false };
    if (typeof value !== 'string') return { days, unknown: true };

    const text = value.normalize('NFKC').trim();
    if (!text || /^(?:無|無休|無公休|全年無休|全年無公休)$/.test(text)) return { days, unknown: false };

    let unknown = false;
    for (const part of text.split(/[、,/;\r\n]/)) {
      const rule = part.trim().replace(/(?:公休|店休|休息)$/, '').trim();
      const closedDays = parseDays(rule);
      if (closedDays) closedDays.forEach(day => days.add(day));
      else unknown = true;
    }
    return { days, unknown };
  }

  function readClock(timestamp) {
    if (typeof timestamp === 'string') {
      if (!/T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestamp)) return null;
      timestamp = Date.parse(timestamp);
    } else if (timestamp instanceof Date) {
      timestamp = timestamp.getTime();
    }
    if (!Number.isFinite(timestamp) || !Number.isFinite(new Date(timestamp).getTime())) return null;

    const parts = Object.fromEntries(taipeiClock.formatToParts(timestamp).map(part => [part.type, part.value]));
    const day = englishDays.indexOf(parts.weekday);
    return { day, minute: Number(parts.hour) * 60 + Number(parts.minute) };
  }

  function stateOf(shop, timestamp) {
    const clock = readClock(timestamp);
    if (!shop || !clock) return 'unknown';

    const { day, minute } = clock;
    const closures = parseClosures(shop.closedDays);
    if (closures.days.has(day)) return 'resting';

    const schedule = parseHours(shop.hours);
    if (!schedule) return 'unknown';
    if (schedule.closed.has(day)) return 'resting';
    if (closures.unknown) return 'unknown';

    const { hoursByDay } = schedule;
    const today = hoursByDay[day];
    const previousDay = (day + 6) % 7;
    const yesterday = closures.days.has(previousDay) ? [] : hoursByDay[previousDay];
    if (today.some(({ start, end }) => minute >= start && (end < start || minute < end))) return 'active';
    if (yesterday.some(({ start, end }) => end < start && minute < end)) return 'active';
    return 'resting';
  }

  const api = { stateOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.LunchShopHours = api;
})();
