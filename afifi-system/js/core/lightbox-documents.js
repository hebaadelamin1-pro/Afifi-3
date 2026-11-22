// ===================== LIGHTBOX (تكبير الصور) =====================
(function () {
  const ov = document.createElement('div');
  ov.id = 'lightbox';
  ov.innerHTML = '<button type="button" aria-label="إغلاق">✕</button><img alt="">';
  document.body.appendChild(ov);
  const close = () => { ov.style.display = 'none'; };
  ov.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  document.addEventListener('click', e => {
    const im = e.target.closest('.img-thumb img, .payment-receipt-thumb');
    if (!im) return;
    ov.querySelector('img').src = im.src;
    ov.style.display = 'flex';
  });
})();

// ===================== عرض السعر وإذن التسليم (3 تصاميم) =====================
const DOC_DESIGNS = [['classic', 'كلاسيكي رسمي'], ['modern', 'حديث'], ['executive', 'تنفيذي']];
let docSt = null;

function docSizeText(calc) {
  const t = calc.type || 'pallet';
  const v = t === 'pallet' ? [calc.palletLength, calc.palletWidth] : (calc.dims || []);
  return v.filter(x => x !== '' && x != null).join('*');
}

function buildDocHtml(st) {
  const c = db.company, q = st.kind === 'quote';
  const qty = parseFloat(st.qty) || 0, price = parseFloat(st.price) || 0;
  const head = `<div class="pq-head"><div class="pq-logo">${c.logo ? `<img src="${c.logo}">` : 'الشعار'}</div>
    <div class="pq-names"><b>${escapeHtml(c.name)}</b><span>${escapeHtml(c.nameEn)}</span></div></div>`;
  const meta = `<div class="pq-meta"><div>السادة شركة: <b>${escapeHtml(st.customer) || '........................'}</b></div><div>التاريخ: <b>${escapeHtml(st.date)}</b></div></div>`;
  let body;
  if (q) {
    const notes = st.notes.split('\n').map(s => s.trim()).filter(Boolean);
    body = `<p class="pq-greet">تحية طيبة وبعد،</p><p><b>مرسل إلى سيادتكم عرض السعر الخاص بالمطلوب:</b></p>
    <table><thead><tr><th>البيان</th><th>العدد</th><th>المقاس</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>
    <tbody><tr><td class="l">${escapeHtml(st.name)}</td><td>${fmt(qty)}</td><td dir="ltr">${escapeHtml(st.size)}</td><td>${fmt(price)}</td><td>${fmt(qty * price)}</td></tr>
    <tr class="tot"><td colspan="4">الإجمالي</td><td>${fmt(qty * price)}</td></tr></tbody></table>
    ${notes.length ? `<div class="pq-notes"><b>ملحوظة:</b><ul>${notes.map(n => `<li>${escapeHtml(n)}</li>`).join('')}</ul></div>` : ''}
    <p class="pq-close"><b>وتفضلوا بقبول وافر الاحترام والتقدير.</b></p>`;
  } else {
    body = `<p><b>تم تسليم البضاعة الموضحة أدناه:</b></p>
    <table><thead><tr><th>م</th><th>البيان</th><th>المقاس</th><th>العدد</th></tr></thead>
    <tbody><tr><td>1</td><td class="l">${escapeHtml(st.name)}</td><td dir="ltr">${escapeHtml(st.size)}</td><td>${fmt(qty)}</td></tr></tbody></table>
    ${st.notes.trim() ? `<div class="pq-notes"><b>ملاحظات:</b> ${escapeHtml(st.notes)}</div>` : ''}
    <p class="pq-note-line">تم استلام البضاعة المذكورة أعلاه سليمة وكاملة.</p>
    <div class="pq-sign"><div>المستلم (الاسم والتوقيع)</div><div>المسلِّم</div><div>ختم الشركة</div></div>`;
  }
  const foot = `<div class="pq-foot">المصنع: ${escapeHtml(c.factoryAddress)}<br>المعرض: ${escapeHtml(c.showroomAddress)}<br>للتواصل: <span dir="ltr">${(c.phones || []).join(' - ')}</span>${c.email ? ' - ' + escapeHtml(c.email) : ''}</div>`;
  return `<div class="pq pq-${st.design}">${head}<div class="pq-title">${q ? 'عرض سعر' : 'إذن تسليم'}</div>${meta}${body}${foot}</div>`;
}

