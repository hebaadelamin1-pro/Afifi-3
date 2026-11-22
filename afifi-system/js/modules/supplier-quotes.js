/* ===================== عروض أسعار الموردين =====================
   البيانات: db.supplierQuotes = [{ id, no, supplierId, supplierName, date, validity, items:[{bayan,qty,price}], notes }]
   الصفحة: السايد بار ← عروض الأسعار ← عروض أسعار الموردين
   ============================================================ */
(function () {
'use strict';

const $ = id => document.getElementById(id);
const E = s => escapeHtml(s == null ? '' : String(s));
const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; };
const lineTotal = i => num(i.qty) * num(i.price);
const grand = q => q.items.reduce((s, i) => s + lineTotal(i), 0);
let query = '';

function list() { return db.supplierQuotes = db.supplierQuotes || []; }
function nextNo() {
  const c = db.salesCfg = db.salesCfg || {};
  c.sq = (c.sq || 0) + 1;
  return 'SQ-' + new Date().getFullYear() + '-' + String(c.sq).padStart(3, '0');
}

/* ---------- القائمة ---------- */
function render() {
  const root = $('supplierQuotesRoot');
  if (!root || !db) return;
  const all = list().slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const q = query.trim().toLowerCase();
  const rows = all.filter(r => !q || (r.supplierName + ' ' + r.no + ' ' + r.items.map(i => i.bayan).join(' ')).toLowerCase().includes(q));
  root.innerHTML = `
    <div class="sx-bar"><input id="sqQ" class="ct-search" type="search" style="margin-inline-start:0" placeholder="بحث باسم المورد أو رقم العرض أو البيان..." value="${E(query)}"><span class="chip info">${all.length} عرض سعر</span></div>
    <div class="sx-card sx-wrap"><table class="sx-table qh-table">
      <thead><tr><th>#</th><th>المورد</th><th>رقم العرض</th><th>التاريخ</th><th>البيان</th><th>الإجمالي</th><th>الإجراءات</th></tr></thead>
      <tbody>${rows.length ? rows.map((r, i) => `<tr data-id="${r.id}">
        <td>${i + 1}</td><td><b>عرض سعر للمورد ${E(r.supplierName)}</b></td><td dir="ltr" style="text-align:right">${E(r.no || '—')}</td><td>${E(r.date || '—')}</td>
        <td class="items" title="${E(r.items.map(x => x.bayan).join(' | '))}">${E(r.items.slice(0, 2).map(x => x.bayan).join('، '))}${r.items.length > 2 ? ' +' + (r.items.length - 2) : ''}</td>
        <td class="num"><b>${fmt(grand(r))}</b> ج.م</td>
        <td style="white-space:nowrap"><button class="sx-act open" data-action="view">عرض</button><button class="sx-act" data-action="edit">تعديل</button><button class="sx-act" data-action="print">طباعة</button><button class="sx-act del" data-action="delete">حذف</button></td>
      </tr>`).join('') : `<tr><td colspan="7" class="sx-empty">${all.length ? 'لا توجد نتائج مطابقة' : 'لا توجد عروض أسعار للموردين بعد — اضغط "+ عرض سعر مورد"'}</td></tr>`}</tbody>
    </table></div>`;

  const qi = root.querySelector('#sqQ');
  qi.addEventListener('input', () => {
    query = qi.value; const pos = qi.selectionStart; render();
    const n = $('sqQ'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { }
  });
  root.querySelectorAll('tbody tr[data-id]').forEach(row => {
    const r = list().find(x => x.id === row.dataset.id);
    const on = (a, fn) => { const el = row.querySelector(`[data-action="${a}"]`); if (el) el.addEventListener('click', e => { e.stopPropagation(); fn(); }); };
    row.addEventListener('click', () => details(r));
    on('view', () => details(r));
    on('edit', () => form(r.id));
    on('print', () => print(r));
    on('delete', () => openConfirm('هل تريد حذف عرض السعر هذا؟', () => { db.supplierQuotes = list().filter(x => x.id !== r.id); persist(); render(); }));
  });
}
window.renderSupplierQuotes = render;

/* ---------- التفاصيل ---------- */
function details(r) {
  const ov = makeOverlay(`<div class="modal qh-detail" style="width:760px;max-width:95vw;max-height:92vh;overflow:auto">
    <h2>عرض سعر مورد — ${E(r.supplierName)}</h2>
    <div class="qh-meta"><div><small>المورد</small><b>${E(r.supplierName)}</b></div><div><small>رقم العرض</small><b>${E(r.no || '—')}</b></div><div><small>التاريخ</small><b>${E(r.date || '—')}</b></div><div><small>صلاحية العرض</small><b>${E(r.validity || '—')}</b></div></div>
    <table class="qh-items"><thead><tr><th style="width:42px">م</th><th>البيان</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>
    ${r.items.map((i, k) => `<tr><td>${k + 1}</td><td class="r">${E(i.bayan)}</td><td>${E(i.qty)}</td><td>${fmt(num(i.price))}</td><td>${fmt(lineTotal(i))}</td></tr>`).join('') || '<tr><td colspan="5">لا توجد بنود</td></tr>'}</tbody>
    <tfoot><tr><td colspan="4">إجمالي الأسعار</td><td>${fmt(grand(r))} ج.م</td></tr></tfoot></table>
    ${r.notes && r.notes.trim() ? `<div class="qh-notes"><b>ملاحظات:</b> ${E(r.notes)}</div>` : ''}
    <div class="modal-actions"><button class="secondary-btn" data-x>إغلاق</button><button class="primary-btn" data-p>🖨 طباعة</button></div></div>`);
  ov.querySelector('[data-x]').onclick = () => ov.remove();
  ov.querySelector('[data-p]').onclick = () => print(r);
}

/* ---------- نموذج الإضافة / التعديل ---------- */
function form(id, supplierId) {
  const ex = id ? list().find(x => x.id === id) : null;
  const sup = supplierId ? db.suppliers.find(s => s.id === supplierId) : null;
  const q = ex ? JSON.parse(JSON.stringify(ex)) : {
    id: null, no: '', supplierId: sup ? sup.id : '', supplierName: sup ? sup.name : '', date: todayStr(), validity: '',
    items: [{ bayan: '', qty: 1, price: '' }], notes: ''
  };
  const ov = makeOverlay(`<div class="modal qh-form" style="width:780px;max-width:95vw;max-height:92vh;overflow:auto">
    <h2>${ex ? 'تعديل' : 'إضافة'} عرض سعر مورد</h2>
    <div class="qh-grid">
      <div class="modal-field"><label>اختر المورد</label><select id="sqSup"><option value="">— اختر مورد موجود —</option>${(db.suppliers || []).map(s => `<option value="${s.id}" ${q.supplierId === s.id ? 'selected' : ''}>${E(s.name)}</option>`).join('')}</select></div>
      <div class="modal-field"><label>اسم المورد (يظهر في الطباعة)</label><input id="sqName" value="${E(q.supplierName)}" placeholder="اسم الشركة أو المورد"></div>
      <div class="modal-field"><label>رقم العرض (اختياري)</label><input id="sqNo" dir="ltr" value="${E(q.no)}" placeholder="يُولَّد تلقائياً"></div>
      <div class="modal-field"><label>التاريخ</label><input id="sqDate" type="date" value="${E(q.date)}"></div>
      <div class="modal-field" style="grid-column:1/-1"><label>صلاحية العرض (اختياري)</label><input id="sqVal" value="${E(q.validity)}" placeholder="مثال: ساري لمدة 15 يوم"></div>
    </div>
    <table class="qh-rows"><thead><tr><th style="width:36px">م</th><th>البيان</th><th style="width:96px">الكمية</th><th style="width:120px">سعر الوحدة</th><th style="width:120px">الإجمالي</th><th style="width:44px"></th></tr></thead><tbody id="sqRows"></tbody></table>
    <button class="add-row-btn" id="sqAdd" type="button">+ إضافة بند</button>
    <div class="qh-tot"><span>إجمالي الأسعار</span><span id="sqTot">0 ج.م</span></div>
    <div class="modal-field" style="margin-top:12px"><label>ملاحظات</label><textarea id="sqNotes" rows="3">${E(q.notes)}</textarea></div>
    <div class="modal-actions"><button class="secondary-btn" data-x>إلغاء</button><button class="primary-btn" data-s>💾 حفظ</button></div></div>`);
  const $$ = s => ov.querySelector(s);
  const drawRows = () => {
    $$('#sqRows').innerHTML = q.items.map((i, k) => `<tr><td style="text-align:center">${k + 1}</td>
      <td><input data-f="bayan" data-k="${k}" value="${E(i.bayan)}" placeholder="الصنف / البيان"></td>
      <td><input data-f="qty" data-k="${k}" type="number" step="any" value="${E(i.qty)}"></td>
      <td><input data-f="price" data-k="${k}" type="number" step="any" value="${E(i.price)}"></td>
      <td class="tt" data-t="${k}">${fmt(lineTotal(i))}</td><td><button class="qh-x" data-del="${k}" type="button" title="حذف البند">✕</button></td></tr>`).join('');
    tot();
  };
  const tot = () => { $$('#sqTot').textContent = fmt(grand(q)) + ' ج.م'; q.items.forEach((i, k) => { const c = $$(`[data-t="${k}"]`); if (c) c.textContent = fmt(lineTotal(i)); }); };
  ov.addEventListener('input', e => { const t = e.target; if (t.dataset.f) { q.items[+t.dataset.k][t.dataset.f] = t.value; tot(); } });
  ov.addEventListener('click', e => { const t = e.target.closest('[data-del]'); if (t) { q.items.splice(+t.dataset.del, 1); if (!q.items.length) q.items.push({ bayan: '', qty: 1, price: '' }); drawRows(); } });
  $$('#sqAdd').onclick = () => { q.items.push({ bayan: '', qty: 1, price: '' }); drawRows(); };
  $$('#sqSup').onchange = e => { const s = db.suppliers.find(x => x.id === e.target.value); q.supplierId = e.target.value; if (s) { q.supplierName = s.name; $$('#sqName').value = s.name; } };
  $$('[data-x]').onclick = () => ov.remove();
  $$('[data-s]').onclick = () => {
    q.supplierName = $$('#sqName').value.trim(); q.no = $$('#sqNo').value.trim(); q.date = $$('#sqDate').value; q.validity = $$('#sqVal').value.trim(); q.notes = $$('#sqNotes').value;
    if (!q.supplierName) { alert('من فضلك اختر أو اكتب اسم المورد'); return; }
    q.items = q.items.filter(i => String(i.bayan || '').trim() || num(i.price));
    if (!q.items.length) { alert('أضف بنداً واحداً على الأقل'); return; }
    if (ex) { Object.assign(ex, q); }
    else { q.id = uid(); q.no = q.no || nextNo(); list().push(q); }
    persist(); ov.remove();
    if ($('view-quotes-suppliers').style.display === 'none') showView('quotes-suppliers'); else render();
  };
  drawRows();
}
window.openSupplierQuoteForm = form;
$('addSupplierQuoteBtn').addEventListener('click', () => form(null));

/* ---------- الطباعة (نفس هوية طباعة عروض أسعار العملاء) ---------- */
function print(r) {
  const rows = r.items.map((i, k) => `<div class="pg-row"><div class="pg-cell">${k + 1}</div><div class="pg-cell pg-right">${E(i.bayan)}</div><div class="pg-cell">${E(i.qty)}</div><div class="pg-cell">${fmt(num(i.price))}</div><div class="pg-cell">${fmt(lineTotal(i))}</div></div>`).join('');
  doPrint(`<div class="print-sheet">${buildPrintHeader()}
    <div class="print-title">عرض سعر مورد</div>
    <div class="print-meta"><div><strong>المورد:</strong> ${E(r.supplierName)}</div><div><strong>التاريخ:</strong> ${E(r.date)}</div></div>
    ${r.no || r.validity ? `<div class="print-meta"><div><strong>رقم العرض:</strong> ${E(r.no || '—')}</div><div><strong>صلاحية العرض:</strong> ${E(r.validity || '—')}</div></div>` : ''}
    <div class="pg-table">
      <div class="pg-row pg-head"><div class="pg-cell">م</div><div class="pg-cell">البيان</div><div class="pg-cell">الكمية</div><div class="pg-cell">سعر الوحدة</div><div class="pg-cell">السعر الإجمالي</div></div>
      ${rows}
      <div class="pg-row pg-foot"><div class="pg-cell pg-span4">إجمالي الأسعار</div><div class="pg-cell">${fmt(grand(r))} ج.م</div></div>
    </div>
    ${r.notes && r.notes.trim() ? `<div class="print-notes"><div>* ${E(r.notes).replace(/\n/g, '</div><div>* ')}</div></div>` : ''}
    ${buildPrintFooter()}</div>`);
}

})();
