/* GIV-2A Finance workspace. No gateway transport, credentials, Auth policy or public giving change. */
(() => {
  'use strict';
  const root = document.getElementById('giving-app');
  if (!root)
    return;
  const auth = window.ChampionLifeAuth, E = window.OutreachUI.el, U = window.GivingUtils, M = window.GivingManagementUtils;
  const view = root.dataset.view, params = new URLSearchParams(location.search), titles = {
      overview: 'Finance Overview',
      gifts: 'Gifts',
      gift: 'Gift Detail',
      manual: 'Manual Entry',
      donors: 'Donors',
      donor: 'Donor Detail',
      funds: 'Funds',
      pledges: 'Pledges',
      pledge: 'Pledge Detail',
      recurring: 'Recurring Giving',
      recurringdetail: 'Recurring Detail',
      batches: 'Batches & Reconciliation',
      batch: 'Batch Detail',
      merchants: 'Merchant Configuration'
    };
  const required = {
    overview: 'finance.reports.read',
    gifts: 'finance.gifts.read',
    gift: 'finance.gifts.read',
    manual: 'finance.gifts.create',
    donors: 'finance.gifts.read',
    donor: 'finance.gifts.read',
    funds: 'finance.read',
    pledges: 'finance.pledges.read',
    pledge: 'finance.pledges.read',
    recurring: 'finance.recurring.read',
    recurringdetail: 'finance.recurring.read',
    batches: 'finance.reconciliation.read',
    batch: 'finance.reconciliation.read',
    merchants: 'finance.merchant.configure'
  };
  let org = params.get('organization'), context, scope, userId, epoch = 0, contextSequence = 0, busy = false, currency = 'USD', scale = 2, timezone = 'UTC', period = 'today';
  const can = k => scope?.permissions.includes(k), money = (v, c = currency) => v == null ? 'Not available' : U.money(v, c, c === currency ? scale : new Intl.NumberFormat('en', {
      style: 'currency',
      currency: c
    }).resolvedOptions().maximumFractionDigits);
  const href = (page, id) => 'staff-giving-' + page + '.html?organization=' + encodeURIComponent(org) + (id ? '&id=' + encodeURIComponent(id) : '');
  const link = (text, page, id) => E('a', text, {
    href: href(page, id),
    class: 'giving-button'
  });
  function date(v, time = false) {
    if (!v)
      return 'Not recorded';
    const calendarDate = /^\d{4}-\d\d-\d\d$/.test(v);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: calendarDate ? 'UTC' : timezone,
      dateStyle: 'medium',
      ...time ? { timeStyle: 'short' } : {}
    }).format(new Date(calendarDate ? v + 'T12:00:00Z' : v));
  }
  function localNow() {
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).format(new Date());
    return parts.replace(' ', 'T');
  }
  const state = text => E('span', String(text || 'Not recorded').replaceAll('_', ' '), { class: 'giving-status' });
  function note(parent, text) {
    parent.append(E('p', text, { class: 'giving-footnote' }));
  }
  function feedback(text, error = false, parent = root) {
    parent.querySelector('.giving-feedback')?.remove();
    parent.append(E('p', text, {
      class: 'giving-feedback ' + (error ? 'giving-error' : 'giving-note'),
      role: error ? 'alert' : 'status'
    }));
  }
  function panel(title, parent = root) {
    const section = E('section', null, { class: 'giving-panel' });
    if (title)
      section.append(E('h2', title));
    parent.append(section);
    return section;
  }
  function field(parent, label, name, {type = 'text', choices, value = '', required = true} = {}) {
    const wrap = E('label', label), input = E(choices ? 'select' : type === 'textarea' ? 'textarea' : 'input', null, {
        name,
        ...!choices && type !== 'textarea' ? { type } : {}
      });
    if (choices)
      for (const [v, t] of choices)
        input.append(E('option', t, { value: v }));
    input.value = value || (choices?.[0]?.[0] ?? '');
    input.required = required;
    wrap.append(input);
    parent.append(wrap);
    return input;
  }
  function button(text, fn, gold = false) {
    const b = E('button', text, {
      type: 'button',
      class: gold ? 'giving-gold' : ''
    });
    b.onclick = async () => {
      if (busy)
        return;
      busy = true;
      b.disabled = true;
      try {
        await fn(b);
      } catch (e) {
        if (!root.querySelector('.staff-state'))
          feedback(e.message, true);
      } finally {
        busy = false;
        if (b.isConnected)
          b.disabled = false;
      }
    };
    return b;
  }
  async function call(action, payload = {}) {
    const version = epoch, who = userId, res = await auth.client.rpc('giving_workspace', {
        p_action: action,
        p_org: org,
        p_payload: payload
      });
    if (version !== epoch || (await auth.getUser())?.id !== who)
      throw Error('Session changed. Reload finance.');
    if (res.error) {
      if (res.error.code === '42501' || [
          401,
          403
        ].includes(res.status)) {
        epoch++;
        contextSequence++;
        root.replaceChildren();
        window.StaffWorkspace.denied(root, 'Your access to this finance section is no longer available.');
        window.StaffWorkspace.refresh();
      }
      throw Error(res.error.message || 'Finance request failed.');
    }
    return res.data;
  }
  function confirm(trigger, description, fn, review) {
    const dialog = E('dialog', null, {
        class: 'giving-confirm',
        'aria-label': 'Confirm finance record'
      }), actions = E('div', null, { class: 'giving-actions' }), cancel = E('button', 'Cancel', { type: 'button' }), yes = E('button', 'Confirm record', {
        type: 'button',
        class: 'giving-gold'
      });
    dialog.append(E('h2', 'Confirm finance record'), E('p', description));
    if (review)
      dialog.append(review);
    actions.append(cancel, yes);
    dialog.append(actions);
    root.append(dialog);
    cancel.onclick = () => dialog.close();
    yes.onclick = async () => {
      yes.disabled = true;
      try {
        await fn();
        dialog.close();
      } catch (e) {
        if (dialog.isConnected)
          feedback(e.message, true, dialog);
        yes.disabled = false;
      }
    };
    dialog.addEventListener('close', () => {
      dialog.remove();
      if (trigger.isConnected)
        trigger.focus();
      else
        root.querySelector('h1')?.focus();
    });
    dialog.showModal();
    cancel.focus();
  }
  function table(parent, columns, rows, empty = 'No records to display.') {
    if (!rows?.length) {
      parent.append(E('p', empty, {
        class: 'giving-empty',
        role: 'status'
      }));
      return;
    }
    const wrap = E('div', null, {
        class: 'giving-table-wrap',
        tabindex: '0',
        'aria-label': 'Scrollable ' + (parent.querySelector('h2')?.textContent || 'finance') + ' table'
      }), t = E('table'), head = E('thead'), tr = E('tr'), body = E('tbody');
    for (const [label] of columns)
      tr.append(E('th', label, { scope: 'col' }));
    head.append(tr);
    for (const row of rows) {
      const r = E('tr');
      for (const [label, fn] of columns) {
        const td = E('td', null, { 'data-label': label }), value = fn(row);
        td.append(value?.nodeType ? value : document.createTextNode(String(value ?? 'Not recorded')));
        r.append(td);
      }
      body.append(r);
    }
    t.append(head, body);
    wrap.append(t);
    parent.append(wrap);
  }
  function detail(parent, pairs) {
    const dl = E('dl', null, { class: 'giving-detail' });
    for (const [label, value] of pairs) {
      const box = E('div');
      box.append(E('dt', label), E('dd', value?.nodeType ? null : String(value ?? 'Not recorded')));
      if (value?.nodeType)
        box.lastChild.append(value);
      dl.append(box);
    }
    parent.append(dl);
  }
  function metrics(parent, values) {
    const grid = E('div', null, { class: 'giving-metrics' });
    for (const [label, value, sub] of values) {
      const box = E('div', null, { class: 'giving-metric' });
      box.append(E('span', label), E('strong', String(value)));
      if (sub)
        box.append(E('small', sub));
      grid.append(box);
    }
    parent.append(grid);
  }
  function history(parent, rows) {
    table(parent, [
      [
        'Date',
        r => date(r.created_at || r.generated_at || r.scheduled_at, true)
      ],
      [
        'Action / reference',
        r => r.action || r.receipt_number || r.id || 'Recorded'
      ],
      [
        'State',
        r => state(r.status || r.delivery_status || 'Recorded')
      ]
    ], rows, 'No history recorded.');
  }
  function formPanel(title, fields, action, payload, description = 'Save this finance record?', parent = root) {
    const section = panel(title, parent), form = E('form', null, { class: 'giving-form' }), controls = {}, save = E('button', 'Save ' + title, {
        type: 'submit',
        class: 'giving-gold'
      }), key = () => crypto.randomUUID();
    let requestKey = key();
    for (const [n, l, opts] of fields)
      controls[n] = field(form, l, n, opts);
    save.classList.add('giving-full');
    form.append(save);
    section.append(form);
    form.addEventListener('input', () => {
      requestKey = key();
    });
    form.onsubmit = e => {
      e.preventDefault();
      try {
        const data = payload(controls);
        confirm(save, description, async () => {
          await call(action, {
            ...data,
            ...![
              'fund_create',
              'fund_update',
              'fund_edit',
              'gateway_create',
              'processor_create',
              'destination_create',
              'destination_update'
            ].includes(action) ? { request_key: requestKey } : {}
          });
          await render();
          feedback('Record saved.');
        });
      } catch (err) {
        feedback(err.message, true, section);
      }
    };
    return {
      section,
      form,
      controls,
      save
    };
  }
  const sum = rows => M.sum(rows), methods = [
      [
        'cash',
        'Cash'
      ],
      [
        'check',
        'Check'
      ],
      [
        'ach',
        'External ACH'
      ],
      [
        'external',
        'External card / reference'
      ],
      [
        'other',
        'Other approved type'
      ]
    ];
  const methodLabel = v => methods.find(x => x[0] === v)?.[1] || v;
  function giftTable(parent, rows) {
    table(parent, [
      [
        'Date',
        g => date(g.gift_at)
      ],
      [
        'Donor',
        g => g.donor_name || 'Anonymous'
      ],
      [
        'Household',
        g => g.household_name || 'Individual'
      ],
      [
        'Amount',
        g => money(g.amount_minor, g.currency)
      ],
      [
        'Fund',
        g => g.fund_name
      ],
      [
        'Parent fund',
        g => g.parent_name || 'Standalone'
      ],
      [
        'Source',
        g => g.source
      ],
      [
        'Payment type',
        g => methodLabel(g.payment_method)
      ],
      [
        'Frequency',
        g => g.recurring_id || g.source === 'recurring' ? 'Recurring' : 'One-time'
      ],
      [
        'Merchant',
        g => g.route_snapshot?.destination_label || 'Manual record'
      ],
      [
        'Gateway',
        g => g.route_snapshot?.gateway_label || g.route_snapshot?.provider || 'None'
      ],
      [
        'MID / route',
        g => g.route_snapshot?.processor_label || g.route_snapshot?.mid_reference || 'None'
      ],
      [
        'Batch',
        g => g.batch_label || 'Unbatched'
      ],
      [
        'Receipt',
        g => g.receipt_number || 'Not issued'
      ],
      [
        'Status',
        g => state(g.transaction_status || g.kind)
      ],
      [
        'Detail',
        g => can('finance.gifts.read') ? link('View gift', 'gift', g.id) : 'Detail requires gift read access'
      ]
    ], rows, 'No gifts match this period and filters.');
  }
  function fundBreakdown(parent, funds, total) {
    const tree = M.fundTree(funds);
    if (M.sum(tree, 'total_minor') !== String(total))
      throw Error('Fund totals do not reconcile. No partial totals displayed.');
    const list = E('div', null, { class: 'giving-fund-list' });
    for (const f of tree) {
      const row = E('div', null, { class: 'giving-fund' });
      if (f.children.length) {
        const toggle = E('button', f.name, {
            type: 'button',
            'aria-expanded': 'false',
            'aria-controls': 'children-' + f.id
          }), amount = E('strong', money(f.total_minor)), children = E('div', null, {
            id: 'children-' + f.id,
            class: 'giving-fund-children',
            hidden: ''
          });
        for (const child of f.children) {
          const r = E('div', null, { class: 'giving-fund-child' });
          r.append(E('span', child.name), E('strong', money(child.direct_minor)));
          children.append(r);
        }
        if (BigInt(f.direct_minor) !== 0n) {
          const direct = E('div', null, { class: 'giving-fund-child' });
          direct.append(E('span', 'Direct to ' + f.name), E('strong', money(f.direct_minor)));
          children.append(direct);
        }
        toggle.onclick = () => {
          const open = toggle.getAttribute('aria-expanded') === 'true';
          toggle.setAttribute('aria-expanded', String(!open));
          children.hidden = open;
        };
        row.append(toggle, amount, children);
      } else
        row.append(E('span', f.name), E('strong', money(f.total_minor)));
      list.append(row);
    }
    const footer = E('div', null, { class: 'giving-fund giving-fund-total' });
    footer.append(E('span', 'Total giving'), E('strong', money(total)));
    list.append(footer);
    parent.append(list);
    note(parent, 'Parent rows include direct gifts and child funds. Expanded child rows explain the parent total and are not counted twice. Refunds and corrections are included at their ledger dates.');
  }
  async function overview() {
    const selector = panel(null), choices = [
        [
          'past_24_hours',
          '24 Hours'
        ],
        [
          'today',
          'Today'
        ],
        [
          'week',
          'Week'
        ],
        [
          'month',
          'Month'
        ],
        [
          'quarter',
          'Quarter'
        ],
        [
          'semiannual',
          '6 Months'
        ],
        [
          'annual',
          'Year'
        ],
        [
          'custom',
          'Custom'
        ]
      ], group = E('div', null, {
        class: 'giving-periods',
        role: 'group',
        'aria-label': 'Reporting period'
      }), custom = E('form', null, {
        class: 'giving-filters',
        hidden: ''
      }), from = field(custom, 'From', 'starts_on', { type: 'date' }), to = field(custom, 'To (inclusive)', 'ends_on', { type: 'date' }), apply = E('button', 'Apply custom period', {
        type: 'submit',
        class: 'giving-gold'
      }), output = E('div');
    custom.append(apply);
    selector.append(group, custom);
    root.append(output);
    let sequence = 0;
    async function load() {
      const token = ++sequence;
      const payload = {
        period,
        ...period === 'custom' ? {
          starts_on: from.value,
          ends_on: to.value
        } : {}
      };
      const data = await call('dashboard', payload);
      if (token !== sequence)
        return;
      const r = data.report;
      timezone = r.period.timezone;
      for (const b of group.children)
        b.setAttribute('aria-pressed', String(b.dataset.period === period));
      const stage = E('div');
      metrics(stage, [
        [
          'Total Giving',
          money(r.total_minor),
          'Net ledger \xB7 selected period'
        ],
        [
          'Number of Gifts',
          data.metrics.gift_count,
          'Distinct gifts / sessions'
        ],
        [
          'Average Gift',
          money(data.metrics.average_minor),
          'Net total per gift'
        ],
        [
          'Recurring Giving',
          money(data.metrics.recurring_minor),
          'Selected period'
        ],
        [
          'Manual Giving',
          money(data.metrics.manual_minor),
          'Received elsewhere'
        ],
        [
          'Online Giving',
          money(data.metrics.online_minor),
          'Selected period'
        ],
        [
          'Outstanding Pledges',
          money(data.metrics.outstanding_pledges_minor),
          'Current active / paused balance'
        ],
        [
          'Unreconciled Batches',
          data.metrics.unreconciled_batches,
          'Current open / ready / difference batches'
        ]
      ]);
      const layout = E('div', null, { class: 'giving-dashboard-grid' }), funds = panel((choices.find(x => x[0] === period)?.[1] || 'Selected period') + ' by Fund', layout);
      fundBreakdown(funds, data.funds, r.total_minor);
      funds.append(link('View All Funds', 'funds'));
      const attention = panel('Needs attention', layout);
      for (const [label, n] of [
          [
            'Unreconciled batches',
            data.metrics.unreconciled_batches
          ],
          [
            'Failed transactions in period',
            data.attention.failed_transactions
          ],
          [
            'Recurring instructions with failures',
            data.attention.failed_recurring
          ],
          [
            'Pledges past target date',
            data.attention.overdue_pledges
          ],
          [
            'Incomplete fund routes',
            data.attention.routing_warnings
          ]
        ]) {
        const item = E('div', null, { class: 'giving-attention' });
        item.append(E('span', label), E('strong', String(n)));
        attention.append(item);
      }
      note(attention, 'Processors are not connected. These states do not initiate payment or notification actions.');
      stage.append(layout);
      const comparisons = panel('At a glance', stage);
      metrics(comparisons, Object.entries(data.comparisons).map(([kind, c]) => [
        kind === 'sunday' ? 'This service period vs previous' : 'This month vs last month',
        money(c.total_minor),
        'Previous ' + money(c.prior_total_minor) + ' \xB7 Change ' + money(c.difference_minor)
      ]));
      note(comparisons, 'Service periods use the configured weekday and boundary (' + r.period.service_weekday + ', ' + r.period.service_boundary + '), in ' + timezone + '. Full reports and charts are a later phase.');
      note(stage, 'Reporting window: ' + date(r.period.starts_at, true) + ' to ' + date(r.period.ends_at, true) + ' (end excluded) \xB7 ' + timezone + ' \xB7 ' + currency + '.');
      output.replaceChildren(stage);
    }
    for (const [value, label] of choices) {
      const b = button(label, async () => {
        if (value === 'custom') {
          period = value;
          custom.hidden = false;
          for (const x of group.children)
            x.setAttribute('aria-pressed', String(x.dataset.period === value));
          from.focus();
          return;
        }
        custom.hidden = true;
        period = value;
        await load();
      });
      b.dataset.period = value;
      b.setAttribute('aria-pressed', String(value === period));
      group.append(b);
    }
    custom.onsubmit = async e => {
      e.preventDefault();
      try {
        await load();
      } catch (err) {
        feedback(err.message, true, selector);
      }
    };
    await load();
  }
  async function gifts() {
    const filters = panel('Find gifts'), fold = E('details', null, { class: 'giving-filter-disclosure' }), summary = E('summary', 'Filters'), form = E('form', null, { class: 'giving-form' }), controls = {};
    fold.append(summary, form);
    filters.append(fold);
    const output = panel('Gift records'), initial = await call('gift_list'), funds = initial.funds || [], routes = initial.routes || [];
    let offset = 0;
    const options = (rows, id, label) => [
      [
        '',
        'All'
      ],
      ...new Map(rows.filter(r => r[id]).map(r => [
        r[id],
        [
          r[id],
          r[label]
        ]
      ])).values()
    ];
    const fields = [
      ['donor_search', 'Donor name', {}],
      [
        'search',
        'Donor, household, fund or reference',
        {}
      ],
      [
        'from',
        'From',
        { type: 'date' }
      ],
      [
        'to',
        'To (inclusive)',
        { type: 'date' }
      ],
      [
        'fund_id',
        'Fund',
        { choices: options(funds, 'id', 'name') }
      ],
      [
        'parent_id',
        'Parent fund',
        { choices: options(funds.filter(f => !f.parent_id), 'id', 'name') }
      ],
      [
        'source',
        'Source',
        {
          choices: [
            [
              '',
              'All'
            ],
            [
              'staff_manual',
              'Manual'
            ],
            [
              'import',
              'Imported'
            ],
            [
              'web',
              'Web'
            ],
            [
              'recurring',
              'Recurring'
            ],
            [
              'text',
              'Text'
            ]
          ]
        }
      ],
      [
        'payment_method',
        'Payment type',
        {
          choices: [
            [
              '',
              'All'
            ],
            ...methods,
            [
              'card',
              'Card'
            ]
          ]
        }
      ],
      [
        'recurring',
        'Frequency',
        {
          choices: [
            [
              '',
              'All'
            ],
            [
              'true',
              'Recurring'
            ],
            [
              'false',
              'One-time'
            ]
          ]
        }
      ],
      [
        'destination_id',
        'Merchant destination',
        { choices: options(routes, 'destination_id', 'destination') }
      ],
      [
        'gateway_id',
        'Gateway',
        { choices: options(routes, 'gateway_id', 'gateway') }
      ],
      [
        'processor_route_id',
        'Processor / MID',
        { choices: options(routes, 'processor_route_id', 'route') }
      ],
      [
        'campaign',
        'Campaign reference',
        {}
      ],
      [
        'event',
        'Event reference',
        {}
      ],
      [
        'min',
        'Minimum amount',
        { type: 'text' }
      ],
      [
        'max',
        'Maximum amount',
        { type: 'text' }
      ],
      [
        'status',
        'Transaction / ledger status',
        {
          choices: [
            [
              '',
              'All'
            ],
            ...[
              'posted',
              'captured',
              'settled',
              'failed',
              'refunded',
              'partially_refunded',
              'disputed',
              'reversal',
              'correction',
              'reclassification',
              'refund'
            ].map(s => [
              s,
              s.replaceAll('_', ' ')
            ])
          ]
        }
      ]
    ];
    for (const [n, l, opt] of fields)
      controls[n] = field(form, l, n, {
        ...opt,
        required: false
      });
    const submit = E('button', 'Apply filters', {
      type: 'submit',
      class: 'giving-gold'
    });
    form.append(submit);
    let seq = 0;
    const payload = () => {
      const p = { offset };
      for (const [k, c] of Object.entries(controls))
        if (c.value)
          p[k === 'min' ? 'min_minor' : k === 'max' ? 'max_minor' : k] = [
            'min',
            'max'
          ].includes(k) ? U.amountToMinor(c.value, scale, true) : c.value;
      return p;
    };
    function show(data) {
      output.replaceChildren(E('h2', 'Gift records'));
      note(output, data.count + ' matching ledger records \xB7 ' + data.currency + ' \xB7 ' + data.timezone);
      giftTable(output, data.gifts);
      const actions = E('div', null, { class: 'giving-actions' });
      if (offset)
        actions.append(button('Previous page', async () => {
          offset = Math.max(0, offset - 100);
          await load();
        }));
      if (offset + 100 < data.count)
        actions.append(button('Next page', async () => {
          offset += 100;
          await load();
        }));
      output.append(actions);
    }
    async function load() {
      const token = ++seq, data = await call('gift_list', payload());
      if (token === seq)
        show(data);
    }
    form.onsubmit = async e => {
      e.preventDefault();
      offset = 0;
      try {
        await load();
        fold.open = false;
      } catch (err) {
        feedback(err.message, true, filters);
      }
    };
    show(initial);
  }
  async function gift() {
    const g = await call('gift_detail', { id: params.get('id') }), p = panel('Contribution');
    detail(p, [
      [
        'Donor',
        g.donor_name
      ],
      [
        'Household',
        g.household_name || 'Individual'
      ],
      [
        'Date / time',
        date(g.gift_at, true)
      ],
      [
        'Amount',
        money(g.amount_minor, g.currency)
      ],
      [
        'Fund',
        g.fund_name
      ],
      [
        'Parent fund',
        g.parent_name || 'Standalone'
      ],
      [
        'Source',
        g.source
      ],
      [
        'Tax treatment',
        g.tax_eligible ? 'Tax eligible' : 'Not tax eligible'
      ]
    ]);
    const payment = panel('Payment'), r = g.route_snapshot || {};
    detail(payment, [
      [
        'Method',
        methodLabel(g.payment_method)
      ],
      [
        'Gateway',
        r.gateway_label || r.provider || 'No gateway \xB7 received elsewhere'
      ],
      [
        'Merchant destination',
        r.destination_label || 'Manual record'
      ],
      [
        'Processor / MID',
        r.processor_label || r.mid_reference || 'None'
      ],
      [
        'Status',
        state(g.transaction_status)
      ],
      [
        'Provider / external reference',
        g.provider_reference || g.external_reference || 'Not recorded'
      ]
    ]);
    note(payment, 'Historical route snapshot retained. No payment credentials are displayed.');
    history(panel('Receipts'), g.receipts);
    history(panel('Refund / void history'), g.refunds);
    table(panel('Reconciliation'), [
      [
        'Ledger',
        r => money(r.ledger_minor)
      ],
      [
        'Deposit',
        r => money(r.deposit_minor)
      ],
      [
        'Difference',
        r => money(r.difference_minor)
      ],
      [
        'Status',
        r => state(r.status)
      ]
    ], g.reconciliations);
    giftTable(panel('Adjustments / reclassifications'), g.adjustments);
    history(panel('Audit lineage'), g.audit);
    root.append(link('Back to Gifts', 'gifts'));
  }
  async function donorOptions(data, parent) {
    const area = E('div', null, { class: 'giving-full giving-donor-search' }), search = field(area, 'Find canonical donor', 'donor_search', { required: false }), go = button('Find donor', async () => {
        const choices = await call('manual_options', { search: search.value });
        parent.replaceChildren(E('option', 'Anonymous', { value: '' }), ...choices.donors.map(d => E('option', d.first_name + ' ' + d.last_name, { value: d.id })));
      });
    area.append(go);
    return area;
  }
  function bindHouseholds(data, person, household) {
    const update = () => {
      const available = data.members.filter(m => m.person_id === person.value).map(m => m.household_id);
      household.replaceChildren(E('option', 'Individual / no household', { value: '' }), ...data.households.filter(h => available.includes(h.id)).map(h => E('option', h.name, { value: h.id })));
    };
    person.addEventListener('change', update);
    update();
  }
  async function manual() {
    const data = await call('manual_options');
    timezone = data.config.timezone;
    const donors = [
        [
          '',
          'Anonymous'
        ],
        ...data.donors.map(d => [
          d.id,
          d.first_name + ' ' + d.last_name
        ])
      ], funds = data.funds.map(f => [
        f.id,
        f.name
      ]), batches = data.batches.filter(b => b.currency === currency).map(b => [
        b.id,
        b.label
      ]);
    if (!funds.length || !batches.length) {
      const p = panel('Ready to record received gifts');
      note(p, 'An active fund and open same-currency batch are required. Ask an authorized finance manager to configure them.');
      if (can('finance.reconciliation.manage'))
        p.append(link('Manage Batches', 'batches'));
      return;
    }
    const common = [
      [
        'person_id',
        'Donor or anonymous',
        {
          required: false,
          choices: donors
        }
      ],
      [
        'household_id',
        'Household attribution',
        {
          required: false,
          choices: [[
              '',
              'Individual'
            ]]
        }
      ],
      [
        'fund_id',
        'Fund',
        { choices: funds }
      ],
      [
        'amount',
        'Amount (' + currency + ')',
        {}
      ],
      [
        'gift_date',
        'Received date and time (' + timezone + ')',
        {
          type: 'datetime-local',
          value: localNow()
        }
      ],
      [
        'payment_method',
        'Payment received as',
        { choices: methods }
      ],
      [
        'batch_id',
        'Open deposit / service batch',
        { choices: batches }
      ],
      [
        'event_reference',
        'Service / event / source reference',
        { required: false }
      ],
      [
        'external_reference',
        'Check number / external reference',
        { required: false }
      ],
      [
        'notes',
        'Notes',
        {
          type: 'textarea',
          required: false
        }
      ]
    ];
    const built = formPanel('Manual gift', common, 'manual', c => {
      if ([
          'check',
          'ach',
          'external'
        ].includes(c.payment_method.value) && !c.external_reference.value.trim())
        throw Error('Received-payment reference required.');
      return {
        person_id: c.person_id.value || null,
        household_id: c.household_id.value || null,
        fund_id: c.fund_id.value,
        amount_minor: U.amountToMinor(c.amount.value, scale),
        currency,
        gift_local: c.gift_date.value,
        payment_method: c.payment_method.value,
        batch_id: c.batch_id.value,
        event_reference: c.event_reference.value || null,
        external_reference: c.external_reference.value || null,
        notes: c.notes.value
      };
    }, 'Record this payment already received? No card charge or ACH processing will occur.');
    bindHouseholds(data, built.controls.person_id, built.controls.household_id);
    built.form.prepend(await donorOptions(data, built.controls.person_id));
    note(built.section, 'Staff actor is recorded automatically. Only reference information is collected for payments received elsewhere.');
    const rapid = panel('Rapid Sunday Entry'), form = E('form', null, { class: 'giving-form' }), batch = field(form, 'Batch', 'rapid_batch', { choices: batches }), received = field(form, 'Received date and time (' + timezone + ')', 'rapid_date', {
        type: 'datetime-local',
        value: localNow()
      }), expected = field(form, 'Counted / expected total (' + currency + ')', 'expected_total'), event = field(form, 'Service / event reference', 'rapid_event', { required: false }), rowsRoot = E('div', null, { class: 'giving-full giving-rapid-rows' }), rows = [], balance = E('p', 'Add rows and enter the counted total.', {
        class: 'giving-full',
        role: 'status'
      }), actions = E('div', null, { class: 'giving-actions giving-full' });
    let key = crypto.randomUUID();
    form.append(rowsRoot, balance, actions);
    rapid.append(form);
    function addRow() {
      const box = E('fieldset', null, { class: 'giving-rapid-row' });
      box.append(E('legend', 'Gift row ' + (rows.length + 1)));
      const c = {
        key: crypto.randomUUID(),
        box,
        person: field(box, 'Donor', 'row_donor', {
          choices: donors,
          required: false
        }),
        method: field(box, 'Type', 'row_type', { choices: methods }),
        fund: field(box, 'Fund', 'row_fund', { choices: funds }),
        amount: field(box, 'Amount', 'row_amount'),
        reference: field(box, 'Reference', 'row_reference', { required: false })
      };
      box.append(button('Remove row', () => {
        rows.splice(rows.indexOf(c), 1);
        box.remove();
        changed();
      }));
      rows.push(c);
      rowsRoot.append(box);
      changed();
      c.person.focus();
    }
    function changed() {
      key = crypto.randomUUID();
      try {
        const total = M.sum(rows.map(r => ({ amount_minor: U.amountToMinor(r.amount.value, scale, true) })));
        const target = expected.value ? U.amountToMinor(expected.value, scale, true) : null;
        balance.textContent = 'Row total ' + money(total) + (target ? ' \xB7 Difference ' + money((BigInt(target) - BigInt(total)).toString()) : ' \xB7 Enter counted total');
      } catch {
        balance.textContent = 'Enter valid amounts to balance the batch.';
      }
    }
    form.addEventListener('input', changed);
    actions.append(button('Add row', addRow), button('Balance', changed));
    const post = E('button', 'Review & Post Batch', {
      type: 'submit',
      class: 'giving-gold'
    });
    actions.append(post);
    form.onsubmit = e => {
      e.preventDefault();
      try {
        if (!rows.length)
          throw Error('Add at least one row.');
        const entries = rows.map(r => ({
          request_key: r.key,
          person_id: r.person.value || null,
          fund_id: r.fund.value,
          amount_minor: U.amountToMinor(r.amount.value, scale),
          payment_method: r.method.value,
          external_reference: r.reference.value || null
        }));
        if (entries.some(r => [
            'check',
            'ach',
            'external'
          ].includes(r.payment_method) && !r.external_reference?.trim()))
          throw Error('Every external/check payment needs a reference.');
        const total = sum(entries);
        if (total !== U.amountToMinor(expected.value, scale))
          throw Error('Row total must match the counted batch total.');
        const review = E('div');
        note(review, entries.length + ' received payments \xB7 ' + money(total) + ' \xB7 ' + batch.selectedOptions[0].textContent);
        table(review, [
          [
            'Donor',
            r => donors.find(d => d[0] === r.person_id)?.[1] || 'Anonymous'
          ],
          [
            'Type',
            r => methodLabel(r.payment_method)
          ],
          [
            'Fund',
            r => funds.find(f => f[0] === r.fund_id)?.[1]
          ],
          [
            'Amount',
            r => money(r.amount_minor)
          ],
          [
            'Reference',
            r => r.external_reference || 'None'
          ]
        ], entries);
        confirm(post, 'Post the reviewed batch rows atomically? No payment processing occurs.', async () => {
          await call('rapid_post', {
            request_key: key,
            batch_id: batch.value,
            gift_local: received.value,
            currency,
            expected_minor: total,
            event_reference: event.value || null,
            rows: entries
          });
          await render();
          feedback('Batch rows posted once.');
        }, review);
      } catch (err) {
        feedback(err.message, true, rapid);
      }
    };
    addRow();
    note(rapid, 'Tab through each row. Review and balance before posting. All rows succeed together or none are posted.');
  }
  async function donors() {
    const section = panel('Canonical People & Households'), form = E('form', null, { class: 'giving-filters' }), search = field(form, 'Search name, email or phone', 'search', { required: false }), submit = E('button', 'Search donors', {
        type: 'submit',
        class: 'giving-gold'
      }), output = E('div');
    form.append(submit);
    section.append(form, output);
    let offset = 0;
    async function load() {
      const data = await call('donor_list', {
        search: search.value,
        offset
      });
      output.replaceChildren();
      table(output, [
        [
          'Name',
          d => link(d.first_name + ' ' + d.last_name, 'donor', d.id)
        ],
        [
          'Household',
          d => d.households.map(h => h.name).join(', ') || 'Individual'
        ],
        [
          'Email',
          d => d.email || 'Not recorded'
        ],
        [
          'Phone',
          d => d.phone || 'Not recorded'
        ],
        [
          'YTD Giving',
          d => money(d.ytd_minor, data.currency)
        ],
        [
          'Last Gift',
          d => date(d.last_gift)
        ],
        [
          'Recurring',
          d => state(d.recurring ? 'Present' : 'None')
        ],
        [
          'Pledge',
          d => state(d.pledged ? 'Present' : 'None')
        ]
      ], data.donors, 'No canonical people match this search.');
      const actions = E('div', null, { class: 'giving-actions' });
      if (offset)
        actions.append(button('Previous page', async () => {
          offset -= 100;
          await load();
        }));
      if (offset + 100 < data.count)
        actions.append(button('Next page', async () => {
          offset += 100;
          await load();
        }));
      output.append(actions);
      note(output, 'Giving authorization provides finance identity fields only. No care or private CRM records are included.');
    }
    form.onsubmit = async e => {
      e.preventDefault();
      offset = 0;
      try {
        await load();
      } catch (err) {
        feedback(err.message, true, section);
      }
    };
    await load();
  }
  async function donor() {
    const data = await call('donor_detail', { person_id: params.get('id') }), selector = panel(data.person.first_name + ' ' + data.person.last_name), household = field(selector, 'Giving attribution view', 'household', {
        choices: [
          [
            '',
            'Individual'
          ],
          ...data.households.map(h => [
            h.id,
            'Household \xB7 ' + h.name
          ])
        ]
      }), output = E('div');
    root.append(output);
    function show(d) {
      output.replaceChildren();
      const gifts = d.gifts.filter(g => g.currency === currency), ytd = gifts.filter(g => new Date(g.gift_at) >= new Date(d.ytd_start) && new Date(g.gift_at) <= new Date(d.as_of)), last = gifts.filter(g => g.kind === 'gift').sort((a, b) => new Date(b.gift_at) - new Date(a.gift_at))[0], pledged = d.pledges.filter(p => p.currency === currency && [
          'active',
          'paused'
        ].includes(p.status));
      const outstanding = pledged.reduce((n, p) => n + (BigInt(p.amount_minor) > BigInt(sum(d.allocations.filter(a => a.pledge_id === p.id))) ? BigInt(p.amount_minor) - BigInt(sum(d.allocations.filter(a => a.pledge_id === p.id))) : 0n), 0n);
      metrics(output, [
        [
          'YTD Giving',
          money(sum(ytd))
        ],
        [
          'Last Gift',
          last ? money(last.amount_minor) + ' \xB7 ' + date(last.gift_at) : 'No gift recorded'
        ],
        [
          'Recurring Total',
          money(sum(d.recurring_lines.filter(l => d.recurring.some(r => r.id === l.instruction_id && r.currency === currency && ['active', 'paused', 'draft'].includes(r.status))))),
          'Current active, paused and draft instructions; per occurrence, not annualized'
        ],
        [
          'Outstanding Pledges',
          money(outstanding.toString())
        ]
      ]);
      giftTable(panel('Giving History', output), gifts);
      table(panel('Pledges', output), [
        [
          'Fund',
          p => p.fund_id
        ],
        [
          'Amount',
          p => money(p.amount_minor, p.currency)
        ],
        [
          'Status',
          p => state(p.status)
        ],
        [
          'Detail',
          p => can('finance.pledges.read') ? link('View pledge', 'pledge', p.id) : 'No pledge detail permission'
        ]
      ], d.pledges);
      table(panel('Recurring Gifts', output), [
        [
          'Frequency',
          r => r.frequency
        ],
        [
          'Next run',
          r => date(r.next_run_at, true)
        ],
        [
          'Status',
          r => state(r.status)
        ],
        [
          'Detail',
          r => can('finance.recurring.read') ? link('View recurring', 'recurringdetail', r.id) : 'No recurring detail permission'
        ]
      ], d.recurring);
      history(panel('Receipts', output), d.receipts);
      table(panel('Statement references', output), [
        [
          'Version',
          r => r.version
        ],
        [
          'From',
          r => date(r.starts_at)
        ],
        [
          'To',
          r => date(r.ends_at)
        ],
        [
          'Generated',
          r => date(r.generated_at, true)
        ]
      ], d.statements, 'No statement references. Statement generation is outside this management package.');
      giftTable(panel('Adjustments / Refunds', output), gifts.filter(g => g.kind !== 'gift'));
      note(output, household.value ? 'Only gifts explicitly attributed to this household are rolled up; individual donor lineage remains visible.' : 'Individual contribution history; household membership alone does not rewrite giving attribution.');
    }
    household.onchange = async () => {
      try {
        show(await call('donor_detail', {
          person_id: params.get('id'),
          ...household.value ? { household_id: household.value } : {}
        }));
      } catch (err) {
        feedback(err.message, true, selector);
      }
    };
    show(data);
  }
  function routingText(r) {
    return r ? [
      r.destination,
      r.gateway,
      r.route
    ].filter(Boolean).join(' \u2192 ') : 'Not configured';
  }
  async function funds() {
    const data = await call('fund_management'), section = panel('Fund hierarchy'), routing = new Map(data.routing.map(r => [
        r.fund_id,
        r
      ]));
    note(section, 'Hierarchy groups ministry giving. Merchant routing is independent. Historical transactions retain their frozen route.');
    const actions = E('div', null, { class: 'giving-actions' });
    section.append(actions);
    function editor(f, parentId = null) {
      const target = panel(f ? 'Edit ' + f.name : parentId ? 'Add Sub-Fund' : 'Add Fund');
      const fields = [
        [
          'name',
          'Name',
          { value: f?.name }
        ],
        [
          'code',
          'Unique code',
          { value: f?.code }
        ],
        [
          'description',
          'Description',
          {
            type: 'textarea',
            required: false,
            value: f?.description
          }
        ],
        [
          'parent_id',
          'Parent',
          {
            required: false,
            choices: [
              [
                '',
                'Standalone / parent fund'
              ],
              ...data.funds.filter(x => !x.parent_id && x.id !== f?.id && x.status === 'active').map(x => [
                x.id,
                x.name
              ])
            ],
            value: f?.parent_id || parentId
          }
        ],
        [
          'destination_id',
          'Merchant destination',
          {
            choices: data.destinations.map(d => [
              d.id,
              d.label
            ]),
            value: f?.destination_id
          }
        ],
        [
          'is_public',
          'Visibility',
          {
            choices: [
              [
                'false',
                'Private'
              ],
              [
                'true',
                'Public'
              ]
            ],
            value: String(f?.is_public ?? false)
          }
        ],
        [
          'reporting_category',
          'Reporting category',
          {
            required: false,
            value: f?.reporting_category
          }
        ],
        [
          'accounting_code',
          'Accounting code',
          {
            required: false,
            value: f?.accounting_code
          }
        ],
        [
          'tax_eligible',
          'Tax treatment',
          {
            choices: [
              [
                'false',
                'Not tax eligible'
              ],
              [
                'true',
                'Tax eligible'
              ]
            ],
            value: String(f?.tax_eligible ?? false)
          }
        ],
        [
          'starts_on',
          'Start',
          {
            type: 'date',
            required: false,
            value: f?.starts_on
          }
        ],
        [
          'ends_on',
          'End',
          {
            type: 'date',
            required: false,
            value: f?.ends_on
          }
        ],
        [
          'display_order',
          'Display order',
          {
            type: 'number',
            value: String(f?.display_order ?? 0)
          }
        ],
        [
          'status',
          'Status',
          {
            choices: [
              [
                'active',
                'Active'
              ],
              [
                'archived',
                'Archived'
              ]
            ],
            value: f?.status || 'active'
          }
        ]
      ];
      const built = formPanel(f ? 'Fund changes' : 'Fund', fields, f ? 'fund_edit' : 'fund_create', c => ({
        ...f ? {
          id: f.id,
          revision: f.revision
        } : {},
        name: c.name.value,
        code: c.code.value,
        description: c.description.value,
        parent_id: c.parent_id.value || null,
        destination_id: c.destination_id.value,
        is_public: c.is_public.value === 'true',
        reporting_category: c.reporting_category.value,
        accounting_code: c.accounting_code.value,
        tax_eligible: c.tax_eligible.value === 'true',
        starts_on: c.starts_on.value || null,
        ends_on: c.ends_on.value || null,
        display_order: Number(c.display_order.value),
        ...f ? { status: c.status.value } : {}
      }), 'Save fund configuration? Posted gifts and historical routes remain unchanged.', target);
      built.controls.name.focus();
      target.scrollIntoView?.({
        block: 'start',
        behavior: 'smooth'
      });
    }
    if (can('finance.configure'))
      actions.append(button('Add Fund', () => editor()), button('Add Parent Fund', () => editor()));
    for (const f of M.fundTree(data.funds)) {
      const card = E('div', null, { class: 'giving-fund-admin' }), heading = E('div', null, { class: 'giving-fund-admin-heading' }), name = E('h3', f.name), controls = E('div', null, { class: 'giving-actions' });
      heading.append(name, state(f.status));
      card.append(heading);
      detail(card, [
        [
          'Code',
          f.code
        ],
        [
          'Category',
          f.reporting_category || 'None'
        ],
        [
          'Public display',
          f.is_public ? 'Public' : 'Private'
        ],
        [
          'Tax treatment',
          f.tax_eligible ? 'Tax eligible' : 'Not tax eligible'
        ],
        [
          'Current route',
          routingText(routing.get(f.id))
        ]
      ]);
      if (can('finance.configure'))
        controls.append(button('Edit ' + f.name, () => editor(f)), button('Add Sub-Fund to ' + f.name, () => editor(null, f.id)));
      if (can('finance.configure') && f.status === 'active')
        controls.append(button('Archive ' + f.name, b => confirm(b, 'Archive this fund for future selection? Historical gifts remain unchanged.', async () => {
          await call('fund_update', {
            id: f.id,
            revision: f.revision,
            status: 'archived'
          });
          await render();
        })));
      card.append(controls);
      if (f.children.length) {
        const fold = E('details'), label = E('summary', 'Sub-Funds (' + f.children.length + ')');
        fold.append(label);
        table(fold, [
          [
            'Fund',
            c => c.name
          ],
          [
            'Status',
            c => state(c.status)
          ],
          [
            'Current route',
            c => routingText(routing.get(c.id))
          ],
          [
            'Manage',
            c => can('finance.configure') ? button('Edit ' + c.name, () => editor(c)) : 'Read only'
          ]
        ], f.children);
        card.append(fold);
      }
      section.append(card);
    }
    if (!data.funds.length)
      note(section, 'No funds configured.');
    if (can('finance.configure')) {
      const order = panel('Public display order');
      note(order, 'Keyboard-friendly Move up / Move down controls reorder sibling funds without changing their hierarchy or routing.');
      const sorted = [...data.funds].sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));
      table(order, [
        [
          'Fund',
          f => f.name
        ],
        [
          'Order',
          f => f.display_order
        ],
        [
          'Change',
          f => {
            const siblings = sorted.filter(s => s.parent_id === f.parent_id), i = siblings.indexOf(f), box = E('div', null, { class: 'giving-actions' });
            for (const [label, index] of [
                [
                  'Move up',
                  i - 1
                ],
                [
                  'Move down',
                  i + 1
                ]
              ])
              if (siblings[index])
                box.append(button(label + ' ' + f.name, async b => {
                  const other = siblings[index];
                  confirm(b, 'Swap these funds in their sibling display order?', async () => {
                    await call('fund_reorder', {
                      id: f.id,
                      revision: f.revision,
                      other_id: other.id,
                      other_revision: other.revision
                    });
                    await render();
                  });
                }));
            return box;
          }
        ]
      ], sorted);
    }
  }
  async function pledges() {
    const data = await call('pledge_list'), p = panel('Pledge commitments'), same = data.pledges.filter(g => g.currency === currency), active = same.filter(g => [
        'active',
        'paused'
      ].includes(g.status));
    metrics(p, [
      [
        'Total Pledged',
        money(sum(same))
      ],
      [
        'Received',
        money(M.sum(same, 'received_minor'))
      ],
      [
        'Outstanding',
        money(active.reduce((n, g) => n + (BigInt(g.amount_minor) > BigInt(g.received_minor) ? BigInt(g.amount_minor) - BigInt(g.received_minor) : 0n), 0n).toString())
      ]
    ]);
    table(p, [
      [
        'Donor',
        g => g.donor_name || 'Household pledge'
      ],
      [
        'Fund / Campaign',
        g => g.fund_name + (g.campaign_reference ? ' \xB7 ' + g.campaign_reference : '')
      ],
      [
        'Pledged',
        g => money(g.amount_minor, g.currency)
      ],
      [
        'Received',
        g => money(g.received_minor, g.currency)
      ],
      [
        'Remaining / overage',
        g => money((BigInt(g.amount_minor) - BigInt(g.received_minor)).toString(), g.currency)
      ],
      [
        'Complete',
        g => M.percent(g.received_minor, g.amount_minor)
      ],
      [
        'Frequency',
        g => g.frequency
      ],
      [
        'Start',
        g => date(g.starts_on)
      ],
      [
        'End',
        g => date(g.ends_on)
      ],
      [
        'Status',
        g => state(g.status)
      ],
      [
        'Detail',
        g => link('View pledge', 'pledge', g.id)
      ]
    ], data.pledges, 'No pledges.');
    if (can('finance.pledges.manage'))
      await commitmentEditor(false);
  }
  async function pledge() {
    const data = await call('pledge_detail', { id: params.get('id') }), g = data.pledges[0], p = panel(g.donor_name || 'Household pledge');
    detail(p, [
      [
        'Fund / Campaign',
        g.fund_name + (g.campaign_reference ? ' \xB7 ' + g.campaign_reference : '')
      ],
      [
        'Pledged',
        money(g.amount_minor, g.currency)
      ],
      [
        'Received',
        money(g.received_minor, g.currency)
      ],
      [
        'Remaining / overage',
        money((BigInt(g.amount_minor) - BigInt(g.received_minor)).toString(), g.currency)
      ],
      [
        'Frequency',
        g.frequency
      ],
      [
        'Start',
        date(g.starts_on)
      ],
      [
        'Target',
        date(g.ends_on)
      ],
      [
        'Status',
        state(g.status)
      ],
      [
        'Notes',
        g.notes || 'None'
      ]
    ]);
    table(panel('Expectation schedule'), [
      [
        'Due',
        r => date(r.due_on)
      ],
      [
        'Expected',
        r => money(r.expected_minor, g.currency)
      ]
    ], g.schedule, 'No expectation schedule.');
    table(panel('Payment allocations'), [
      [
        'Date',
        r => date(r.created_at)
      ],
      [
        'Amount',
        r => money(r.amount_minor, g.currency)
      ],
      [
        'Gift',
        r => can('finance.gifts.read') ? link('View gift', 'gift', r.gift_id) : 'Gift history requires gift read permission'
      ]
    ], g.allocations);
    history(panel('History'), g.history);
    if (can('finance.pledges.manage')) {
      const actions = E('div', null, { class: 'giving-actions' });
      p.append(actions);
      for (const [label, status] of [
          [
            'Pause',
            'paused'
          ],
          [
            'Cancel pledge',
            'cancelled'
          ],
          [
            'Close pledge',
            'closed'
          ]
        ])
        actions.append(button(label, b => confirm(b, label + ' this pledge? Historical gifts and allocations remain unchanged.', async () => {
          await call('pledge_status', {
            request_key: crypto.randomUUID(),
            id: g.id,
            revision: g.revision,
            status
          });
          await render();
        })));
      formPanel('Future expectation / note', [
        [
          'frequency',
          'Frequency',
          {
            choices: [
              'weekly',
              'biweekly',
              'monthly',
              'custom',
              'none'
            ].map(x => [
              x,
              x
            ]),
            value: g.frequency
          }
        ],
        [
          'ends_on',
          'Target date',
          {
            type: 'date',
            required: false,
            value: g.ends_on
          }
        ],
        [
          'due_on',
          'Future expectation date',
          {
            type: 'date',
            required: false
          }
        ],
        [
          'expected',
          'Future expected amount',
          { required: false }
        ],
        [
          'notes',
          'Notes',
          {
            type: 'textarea',
            required: false,
            value: g.notes
          }
        ]
      ], 'pledge_expectation', c => {
        if (Boolean(c.due_on.value) !== Boolean(c.expected.value))
          throw Error('Set both future date and expected amount.');
        return {
          id: g.id,
          revision: g.revision,
          frequency: c.frequency.value,
          ends_on: c.ends_on.value || null,
          notes: c.notes.value,
          ...c.due_on.value ? {
            schedule: [{
                due_on: c.due_on.value,
                expected_minor: U.amountToMinor(c.expected.value, scale)
              }]
          } : {}
        };
      }, 'Update future expectations and note? Past schedule, contributions and allocations remain unchanged.');
    }
  }
  async function commitmentEditor(isRecurring) {
    const data = await call(isRecurring ? 'recurring_options' : 'pledge_options'), host = panel(null), fold = E('details');
    fold.append(E('summary', isRecurring ? 'Create a draft recurring instruction' : 'Create a pledge'));
    host.append(fold);
    const fields = [
      [
        'person_id',
        'Canonical donor',
        {
          choices: data.donors.map(d => [
            d.id,
            d.first_name + ' ' + d.last_name
          ])
        }
      ],
      [
        'household_id',
        'Household attribution',
        {
          required: false,
          choices: [[
              '',
              'Individual'
            ]]
        }
      ],
      [
        'fund_id',
        'Fund',
        {
          choices: data.funds.map(f => [
            f.id,
            f.name
          ])
        }
      ],
      [
        'amount',
        'Amount (' + currency + ')',
        {}
      ],
      [
        'frequency',
        'Frequency',
        {
          choices: (isRecurring ? [
            'weekly',
            'biweekly',
            'monthly',
            'twice_monthly',
            'custom'
          ] : [
            'weekly',
            'biweekly',
            'monthly',
            'custom',
            'none'
          ]).map(x => [
            x,
            x
          ])
        }
      ],
      [
        'starts_on',
        'Start date',
        {
          type: 'date',
          value: localNow().slice(0, 10)
        }
      ],
      [
        'ends_on',
        'End / target date',
        {
          type: 'date',
          required: false
        }
      ]
    ];
    if (isRecurring)
      fields.push([
        'next_run_at',
        'Next scheduled date (' + timezone + ')',
        { type: 'datetime-local' }
      ]);
    else
      fields.push([
        'notes',
        'Commitment note',
        {
          type: 'textarea',
          required: false
        }
      ]);
    const lines = [];
    const built = formPanel(isRecurring ? 'Recurring instruction' : 'Pledge', fields, isRecurring ? 'recurring_draft' : 'pledge_create', c => ({
      person_id: c.person_id.value,
      household_id: c.household_id.value || null,
      currency,
      frequency: c.frequency.value,
      starts_on: c.starts_on.value,
      ends_on: c.ends_on.value || null,
      ...isRecurring ? {
        next_local: c.next_run_at.value,
        lines: [
          {
            fund_id: c.fund_id.value,
            amount_minor: U.amountToMinor(c.amount.value, scale)
          },
          ...lines.map(l => ({
            fund_id: l.fund.value,
            amount_minor: U.amountToMinor(l.amount.value, scale)
          }))
        ]
      } : {
        fund_id: c.fund_id.value,
        amount_minor: U.amountToMinor(c.amount.value, scale),
        notes: c.notes.value
      }
    }), isRecurring ? 'Save one draft instruction with these fund allocations? No payment will run.' : 'Save this pledge commitment? No payment is collected.', fold);
    bindHouseholds(data, built.controls.person_id, built.controls.household_id);
    if (isRecurring) {
      const extra = E('div', null, { class: 'giving-full' });
      built.form.insertBefore(extra, built.save);
      extra.append(button('Add another fund', () => {
        const box = E('fieldset', null, { class: 'giving-form giving-full' });
        box.append(E('legend', 'Additional fund'));
        const fund = field(box, 'Fund', 'extra_fund', {
            choices: data.funds.map(f => [
              f.id,
              f.name
            ])
          }), amount = field(box, 'Amount (' + currency + ')', 'extra_amount');
        const l = {
          box,
          fund,
          amount
        };
        lines.push(l);
        box.append(button('Remove fund', () => {
          lines.splice(lines.indexOf(l), 1);
          box.remove();
          built.form.dispatchEvent(new Event('input', { bubbles: true }));
        }));
        extra.append(box);
        built.form.dispatchEvent(new Event('input', { bubbles: true }));
      }));
      note(built.section, 'All allocations form one instruction. Multiple MID routes are summarized at review, and no provider action is enabled.');
    }
  }
  function recurringTable(p, rows) {
    table(p, [
      [
        'Donor',
        g => g.donor_name
      ],
      [
        'Total',
        g => money(sum(g.lines), g.currency)
      ],
      [
        'Funds',
        g => g.lines.map(l => l.fund_name + ' ' + money(l.amount_minor, g.currency)).join(' \xB7 ')
      ],
      [
        'Frequency',
        g => g.frequency
      ],
      [
        'Next run',
        g => date(g.next_run_at, true)
      ],
      [
        'Payment method',
        g => g.payment_descriptor || 'Not configured'
      ],
      [
        'Gateway / MID',
        g => [...new Set(g.lines.map(l => [
            l.route_snapshot?.gateway_label || l.route_snapshot?.provider,
            l.route_snapshot?.processor_label || l.route_snapshot?.mid_reference
          ].filter(Boolean).join(' / ')))].join(' \xB7 ') || 'Not configured'
      ],
      [
        'Status',
        g => state(g.status)
      ],
      [
        'Detail',
        g => link('View instruction', 'recurringdetail', g.id)
      ]
    ], rows, 'No recurring gifts.');
  }
  async function recurring() {
    const data = await call('recurring_list'), p = panel('Recurring instructions');
    recurringTable(p, data.instructions);
    note(p, 'One instruction can include multiple funds. Processing and provider actions remain disabled until activation.');
    if (can('finance.recurring.manage'))
      await commitmentEditor(true);
  }
  async function recurringdetail() {
    const data = await call('recurring_detail', { id: params.get('id') }), g = data.instructions[0], p = panel('One recurring instruction');
    metrics(p, [
      [
        'Total per occurrence',
        money(sum(g.lines), g.currency)
      ],
      [
        'Frequency',
        g.frequency
      ],
      [
        'Next run',
        date(g.next_run_at, true)
      ],
      [
        'Status',
        g.status
      ]
    ]);
    detail(p, [
      [
        'Donor',
        g.donor_name
      ],
      [
        'Payment descriptor',
        g.payment_descriptor || 'Not configured'
      ],
      [
        'Failure state',
        g.failure_state || 'No failure recorded'
      ]
    ]);
    table(panel('Fund allocations & retained routing'), [
      [
        'Fund',
        l => l.fund_name
      ],
      [
        'Amount',
        l => money(l.amount_minor, g.currency)
      ],
      [
        'Destination',
        l => l.route_snapshot.destination_label
      ],
      [
        'Gateway',
        l => l.route_snapshot.gateway_label || l.route_snapshot.provider
      ],
      [
        'Route / MID',
        l => l.route_snapshot.processor_label || l.route_snapshot.mid_reference || l.route_snapshot.processor_reference
      ]
    ], g.lines);
    history(panel('Scheduled run history'), g.runs);
    history(panel('Instruction history'), g.history);
    const actions = panel('Provider actions');
    for (const text of [
        'Update payment method',
        'Activate instruction'
      ]) {
      const b = E('button', text, {
        type: 'button',
        disabled: '',
        title: 'Requires separately approved provider activation'
      });
      actions.append(b);
    }
    note(actions, 'Unavailable until the processor and its recurring capabilities are reviewed and activated. No payment token or account number is exposed.');
  }
  function batchLabel(s) {
    return {
      attention: 'Difference',
      balanced: 'Reconciled'
    }[s] || String(s).replace(/^./, x => x.toUpperCase());
  }
  async function batches() {
    const data = await call('batch_list'), tabs = panel('Batch workspace'), nav = E('div', null, {
        class: 'giving-periods giving-batch-tabs',
        role: 'group',
        'aria-label': 'Batch section'
      }), out = E('div');
    tabs.append(nav, out);
    function show(kind) {
      out.replaceChildren();
      for (const b of nav.children)
        b.setAttribute('aria-pressed', String(b.dataset.kind === kind));
      const rows = data.batches.filter(b => kind === 'reconciliation' || kind === 'settlement' === (b.kind === 'processor_settlement'));
      table(out, [
        [
          'Date',
          b => date(b.batch_date)
        ],
        [
          'Batch',
          b => link(b.label, 'batch', b.id)
        ],
        [
          'Type',
          b => b.kind.replaceAll('_', ' ')
        ],
        [
          'Reference',
          b => b.reference || 'None'
        ],
        [
          'Ledger total',
          b => money(b.ledger_minor, b.currency)
        ],
        [
          'Deposit / Settlement',
          b => money(b.deposit_minor, b.currency) + ' / ' + money(b.settlement_minor, b.currency)
        ],
        [
          'Difference',
          b => money(b.difference_minor, b.currency)
        ],
        [
          'Status',
          b => state(batchLabel(b.status))
        ],
        [
          'Reviewer',
          b => b.reviewer || 'Not reviewed'
        ]
      ], rows, kind === 'reconciliation' ? 'No reconciliation batches.' : 'No ' + kind + ' batches.');
    }
    for (const [k, l] of [
        [
          'manual',
          'Manual Batches'
        ],
        [
          'settlement',
          'Settlement Batches'
        ],
        [
          'reconciliation',
          'Reconciliation'
        ]
      ]) {
      const b = button(l, () => show(k));
      b.dataset.kind = k;
      nav.append(b);
    }
    show('manual');
    if (can('finance.reconciliation.manage')) {
      formPanel('Batch', [
        [
          'label',
          'Batch label',
          {}
        ],
        [
          'kind',
          'Batch type',
          {
            choices: [
              [
                'service',
                'Service'
              ],
              [
                'manual_deposit',
                'Manual deposit'
              ],
              [
                'processor_settlement',
                'Processor settlement'
              ]
            ]
          }
        ],
        [
          'batch_date',
          'Batch date',
          {
            type: 'date',
            value: localNow().slice(0, 10)
          }
        ],
        [
          'reference',
          'Deposit / settlement reference',
          { required: false }
        ]
      ], 'batch_create', c => ({
        label: c.label.value,
        kind: c.kind.value,
        currency,
        batch_date: c.batch_date.value,
        reference: c.reference.value
      }));
    }
  }
  async function batch() {
    const data = await call('batch_detail', { id: params.get('id') }), b = data.batches[0], p = panel(b.label);
    metrics(p, [
      [
        'Ledger / expected deposit',
        money(b.ledger_minor, b.currency)
      ],
      [
        'Recorded deposit',
        money(b.deposit_minor, b.currency)
      ],
      [
        'Settlement',
        money(b.settlement_minor, b.currency)
      ],
      [
        'Difference',
        money(b.difference_minor, b.currency)
      ]
    ]);
    detail(p, [
      [
        'Date',
        date(b.batch_date)
      ],
      [
        'Type',
        b.kind
      ],
      [
        'Reference',
        b.reference || 'None'
      ],
      [
        'Status',
        state(batchLabel(b.status))
      ],
      [
        'Reviewer',
        b.reviewer || 'Not reviewed'
      ],
      [
        'Notes',
        b.reconciliation_notes || 'None'
      ]
    ]);
    giftTable(panel('Included Gifts'), b.gifts);
    table(panel('Fund Totals'), [
      [
        'Fund',
        r => r.label
      ],
      [
        'Amount',
        r => money(r.amount_minor, b.currency)
      ]
    ], M.group(b.gifts, 'fund_name'));
    table(panel('Payment-Type Totals'), [
      [
        'Method',
        r => methodLabel(r.label)
      ],
      [
        'Amount',
        r => money(r.amount_minor, b.currency)
      ]
    ], M.group(b.gifts, 'payment_method'));
    history(panel('History'), b.history);
    if (can('finance.reconciliation.manage')) {
      const actions = E('div', null, { class: 'giving-actions' });
      p.append(actions);
      for (const [label, status] of b.status === 'open' ? [[
            'Mark Ready',
            'ready'
          ]] : b.status === 'ready' ? [[
            'Reopen for entry',
            'open'
          ]] : b.status === 'reconciled' ? [[
            'Close Batch',
            'closed'
          ]] : [])
        actions.append(button(label, bn => confirm(bn, label + '?', async () => {
          await call('batch_state', {
            id: b.id,
            request_key: crypto.randomUUID(),
            status
          });
          await render();
        })));
      if ([
          'open',
          'ready'
        ].includes(b.status))
        formPanel('Reconciliation', [
          [
            'settlement',
            'Expected / settlement amount (' + b.currency + ')',
            {}
          ],
          [
            'deposit',
            'Recorded deposit (' + b.currency + ')',
            {}
          ],
          [
            'notes',
            'Notes',
            {
              type: 'textarea',
              required: false
            }
          ]
        ], 'reconcile', c => ({
          batch_id: b.id,
          settlement_minor: U.amountToMinor(c.settlement.value, scale, true),
          deposit_minor: U.amountToMinor(c.deposit.value, scale, true),
          notes: c.notes.value
        }), 'Record reconciliation totals? Differences remain visible; posted gifts will not be rewritten.');
    }
  }
  async function merchants() {
    const data = await call('merchant_management'), summary = panel('Gateway & merchant overview');
    note(summary, 'Not connected \xB7 No credentials are collected here. Multiple gateway accounts can serve this organization; fund hierarchy does not select a MID.');
    for (const g of data.gateways) {
      const card = E('div', null, { class: 'giving-gateway-card' });
      card.append(E('h3', g.label), state(g.provider === 'authorize_net' ? 'Authorize.Net' : g.provider.toUpperCase()), E('p', g.environment + ' \xB7 Not connected'));
      const routes = data.routes.filter(r => r.gateway_id === g.id);
      for (const r of routes) {
        const box = E('div', null, { class: 'giving-route-card' });
        box.append(E('h4', r.label), E('p', 'MID/reference: ' + (r.mid_reference || r.processor_reference)), E('p', 'Funds: ' + data.routing.filter(f => f.processor_route_id === r.id).map(f => f.fund).join(', ')));
        card.append(box);
      }
      note(card, g.provider === 'authorize_net' ? 'A single merchant route can receive many fund designations.' : 'Distinct processor / MID routes retain their fund assignments. Capabilities remain unverified until boarding.');
      summary.append(card);
    }
    if (!data.gateways.length)
      note(summary, 'No gateway accounts configured.');
    const matrix = panel('Fund Routing Matrix');
    table(matrix, [
      [
        'Fund',
        r => r.fund
      ],
      [
        'Merchant destination',
        r => r.destination || 'Not configured'
      ],
      [
        'Gateway',
        r => r.gateway || 'Not configured'
      ],
      [
        'MID / Route',
        r => r.mid || r.route || 'Not configured'
      ],
      [
        'Status',
        r => state(r.status)
      ]
    ], data.routing, 'No merchant routes configured.');
    note(matrix, 'Current routing is shown here. Posted gifts and recurring lines retain their historical route snapshot.');
    const advanced = panel('Advanced configuration'), fold = E('details'), heading = E('summary', 'Gateway Accounts, Merchant Destinations & MID Routes');
    fold.append(heading);
    advanced.append(fold);
    table(fold, [
      [
        'Gateway',
        g => g.label
      ],
      [
        'Provider',
        g => g.provider
      ],
      [
        'Environment',
        g => g.environment
      ],
      [
        'State',
        () => state('Not connected')
      ]
    ], data.gateways);
    table(fold, [
      [
        'Destination',
        d => d.merchant_label
      ],
      [
        'Currency',
        d => d.currency
      ],
      [
        'Legal entity',
        d => d.legal_entity || 'Not recorded'
      ]
    ], data.destinations);
    table(fold, [
      [
        'Processor / MID route',
        r => r.label
      ],
      [
        'Processor reference',
        r => r.processor_reference
      ],
      [
        'MID',
        r => r.mid_reference || 'None'
      ]
    ], data.routes);
    formPanel('Gateway account', [
      [
        'label',
        'Account label',
        {}
      ],
      [
        'provider',
        'Provider',
        {
          choices: [
            [
              'authorize_net',
              'Authorize.Net'
            ],
            [
              'nmi',
              'NMI'
            ]
          ]
        }
      ]
    ], 'gateway_create', c => ({
      label: c.label.value,
      provider: c.provider.value
    }), 'Create a disabled gateway configuration? No processor will be connected.', fold);
    if (data.gateways.length)
      formPanel('Processor route', [
        [
          'gateway_id',
          'Gateway',
          {
            choices: data.gateways.map(g => [
              g.id,
              g.label
            ])
          }
        ],
        [
          'label',
          'Route label',
          {}
        ],
        [
          'processor_reference',
          'Non-secret processor reference',
          {}
        ],
        [
          'mid_reference',
          'Non-secret MID reference',
          { required: false }
        ]
      ], 'processor_create', c => ({
        gateway_id: c.gateway_id.value,
        label: c.label.value,
        processor_reference: c.processor_reference.value,
        mid_reference: c.mid_reference.value
      }), 'Create a route reference only?', fold);
    if (data.routes.length) {
      const built = formPanel('Merchant destination', [
        [
          'label',
          'Destination label',
          {}
        ],
        [
          'purpose',
          'Purpose',
          {}
        ],
        [
          'legal_entity',
          'Legal entity',
          { required: false }
        ],
        [
          'deposit_label',
          'Deposit label',
          { required: false }
        ],
        [
          'currency',
          'Currency',
          { value: currency }
        ],
        [
          'gateway_id',
          'Gateway',
          {
            choices: data.gateways.map(g => [
              g.id,
              g.label
            ])
          }
        ],
        [
          'processor_route_id',
          'Processor / MID',
          {
            choices: data.routes.map(r => [
              r.id,
              r.label
            ])
          }
        ]
      ], 'destination_create', c => ({
        label: c.label.value,
        purpose: c.purpose.value,
        legal_entity: c.legal_entity.value,
        deposit_label: c.deposit_label.value,
        currency: c.currency.value.toUpperCase(),
        gateway_id: c.gateway_id.value,
        processor_route_id: c.processor_route_id.value
      }), 'Create a disabled merchant configuration?', fold);
      built.controls.gateway_id.onchange = () => built.controls.processor_route_id.replaceChildren(...data.routes.filter(r => r.gateway_id === built.controls.gateway_id.value).map(r => E('option', r.label, { value: r.id })));
      built.controls.gateway_id.onchange();
    }
  }
  const renderers = {
    overview,
    gifts,
    gift,
    manual,
    donors,
    donor,
    funds,
    pledges,
    pledge,
    recurring,
    recurringdetail,
    batches,
    batch,
    merchants
  };
  async function render() {
    root.replaceChildren();
    const header = E('header', null, { class: 'giving-header' }), copy = E('div');
    copy.append(E('p', 'GIVING / FINANCE', { class: 'staff-eyebrow' }), E('h1', titles[view], { tabindex: '-1' }), E('p', scope.name + ' \xB7 Finance workspace'));
    header.append(copy);
    root.append(header);
    const orgpick = field(header, 'Authorized organization', 'organization', {
      choices: context.organizations.filter(o => o.permissions.includes(required[view])).map(o => [
        o.id,
        o.name
      ]),
      value: org
    });
    orgpick.onchange = async () => {
      org = orgpick.value;
      scope = context.organizations.find(o => o.id === org);
      epoch++;
      currency = scope.currency;
      scale = scope.minor_unit_scale;
      timezone = scope.timezone || 'UTC';
      window.StaffWorkspace.refresh();
      try {
        await render();
      } catch (e) {
        feedback(e.message, true);
      }
    };
    if (can('finance.gifts.create') && view !== 'manual') {
      const actions = E('div', null, { class: 'giving-actions' });
      actions.append(link('Record received gift', 'manual'));
      header.append(actions);
    }
    root.append(E('p', 'Online processors and Text-to-Give are not connected. GiveHub remains the live giving system.', {
      class: 'giving-note',
      role: 'status'
    }));
    await renderers[view]();
  }
  async function start(preserve = false) {
    // Permission polling has its own sequence. An unchanged refresh must not
    // cancel a pending finance read; epoch changes only when its scope does.
    const token = ++contextSequence, previous = scope, priorUser = userId;
    try {
      const user = await auth.getUser();
      if (token !== contextSequence)
        return;
      if (!user || user.is_anonymous) {
        epoch++;
        userId = null;
        root.replaceChildren();
        window.StaffWorkspace.state(root, 'Sign in required', 'Use your authorized finance account.', 'Sign in', 'discipleship-login.html?next=' + encodeURIComponent('/' + location.pathname.split('/').pop()));
        return;
      }
      if (userId !== user.id)
        epoch++;
      userId = user.id;
      const res = await auth.client.rpc('giving_workspace', {
        p_action: 'context',
        p_org: null,
        p_payload: {}
      });
      if (token !== contextSequence || (await auth.getUser())?.id !== userId)
        return;
      if (res.error)
        throw Error('Finance access could not be checked.');
      context = res.data;
      scope = context.organizations.find(o => o.id === org && o.permissions.includes(required[view])) || (!org ? context.organizations.find(o => o.permissions.includes(required[view])) : null);
      if (!scope) {
        epoch++;
        root.replaceChildren();
        window.StaffWorkspace.denied(root, 'Your current permissions do not include this finance section.');
        window.StaffWorkspace.refresh();
        return;
      }
      org = scope.id;
      currency = scope.currency || 'USD';
      scale = scope.minor_unit_scale ?? 2;
      timezone = scope.timezone || 'UTC';
      if (preserve && priorUser === userId && previous?.id === org && JSON.stringify(previous.permissions) === JSON.stringify(scope.permissions))
        return;
      epoch++;
      await render();
    } catch (e) {
      if (token !== contextSequence)
        return;
      epoch++;
      root.replaceChildren();
      window.StaffWorkspace.state(root, 'Finance unavailable', e.message, 'Return to Staff Dashboard', 'staff-people.html');
    }
  }
  auth.client.auth.onAuthStateChange((_event, session) => {
    if (session?.user?.id !== userId) {
      epoch++;
      contextSequence++;
      root.replaceChildren();
      window.StaffWorkspace.refresh();
      setTimeout(start, 0);
    }
  });
  window.addEventListener('focus', () => {
    if (!busy)
      start(true);
  });
  setInterval(() => {
    if (!busy && document.visibilityState === 'visible')
      start(true);
  }, 20000);
  start();
})();