function openDoc(kind) {
  const calc = db.general, comp = computeCalc(calc), q = kind === 'quote';
  docSt = { kind, design: 'classic', customer: '', date: todayStr().replace(/-/g, '/'),
    name: calc.palletName || calc.name || TYPE_META[calc.type || 'pallet'].label,
    size: docSizeText(calc), qty: comp.quantity, price: Math.round(comp.unitPrice * 100) / 100,
    notes: q ? defaultNotes().join('\n') : '' };
  let ov = document.getElementById('docOverlay');
  if (!ov) { ov = document.createElement('div'); ov.id = 'docOverlay'; ov.className = 'modal-overlay'; document.body.appendChild(ov); }
  const F = (id, label, val, type) => `<div class="modal-field"><label>${label}</label><input type="${type || 'text'}" id="${id}" value="${escapeHtml(String(val))}"></div>`;
  ov.innerHTML = `<div class="modal doc-modal"><h2>${q ? 'طباعة عرض سعر' : 'طباعة إذن تسليم'}</h2>
    <div class="doc-body"><div class="doc-form">
      ${F('dc-customer', 'اسم العميل / الشركة', '')}${F('dc-date', 'التاريخ', docSt.date)}${F('dc-name', 'البيان', docSt.name)}${F('dc-size', 'المقاس', docSt.size)}${F('dc-qty', 'العدد', docSt.qty, 'number')}
      ${q ? F('dc-price', 'سعر الوحدة (ج.م)', docSt.price, 'number') : ''}
      <div class="modal-field"><label>${q ? 'الملاحظات (كل سطر ملاحظة)' : 'ملاحظات (اختياري)'}</label><textarea id="dc-notes" rows="${q ? 5 : 3}">${escapeHtml(docSt.notes)}</textarea></div>
      <div class="modal-field"><label>التصميم</label><div class="doc-designs">${DOC_DESIGNS.map(d => `<button type="button" class="type-btn ${d[0] === docSt.design ? 'on' : ''}" data-d="${d[0]}">${d[1]}</button>`).join('')}</div></div>
    </div><div class="doc-prev"><div class="doc-preview"></div></div></div>
    <div class="modal-actions"><button class="primary-btn" id="docPrint"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>طباعة</button><button class="secondary-btn" id="docClose">إغلاق</button></div></div>`;
  const prev = () => { ov.querySelector('.doc-preview').innerHTML = buildDocHtml(docSt); };
  const map = { 'dc-customer': 'customer', 'dc-date': 'date', 'dc-name': 'name', 'dc-size': 'size', 'dc-qty': 'qty', 'dc-price': 'price', 'dc-notes': 'notes' };
  Object.keys(map).forEach(id => { const el = ov.querySelector('#' + id); if (el) el.addEventListener('input', () => { docSt[map[id]] = el.value; prev(); }); });
  ov.querySelectorAll('[data-d]').forEach(b => b.addEventListener('click', () => {
    docSt.design = b.dataset.d; ov.querySelectorAll('[data-d]').forEach(x => x.classList.toggle('on', x === b)); prev();
  }));
  ov.querySelector('#docClose').onclick = () => { ov.style.display = 'none'; };
  ov.querySelector('#docPrint').onclick = () => { ov.style.display = 'none'; doPrint(buildDocHtml(docSt)); };
  prev();
  ov.style.display = 'flex';
}
document.getElementById('genQuoteBtn').addEventListener('click', () => openDoc('quote'));
document.getElementById('genDeliveryBtn').addEventListener('click', () => openDoc('delivery'));

