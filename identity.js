/* This mapping must match the member name key validation in database.rules.json. */
(function (root) {
  'use strict';

  function key(value) {
    return 'k-' + value.toLowerCase().replace(/[%./$#\[\]]/g, function (char) {
      return '%' + char.charCodeAt(0).toString(16).toUpperCase();
    });
  }

  function fields(name, department) {
    if (typeof name !== 'string' || typeof department !== 'string') return null;
    name = name.trim();
    department = department.trim();
    if (!name || !department || name.length > 30 || department.length > 40 ||
        /[\x00-\x1f\x7f]/.test(name + department)) return null;
    return {name: name, department: department, nameKey: key(name), departmentKey: key(department)};
  }

  function claimPath(identity) {
    var segment = /^k-[^./$#\[\]\x00-\x1f\x7f]+$/;
    if (!identity || typeof identity.departmentKey !== 'string' ||
        typeof identity.nameKey !== 'string' || !segment.test(identity.departmentKey) ||
        !segment.test(identity.nameKey)) return '';
    return 'memberNameClaims/' + identity.departmentKey + '/' + identity.nameKey;
  }

  function sameIdentity(next, previous) {
    return next && previous && next.name === previous.name && next.department === previous.department &&
      next.nameKey === previous.nameKey && next.departmentKey === previous.departmentKey;
  }

  function patch(uid, profile, previous) {
    if (typeof uid !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(uid)) throw new Error('會員資料識別碼無效。');
    var identity = fields(profile.name, profile.department);
    var next = claimPath(identity), old = claimPath(previous);
    if (!next) throw new Error('請填寫有效的姓名與部門。');

    var memberPath = 'members/' + uid + '/';
    var updates = {};
    ['avatar', 'avatarImage', 'updatedAt'].forEach(function (field) {
      updates[memberPath + field] = profile[field];
    });
    if (sameIdentity(identity, previous)) return updates;

    Object.keys(identity).forEach(function (field) {
      updates[memberPath + field] = identity[field];
    });
    updates[next] = uid;
    if (old && old !== next) updates[old] = null;
    return updates;
  }

  var readinessPath = 'identityRegistryState/ready';

  function requireReady(ready) {
    if (ready === true) return;
    var error = new Error('姓名登記目前正在更新。你的修改尚未儲存，請稍後再試。');
    error.code = 'member/identity-registry-updating';
    throw error;
  }

  function save(db, uid, profile, previous) {
    return Promise.resolve().then(function () {
      var identity = fields(profile.name, profile.department);
      if (!identity) throw new Error('請填寫有效的姓名與部門。');

      var changing = !sameIdentity(identity, previous);
      var ready = changing ? db.get(readinessPath).then(requireReady) : Promise.resolve();
      return ready.then(function () {
        return db.saveMemberIdentity(uid, profile, previous).catch(function (error) {
          if (!changing || !/permission[_-]denied/i.test(String(error && error.code || ''))) throw error;
          // The server gate may have closed after the initial read.
          return db.get(readinessPath).then(function (open) {
            requireReady(open);
            return db.get(claimPath(identity)).then(function (owner) {
              if (owner && owner !== uid) {
                var taken = new Error('同部門已有此姓名（英文不分大小寫）。請確認部門或使用公司同事認得的另一個名字。');
                taken.code = 'member/name-taken';
                throw taken;
              }
              throw error;
            }, function () { throw error; });
          }, function () { throw error; });
        });
      });
    });
  }

  var identity = {fields: fields, claimPath: claimPath, patch: patch, save: save};
  if (typeof module === 'object' && module.exports) module.exports = identity;
  else root.LunchIdentity = identity;
})(typeof window === 'undefined' ? globalThis : window);
