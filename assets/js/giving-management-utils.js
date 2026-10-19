/* Pure GIV-2A presentation calculations. Canonical values arrive as minor-unit strings. */
(() => {
  'use strict';
  const minor = v => BigInt(v ?? 0), sum = (rows, key = 'amount_minor') => rows.reduce((n, r) => n + minor(r[key]), 0n).toString();
  function fundTree(funds) {
    const rows = funds.map(f => ({
      ...f,
      direct_minor: String(f.direct_minor ?? 0)
    }));
    return rows.filter(f => !f.parent_id).map(f => {
      const children = rows.filter(c => c.parent_id === f.id);
      return {
        ...f,
        children,
        total_minor: (minor(f.direct_minor) + minor(sum(children, 'direct_minor'))).toString()
      };
    });
  }
  function percent(received, total) {
    return minor(total) > 0n ? String(minor(received) * 10000n / minor(total) / 100n) + '%' : 'Not applicable';
  }
  function group(rows, key) {
    const m = new Map();
    for (const r of rows) {
      const k = r[key] || 'Unspecified';
      m.set(k, (m.get(k) || 0n) + minor(r.amount_minor));
    }
    return [...m].map(([label, v]) => ({
      label,
      amount_minor: v.toString()
    }));
  }
  window.GivingManagementUtils = Object.freeze({
    sum,
    fundTree,
    percent,
    group
  });
})();
