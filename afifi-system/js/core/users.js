// ===================== USERS MANAGEMENT =====================
// كل قسم: [المفتاح, الاسم, الوصف, الإجراءات المتاحة (edit=إضافة وتعديل, del=حذف)]
const PERM_SECTIONS = [
  ['general', 'الحاسبة العامة', 'حساب تكلفة وسعر المنتجات وطباعة العروض', ['edit']],
  ['customers', 'عميل الشركة (مؤكد)', 'حسابات العملاء المؤكدين والحاسبات والطلبات والمبيعات والعربون', ['edit', 'del']],
  ['prospects', 'عميل محتمل', 'العملاء المحتملون واعتمادهم كعملاء مؤكدين', ['edit', 'del']],
  ['collections', 'التحصيل', 'تسجيل الدفعات ومتابعة المتبقي', ['edit', 'del']],
  ['quotes', 'عروض أسعار العملاء', 'إنشاء وطباعة عروض الأسعار الخاصة بالعملاء', ['edit', 'del']],
  ['quotesSuppliers', 'عروض أسعار الموردين', 'عروض الأسعار الخاصة بالموردين', ['edit', 'del']],
  ['suppliers', 'الموردون', 'سجل الموردين وحساباتهم', ['edit', 'del']],
  ['purchases', 'المشتريات', 'تسجيل المشتريات والسداد وكشف حساب المورد', ['edit', 'del']],
  ['cubic', 'تكعيب الموردين', 'تكعيبات الخشب الخاصة بالموردين', ['edit', 'del']],
  ['company', 'بيانات الشركة', 'الشعار والعناوين وأرقام التواصل', ['edit']],
  ['users', 'المستخدمون', 'إدارة الحسابات والصلاحيات', ['edit', 'del']]
];
const PERM_ACT_LABEL = { edit: 'إضافة وتعديل', del: 'حذف' };
function defaultPerms() {
  // كل مستخدم جديد يبدأ بدون أي صلاحية — المدير العام هو اللي يحددها له
  const p = {};
  PERM_SECTIONS.forEach(([k]) => { p[k] = false; });
  return p;
}
function normalizeUser(u) {
  if (u.active === undefined) u.active = true;
  if (u.canLogin === undefined) u.canLogin = true;
  if (!u.groups) u.groups = [];
  if (!u.fullName) u.fullName = u.username;
  if (!u.branches) u.branches = [];
  return u;
}
// صلاحيات مستخدم (مع توريث الأقسام الجديدة من الأقسام القديمة المقابلة لها)
function permsOf(u) {
  const saved = (u && u.perms) || {};
  const p = Object.assign(defaultPerms(), saved);
  if (saved.prospects === undefined) p.prospects = p.customers;
  if (saved.quotesSuppliers === undefined) p.quotesSuppliers = p.quotes;
  return p;
}
// can('customers') = دخول القسم ، can('customers','edit') = إضافة/تعديل ، can('customers','del') = حذف
function can(key, act) {
  if (!currentUser) return false;
  if (currentUser.role === 'admin') return true;
  const p = permsOf(currentUser);
  if (!p[key]) return false;
  return act ? p[key + '_' + act] !== false : true;
}
const VIEW_PERM = {
  general: 'general', collections: 'collections', quotes: 'quotes', 'quote-form': 'quotes', 'quotes-suppliers': 'quotesSuppliers',
  suppliers: 'suppliers', 'supplier-detail': 'suppliers', purchases: 'purchases', cubic: 'cubic', 'cubic-edit': 'cubic',
  company: 'company', users: 'users', 'clients-confirmed': 'customers', 'clients-prospect': 'prospects'
};
function canAccessView(view) {
  if (!currentUser) return false;
  if (view === 'customers') return can('customers') || can('prospects');
  if (['customer-detail', 'customer-calc', 'sales'].includes(view)) {
    const c = db && db.customers.find(x => x.id === currentCustomerId);
    return c ? can(c.status === 'prospect' ? 'prospects' : 'customers') : (can('customers') || can('prospects'));
  }
  const k = VIEW_PERM[view];
  return k ? can(k) : true;
}
const canAccess = canAccessView; // اسم قديم
function firstAllowedView() {
  return ['general', 'customers', 'collections', 'quotes', 'quotes-suppliers', 'suppliers', 'purchases', 'cubic', 'company', 'users'].find(v => canAccessView(v));
}
function applyNavAccess() {
  document.querySelectorAll('.nav-btn[data-view]').forEach(el => { el.style.display = canAccessView(el.dataset.view) ? '' : 'none'; });
  document.querySelectorAll('.nav-parent[data-perm]').forEach(el => {
    const grp = el.closest('.nav-group');
    if (grp) grp.style.display = el.dataset.perm.split(',').some(k => can(k)) ? '' : 'none';
  });
  applyActionPerms();
}
// صلاحيات الإضافة/التعديل والحذف: تُطبَّق كـ classes على body ويخفي الـ CSS الأزرار المقابلة
function applyActionPerms() {
  PERM_SECTIONS.forEach(([k, , , acts]) => acts.forEach(a => {
    document.body.classList.toggle('np-' + k + '-' + a, !!currentUser && !can(k, a));
  }));
}

