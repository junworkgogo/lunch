/* Firebase 網頁設定屬於公開應用設定；權限由 Authentication 與資料庫規則控制。 */
window.LUNCH_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCLzpiNkFesQYvTiS9e9Jh4fMVRr6riQ74',
  authDomain: 'lunch-8ebca.firebaseapp.com',
  databaseURL: 'https://lunch-8ebca-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'lunch-8ebca',
  appId: '1:274380773188:web:47076bc4e03475cff3e911'
};
window.LUNCH_MEMBERS_CONFIG = Object.assign({requireAuth: true, providers: ['google']}, window.LUNCH_MEMBERS_CONFIG || window.LUNCH_MEMBER_CONFIG || {});
window.LUNCH_DEFER_BOOT = true;
