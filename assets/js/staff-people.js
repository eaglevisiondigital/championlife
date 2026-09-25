(() => {
  const auth = window.ChampionLifeAuth;
  const $ = id => document.getElementById(id);
  const status = $('status'), select = $('organization'), body = $('people');
  let user, permissions = [], rows = [], page = 0, request = 0, editing = null, invalid = false;
  const size = 25;
  function can(permission, org = select.value) {
    return permissions.some(p => p.organization_id === org && p.permission === permission);
  }
  function clearPrivateView() {
    invalid = true; request++; rows = []; permissions = []; editing = null;
    body.replaceChildren(); select.replaceChildren(); $('workspace').hidden = true;
    $('editor').close(); $('person-form').reset();
    status.textContent = 'Your account changed. Reload this page to continue.';
  }
  async function loadPeople() {
    const token = ++request, org = select.value;
    rows = []; body.replaceChildren(); $('previous').disabled = true; $('next').disabled = true;
    if (invalid || !can('people.read', org)) return;
    status.textContent = 'Loading people...';
    $('access').textContent = can('people.update') ? 'You can view and edit contact details.' : 'You have view-only access.';
    const {data, error} = await auth.client.from('organization_people')
      .select('id,organization_id,first_name,last_name,email,phone,updated_at')
      .eq('organization_id', org).order('last_name').order('id').range(page * size, page * size + size);
    if (invalid || token !== request) return;
    if (error) { status.textContent = 'People could not be loaded. Refresh to try again.'; return; }
    rows = (data || []).slice(0, size);
    $('next').disabled = (data || []).length <= size; $('previous').disabled = page === 0;
    $('page').textContent = 'Page ' + (page + 1);
    status.textContent = rows.length ? rows.length + ' people shown.' : 'No people records are available in this organization.';
    for (const person of rows) {
      const tr = document.createElement('tr');
      for (const value of [(person.first_name + ' ' + person.last_name).trim(), person.email || '—', person.phone || '—']) {
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
  select.addEventListener('change', () => { page = 0; loadPeople(); });
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
      $('workspace').hidden = false; await loadPeople();
    } catch (_) { status.textContent = 'Your workspace could not be loaded. Reload to try again.'; }
  }
  start();
})();