let usersFilter = { q: '', status: 'all' };

function renderUsersList() {
  const root = document.getElementById('usersListRoot');
  const q = usersFilter.q.trim().toLowerCase();
  const list = db.users.filter(u => {
    if (q && !((u.fullName || '') + ' ' + u.username).toLowerCase().includes(q)) return false;
    if (usersFilter.status === 'active' && u.active === false) return false;
    if (usersFilter.status === 'inactive' && u.active !== false) return false;
    return true;
  });
  const tickOk = '<span class="tick-ok">' + IC.check + '</span>';
  const tickNo = '<span class="tick-no"><svg class="ic" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg></span>';
  root.innerHTML = `
  <div class="list-card users-card">
    <h3 class="users-title">قائمة المستخدمين</h3>
    <div class="users-filter">
      <div class="search-inp">${IC.search}<input type="text" id="userSearch" placeholder="بحث بالاسم أو اسم المستخدم" value="${escapeHtml(usersFilter.q)}"></div>
      <select id="userStatusFilter">
        <option value="all" ${usersFilter.status === 'all' ? 'selected' : ''}>كل الحالات</option>
        <option value="active" ${usersFilter.status === 'active' ? 'selected' : ''}>مفعّل</option>
        <option value="inactive" ${usersFilter.status === 'inactive' ? 'selected' : ''}>موقوف</option>
      </select>
      <button class="primary-btn" id="userFilterBtn">تصفية</button>
      <button class="secondary-btn" id="userResetBtn">إعادة ضبط</button>
    </div>
    <div class="scroll"><table class="tbl">
      <thead><tr><th>الاسم الكامل</th><th>اسم المستخدم لتسجيل الدخول</th><th>الحالة</th><th>يسمح بتسجيل الدخول</th><th>مدير عام</th><th>المجموعات</th><th>الإجراءات</th></tr></thead>
      <tbody>
      ${list.length ? list.map(u => `
        <tr data-id="${u.id}">
          <td><div class="cell-user"><div class="avatar">${escapeHtml(initial(u.fullName || u.username))}</div><b>${escapeHtml(u.fullName || u.username)}</b></div></td>
          <td><span class="uname">${escapeHtml(u.username)}</span></td>
          <td>${u.active === false ? '<span class="chip due">موقوف</span>' : '<span class="chip ok">مفعّل</span>'}</td>
          <td>${u.canLogin === false ? tickNo : tickOk}</td>
          <td>${u.role === 'admin' ? '<span class="chip purple">نعم</span>' : '<span class="chip gray">لا</span>'}</td>
          <td>${(u.groups || []).length ? `<div class="group-chips">${u.groups.map(g => `<span class="chip info">${escapeHtml(g)}</span>`).join('')}</div>` : '—'}</td>
          <td><div class="row-actions">
            <button class="btn-outline" data-action="perms">إدارة الصلاحيات</button>
            <button class="btn-outline" data-action="branches">الفروع والمخازن</button>
            <button class="btn-outline" data-action="edit">تعديل</button>
            <button class="btn-outline red" data-action="delete">حذف</button>
          </div></td>
        </tr>`).join('') : '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--m-mute);">لا يوجد مستخدمون مطابقون</td></tr>'}
      </tbody></table></div>
    <div class="users-foot">عرض <b>${list.length ? 1 : 0}</b> إلى <b>${list.length}</b> من إجمالي <b>${db.users.length}</b></div>
  </div>`;

  const apply = () => {
    usersFilter.q = document.getElementById('userSearch').value;
    usersFilter.status = document.getElementById('userStatusFilter').value;
    renderUsersList();
  };
  document.getElementById('userFilterBtn').addEventListener('click', apply);
  document.getElementById('userSearch').addEventListener('keydown', e => { if (e.key === 'Enter') apply(); });
  document.getElementById('userStatusFilter').addEventListener('change', apply);
  document.getElementById('userResetBtn').addEventListener('click', () => { usersFilter = { q: '', status: 'all' }; renderUsersList(); });

  root.querySelectorAll('tbody tr[data-id]').forEach(row => {
    const id = row.dataset.id;
    row.querySelector('[data-action="perms"]').addEventListener('click', () => openPermsModal(id));
    row.querySelector('[data-action="branches"]').addEventListener('click', () => openBranchesModal(id));
    row.querySelector('[data-action="edit"]').addEventListener('click', () => openUserModal(id));
    row.querySelector('[data-action="delete"]').addEventListener('click', () => {
      const u = db.users.find(x => x.id === id);
      if (currentUser && u.id === currentUser.id) { alert('لا يمكنك حذف حسابك الحالي وأنت مسجل دخول به'); return; }
      const adminsCount = db.users.filter(x => x.role === 'admin' && x.active !== false).length;
      if (u.role === 'admin' && u.active !== false && adminsCount <= 1) { alert('لا يمكن حذف آخر حساب مدير في البرنامج'); return; }
      openConfirm(`هل تريد حذف المستخدم "${u.username}"؟`, () => {
        db.users = db.users.filter(x => x.id !== id);
        persist();
        renderUsersList();
      });
    });
  });
}

