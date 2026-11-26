(function () {
  'use strict';
  var A = window.LunchApp, pendingInstall = null, bar = null;
  function offline() { return navigator.onLine === false; }
  function syncConnection() {
    if (!bar) {
      bar = document.createElement('p');
      bar.className = 'connection-status';bar.setAttribute('role','status');
      bar.textContent = '網路暫時中斷。請保留購物車，恢復連線後再送出訂單或付款回報。';
      document.body.prepend(bar);
    }
    bar.hidden = !offline();
  }
  window.addEventListener('offline',syncConnection);window.addEventListener('online',syncConnection);syncConnection();
  // Do not allow Firebase's offline write queue to accept a new order/report as an apparent success.
  if (A) ['set','update','writeGroupAccess','updateGroupAccess','transferOrder','removePaths','saveMemberIdentity','transaction'].forEach(function (name) {
    var original = A.DB[name];if (typeof original !== 'function') return;
    A.DB[name] = function () {
      if (offline()) {var error = new Error('網路中斷，尚未送出。請恢復連線後重試。');error.code='network_error';return Promise.reject(error);}
      return original.apply(A.DB,arguments);
    };
  });
  function standalone() {return navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;}
  window.addEventListener('beforeinstallprompt', function (event) {event.preventDefault();pendingInstall=event;});
  window.addEventListener('appinstalled', function () {pendingInstall=null;});
  window.LunchPWA = {install:function () {
    if (standalone()) {A.toast('已經以主畫面模式開啟');return Promise.resolve();}
    if (pendingInstall) {var prompt=pendingInstall;pendingInstall=null;return prompt.prompt().then(function(){return prompt.userChoice;});}
    A.toast(/iPad|iPhone|iPod/.test(navigator.userAgent)?'請在 Safari 點「分享」，再選「加入主畫面」。':'請在瀏覽器選單選「安裝應用程式」或「新增至主畫面」。');return Promise.resolve();
  }};
  if ('serviceWorker' in navigator && window.isSecureContext && !window.LUNCH_TEST_MODE) {
    window.addEventListener('load', function () {navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).then(function(registration){return registration.update();}).catch(function(){/* Browser still works if installation is unavailable. */});});
  }
})();
