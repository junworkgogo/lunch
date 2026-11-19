/* 團購可見名單索引。資料庫規則仍以團購本身為授權依據。 */
(function (root, factory) {
  'use strict';
  var access = factory();
  if (typeof module === 'object' && module.exports) module.exports = access;
  else root.LunchGroupAccess = access;
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';

  // 此政策須和 database.rules.json 中的管理員讀取策略一同切換。
  var adminSeesPrivate = true;
  var own = Object.prototype.hasOwnProperty;

  function uid(user) {
    return String(user && (user.uid || user.id) || '');
  }

  function owner(group, user) {
    return Boolean(uid(user) && group.ownerUserId === uid(user));
  }

  function canView(group, user) {
    if (!group || group.deleted) return false;
    var id = uid(user);
    return group.audience !== 'selected' || owner(group, user) ||
      Boolean(id && group.participants && own.call(group.participants, id) && group.participants[id]) ||
      Boolean(adminSeesPrivate && user && (user.admin || user.isAdmin));
  }

  function activeSourcePaths(user) {
    return ['publicGroupIds'].concat(uid(user) ? ['userGroupIds/' + uid(user)] : []);
  }

  function validKey(key) {
    return typeof key === 'string' && Boolean(key) && !/[.#$\[\]/\x00-\x1F\x7F]/.test(key);
  }

  function permissionDenied(error) {
    return /permission[_-]denied/i.test(String(error && (error.code || error.message) || ''));
  }

  function indexRows(group, gid) {
    var result = {};
    if (!group || group.deleted) return result;
    if (!validKey(gid)) throw new Error('團購編號不正確。');
    var createdAt = Number(group.createdAt) || 0;
    var row = {createdAt: createdAt, deadline: group.deadline, revision: group.accessRevision || 0};
    if (group.audience !== 'selected') {
      result['publicGroupIds/' + gid] = row;
    } else {
      var people = Object.assign(Object.create(null), group.participants);
      if (group.ownerUserId) people[group.ownerUserId] = true;
      Object.keys(people).forEach(function(id) {
        if (validKey(id) && people[id]) result['userGroupIds/' + id + '/' + gid] = row;
      });
    }
    return result;
  }

  function nextGroup(previous, change) {
    var next = Object.assign({}, previous, change);
    next.accessRevision = Number(previous && previous.accessRevision || 0) + 1;
    return next;
  }

  function indexPatch(gid, previous, next) {
    var oldRows = indexRows(previous, gid), newRows = indexRows(next, gid), patch = {};
    Object.keys(oldRows).forEach(function(key) {
      if (!own.call(newRows, key)) patch[key] = null;
    });
    return Object.assign(patch, newRows);
  }

  function buildWrite(gid, previous, change, extra) {
    var next = nextGroup(previous, change);
    var patch = Object.assign({}, extra, indexPatch(gid, previous, next));
    var path = 'groups/' + gid;
    if (!previous) {
      patch[path] = next;
    } else {
      Object.keys(change).forEach(function(key) { patch[path + '/' + key] = change[key]; });
      // Also validate all current roster entries against their companion index writes.
      patch[path + '/participants'] = next.participants || false;
      patch[path + '/accessRevision'] = next.accessRevision;
    }
    return {patch: patch, group: next};
  }

  return {
    adminSeesPrivate: adminSeesPrivate,
    canView: canView,
    activeSourcePaths: activeSourcePaths,
    indexRows: indexRows,
    indexPatch: indexPatch,
    buildWrite: buildWrite,
    permissionDenied: permissionDenied
  };
});
