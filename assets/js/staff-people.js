(() => {
  const auth = window.ChampionLifeAuth;
  const $ = id => document.getElementById(id);
  const status = $('status'), select = $('organization'), body = $('people');
  let user, permissions = [], rows = [], page = 0, request = 0, editing = null, invalid = false;
  const size = 25;
  let portals = null, giving = null, workflows = null, tags = null, households = null, overview = null, personDetail = null, staffAdmin = null, personEditToken = 0;
  let taskPage = 0, taskRequest = 0, taskEditing = null, taskEditToken = 0, historyRequest = 0;
  let currentView = 'overview', searchText = '', searchField = 'last_name';
  const views = {
    overview: ['Your ministry workspace.', 'Choose your next step and stay connected to your people.'],
    portals: ['The right space for every connection.', 'Manage participant resources, access tags and overlapping ministry areas.'],
    giving: ['Giving, carefully connected.', 'Separate ministry destinations, funds and draft routing.'],
    workflows: ['Follow-up that keeps moving.', 'Review automated tasks, held notifications and routing exceptions.'],
    tags: ['Connections and next steps.', 'Organize tags and their responsible departments.'],
    households: ['People connected as family.', 'Organize household relationships within your ministry.'],
    staff: ['Your team. The right access.', 'Give each staff member the tools their work requires.'],
    followup: ['Every next step matters.', 'Keep follow-up clear, timely and connected to the right organization.'],
    people: ['People and connection.', 'Care for the people connected to your church and ministry.'],
    modules: ['Room for every next step.', 'The full platform is taking shape around your ministry.']
  };
  const modules = [
    ['People', 'Organization contacts and permitted contact editing.', 'Available', 'Kingdom Propel'],
    ['Households & Family Hub', 'Household records and relationships are available. Family portal, calendars and registrations are planned.', 'Households available', 'Kingdom Propel'],
    ['Tags & departments', 'Department ownership, person tags and reviewed task automation are available. Email delivery is pending.', 'Tags available', 'Kingdom Propel'],
    ['Giving & partners', 'Funds and draft checkout routing are available. Payments, gifts, statements and partnerships are planned.', 'Draft setup available', 'Kingdom Propel'],
    ['Forms', 'Drag-and-drop forms with desktop/mobile editing and payments.', 'Planned', 'Kingdom Propel'],
    ['Serving, groups & events', 'Volunteer schedules, groups, events and check-in.', 'Planned', 'Kingdom Propel'],
    ['Follow-up & care', 'Operational tasks, due dates and self-assignment are available. Restricted pastoral care is planned.', 'Follow-up available', 'Kingdom Propel'],
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
    if(view!=='overview')overview?.clear();
    taskRequest++; $('task-list').replaceChildren();
    for (const name of Object.keys(views)) $('view-' + name).hidden = name !== view;
    document.querySelectorAll('.sidebar [data-view]').forEach(button => {
      if (button.dataset.view === view) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    $('view-title').textContent = views[view][0]; $('view-description').textContent = views[view][1];
    $('refresh').hidden = view !== 'people';
    if (focus) $('view-title').focus();
    if (!invalid && permissions.length && view === 'overview') {request++;overview?.load();}
    else if (!invalid && permissions.length && view === 'people') loadPeople();
    else if (!invalid && permissions.length && view === 'portals') {request++;portals?.load();}
    else if (!invalid && permissions.length && view === 'giving') {request++;giving?.load();}
    else if (!invalid && permissions.length && view === 'workflows') {request++;workflows?.load();}
    else if (!invalid && permissions.length && view === 'tags') {request++;tags?.load();}
    else if (!invalid && permissions.length && view === 'households') {request++;households?.load();}
    else if (!invalid && permissions.length && view === 'staff') { request++; staffAdmin?.load(); }
    else if (!invalid && permissions.length && view === 'followup') { request++; loadTasks(); }
    else if (permissions.length && !invalid) { request++; status.textContent = 'Workspace ready.'; }
  }
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
  function updateOrganization() {
    $('workspace-name').textContent = select.selectedOptions[0]?.textContent || 'Ministry workspace';
    $('person-add').hidden = !can('people.create') || !can('people.read');
    $('access-summary').textContent = !can('people.read') ? 'Contact access has not been assigned. Other assigned tools remain available.' : can('people.update') ? 'You can view people and edit contact details in this organization.' : 'You have view-only access to people in this organization.';
  }
  showView('overview', false);
  function can(permission, org = select.value) {
    return permissions.some(p => p.organization_id === org && p.permission === permission);
  }
  function clearPrivateView() {
    invalid = true; portals?.clear(); giving?.clear(); workflows?.clear(); tags?.clear(); households?.clear(); overview?.clear(); personDetail?.clear(); personEditToken++; staffAdmin?.clear(); clearTasks(); request++; rows = []; permissions = []; editing = null;
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
      const nameCell=tr.firstElementChild, link=document.createElement('a');
      link.href='#person';link.textContent=nameCell.textContent;
      link.addEventListener('click',event=>{event.preventDefault();personDetail?.open(person);});
      nameCell.replaceChildren(link);
      const action = document.createElement('td');
      if (can('people.update')) {
        const button = document.createElement('button'); button.textContent = 'Edit';
        button.setAttribute('aria-label', 'Edit ' + person.first_name + ' ' + person.last_name);
        button.addEventListener('click', () => {
          editPerson(person);
        }); action.append(button);
      } else action.textContent = 'View only';
      if (can('followup.read') && can('followup.manage')) {
        const button = document.createElement('button'); button.textContent = 'Follow up';
        button.setAttribute('aria-label', 'Follow up with ' + person.first_name + ' ' + person.last_name);
        button.addEventListener('click', () => openTask(null, person)); action.append(button);
      }
      if(can('tags.read')){const button=document.createElement('button');button.textContent='Tags';button.addEventListener('click',()=>tags?.openPerson(person));action.append(button);}
      if(can('portal.manage')&&can('staff.manage')){const button=document.createElement('button');button.textContent='Portal account';button.addEventListener('click',()=>portals?.openLink(person));action.append(button);}
      tr.append(action); body.append(tr);
    }
  }
  function editPerson(person) {
    if(invalid || !can('people.update',person.organization_id))return;
    personEditToken++;$('save').disabled=false;editing={...person};$('person-editor-title').textContent='Edit contact details';
    for(const name of ['first_name','last_name','email','phone'])$('person-form').elements.namedItem(name).value=person[name]||'';
    $('edit-status').textContent='';$('editor').showModal();
  }
  $('person-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (invalid || $('save').disabled || !editing || !can(editing.id ? 'people.update' : 'people.create', editing.organization_id)) return;
    const person = {...editing}, editToken = personEditToken, values = {};
    for (const name of ['first_name','last_name','email','phone']) values[name] = $('person-form').elements.namedItem(name).value.trim() || null;
    if (!values.first_name || !values.last_name) { $('edit-status').textContent = 'First and last name are required.'; return; }
    $('save').disabled = true;
    try {
      if ((await auth.getUser())?.id !== user.id) { clearPrivateView(); return; }
      if (invalid || editToken !== personEditToken) return;
      const query = person.id ? auth.client.from('organization_people')
        .update(values).eq('id', person.id).eq('organization_id', person.organization_id).eq('updated_at', person.updated_at)
        : auth.client.from('organization_people').insert({...values,organization_id:person.organization_id});
      const {data, error} = await query.select('id').maybeSingle();
      if (invalid || editToken !== personEditToken) return;
      if (error || !data) { $('edit-status').textContent = 'Changes were not saved. Access may have changed or another person updated this record. Close and refresh before retrying.'; return; }
      $('editor').close(); editing = null; await loadPeople();
      if(!invalid && editToken===personEditToken && personDetail?.isOpen()) personDetail.refresh();
      if (!invalid && editToken === personEditToken) status.textContent = person.id ? 'Contact details saved.' : 'Person added to this organization.';
    } catch (_) { if (!invalid && editToken === personEditToken) $('edit-status').textContent = 'Changes were not saved. Please try again.'; }
    finally { if (editToken === personEditToken) $('save').disabled = false; }
  });
  $('person-add').addEventListener('click', () => {
    if (invalid || !can('people.read') || !can('people.create')) return;
    personEditToken++; $('save').disabled=false; editing = {organization_id:select.value}; $('person-form').reset();
    $('person-editor-title').textContent = 'Add person'; $('edit-status').textContent = '';
    $('editor').showModal();
  });
  $('cancel').addEventListener('click', () => { personEditToken++; $('editor').close(); editing = null; });
  $('editor').addEventListener('cancel', () => {personEditToken++;editing=null;});
  select.addEventListener('change', () => {
    portals?.clear(); giving?.clear(); workflows?.clear(); tags?.clear(); households?.clear(); overview?.clear(); personDetail?.clear(); personEditToken++; staffAdmin?.clear(); clearTasks(); taskPage = 0; request++; page = 0; rows = []; body.replaceChildren(); editing = null;
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
      const available = (orgs.data || []).filter(org => can('people.read',org.id) || can('staff.manage',org.id) || can('finance.read',org.id));
      if (!available.length) { status.textContent = 'No staff workspace is assigned to this account yet. Ask your ministry administrator for access.'; return; }
      for (const org of available) { const option = document.createElement('option'); option.value = org.id; option.textContent = org.name; select.append(option); }
      $('workspace').hidden = false; updateOrganization(); showView(currentView, false);
    } catch (_) { status.textContent = 'Your workspace could not be loaded. Reload to try again.'; }
  }
  function clearTasks() {
    taskRequest++; taskEditToken++; historyRequest++; taskEditing = null;
    $('task-list').replaceChildren(); $('task-events').replaceChildren();
    $('task-editor').close(); $('task-history').close(); $('task-form').reset();
    $('task-assignee-status').textContent = ''; $('task-person').textContent = ''; $('task-save-status').textContent = ''; $('task-assignee').replaceChildren();
    $('task-status').textContent = ''; $('task-page').textContent = '';
  }
  function taskAccess() { return !invalid && can('people.read') && can('followup.read'); }
  function openTask(task, person) {
    if (!taskAccess() || !can('followup.manage')) return;
    taskEditToken++; taskEditing = task ? {...task} : {organization_id:select.value,person_id:person.id};
    $('task-editor-title').textContent = task ? 'Update follow-up' : 'Create follow-up';
    const contact = person || task.person;
    $('task-person').textContent = contact ? [contact.first_name,contact.last_name].join(' ') : 'Organization contact';
    $('task-title').value = task?.title || ''; $('task-due').value = task?.due_on || '';
    $('task-state').value = task?.status || 'open'; $('task-state-label').hidden = !task;
    $('task-assignee').replaceChildren();
    const options = [['','Unassigned'],[user.id,'Me']];
    if (task?.assigned_user_id && task.assigned_user_id !== user.id) options.push([task.assigned_user_id,'Keep current staff assignment']);
    for (const [value,label] of options) { const option = document.createElement('option'); option.value=value; option.textContent=label; $('task-assignee').append(option); }
    $('task-assignee').value = task?.assigned_user_id || '';
    $('task-save-status').textContent = ''; $('task-save').disabled = false; $('task-editor').showModal();
    populateAssignees(taskEditToken, select.value, task?.assigned_user_id || '');
  }
  async function populateAssignees(token, org, current) {
    $('task-assignee-status').textContent = 'Loading eligible staff...';
    try {
      const {data,error} = await auth.client.rpc('list_staff_directory',{p_org:org,p_for_assignment:true});
      if (invalid || token !== taskEditToken) return;
      if (error) throw error;
      // Preserve any selection made while the directory request was pending.
      const selected = $('task-assignee').value;
      const known = new Set(Array.from($('task-assignee').options, option => option.value));
      for (const member of data || []) {
        if (known.has(member.user_id)) continue;
        const option=document.createElement('option');option.value=member.user_id;option.textContent=member.display_name;$('task-assignee').append(option);known.add(member.user_id);
      }
      $('task-assignee').value=selected;
      $('task-assignee-status').textContent='Only staff with access to this organization are listed.';
    } catch (_) { if (!invalid && token===taskEditToken) $('task-assignee-status').textContent='Team list could not load. You can still leave this unassigned or assign yourself.'; }
  }
  async function loadTasks() {
    const token = ++taskRequest, org = select.value;
    $('task-list').replaceChildren(); $('task-previous').disabled = true; $('task-next').disabled = true;
    if (!taskAccess()) { $('task-status').textContent = 'Follow-up access has not been assigned for this organization.'; return; }
    $('task-status').textContent = 'Loading follow-up...';
    try {
      let query = auth.client.from('followup_tasks').select('id,organization_id,person_id,title,status,due_on,assigned_user_id,revision,person:organization_people(first_name,last_name)').eq('organization_id',org);
      const filter = $('task-filter').value;
      if (['open','completed','canceled'].includes(filter)) query=query.eq('status',filter);
      if ($('task-assignment-filter').value === 'mine') query=query.eq('assigned_user_id',user.id);
      if ($('task-assignment-filter').value === 'unassigned') query=query.is('assigned_user_id',null);
      const {data,error} = await query.order('due_on',{ascending:true,nullsFirst:false}).order('id').range(taskPage*size,taskPage*size+size);
      if (invalid || token !== taskRequest) return;
      if (error) throw error;
      const tasks=(data || []).slice(0,size);
      $('task-previous').disabled=taskPage===0; $('task-next').disabled=(data || []).length<=size;
      $('task-page').textContent='Page '+(taskPage+1); $('task-status').textContent=tasks.length ? tasks.length+' tasks shown.' : 'No follow-up tasks match these filters.';
      for (const task of tasks) {
        const card=document.createElement('article'); card.className='task-card';
        const title=document.createElement('h3'); title.textContent=task.title;
        const detail=document.createElement('p');
        const name=task.person ? [task.person.first_name,task.person.last_name].join(' ') : 'Organization contact';
        const assignment=!task.assigned_user_id ? 'Unassigned' : task.assigned_user_id===user.id ? 'Assigned to me' : 'Assigned to staff';
        detail.textContent=[name,task.status,task.due_on ? 'Due '+task.due_on : 'No due date',assignment].join(' · ');
        const actions=document.createElement('div');actions.className='actions';
        if (can('followup.manage')) { const edit=document.createElement('button');edit.textContent='Update task';edit.addEventListener('click',()=>openTask(task));actions.append(edit); }
        const history=document.createElement('button');history.textContent='Activity';history.addEventListener('click',()=>loadHistory(task));actions.append(history);
        card.append(title,detail,actions);$('task-list').append(card);
      }
    } catch (_) { if (!invalid && token===taskRequest) $('task-status').textContent='Follow-up could not be loaded. Refresh to try again.'; }
  }
  async function loadHistory(task) {
    const token=++historyRequest; $('task-events').replaceChildren(); $('task-history-status').textContent='Loading activity...'; $('task-history').showModal();
    try {
      const {data,error}=await auth.client.from('followup_task_events').select('action,occurred_at,actor_user_id,before_state,after_state').eq('organization_id',select.value).eq('task_id',task.id).order('occurred_at',{ascending:false}).limit(30);
      if (invalid || token!==historyRequest) return;
      if (error) throw error;
      $('task-history-status').textContent=(data || []).length ? 'Most recent activity (up to 30 changes).' : 'No activity is available.';
      for (const event of data || []) { const li=document.createElement('li');li.textContent=[new Date(event.occurred_at).toLocaleString(),event.actor_user_id===user.id?'You':'Authorized staff',event.action,event.after_state.title,'Status: '+event.after_state.status,'Due: '+(event.after_state.due_on || 'none')].join(' · ');$('task-events').append(li); }
    } catch (_) { if (!invalid && token===historyRequest) $('task-history-status').textContent='Activity could not be loaded.'; }
  }
  $('task-form').addEventListener('submit',async event=>{
    event.preventDefault(); if ($('task-save').disabled || !taskEditing || !taskAccess() || !can('followup.manage')) return;
    const task={...taskEditing}, token=taskEditToken, title=$('task-title').value.trim();
    if (!title) { $('task-save-status').textContent='Enter a next step.'; return; }
    const values={title,due_on:$('task-due').value || null,assigned_user_id:$('task-assignee').value || null};
    if (task.id) values.status=$('task-state').value;
    $('task-save').disabled=true; $('task-save-status').textContent='Saving...';
    try {
      if ((await auth.getUser())?.id!==user.id) { clearPrivateView(); return; }
      if (invalid || token!==taskEditToken) return;
      const query=task.id ? auth.client.from('followup_tasks').update(values).eq('id',task.id).eq('organization_id',task.organization_id).eq('revision',task.revision) : auth.client.from('followup_tasks').insert({...values,organization_id:task.organization_id,person_id:task.person_id});
      const {data,error}=await query.select('id').maybeSingle();
      if (invalid || token!==taskEditToken) return;
      if (error || !data) { $('task-save-status').textContent='Task was not saved. Access may have changed or someone updated it. Close and refresh before retrying.'; return; }
      $('task-editor').close(); taskEditing=null; taskPage=0;
      if(personDetail?.isOpen())personDetail.refresh();else if(currentView==='overview')overview?.load();else showView('followup');
    } catch (_) { if (!invalid && token===taskEditToken) $('task-save-status').textContent='Task was not saved. Check your connection and try again.'; }
    finally { if(token===taskEditToken) $('task-save').disabled=false; }
  });
  $('task-cancel').addEventListener('click',()=>{taskEditToken++;taskEditing=null;$('task-editor').close();});
  $('task-editor').addEventListener('cancel',()=>{taskEditToken++;taskEditing=null;});
  $('task-history-close').addEventListener('click',()=>{historyRequest++;$('task-history').close();$('task-events').replaceChildren();});
  $('task-history').addEventListener('cancel',()=>{historyRequest++;$('task-events').replaceChildren();});
  for (const id of ['task-filter','task-assignment-filter']) $(id).addEventListener('change',()=>{taskPage=0;loadTasks();});
  $('task-refresh').addEventListener('click',()=>loadTasks());
  $('task-previous').addEventListener('click',()=>{if(taskPage>0)taskPage--;loadTasks();});
  $('task-next').addEventListener('click',()=>{taskPage++;loadTasks();});

  portals=window.ChampionStaffPortals?.({auth,getContext:()=>({user,organizationId:select.value,can,invalid}),onAccountChange:clearPrivateView});
  giving=window.ChampionGivingSetup?.({auth,getContext:()=>({user,organizationId:select.value,can,invalid}),onAccountChange:clearPrivateView});
  workflows=window.ChampionWorkflows?.({auth,getContext:()=>({user,organizationId:select.value,can,invalid}),onAccountChange:clearPrivateView,onTask:task=>openTask(task)});
  tags=window.ChampionTags?.({auth,onConfigure:row=>workflows?.openRule(row),getContext:()=>({user,organizationId:select.value,can,invalid}),onAccountChange:clearPrivateView});
  households=window.ChampionHouseholds?.({auth,getContext:()=>({user,organizationId:select.value,can,invalid}),onAccountChange:clearPrivateView});
  overview=window.ChampionStaffOverview?.({auth,getContext:()=>({user,organizationId:select.value,can,invalid}),onTask:task=>openTask(task)});
  personDetail=window.ChampionPersonDetail?.({auth,getContext:()=>({user,organizationId:select.value,can,invalid}),onEdit:editPerson,onFollowup:person=>openTask(null,person),onUpdateTask:task=>openTask(task)});
  staffAdmin = window.ChampionStaffAdmin?.({auth,onAccountChange:clearPrivateView,getContext:()=>({user,organizationId:select.value,can,invalid})});
  start();
})();
