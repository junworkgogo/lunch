(function () {
  'use strict';

  const icons = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    shops: '<path d="M3 10l2-6h14l2 6M4 13v7h16v-7M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>',
    orders: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6m-6 4h6"/>',
    account: '<circle cx="12" cy="8" r="3.3"/><path d="M5 20v-1a7 7 0 0 1 14 0v1"/>'
  };

  function icon(name) {
    const frame = document.createElement('span');
    frame.className = 'mobile-nav-icon';
    frame.setAttribute('aria-hidden', 'true');
    frame.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + icons[name] + '</svg>';
    return frame;
  }

  function textLabel(value) {
    const label = document.createElement('span');
    label.textContent = value;
    return label;
  }

  function mount() {
    const page = document.documentElement;
    const top = document.querySelector('header.top > .top-in');
    const desktopNav = top && top.querySelector('.nav');
    if (!desktopNav || page.classList.contains('mobile-nav-ready')) return;

    const account = document.createElement('a');
    account.className = 'mobile-account-link';
    const nav = document.createElement('nav');
    nav.className = 'mobile-bottom-nav';
    nav.setAttribute('aria-label', '手機主選單');
    const links = new Map();
    for (const [key, label, href] of [
      ['home', '首頁', '#/'],
      ['shops', '店家', '#/shops'],
      ['orders', '訂單', '#/members/orders']
    ]) {
      const link = document.createElement('a');
      link.className = 'mobile-nav-link';
      link.href = href;
      link.append(icon(key), textLabel(label));
      if (key === 'orders') link.setAttribute('aria-label', '我的訂單');
      links.set(key, link);
      nav.append(link);
    }
    top.append(account);
    document.body.append(nav);

    let avatarSource;
    let accountTarget;
    function syncAccount() {
      const profile = desktopNav.querySelector('.member-nav-profile');
      const avatar = profile && profile.querySelector('.member-avatar');
      const target = profile ? profile.getAttribute('href') : '#/members/login';
      if (avatar === avatarSource && target === accountTarget) return;
      avatarSource = avatar;
      accountTarget = target;
      account.href = target;
      account.setAttribute('aria-label', profile ? '我的會員資料' : '會員登入');
      account.replaceChildren(avatar ? avatar.cloneNode(true) : icon('account'));
      if (!profile) account.append(textLabel('登入'));
    }

    function syncCurrentPage() {
      const route = location.hash.replace(/^#/, '').split('?')[0].replace(/\/+$/, '');
      const area = route.split('/')[1] || '';
      const orders = route === '/members/orders' || route.startsWith('/members/orders/');
      const pendingOrders = route === '/members/login' &&
        new URLSearchParams(location.hash.split('?')[1]).get('next') === '#/members/orders';
      const selected = orders || pendingOrders ? 'orders' :
        area === 'shops' ? 'shops' :
        ['', 'g', 'new', 'history', 'my-groups'].includes(area) ? 'home' : '';
      links.forEach((link, key) => {
        if (key === selected) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
      if (area === 'members' && !selected) account.setAttribute('aria-current', 'page');
      else account.removeAttribute('aria-current');
    }

    const viewport = window.visualViewport;
    const mobile = window.matchMedia('(max-width: 768px)');
    function syncKeyboard() {
      if (!viewport) return;
      const active = document.activeElement;
      const editing = active && active.matches('input:not([readonly],[disabled],[type=checkbox],[type=radio],[type=button],[type=submit],[type=file],[type=range]),textarea:not([readonly],[disabled]),[contenteditable=true]');
      const keyboardOpen = mobile.matches && editing && Math.abs(viewport.scale - 1) < .02 &&
        window.innerHeight - viewport.height > 110;
      page.classList.toggle('mobile-nav-keyboard-open', Boolean(keyboardOpen));
      if (keyboardOpen) {
        const offset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
        page.style.setProperty('--mobile-keyboard-offset', offset + 'px');
        page.style.setProperty('--mobile-visible-height', viewport.height + 'px');
      } else {
        page.style.removeProperty('--mobile-keyboard-offset');
        page.style.removeProperty('--mobile-visible-height');
      }
    }

    const observer = new MutationObserver(syncAccount);
    observer.observe(desktopNav, { childList: true, subtree: true });
    window.addEventListener('lunch:userchange', syncAccount);
    window.addEventListener('hashchange', syncCurrentPage);
    if (viewport) {
      viewport.addEventListener('resize', syncKeyboard);
      viewport.addEventListener('scroll', syncKeyboard);
      document.addEventListener('focusin', syncKeyboard);
      document.addEventListener('focusout', syncKeyboard);
    }

    syncAccount();
    syncCurrentPage();
    page.classList.add('mobile-nav-ready');

    window.addEventListener('pagehide', function teardown(event) {
      if (event.persisted) return;
      observer.disconnect();
      window.removeEventListener('lunch:userchange', syncAccount);
      window.removeEventListener('hashchange', syncCurrentPage);
      window.removeEventListener('pagehide', teardown);
      if (viewport) {
        viewport.removeEventListener('resize', syncKeyboard);
        viewport.removeEventListener('scroll', syncKeyboard);
        document.removeEventListener('focusin', syncKeyboard);
        document.removeEventListener('focusout', syncKeyboard);
      }
      page.classList.remove('mobile-nav-ready', 'mobile-nav-keyboard-open');
      page.style.removeProperty('--mobile-keyboard-offset');
      page.style.removeProperty('--mobile-visible-height');
      account.remove();
      nav.remove();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
