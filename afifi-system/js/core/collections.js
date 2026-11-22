// ===================== التحصيل =====================
function money(n) { return (isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function renderCollectionsView() {
  const root = document.getElementById('collectionsRoot');
  let W = 0, P = 0;
  const rows = db.customers.filter(c => c.status !== 'prospect').map(c => { const L = ledgerOf(c); W += L.required; P += L.paid; return { c, L }; });
  const R = W - P;
  root.innerHTML = `<div class="coll-cards">
    <div class="coll-card"><div class="kpi-ic">${IC.file}</div><div><small>إجمالي المسحوبات الآجلة للعملاء</small><strong><span class="num">${money(W)}</span> ج.م</strong></div></div>
    <div class="coll-card"><div class="kpi-ic" style="background:var(--m-ok-soft);color:var(--m-ok)">${IC.wallet}</div><div><small>إجمالي المقبوضات والعرابين</small><strong class="ok"><span class="num">${money(P)}</span> ج.م</strong></div></div>
    <div class="coll-card"><div class="kpi-ic" style="background:var(--m-due-soft);color:var(--m-due)">${IC.alert}</div><div><small>المتبقي للتحصيل</small><strong class="due"><span class="num">${money(R)}</span> ج.م</strong></div></div></div>
    <div class="list-card coll-table">
      <div class="coll-toolbar"><div class="search-inp">${IC.search}<input type="text" id="collSearch" placeholder="ابحث باسم العميل أو رقم الهاتف..."></div></div>
      <div class="scroll"><table><thead><tr><th>العميل / الشركة</th><th>العنوان</th><th>إجمالي المسحوبات</th><th>المدفوع والعربون</th><th>المتبقي عليه</th><th>التحصيل</th><th></th></tr></thead><tbody>
      ${rows.length ? rows.map(({ c, L }) => {
        const pct = L.required > 0 ? Math.min(100, Math.max(0, Math.round(L.paid / L.required * 100))) : 0;
        return `<tr data-id="${c.id}" data-q="${escapeHtml((c.name + ' ' + (c.phone || '')).toLowerCase())}">
          <td><div class="cell-cust"><div class="avatar">${escapeHtml(initial(c.name))}</div><div><b>${escapeHtml(c.name)}</b><small class="num">${escapeHtml(c.phone || '')}</small></div></div></td>
          <td class="mut">${escapeHtml(c.address || '')}</td>
          <td><span class="num">${money(L.required)}</span> ج.م</td>
          <td class="ok"><span class="num">${money(L.paid)}</span> ج.م</td>
          <td class="${L.remaining > 0.005 ? 'due' : 'ok'}"><span class="num">${money(L.remaining)}</span> ج.م</td>
          <td><span class="mini-bar"><span style="width:${pct}%"></span></span><span class="num">${pct}%</span></td>
          <td><button class="icon-btn pay" data-collect="${c.id}">+ تحصيل</button></td></tr>`;
      }).join('') : '<tr><td colspan="7" class="mut" style="text-align:center;padding:30px;">لا يوجد عملاء بعد. اضغط "+ إضافة عميل جديد".</td></tr>'}
      </tbody></table></div></div>`;
  root.querySelectorAll('tr[data-id]').forEach(tr => tr.addEventListener('click', () => openCustomerDetail(tr.dataset.id)));
  root.querySelectorAll('[data-collect]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    openPaymentModal(db.customers.find(c => c.id === b.dataset.collect), '', true);
  }));
  const s = root.querySelector('#collSearch');
  if (s) s.addEventListener('input', () => {
    const q = s.value.trim().toLowerCase();
    root.querySelectorAll('tr[data-id]').forEach(tr => { tr.style.display = !q || tr.dataset.q.includes(q) ? '' : 'none'; });
  });
}
document.getElementById('addCustomerBtn2').addEventListener('click', () => openCustomerModal());