function makeOverlay(html) {
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.style.display = 'flex';
  ov.innerHTML = html;
  document.body.appendChild(ov);
  ov.addEventListener('mousedown', e => { if (e.target === ov) ov.remove(); });
  return ov;
}

function openPermsModal(id) {
  const u = db.users.find(x => x.id === id); if (!u) return;
  const admin = u.role === 'admin';
  const cur = permsOf(u);
  const sw = (k, on, dis) => dis ? '<span class="tick-ok">' + IC.check + '</span>' : `<input type="checkbox" class="switch" data-k="${k}" ${on ? 'checked' : ''} ${dis ? 'disabled' : ''}>`;
  const ov = makeOverlay(`
    <div class="modal perm-modal">
      <h2>إدارة الصلاحيات — ${escapeHtml(u.fullName || u.username)}</h2>
      ${admin ? '<div class="soft-note">هذا الحساب <b>مدير عام</b>: يملك كل الصلاحيات دائماً ولا تُقيَّد. لتحديد صلاحيات موظف، أنشئ له مستخدماً جديداً من زر <b>إنشاء مستخدم جديد</b> ثم اضغط <b>إدارة الصلاحيات</b> في صفّه.</div>' : '<div class="soft-note">فعّل <b>دخول القسم</b> ليظهر في القائمة، ثم حدّد هل يستطيع المستخدم <b>الإضافة والتعديل</b> و<b>الحذف</b> داخله.</div>'}
      <div class="perm-tools"><button type="button" class="btn-outline" data-all="1">تحديد الكل</button><button type="button" class="btn-outline" data-all="0">إلغاء الكل</button></div>
      <div class="perm-table">
        <div class="perm-head"><span>القسم</span><span>دخول</span><span>إضافة وتعديل</span><span>حذف</span></div>
        ${PERM_SECTIONS.map(([k, name, desc, acts]) => `
          <div class="perm-line" data-sec="${k}">
            <span class="perm-name"><b>${name}</b><small>${desc}</small></span>
            <span class="perm-c">${sw(k, admin || cur[k], admin)}</span>
            <span class="perm-c">${acts.includes('edit') ? sw(k + '_edit', admin || (cur[k] && cur[k + '_edit'] !== false), admin) : '<i>—</i>'}</span>
            <span class="perm-c">${acts.includes('del') ? sw(k + '_del', admin || (cur[k] && cur[k + '_del'] !== false), admin) : '<i>—</i>'}</span>
          </div>`).join('')}
      </div>
      <div class="modal-actions">
        <button class="secondary-btn" data-x>${admin ? 'إغلاق' : 'إلغاء'}</button>
        ${admin ? '' : '<button class="primary-btn" data-save>حفظ الصلاحيات</button>'}
      </div>
    </div>`);
  // إيقاف الدخول يقفل خياري التعديل والحذف، وتشغيل أي منهما يشغّل الدخول
  ov.querySelectorAll('.perm-line').forEach(line => {
    const main = line.querySelector('.switch[data-k="' + line.dataset.sec + '"]');
    if (!main) return;
    const subs = [...line.querySelectorAll('.switch')].filter(i => i !== main);
    const sync = () => subs.forEach(i => { if (!main.checked) i.checked = false; i.disabled = admin || !main.checked; });
    main.addEventListener('change', () => { if (main.checked) subs.forEach(i => i.checked = true); sync(); });
    sync();
  });
  ov.querySelectorAll('[data-all]').forEach(b => b.addEventListener('click', () => {
    if (admin) return;
    const on = b.dataset.all === '1';
    ov.querySelectorAll('.switch').forEach(i => { i.checked = on; i.disabled = false; });
    ov.querySelectorAll('.perm-line').forEach(line => { const m = line.querySelector('.switch'); if (m) m.dispatchEvent(new Event('change')); });
  }));
  ov.querySelector('[data-x]').addEventListener('click', () => ov.remove());
  const sv = ov.querySelector('[data-save]');
  if (sv) sv.addEventListener('click', () => {
    const p = {};
    ov.querySelectorAll('.switch').forEach(i => p[i.dataset.k] = i.checked);
    u.perms = p;
    persist();
    if (currentUser && currentUser.id === u.id) applyNavAccess();
    ov.remove();
    showToast('تم حفظ صلاحيات ' + (u.fullName || u.username));
  });
}

