(function () {
  'use strict';

  var sections = [
    {
      id: 'profile',
      selector: '.member-profile',
      label: '個人資料',
      icon: '<circle cx="12" cy="8" r="3.2"/><path d="M5 20v-1.5a4.5 4.5 0 0 1 4.5-4.5h5a4.5 4.5 0 0 1 4.5 4.5V20"/>'
    },
    {
      id: 'payment',
      selector: '[data-payinfo]',
      label: '收款資料',
      icon: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18m-14 4.5h4"/>'
    },
    {
      id: 'members',
      selector: '.member-role-admin',
      label: '會員管理',
      icon: '<circle cx="10" cy="8" r="3"/><path d="M3.5 20v-1.5a4.5 4.5 0 0 1 4.5-4.5h4a4.5 4.5 0 0 1 4.5 4.5V20m.5-14.5a2.8 2.8 0 0 1 0 5.5m1.5 3.5a4 4 0 0 1 2 3.5V20"/>'
    }
  ];

  function mount(root, user) {
    var dashboard = root.querySelector('.member-dashboard');
    if (!dashboard || dashboard.classList.contains('account-tabs')) return;

    var available = [];
    sections.forEach(function (section) {
      if (section.id === 'members' && !(user && user.roleManager)) return;
      var panel = dashboard.querySelector(section.selector);
      if (panel) available.push({section: section, panel: panel});
    });
    if (available.length < 2) return;

    var sidebar = document.createElement('aside');
    sidebar.className = 'account-sidebar';
    var identity = document.createElement('div');
    identity.className = 'account-identity';
    var sourceAvatar = dashboard.querySelector('[data-profile-avatar]');
    if (sourceAvatar) { var sidebarAvatar = sourceAvatar.cloneNode(true); sidebarAvatar.removeAttribute('data-profile-avatar'); identity.appendChild(sidebarAvatar); }
    var identityText = document.createElement('div');
    var identityName = document.createElement('strong');
    identityName.textContent = user.name || '午餐夥伴';
    var identityDepartment = document.createElement('span');
    identityDepartment.textContent = user.department || '尚未設定部門';
    identityText.append(identityName, identityDepartment);
    identity.appendChild(identityText);
    sidebar.appendChild(identity);
    var tablist = document.createElement('div');
    tablist.className = 'account-tab-list';
    tablist.setAttribute('role', 'tablist');
    tablist.setAttribute('aria-label', '我的帳號');
    tablist.setAttribute('aria-orientation', matchMedia('(max-width: 768px)').matches ? 'horizontal' : 'vertical');
    var media = matchMedia('(max-width: 768px)');
    function orientation() {
      if (!tablist.isConnected) { media.removeEventListener('change', orientation); return; }
      tablist.setAttribute('aria-orientation', media.matches ? 'horizontal' : 'vertical');
    }
    media.addEventListener('change', orientation);
    tablist.style.setProperty('--account-tab-count', available.length);

    var indicator = document.createElement('span');
    indicator.className = 'account-tab-slider';
    indicator.setAttribute('aria-hidden', 'true');
    tablist.appendChild(indicator);

    var panels = document.createElement('div');
    panels.className = 'account-tab-panels';
    available.forEach(function (view, index) {
      var tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'account-tab';
      tab.id = 'account-tab-' + view.section.id;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', 'account-panel-' + view.section.id);
      tab.innerHTML =
        '<span class="account-tab-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">' +
        view.section.icon + '</svg></span><span class="account-tab-label">' + view.section.label + '</span>';
      tab.addEventListener('click', function () { select(index); });
      tab.addEventListener('keydown', function (event) {
        var next = index;
        if (media.matches && /^(ArrowUp|ArrowDown)$/.test(event.key)) return;
        if (!media.matches && /^(ArrowLeft|ArrowRight)$/.test(event.key)) return;
        switch (event.key) {
          case 'ArrowUp':
          case 'ArrowLeft': next = (index + available.length - 1) % available.length; break;
          case 'ArrowDown':
          case 'ArrowRight': next = (index + 1) % available.length; break;
          case 'Home': next = 0; break;
          case 'End': next = available.length - 1; break;
          default: return;
        }
        event.preventDefault();
        select(next);
        available[next].tab.focus({preventScroll: true});
        if (media.matches) available[next].tab.scrollIntoView({block: 'nearest', inline: 'nearest'});
      });

      var panel = document.createElement('div');
      panel.id = 'account-panel-' + view.section.id;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', tab.id);
      panel.tabIndex = 0;
      panel.appendChild(view.panel);
      view.panel = panel;
      view.tab = tab;
      tablist.appendChild(tab);
    });

    function select(index) {

      tablist.style.setProperty('--account-active-tab', index);
      available.forEach(function (view, tabIndex) {
        var selected = index === tabIndex;
        view.tab.setAttribute('aria-selected', String(selected));
        view.tab.tabIndex = selected ? 0 : -1;
        view.panel.hidden = !selected;
      });
    }

    select(0);
    available.forEach(function (view) { panels.appendChild(view.panel); });
    sidebar.appendChild(tablist);
    dashboard.prepend(sidebar, panels);
    dashboard.classList.add('account-tabs');
  }

  window.LunchAccount = {mount: mount};
})();
