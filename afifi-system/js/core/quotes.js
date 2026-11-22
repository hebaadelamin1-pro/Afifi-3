// ===================== QUOTES =====================
let quotesQuery = '';

// إجمالي عرض سعر منشأ من صفحة المبيعات (طلب العميل)
function salesQuoteTotal(sq) {
  let sub = 0;
  (sq.items || []).forEach(i => { sub += (parseFloat(i.qty) || 0) * (parseFloat(i.price) || 0); });
  const tax = sq.taxOn ? sub * (parseFloat(sq.taxPct) || 0) / 100 : 0;
  return Math.round((sub + tax) * 100) / 100;
}

// كل عروض أسعار العملاء: المستقلة + المنشأة من حساب كل عميل/طلب
function allClientQuotes() {
  const rows = (db.quotes || []).map(q => ({
    kind: 'quote', id: q.id, name: q.customerName || 'بدون اسم', no: '—', date: q.date || '',
    items: q.items.map(i => ({ bayan: i.bayan, size: '', qty: i.qty ?? 1, price: i.price })),
    total: q.items.reduce((s, it) => s + quoteItemTotal(it), 0), notes: q.notes || [], src: 'عرض سعر مستقل', q
  }));
  db.customers.forEach(c => {
    if (typeof can === 'function' && currentUser && !can(c.status === 'prospect' ? 'prospects' : 'customers')) return;
    (c.accounts || []).forEach(o => {
      const sq = o.sales && o.sales.quote;
      if (!sq) return;
      rows.push({
        kind: 'sales', id: o.id, cid: c.id, oid: o.id, name: sq.customer || c.name, no: sq.no || '—', date: sq.date || '',
        items: (sq.items || []).map(i => ({ bayan: i.bayan, size: i.size, qty: i.qty, price: i.price })),
        total: salesQuoteTotal(sq), notes: String(sq.notesText || '').split('\n').map(x => x.trim()).filter(Boolean),
        tax: sq.taxOn ? { pct: sq.taxPct } : null, src: 'من حساب العميل — ' + (o.description || 'طلب'), status: c.status
      });
    });
  });
  return rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function showClientQuoteDetails(r) {
  const itemsHtml = r.items.map((i, k) => {
    const t = (parseFloat(i.qty) || 0) * (parseFloat(i.price) || 0);
    return `<tr><td>${k + 1}</td><td class="r">${escapeHtml(i.bayan || '')}</td><td dir="ltr">${escapeHtml(i.size || '')}</td><td>${escapeHtml(String(i.qty ?? ''))}</td><td>${fmt(parseFloat(i.price) || 0)}</td><td>${fmt(t)}</td></tr>`;
  }).join('');
  makeOverlay(`<div class="modal qh-detail" style="width:760px;max-width:95vw;max-height:92vh;overflow:auto">
    <h2>عرض سعر — ${escapeHtml(r.name)}</h2>
    <div class="qh-meta"><div><small>الشركة / العميل</small><b>${escapeHtml(r.name)}</b></div><div><small>رقم العرض</small><b>${escapeHtml(r.no)}</b></div><div><small>التاريخ</small><b>${escapeHtml(r.date || '—')}</b></div><div><small>المصدر</small><b>${escapeHtml(r.src)}</b></div></div>
    <table class="qh-items"><thead><tr><th style="width:42px">م</th><th>البيان</th><th>المقاس</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>${itemsHtml || '<tr><td colspan="6">لا توجد بنود</td></tr>'}</tbody>
    <tfoot><tr><td colspan="5">${r.tax ? 'الإجمالي بعد ضريبة ' + escapeHtml(String(r.tax.pct)) + '%' : 'إجمالي الأسعار'}</td><td>${fmt(r.total)} ج.م</td></tr></tfoot></table>
    ${r.notes.length ? `<div class="qh-notes"><b>ملاحظات:</b>${r.notes.map(n => `<div>* ${escapeHtml(n)}</div>`).join('')}</div>` : ''}
    <div class="modal-actions"><button class="secondary-btn" data-x>إغلاق</button></div></div>`)
    .querySelector('[data-x]').addEventListener('click', e => e.target.closest('.modal-overlay').remove());
}

function renderQuotesList() {
  const root = document.getElementById('quotesListRoot');
  const q = quotesQuery.trim().toLowerCase();
  const all = allClientQuotes();
  const rows = all.filter(r => !q || (r.name + ' ' + r.no + ' ' + r.items.map(i => i.bayan).join(' ')).toLowerCase().includes(q));
  root.innerHTML = `
    <div class="sx-bar"><input id="quotesQ" class="ct-search" type="search" style="margin-inline-start:0" placeholder="بحث باسم الشركة أو رقم العرض أو البيان..." value="${escapeHtml(quotesQuery)}"><span class="chip info">${all.length} عرض سعر</span></div>
    <div class="sx-card sx-wrap"><table class="sx-table qh-table">
      <thead><tr><th>#</th><th>الشركة / العميل</th><th>رقم العرض</th><th>التاريخ</th><th>البيان</th><th>الإجمالي</th><th>المصدر</th><th>الإجراءات</th></tr></thead>
      <tbody>${rows.length ? rows.map((r, i) => `<tr data-i="${i}">
        <td>${i + 1}</td><td><b>${/^\s*(شركة|مؤسسة|مصنع)/.test(r.name) ? 'عرض سعر ل' : 'عرض سعر لشركة '}${escapeHtml(r.name)}</b></td><td dir="ltr" style="text-align:right">${escapeHtml(r.no)}</td><td>${escapeHtml(r.date || '—')}</td>
        <td class="items" title="${escapeHtml(r.items.map(x => x.bayan).join(' | '))}">${escapeHtml(r.items.slice(0, 2).map(x => x.bayan).join('، '))}${r.items.length > 2 ? ' +' + (r.items.length - 2) : ''}</td>
        <td class="num"><b>${fmt(r.total)}</b> ج.م</td>
        <td><span class="qh-src ${r.kind === 'sales' ? 'acc' : ''}">${escapeHtml(r.src)}</span></td>
        <td style="white-space:nowrap">
          <button class="sx-act open" data-action="view">عرض</button>
          ${r.kind === 'quote' ? `<button class="sx-act" data-action="toAccount">➕ لحساب العميل</button><button class="sx-act" data-action="edit">تعديل</button><button class="sx-act" data-action="print">طباعة</button><button class="sx-act del" data-action="delete">حذف</button>` : `<button class="sx-act" data-action="openOrder">فتح الطلب</button>`}
        </td></tr>`).join('') : `<tr><td colspan="8" class="sx-empty">${all.length ? 'لا توجد نتائج مطابقة' : 'لا توجد عروض أسعار بعد — اضغط "+ عرض سعر جديد"'}</td></tr>`}</tbody>
    </table></div>`;

  const qi = root.querySelector('#quotesQ');
  qi.addEventListener('input', () => {
    quotesQuery = qi.value; const pos = qi.selectionStart;
    renderQuotesList();
    const n = document.getElementById('quotesQ'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { }
  });

  root.querySelectorAll('tbody tr[data-i]').forEach(row => {
    const r = rows[+row.dataset.i];
    const on = (a, fn) => { const el = row.querySelector(`[data-action="${a}"]`); if (el) el.addEventListener('click', e => { e.stopPropagation(); fn(); }); };
    row.addEventListener('click', () => showClientQuoteDetails(r));
    on('view', () => showClientQuoteDetails(r));
    on('openOrder', () => { currentCustomerId = r.cid; openSales(r.cid, r.oid); });
    on('edit', () => editQuote(r.id));
    on('print', () => printQuote(db.quotes.find(x => x.id === r.id)));
    on('toAccount', () => {
      const qt = db.quotes.find(x => x.id === r.id);
      const customer = db.customers.find(c => c.id === qt.customerId);
      if (!customer) { alert('عرض السعر ده مش مرتبط بعميل مسجل. من فضلك افتح عرض السعر واختار عميل موجود من القائمة أولًا.'); return; }
      const grand = qt.items.reduce((s, it) => s + quoteItemTotal(it), 0);
      if (!customer.accounts) customer.accounts = [];
      customer.accounts.push({
        id: uid(),
        description: 'عرض سعر بتاريخ ' + (qt.date || todayStr()),
        totalAmount: Math.round(grand * 100) / 100,
        date: todayStr(),
        payments: [],
        quoteId: qt.id
      });
      persist();
      alert(`تم إضافة عرض السعر كطلب في حساب العميل "${customer.name}" بمبلغ ${fmt(grand)} ج.م`);
      openCustomerDetail(customer.id);
    });
    on('delete', () => {
      openConfirm('هل تريد حذف عرض السعر هذا؟', () => {
        db.quotes = db.quotes.filter(x => x.id !== r.id);
        persist();
        renderQuotesList();
      });
    });
  });
}

document.getElementById('addQuoteBtn').addEventListener('click', () => {
  currentQuoteEditing = {
    id: null,
    customerId: '',
    customerName: '',
    date: new Date().toISOString().slice(0, 10),
    items: [{ bayan: '', qty: 1, price: '' }],
    notes: defaultNotes()
  };
  renderQuoteForm();
  showView('quote-form');
});

document.getElementById('backToQuotesBtn').addEventListener('click', () => showView('quotes'));

function editQuote(id) {
  const q = db.quotes.find(x => x.id === id);
  if (!q) return;
  currentQuoteEditing = JSON.parse(JSON.stringify(q));
  renderQuoteForm();
  showView('quote-form');
}

function renderQuoteForm() {
  const root = document.getElementById('quoteFormRoot');
  const q = currentQuoteEditing;
  root.innerHTML = `
    <div class="sheet" style="padding:20px 24px;">
      <div class="quote-form-grid">
        <div class="field">
          <label>اختر العميل</label>
          <select class="quote-customer-select">
            <option value="">— اختر عميل موجود —</option>
            ${db.customers.map(c => `<option value="${c.id}" ${q.customerId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>اسم العميل (يظهر في الطباعة)</label>
          <input type="text" class="quote-customer-name" value="${escapeHtml(q.customerName || '')}" placeholder="اسم الشركة أو العميل">
        </div>
        <div class="field">
          <label>التاريخ</label>
          <input type="date" class="quote-date" value="${q.date || ''}">
        </div>
      </div>

      <div class="calc-picker-box"></div>

      <table class="quote-items-table">
        <thead>
          <tr><th style="width:36px;">م</th><th>الصنف</th><th style="width:100px;">الكمية</th><th style="width:130px;">سعر الوحدة</th><th style="width:130px;">السعر الإجمالي</th><th style="width:36px;"></th></tr>
        </thead>
        <tbody class="quote-items-body"></tbody>
        <tfoot>
          <tr>
            <td colspan="4" style="text-align:left; font-family:'Cairo',sans-serif; font-weight:800; padding:10px; background:#eee5cf;">إجمالي الأسعار</td>
            <td colspan="2" class="quote-grand-total" style="font-family:'Cairo',sans-serif; font-weight:800; padding:10px; background: var(--brass-light); text-align:center;">0 ج.م</td>
          </tr>
        </tfoot>
      </table>
      <button class="add-row-btn" id="addQuoteItemBtn">+ إضافة بند يدوي</button>

      <div class="notes-box">
        <h3>ملاحظات تظهر أسفل عرض السعر</h3>
        <div class="notes-list"></div>
        <button class="add-row-btn" id="addNoteBtn">+ إضافة ملاحظة</button>
      </div>
    </div>
  `;

  root.querySelector('.quote-customer-select').addEventListener('change', e => {
    const c = db.customers.find(x => x.id === e.target.value);
    q.customerId = e.target.value;
    if (c) {
      q.customerName = c.name;
      root.querySelector('.quote-customer-name').value = c.name;
      // if the items list is still empty/default, auto-pull all of this customer's calculators
      const isBlankDefault = q.items.length <= 1 && q.items.every(it => !it.bayan && it.price === '');
      if (isBlankDefault && c.calculators.length) {
        q.items = c.calculators.map(makeQuoteItemFromCalc);
      }
    }
    renderCalcPicker(root, q);
    buildQuoteItemsTable(root, q);
  });
  root.querySelector('.quote-customer-name').addEventListener('input', e => { q.customerName = e.target.value; });
  root.querySelector('.quote-date').addEventListener('input', e => { q.date = e.target.value; });

  renderCalcPicker(root, q);
  buildQuoteItemsTable(root, q);
  buildNotesList(root, q);

  root.querySelector('#addQuoteItemBtn').addEventListener('click', () => {
    q.items.push({ bayan: '', qty: 1, price: '' });
    buildQuoteItemsTable(root, q);
  });
  root.querySelector('#addNoteBtn').addEventListener('click', () => {
    q.notes.push('');
    buildNotesList(root, q);
  });
}

function makeQuoteItemFromCalc(calc) {
  const computed = computeCalc(calc);
  return {
    bayan: calc.palletName || calc.name || TYPE_META[calc.type || 'pallet'].label,
    type: calc.type || 'pallet',
    qty: 1,
    price: Math.round(computed.finalPrice * 100) / 100
  };
}

function renderCalcPicker(root, q) {
  const box = root.querySelector('.calc-picker-box');
  const customer = db.customers.find(c => c.id === q.customerId);
  if (!customer || !customer.calculators.length) {
    box.innerHTML = '';
    return;
  }
  box.innerHTML = `
    <div class="costs-box" style="margin-bottom:16px;">
      <h3>إضافة بند من حاسبات "${escapeHtml(customer.name)}"</h3>
      <div class="calc-picker-list">
        ${customer.calculators.map(calc => {
          const computed = computeCalc(calc);
          return `
          <div class="calc-picker-item">
            <span>${escapeHtml(calc.palletName || calc.name || 'حاسبة')} — ${fmt(computed.finalPrice)} ج.م</span>
            <button class="icon-btn open" data-calc-id="${calc.id}">+ إضافة لعرض السعر</button>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
  box.querySelectorAll('[data-calc-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const calc = customer.calculators.find(c => c.id === btn.dataset.calcId);
      q.items.push(makeQuoteItemFromCalc(calc));
      buildQuoteItemsTable(root, q);
    });
  });
}

function buildQuoteItemsTable(root, q) {
  const tbody = root.querySelector('.quote-items-body');
  tbody.innerHTML = '';
  q.items.forEach((item, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="rownum">${idx + 1}</td>
      <td><input type="text" class="bayan-input" value="${escapeHtml(item.bayan || '')}" placeholder="مثال: بالتة 113*113 أو صندوق خشبي أو بكرة سحاب"></td>
      <td><input type="number" class="qty-input" value="${item.qty ?? 1}" min="0" placeholder="1"></td>
      <td><input type="number" class="price-input" value="${item.price ?? ''}" placeholder="0"></td>
      <td class="calc line-total-cell">0</td>
      <td><button class="row-del-btn" title="حذف البند">✕</button></td>
    `;
    tr.querySelector('.bayan-input').addEventListener('input', e => { item.bayan = e.target.value; });
    tr.querySelector('.qty-input').addEventListener('input', e => { item.qty = e.target.value; updateQuoteTotals(root, q); });
    tr.querySelector('.price-input').addEventListener('input', e => { item.price = e.target.value; updateQuoteTotals(root, q); });
    tr.querySelector('.row-del-btn').addEventListener('click', () => {
      q.items.splice(idx, 1);
      buildQuoteItemsTable(root, q);
    });
    tbody.appendChild(tr);
  });
  updateQuoteTotals(root, q);
}

function quoteItemTotal(item) {
  const qty = parseFloat(item.qty ?? 1) || 0;
  const price = parseFloat(item.price) || 0;
  return qty * price;
}

function updateQuoteTotals(root, q) {
  const rows = root.querySelectorAll('.quote-items-body tr');
  let grand = 0;
  rows.forEach((tr, idx) => {
    const total = quoteItemTotal(q.items[idx]);
    grand += total;
    const cell = tr.querySelector('.line-total-cell');
    if (cell) cell.textContent = fmt(total);
  });
  const grandCell = root.querySelector('.quote-grand-total');
  if (grandCell) grandCell.textContent = fmt(grand) + ' ج.م';
}

function buildNotesList(root, q) {
  const list = root.querySelector('.notes-list');
  list.innerHTML = '';
  q.notes.forEach((note, idx) => {
    const div = document.createElement('div');
    div.className = 'note-row';
    div.innerHTML = `<input type="text" value="${escapeHtml(note)}"><button class="row-del-btn" title="حذف">✕</button>`;
    div.querySelector('input').addEventListener('input', e => { q.notes[idx] = e.target.value; });
    div.querySelector('button').addEventListener('click', () => { q.notes.splice(idx, 1); buildNotesList(root, q); });
    list.appendChild(div);
  });
}

document.getElementById('saveQuoteBtn').addEventListener('click', () => {
  const q = currentQuoteEditing;
  if (!q.customerName.trim()) { alert('من فضلك اختر أو اكتب اسم العميل'); return; }
  if (q.id) {
    const idx = db.quotes.findIndex(x => x.id === q.id);
    if (idx > -1) db.quotes[idx] = q;
  } else {
    q.id = uid();
    db.quotes.push(q);
  }
  persist();
  renderQuotesList();
  showView('quotes');
});

document.getElementById('printQuoteBtn').addEventListener('click', () => {
  printQuote(currentQuoteEditing);
});
