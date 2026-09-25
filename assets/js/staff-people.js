(() => {
  const auth = window.ChampionLifeAuth;
  const $ = id => document.getElementById(id);
  const status = $('status'), select = $('organization'), body = $('people');
  let user, permissions = [], rows = [], page = 0, request = 0, editing = null, invalid = false;
  const size = 25;
  let currentView = 'overview', searchText = '', searchField = 'last_name';
  const views = {
    overview: ['Your ministry workspace.', 'Choose your next step and stay connected to your people.'],
    people: ['People and connection.', 'Care for the people connected to your church and ministry.'],
    modules: ['Room for every next step.', 'The full platform is taking shape around your ministry.']
  };
  const modules = [
    ['People', 'Organization contacts and permitted contact editing.', 'Available', 'Kingdom Propel'],
    ['Households & Family Hub', 'Family relationships, calendars and registrations.', 'Planned', 'Kingdom Propel'],
    ['Giving & partners', 'Funds, manual gifts, statements, partnerships and DAF support.', 'Planned', 'Kingdom Propel'],
    ['Forms', 'Drag-and-drop forms with desktop/mobile editing and payments.', 'Planned', 'Kingdom Propel'],
    ['Serving, groups & events', 'Volunteer schedules, groups, events and check-in.', 'Planned', 'Kingdom Propel'],
    ['Follow-up & care', 'Next steps, assignments and restricted pastoral care.', 'Planned', 'Kingdom Propel'],
    ['Discipleship', 'Shared courses, lessons and learner progress. Learner portal exists; staff tools are planned.', 'Staff tools planned', 'Lockliel'],
    ['Evangelism & sharing', 'Approved invitations and shareable evangelistic resources.', 'Planned', 'Lockliel'],
    ['Communications & reports', 'Segmented messaging, preferences and ministry reporting.', 'Planned', 'Kingdom Propel'],
    ['Kingdom Raise', 'Project giving boards for your ministry goals.', 'Later phase', 'Kingdom Propel'],
    ['Host church coordination', 'Outreach preparation and host church collaboration.', 'Awaiting department process', 'Kingdom Propel']
  ];
  for (const [name, description, stage, provider] of modules) {
    const card = document.createElement('article'); card.className = 'module-card';
    for (const [tag, value] of [['span',stage], ['h3',name], ['p',description], ['small','Powered by ' + provider]]) {
      const el = document.createElement(tag); el.textContent = value; card.append(el);
    }
    $('module-grid').append(card);
  }
  function showView(view, focus = true) {
    if (!views[view]) return;
    currentView = view;
    for (const name of Object.keys(views)) $('view-' + name).hidden = name !== view;
    document.querySelectorAll('.sidebar [data-view]').forEach(button => {
      if (button.dataset.view === view) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    $('view-title').textContent = views[view][0]; $('view-description').textContent = views[view][1];
    $('refresh').hidden = view !== 'people';
    if (focus) $('view-title').focus();
    if (!invalid && permissions.length && view === 'people') loadPeople();
    else if (permissions.length && !invalid) { request++; status.textContent = 'Workspace ready.'; }
  }
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
  function updateOrganization() {
    $('workspace-name').textContent = select.selectedOptions[0]?.textContent || 'Ministry workspace';
    $('access-summary').textContent = can('people.update') ? 'You can view people and edit contact details in this organization.' : 'You have view-only access to people in this organization.';
  }
  showView('overview', false);
  function can(permission, org = select.value) {
    return permissions.some(p => p.organization_id === org && p.permission === permission);
  }
  function clearPrivateView() {
    invalid = true; request++; rows = []; permissions = []; editing = null;
    body.replaceChildren(); select.replaceChildren(); $('workspace').hidden = true;
    $('editor').close(); $('person-form').reset(); $('access-summary').textContent = ''; $('workspace-name').textContent = 'Ministry workspace';
    status.textContent = 'Your account changed. Reload this page to continue.';
  }
  async function loadPeople() {
    const token = ++request, org = select.value;
    rows = []; body.replaceChildren(); $('previous').disabled = true; $('next').disabled = true;
    if (invalid || !can('people.read', org)) return;
    status.textContent = 'Loading people...';
    $('access').textContent = can('people.update') ? 'You can view and edit contact details.' : 'You have view-only access.';
    let query = auth.client.from('organization_people')
      .select('id,organization_id,first_name,last_name,email,phone,updated_at')
      .eq('organization_id', org);
    if (searchText) query = query.ilike(searchField, '%' + searchText.replace(/[\\%_]/g, '\\$&') + '%');
    let result;
    try { result = await query.order('last_name').order('id').range(page * size, page * size + size); }
    catch (_) { result = {error: true}; }
    const {data, error} = result;
    if (invalid || token !== request) return;
    if (error) { status.textContent = 'People could not be loaded. Refresh to try again.'; return; }
    rows = (data || []).slice(0, size);
    $('next').disabled = (data || []).length <= size; $('previous').disabled = page === 0;
    $('page').textContent = 'Page ' + (page + 1);
    status.textContent = rows.length ? rows.length + ' people shown.' : 'No people records are available in this organization.';
    for (const person of rows) {
      const tr = document.createElement('tr');
      for (const value of [(person.first_name + ' ' + person.last_name).trim(), person.email || 'Not provided', person.phone || 'Not provided']) {
        const td = document.createElement('td'); td.textContent = value; tr.append(td);
      }
      const action = document.createElement('td');
      if (can('people.update')) {
        const button = document.createElement('button'); button.textContent = 'Edit';
        button.setAttribute('aria-label', 'Edit ' + person.first_name + ' ' + person.last_name);
        button.addEventListener('click', () => {
          editing = {...person};
          for (const name of ['first_name','last_name','email','phone']) $('person-form').elements.namedItem(name).value = person[name] || '';
          $('edit-status').textContent = ''; $('editor').showModal();
        }); action.append(button);
      } else action.textContent = 'View only';
      tr.append(action); body.append(tr);
    }
  }
  $('person-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (invalid || !editing || !can('people.update', editing.organization_id)) return;
    const person = {...editing}, values = {};
    for (const name of ['first_name','last_name','email','phone']) values[name] = $('person-form').elements.namedItem(name).value.trim() || null;
    if (!values.first_name || !values.last_name) { $('edit-status').textContent = 'First and last name are required.'; return; }
    $('save').disabled = true;
    try {
      if ((await auth.getUser())?.id !== user.id) { clearPrivateView(); return; }
      const {data, error} = await auth.client.from('organization_people')
        .update({...values, updated_at:new Date().toISOString()})
        .eq('id', person.id).eq('organization_id', person.organization_id).eq('updated_at', person.updated_at)
        .select('id').maybeSingle();
      if (invalid) return;
      if (error || !data) { $('edit-status').textContent = 'Changes were not saved. Access may have changed or another person updated this record. Close and refresh before retrying.'; return; }
      $('editor').close(); editing = null; await loadPeople();
      if (!invalid) status.textContent = 'Contact details saved.';
    } catch (_) { if (!invalid) $('edit-status').textContent = 'Changes were not saved. Please try again.'; }
    finally { $('save').disabled = false; }
  });
  $('cancel').addEventListener('click', () => { $('editor').close(); editing = null; });
  select.addEventListener('change', () => {
    request++; page = 0; rows = []; body.replaceChildren(); editing = null;
    $('editor').close(); $('person-form').reset(); searchText = ''; $('search-query').value = '';
    updateOrganization(); showView(currentView, false);
  });
  $('search-form').addEventListener('submit', event => {
    event.preventDefault(); searchText = $('search-query').value.trim();
    searchField = ['first_name','last_name','email'].includes($('search-field').value) ? $('search-field').value : 'last_name';
    page = 0; loadPeople();
  });
  $('clear-search').addEventListener('click', () => { searchText = ''; $('search-query').value = ''; page = 0; loadPeople(); });
  $('refresh').addEventListener('click', () => loadPeople());
  $('previous').addEventListener('click', () => { if (page > 0) page--; loadPeople(); });
  $('next').addEventListener('click', () => { page++; loadPeople(); });
  $('sign-out').addEventListener('click', async () => {
    try { await auth.signOut(); location.assign('discipleship-login.html?next=staff-people.html'); }
    catch (_) { status.textContent = 'Sign out failed. Please try again.'; }
  });
  async function start() {
    try {
      if (!auth) throw new Error('Auth unavailable');
      user = await auth.getUser();
      if (!user) { status.textContent = 'Sign in to access your ministry workspace.'; $('sign-in').hidden = false; return; }
      $('sign-out').hidden = false;
      auth.client.auth.onAuthStateChange((_event, session) => { if (session?.user?.id !== user.id) clearPrivateView(); });
      const [grants, orgs] = await Promise.all([
        auth.client.from('organization_staff_permissions').select('organization_id,permission').eq('user_id',user.id).is('revoked_at',null),
        auth.client.from('organizations').select('id,name').order('name')
      ]);
      if (invalid) return;
      if (grants.error || orgs.error) throw new Error('Workspace unavailable');
      permissions = grants.data || [];
      const available = (orgs.data || []).filter(org => can('people.read',org.id));
      if (!available.length) { status.textContent = 'No staff workspace is assigned to this account yet. Ask your ministry administrator for access.'; return; }
      for (const org of available) { const option = document.createElement('option'); option.value = org.id; option.textContent = org.name; select.append(option); }
      $('workspace').hidden = false; updateOrganization(); showView(currentView, false);
    } catch (_) { status.textContent = 'Your workspace could not be loaded. Reload to try again.'; }
  }
  start();
})();