function openBranchesModal(id) {
  const u = db.users.find(x => x.id === id); if (!u) return;
  if (!db.branches) db.branches = [];
  const sel = new Set(u.branches || []);
  const ov = makeOverlay('<div class="modal"></div>');
  const box = ov.querySelector('.modal');
  const draw = () => {
    box.innerHTML = `
      <h2>الفروع والمخازن — ${escapeHtml(u.fullName || u.username)}</h2>
      <div class="soft-note">حدّد الفروع والمخازن التي يتبع لها المستخدم. يتم حفظ الربط الآن، ويمكن استخدامه لاحقاً لتقييد البيانات حسب الفرع.</div>
      <div class="perm-list">
        ${db.branches.map(b => `<div class="branch-row"><label><input type="checkbox" data-b="${b.id}" ${sel.has(b.id) ? 'checked' : ''}> ${escapeHtml(b.name)} <span class="chip info">${escapeHtml(b.kind || 'فرع')}</span></label><button class="del-payment" data-del="${b.id}" title="حذف">✕</button></div>`).join('') || '<div class="empty-state" style="padding:16px;">لا توجد فروع أو مخازن</div>'}
      </div>
      <div class="branch-add"><input type="text" id="newBranchName" placeholder="اسم فرع أو مخزن جديد"><select id="newBranchKind"><option>فرع</option><option>مخزن</option></select><button class="secondary-btn" id="addBranchBtn">إضافة</button></div>
      <div class="modal-actions"><button class="secondary-btn" data-x>إلغاء</button><button class="primary-btn" data-save>حفظ</button></div>`;
    box.querySelectorAll('[data-b]').forEach(c => c.addEventListener('change', () => { c.checked ? sel.add(c.dataset.b) : sel.delete(c.dataset.b); }));
    box.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
      db.branches = db.branches.filter(x => x.id !== b.dataset.del);
      db.users.forEach(x => { x.branches = (x.branches || []).filter(i => i !== b.dataset.del); });
      sel.delete(b.dataset.del); persist(); draw();
    }));
    box.querySelector('#addBranchBtn').addEventListener('click', () => {
      const n = box.querySelector('#newBranchName').value.trim(); if (!n) return;
      db.branches.push({ id: uid(), name: n, kind: box.querySelector('#newBranchKind').value });
      persist(); draw();
    });
    box.querySelector('[data-x]').addEventListener('click', () => ov.remove());
    box.querySelector('[data-save]').addEventListener('click', () => {
      u.branches = [...sel]; persist(); ov.remove(); showToast('تم حفظ الفروع والمخازن');
    });
  };
  draw();
}


// شبكة اختيار الأقسام داخل نافذة إنشاء/تعديل المستخدم
function renderUserPermsGrid(u) {
  const cur = u ? permsOf(u) : defaultPerms();
  document.getElementById('userPermsGrid').innerHTML = PERM_SECTIONS.map(([k, name]) =>
    `<label class="um-perm"><span>${name}</span><input type="checkbox" data-pk="${k}" ${cur[k] ? 'checked' : ''}></label>`).join('');
}
function syncUserPermsBox() {
  const admin = document.getElementById('userRoleInput').value === 'admin';
  document.getElementById('userPermsBox').style.display = admin ? 'none' : '';
}
function readUserPermsGrid(oldPerms) {
  const p = Object.assign({}, oldPerms || {});
  document.querySelectorAll('#userPermsGrid [data-pk]').forEach(c => {
    const k = c.dataset.pk, on = c.checked, was = !!(oldPerms && oldPerms[k]);
    p[k] = on;
    const acts = (PERM_SECTIONS.find(x => x[0] === k) || [])[3] || [];
    // قسم اتفعّل لأول مرة: إضافة/تعديل/حذف مفعّلة افتراضياً — وإيقافه يقفلها
    acts.forEach(a => { if (!on) p[k + '_' + a] = false; else if (!was) p[k + '_' + a] = true; });
  });
  return p;
}

