'use strict';
// Public iding.tw menu response. Nested combos are omitted rather than losing their required choices.
function convert(data, label) {
  if (!data || !Array.isArray(data.entrees) || !Array.isArray(data.options) || !Array.isArray(data.option_items)) throw new Error('菜單格式已變更');
  const map = rows => new Map((rows || []).map(row => [row.index, row]));
  const choices = map(data.option_items), options = map(data.options), categories = map(data.categories), subs = map(data.subcategories);
  const cats = [], byCategory = new Map();
  let skipped = 0, omittedUpgrades = 0;
  const integer = value => Number.isInteger(value) && Math.abs(value) <= 1000000;
  const visible = row => row && !row.disabled && !row.hidden && !row.store_only &&
    (row.price_overwrite?.base?.app == null || row.price_overwrite.base.app === row.price);
  for (const entree of data.entrees.slice(0, 500)) {
    if (!visible(entree) || entree.combo_only) continue;
    if (entree.prompt_price || entree.prompt_quantity || (entree.collection_indexes || []).length || !integer(entree.price) || entree.price < 0) { skipped++; continue; }
    const n = label(entree.name), g = [], extras = [];
    let p = entree.price, unsupported = !n;
    const seen = new Set();
    for (const index of entree.option_indexes || []) {
      if (seen.has(index)) continue; seen.add(index);
      const option = options.get(index);
      if (!visible(option)) { unsupported = true; break; }
      if (option.option_group_id || Number.isInteger(option.option_group_id) || (option.qty_max || 0) > 1 || (option.qty_min || 0) > 1 || !integer(option.price)) { unsupported = true; break; }
      const raw = (option.option_item_indexes || []).map(id => choices.get(id));
      if (!raw.length || raw.some(row => !visible(row) || !integer(row.price))) { unsupported = true; break; }
      const boolean = raw.every(row => row.boolean_value === 0 || row.boolean_value === 1);
      if (boolean) {
        const yes = raw.filter(row => row.boolean_value === 1), no = raw.filter(row => row.boolean_value === 0);
        if (yes.length !== 1 || no.length !== 1 || no[0].price !== 0) { unsupported = true; break; }
        const add=option.price+yes[0].price, name=label(option.name);
        if(add<0){p+=add;g.push({n:name,req:true,o:[{n:'不調整',add:-add},{n:name,add:0}]});}
        else extras.push({n:name,add});
      } else {
        if (raw.some(row => row.boolean_value !== null || row.is_auto_create_empty_item)) { unsupported = true; break; }
        const cost = raw.map(row => option.price + row.price), min = Math.min(...cost);
        p += min;
        const o = raw.map((row,i) => ({n:label(row.name)||(cost[i]===0?'不調整':''), add:cost[i]-min}));
        if (o.some(row => !row.n)) { unsupported = true; break; }
        g.push({n:label(option.name) || '規格',req:true,o});
      }
    }
    if (unsupported || !integer(p) || p < 0) { skipped++; continue; }
    if (extras.length) g.push({n:'客製加選',req:false,o:extras});
    const sub = subs.get(entree.subcategory_index), category = categories.get(entree.category_index);
    if ((sub && !visible(sub)) || (category && !visible(category))) continue;
    const c = label(sub?.name || category?.name) || '餐點';
    if (!byCategory.has(c)) { const cat={c,items:[]};byCategory.set(c,cat);cats.push(cat); }
    byCategory.get(c).items.push({n,p,g});
    if((entree.combo_entree_indexes||[]).length)omittedUpgrades++;
  }
  return {cats,skipped,omittedUpgrades};
}
module.exports = {convert};
