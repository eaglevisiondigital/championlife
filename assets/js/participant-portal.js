(() => {
  const auth = window.ChampionLifeAuth;
  const $ = id => document.getElementById(id);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const params = new URLSearchParams(location.search);
  const requested = uuid.test(params.get('area') || '') && uuid.test(params.get('resource') || '')
    ? { area: params.get('area'), resource: params.get('resource') } : null;
  let user, invalid = false, areas = [], generation = 0, detailToken = 0, page = 0, search = '', opened = null;
  const size = 12;
  function resourcePath(area, resource) {
    return '/my-ministry.html?area=' + encodeURIComponent(area) + '&resource=' + encodeURIComponent(resource);
  }
  function resetDetail() {
    detailToken++;
    opened = null;
    $('ministry-resource').close();
    $('ministry-resource-title').textContent = 'Resource';
    $('ministry-resource-body').textContent = '';
    $('ministry-resource-status').textContent = '';
    $('ministry-resource-copy').hidden = true;
    $('ministry-resource-link').hidden = true;
    $('ministry-resource-link').value = '';
  }
  function clear() {
    generation++;
    resetDetail();
    areas = []; page = 0; search = '';
    $('ministry-search').value = '';
    $('ministry-area').replaceChildren();
    $('ministry-resources').replaceChildren();
    $('ministry-workspace').hidden = true;
  }
  function accountChanged() {
    invalid = true; clear();
    $('ministry-status').textContent = 'Your account changed. Reload to continue.';
  }
  async function loadAreas(initial = false) {
    const token = ++generation;
    if (invalid || !user) return;
    resetDetail();
    $('ministry-resources').replaceChildren();
    $('ministry-workspace').hidden = true;
    $('ministry-status').textContent = 'Loading your ministry areas...';
    try {
      const { data, error } = await auth.client.from('portal_areas')
        .select('id,organization_id,area_key,title,organization_label').order('organization_label').order('title');
      if (token !== generation || invalid) return;
      if (error) throw error;
      const current = initial && requested ? requested.area : $('ministry-area').value;
      areas = data || [];
      $('ministry-area').replaceChildren();
      for (const area of areas) {
        const option = document.createElement('option');
        option.value = area.id;
        option.textContent = area.organization_label + ' · ' + area.title;
        $('ministry-area').append(option);
      }
      if (!areas.length) {
        $('ministry-status').textContent = 'No ministry areas are assigned to this account yet. Ask your church or SowGo administrator to review your account connection and participation.';
        return;
      }
      if (areas.some(a => a.id === current)) $('ministry-area').value = current;
      $('ministry-workspace').hidden = false;
      page = 0;
      const listToken = await loadResources();
      if (listToken !== generation || invalid) return;
      if (initial && requested) {
        const area = areas.find(a => a.id === requested.area);
        if (area) await openResource(requested.resource, area);
        else $('ministry-status').textContent = 'That resource is unavailable or your account does not have access. You can browse your available areas below.';
      }
    } catch (_) {
      if (token === generation && !invalid) {
        clear();
        $('ministry-status').textContent = 'Access could not be loaded. Reload to try again.';
      }
    }
  }
  async function loadResources() {
    const area = areas.find(x => x.id === $('ministry-area').value), token = ++generation;
    resetDetail();
    $('ministry-resources').replaceChildren();
    $('ministry-prev').disabled = true;
    $('ministry-next').disabled = true;
    if (invalid || !area) return token;
    $('ministry-status').textContent = 'Loading resources...';
    try {
      let query = auth.client.from('portal_resources').select('id,title,summary')
        .eq('organization_id', area.organization_id).eq('area_id', area.id).eq('status', 'published');
      // A dedicated filter avoids interpolating user input into PostgREST boolean expressions.
      if (search) query = query.ilike('title', '%' + search + '%');
      const { data, error } = await query.order('updated_at', { ascending: false }).order('id')
        .range(page * size, page * size + size);
      if (token !== generation || invalid) return token;
      if (error) throw error;
      const rows = data || [];
      $('ministry-prev').disabled = page === 0;
      $('ministry-next').disabled = rows.length <= size;
      $('ministry-status').textContent = rows.length
        ? 'Page ' + (page + 1) + ' · ' + area.organization_label + ' · ' + area.title + (search ? ' · Search: ' + search : '')
        : search ? 'No matching titles in this area. Try another search or clear the search.'
          : page ? 'No more resources on this page. Use Previous to return.'
            : 'No published resources are available here. Refresh access if your participation changed.';
      for (const row of rows.slice(0, size)) {
        const card = document.createElement('article'); card.className = 'module-card';
        const title = document.createElement('h2'); title.textContent = row.title;
        const summary = document.createElement('p'); summary.textContent = row.summary;
        const button = document.createElement('button'); button.textContent = 'Read resource';
        button.setAttribute('aria-label', 'Read ' + row.title);
        button.addEventListener('click', () => openResource(row.id, area));
        card.append(title, summary, button); $('ministry-resources').append(card);
      }
    } catch (_) {
      if (token === generation && !invalid) {
        $('ministry-prev').disabled = page === 0;
        $('ministry-status').textContent = 'Resources could not load. Search again or refresh access to retry.';
      }
    }
    return token;
  }
  async function openResource(id, area) {
    resetDetail();
    const token = detailToken;
    if (invalid) return;
    $('ministry-resource-status').textContent = 'Loading...';
    $('ministry-resource').showModal();
    try {
      const { data, error } = await auth.client.from('portal_resources').select('title,body')
        .eq('organization_id', area.organization_id).eq('area_id', area.id).eq('id', id)
        .eq('status', 'published').maybeSingle();
      if (token !== detailToken || invalid) return;
      if (error || !data) throw new Error('Unavailable');
      $('ministry-resource-title').textContent = data.title;
      $('ministry-resource-body').textContent = data.body;
      $('ministry-resource-status').textContent = 'Shared links require sign-in and access to this area.';
      opened = { area: area.id, resource: id };
      $('ministry-resource-copy').hidden = false;
    } catch (_) {
      if (token === detailToken && !invalid)
        $('ministry-resource-status').textContent = 'This resource is unavailable or your access has changed.';
    }
  }
  $('ministry-resource-copy').addEventListener('click', async () => {
    if (!opened || invalid) return;
    const token = detailToken, url = location.origin + resourcePath(opened.area, opened.resource);
    try {
      await navigator.clipboard.writeText(url);
      if (token === detailToken && !invalid) $('ministry-resource-status').textContent = 'Link copied. Recipients need their own access to this area.';
    } catch (_) {
      if (token !== detailToken || invalid) return;
      $('ministry-resource-link').value = url;
      $('ministry-resource-link').hidden = false;
      $('ministry-resource-link').focus(); $('ministry-resource-link').select();
      $('ministry-resource-status').textContent = 'Copy the selected link. Recipients need their own access to this area.';
    }
  });
  $('ministry-resource-close').addEventListener('click', resetDetail);
  $('ministry-resource').addEventListener('cancel', resetDetail);
  $('ministry-area').addEventListener('change', () => {
    page = 0; search = ''; $('ministry-search').value = ''; loadResources();
  });
  $('ministry-search-form').addEventListener('submit', event => {
    event.preventDefault();
    search = $('ministry-search').value.replace(/[\\%_*]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
    $('ministry-search').value = search; page = 0; loadResources();
  });
  $('ministry-search-clear').addEventListener('click', () => {
    search = ''; $('ministry-search').value = ''; page = 0; loadResources();
  });
  $('ministry-refresh').addEventListener('click', () => loadAreas());
  $('ministry-prev').addEventListener('click', () => { if (page > 0) page--; loadResources(); });
  $('ministry-next').addEventListener('click', () => { page++; loadResources(); });
  $('ministry-sign-out').addEventListener('click', async () => {
    // Clear protected content immediately, including if the network sign-out fails.
    accountChanged();
    try { await auth.signOut(); location.assign('discipleship-login.html?next=my-ministry.html'); }
    catch (_) { $('ministry-status').textContent = 'Sign out could not complete. Try Sign out again or reload.'; }
  });
  (async () => {
    try {
      user = await auth.getUser();
      if (!user) {
        $('ministry-sign-in').href = 'discipleship-login.html?next=' + encodeURIComponent(requested
          ? resourcePath(requested.area, requested.resource) : '/my-ministry.html');
        $('ministry-sign-in').hidden = false;
        $('ministry-status').textContent = 'Sign in to see your ministry areas.';
        return;
      }
      $('ministry-sign-out').hidden = false;
      auth.client.auth.onAuthStateChange((_event, session) => { if (session?.user?.id !== user.id) accountChanged(); });
      await loadAreas(true);
    } catch (_) { $('ministry-status').textContent = 'Your portal could not load. Reload to try again.'; }
  })();
})();