let userModalMode = 'add';
let userModalEditId = null;

function openUserModal(id) {
  userModalMode = id ? 'edit' : 'add';
  userModalEditId = id;
  document.getElementById('userModalTitle').textContent = id ? 'تعديل مستخدم' : 'إنشاء مستخدم جديد';
  document.getElementById('userPasswordInput').value = '';
  if (id) {
    const u = db.users.find(x => x.id === id);
    document.getElementById('userFullNameInput').value = u.fullName || '';
    document.getElementById('userUsernameInput').value = u.username;
    document.getElementById('userRoleInput').value = u.role;
    document.getElementById('userActiveInput').value = u.active === false ? '0' : '1';
    document.getElementById('userCanLoginInput').checked = u.canLogin !== false;
    document.getElementById('userGroupsInput').value = (u.groups || []).join('، ');
    renderUserPermsGrid(u);
  } else {
    document.getElementById('userFullNameInput').value = '';
    document.getElementById('userUsernameInput').value = '';
    document.getElementById('userRoleInput').value = 'user';
    document.getElementById('userActiveInput').value = '1';
    document.getElementById('userCanLoginInput').checked = true;
    document.getElementById('userGroupsInput').value = '';
    renderUserPermsGrid(null);
  }
  syncUserPermsBox();
  document.getElementById('userModalOverlay').style.display = 'flex';
}

document.getElementById('userRoleInput').addEventListener('change', syncUserPermsBox);
document.getElementById('addUserBtn').addEventListener('click', () => openUserModal(null));
document.getElementById('cancelUserModalBtn').addEventListener('click', () => {
  document.getElementById('userModalOverlay').style.display = 'none';
});

document.getElementById('saveUserModalBtn').addEventListener('click', async () => {
  const fullName = document.getElementById('userFullNameInput').value.trim();
  const username = document.getElementById('userUsernameInput').value.trim();
  const password = document.getElementById('userPasswordInput').value;
  const role = document.getElementById('userRoleInput').value;
  const active = document.getElementById('userActiveInput').value === '1';
  const canLogin = document.getElementById('userCanLoginInput').checked;
  const groups = document.getElementById('userGroupsInput').value.split(/[,،]/).map(x => x.trim()).filter(Boolean);
  if (!username) { alert('من فضلك أدخل اسم المستخدم'); return; }
  let newUserId = null;

  if (userModalMode === 'add') {
    if (!password) { alert('من فضلك أدخل كلمة مرور'); return; }
    if (db.users.some(u => u.username === username)) { alert('اسم المستخدم موجود بالفعل'); return; }
    const passwordHash = await sha256(password);
    const nu = normalizeUser({ id: uid(), fullName: fullName || username, username, passwordHash, role, active, canLogin, groups, createdAt: todayStr(), perms: role === 'admin' ? undefined : readUserPermsGrid(defaultPerms()) });
    db.users.push(nu);
    newUserId = nu.id;
  } else {
    const u = db.users.find(x => x.id === userModalEditId);
    if (u) {
      if (db.users.some(x => x.username === username && x.id !== u.id)) { alert('اسم المستخدم موجود بالفعل'); return; }
      const othersAdmins = db.users.filter(x => x.id !== u.id && x.role === 'admin' && x.active !== false).length;
      if ((role !== 'admin' || !active) && u.role === 'admin' && othersAdmins === 0) { alert('لا يمكن تغيير أو إيقاف آخر مدير عام في البرنامج'); return; }
      if (currentUser && u.id === currentUser.id && (!active || !canLogin)) { alert('لا يمكنك إيقاف حسابك الحالي'); return; }
      Object.assign(u, { fullName: fullName || username, username, role, active, canLogin, groups });
      if (role !== 'admin') u.perms = readUserPermsGrid(permsOf(u));
      if (currentUser && currentUser.id === u.id) applyNavAccess();
      if (password) u.passwordHash = await sha256(password);
    }
  }
  await persist();
  document.getElementById('userModalOverlay').style.display = 'none';
  renderUsersList();
});
