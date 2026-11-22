// ===================== CUSTOMERS =====================
const isProspect = c => c.status === 'prospect';
const isConfirmedCust = c => c.status !== 'prospect';

function renderCustomersList() {
  const root = document.getElementById('customersListRoot');
  // احترام الصلاحيات: لو مفيش صلاحية للتبويب الحالي نحوّل للتبويب المسموح
  if (typeof can === 'function' && currentUser) {
    const cOk = can('customers'), pOk = can('prospects');
    if (custTab === 'confirmed' && !cOk && pOk) custTab = 'prospect';
    if (custTab === 'prospect' && !pOk && cOk) custTab = 'confirmed';
    if (custTab === 'all' && !(cOk && pOk)) custTab = cOk ? 'confirmed' : 'prospect';
  }
  const allowed = c => typeof can !== 'function' || !currentUser || can(isProspect(c) ? 'prospects' : 'customers');
  const base = db.customers.filter(allowed);
  const nAll = base.length, nConf = base.filter(isConfirmedCust).length, nPro = base.filter(isProspect).length;

  const titles = { all: ['العملاء', 'عملاء الشركة المؤكدون والعملاء المحتملون'], confirmed: ['عميل الشركة (مؤكد)', 'العملاء المؤكدون المتعاملون مع الشركة'], prospect: ['عميل محتمل', 'عملاء لم يتأكد التعامل معهم بعد — اضغط "معتمد" لتحويل العميل إلى عميل مؤكد'] };
  document.getElementById('custTitle').textContent = titles[custTab][0];
  document.getElementById('custHint').textContent = titles[custTab][1];

  const q = custQuery.trim().toLowerCase();
  const list = base.filter(c => {
    if (custTab === 'confirmed' && !isConfirmedCust(c)) return false;
    if (custTab === 'prospect' && !isProspect(c)) return false;
    return !q || ((c.name || '') + ' ' + (c.phone || '') + ' ' + (c.address || '')).toLowerCase().includes(q);
  });

  const tab = (k, label, n) => `<button class="ct-tab ${custTab === k ? 'on' : ''}" data-tab="${k}">${label}<b>${n}</b></button>`;
  root.innerHTML = `
    <div class="sx-bar">
      <div class="ct-tabs">${(typeof can !== 'function' || !currentUser || (can('customers') && can('prospects'))) ? tab('all', 'الكل', nAll) : ''}${(typeof can !== 'function' || !currentUser || can('customers')) ? tab('confirmed', 'عميل الشركة (مؤكد)', nConf) : ''}${(typeof can !== 'function' || !currentUser || can('prospects')) ? tab('prospect', 'عميل محتمل', nPro) : ''}</div>
      <input id="custQ" class="ct-search" type="search" placeholder="بحث باسم العميل أو الهاتف أو العنوان..." value="${escapeHtml(custQuery)}">
    </div>
    <div class="sx-card sx-wrap"><table class="sx-table ct-table">
      <thead><tr><th>#</th><th>العميل</th><th>الحالة</th><th>الهاتف</th><th>الطلبات</th><th>المطلوب</th><th>المدفوع</th><th>المتبقي</th><th>الإجراءات</th></tr></thead>
      <tbody>${list.length ? list.map((c, i) => {
        const L = ledgerOf(c), pro = isProspect(c);
        const rem = !L.required && !L.paid ? '<span class="chip info">لا توجد طلبات</span>'
          : L.remaining > 0.005 ? `<span class="due">${fmt(L.remaining)}</span>` : `<span class="chip ok">${IC.check} مسدَّد</span>`;
        return `<tr data-id="${c.id}" data-status="${pro ? 'prospect' : 'confirmed'}">
          <td>${i + 1}</td>
          <td><div class="cell-user"><div class="avatar">${escapeHtml(initial(c.name))}</div><div><b>${escapeHtml(c.name)}</b><div class="ct-sub">${escapeHtml(c.address || 'بدون عنوان')}</div></div></div></td>
          <td>${pro ? '<span class="ct-badge pro">عميل محتمل</span>' : '<span class="ct-badge ok">عميل مؤكد</span>'}</td>
          <td dir="ltr" style="text-align:right">${escapeHtml(c.phone || '—')}</td>
          <td>${(c.accounts || []).length}</td>
          <td class="num">${fmt(L.required)}</td>
          <td class="ok num">${fmt(L.paid)}</td>
          <td>${rem}</td>
          <td style="white-space:nowrap">
            ${pro ? '<button class="sx-act approve" data-action="approve" title="تحويل إلى عميل مؤكد">✓ معتمد</button>' : ''}
            <button class="sx-act open" data-action="open">فتح الحساب</button>
            ${pro ? '' : '<button class="sx-act pay" data-action="collect">+ تحصيل</button>'}
            <button class="sx-act" data-action="edit">تعديل</button>
            <button class="sx-act del" data-action="delete">حذف</button>
          </td></tr>`;
      }).join('') : `<tr><td colspan="9" class="sx-empty">${db.customers.length ? 'لا توجد نتائج مطابقة' : 'لا يوجد عملاء بعد — اضغط "+ إضافة عميل" للبدء'}</td></tr>`}</tbody>
    </table></div>`;

  root.querySelectorAll('.ct-tab').forEach(b => b.addEventListener('click', () => { custTab = b.dataset.tab; renderCustomersList(); setNavActive('customers'); }));
  const qi = root.querySelector('#custQ');
  qi.addEventListener('input', () => {
    custQuery = qi.value; const pos = qi.selectionStart;
    renderCustomersList();
    const n = document.getElementById('custQ'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { }
  });

  root.querySelectorAll('tbody tr[data-id]').forEach(row => {
    const id = row.dataset.id;
    row.addEventListener('dblclick', () => openCustomerDetail(id));
    const on = (a, fn) => { const el = row.querySelector(`[data-action="${a}"]`); if (el) el.addEventListener('click', e => { e.stopPropagation(); fn(); }); };
    on('open', () => openCustomerDetail(id));
    on('approve', () => approveCustomer(id));
    on('collect', () => openPaymentModal(db.customers.find(x => x.id === id), '', true));
    on('edit', () => openCustomerModal(id));
    on('delete', () => {
      const c = db.customers.find(x => x.id === id);
      openConfirm(`هل تريد حذف العميل "${c.name}"؟ سيتم حذف كل حاساباته أيضًا.`, () => {
        db.customers = db.customers.filter(x => x.id !== id);
        persist();
        renderCustomersList();
      });
    });
  });
}

// اعتماد عميل محتمل → عميل شركة مؤكد، ثم الانتقال مباشرة لصفحة العميل
function approveCustomer(id) {
  const c = db.customers.find(x => x.id === id);
  if (!c) return;
  c.status = 'confirmed';
  c.approvedAt = todayStr();
  persist();
  if (typeof showToast === 'function') showToast('تم اعتماد "' + c.name + '" كعميل مؤكد');
  openCustomerDetail(id);
}

function openCustomerDetail(id) {
  currentCustomerId = id;
  const customer = db.customers.find(c => c.id === id);
  if (!customer) return;
  document.getElementById('customerDetailName').textContent = customer.name;
  document.getElementById('customerDetailAvatar').textContent = initial(customer.name);
  document.getElementById('customerDetailSub').textContent = [customer.phone, customer.address].filter(Boolean).join(' • ') || 'بدون بيانات تواصل';
  renderCustomerSpecs(customer);
  renderCustomerAccounts(customer);
  renderCustomerCalcsList(customer);
  document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
  document.getElementById('view-customer-detail').style.display = 'block';
  setNavActive('customer-detail');
}

function renderCustomerSpecs(customer) {
  const root = document.getElementById('customerSpecsRoot');
  const otherCustomers = db.customers.filter(c => c.id !== customer.id);
  root.innerHTML = `
    <div class="specs-box">
      <h3>مواصفات هذا العميل (تظهر في القائمة المنسدلة بحاساباته)</h3>
      <div class="specs-chips"></div>
      <div class="specs-add-row">
        <input type="text" class="new-spec-input" placeholder="اسم مواصفة جديدة">
        <button class="primary-btn" id="addSpecBtn">+ إضافة</button>
      </div>
      ${otherCustomers.length ? `
      <div class="specs-add-row" style="margin-top:10px;">
        <select class="copy-specs-select">
          <option value="">— انسخ المواصفات من عميل تاني —</option>
          ${otherCustomers.map(c => `<option value="${c.id}">${escapeHtml(c.name)} (${c.specs.length} مواصفة)</option>`).join('')}
        </select>
        <button class="secondary-btn" id="copySpecsBtn">نسخ</button>
      </div>` : ''}
    </div>
  `;

  function renderChips() {
    const chips = root.querySelector('.specs-chips');
    chips.innerHTML = customer.specs.map((s, idx) => `
      <span class="spec-chip" data-idx="${idx}">${escapeHtml(s)} <button title="حذف">✕</button></span>
    `).join('');
    chips.querySelectorAll('.spec-chip button').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.parentElement.dataset.idx, 10);
        customer.specs.splice(idx, 1);
        persist();
        renderChips();
      });
    });
  }
  renderChips();

  root.querySelector('#addSpecBtn').addEventListener('click', () => {
    const input = root.querySelector('.new-spec-input');
    const val = input.value.trim();
    if (!val) return;
    if (!customer.specs.includes(val)) customer.specs.push(val);
    input.value = '';
    persist();
    renderChips();
  });
  root.querySelector('.new-spec-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') root.querySelector('#addSpecBtn').click();
  });

  const copyBtn = root.querySelector('#copySpecsBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const select = root.querySelector('.copy-specs-select');
      const source = db.customers.find(c => c.id === select.value);
      if (!source) { alert('اختار عميل الأول عشان تنسخ مواصفاته'); return; }
      openConfirm(`هل تريد استبدال مواصفات "${customer.name}" بنفس مواصفات "${source.name}"؟`, () => {
        customer.specs = [...source.specs];
        persist();
        renderChips();
      });
    });
  }
}
