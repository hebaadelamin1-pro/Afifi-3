// ===================== PRINTING =====================
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function buildPrintHeader() {
  const c = db.company;
  return `
    <div class="print-header">
      <div class="print-logo">${c.logo ? `<img src="${c.logo}">` : 'شعار الشركة'}</div>
      <div class="print-company-name">
        <div class="ar">${escapeHtml(c.name)}</div>
        <div class="en">${escapeHtml(c.nameEn)}</div>
      </div>
      <div style="width:70px;"></div>
    </div>
  `;
}

function buildPrintFooter() {
  const c = db.company;
  return `
    <div class="print-footer">
      المصنع: ${escapeHtml(c.factoryAddress)}<br>
      المعرض: ${escapeHtml(c.showroomAddress)}<br>
      للتواصل: ${(c.phones || []).join(' - ')} ${c.email ? '- ' + escapeHtml(c.email) : ''}
    </div>
  `;
}

function doPrint(html) {
  const area = document.getElementById('printArea');
  area.innerHTML = html;
  area.classList.add('active');
  window.print();
}
window.onafterprint = () => {
  document.getElementById('printArea').classList.remove('active');
};

function printCustomerStatement(customer) {
  const orders = customer.accounts || [];
  let totalRequired = 0, totalPaid = 0;
  const L = ledgerOf(customer); const LM = {}; L.rows.forEach(r => LM[r.o.id] = r);

  const orderCols = '35% 15% 17% 17% 16%';
  const orderHead = `<div class="pg-row pg-head" style="grid-template-columns:${orderCols};">
    <div class="pg-cell">وصف الطلب</div><div class="pg-cell">التاريخ</div><div class="pg-cell">الإجمالي</div><div class="pg-cell">المدفوع</div><div class="pg-cell">المتبقي</div>
  </div>`;
  const orderRows = orders.map(o => {
    const total = parseFloat(o.totalAmount) || 0;
    const paid = LM[o.id] ? LM[o.id].paid : orderPaid(o);
    const remaining = total - paid;
    totalRequired += total;
    totalPaid += paid;
    return `<div class="pg-row" style="grid-template-columns:${orderCols};">
      <div class="pg-cell" style="text-align:right;">${escapeHtml(o.description || '')}</div>
      <div class="pg-cell">${escapeHtml(o.date || '')}</div>
      <div class="pg-cell">${fmt(total)}</div>
      <div class="pg-cell">${fmt(paid)}</div>
      <div class="pg-cell">${fmt(remaining)}</div>
    </div>`;
  }).join('');
  totalRequired = L.required; totalPaid = L.paid;
  const totalRemaining = L.remaining;

  const payCols = '14% 30% 16% 18% 22%';
  const allPayments = [];
  orders.forEach(o => {
    (o.payments || []).forEach(p => allPayments.push({ ...p, orderDesc: o.description }));
  });
  (customer.payments || []).forEach(p => allPayments.push({ ...p, orderDesc: 'تحصيل على الحساب العام' }));
  allPayments.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const payHead = allPayments.length ? `<div class="pg-row pg-head" style="grid-template-columns:${payCols};">
    <div class="pg-cell">التاريخ</div><div class="pg-cell">الطلب</div><div class="pg-cell">طريقة الدفع</div><div class="pg-cell">المبلغ</div><div class="pg-cell">ملاحظة</div>
  </div>` : '';
  const payRows = allPayments.map(p => `<div class="pg-row" style="grid-template-columns:${payCols};">
      <div class="pg-cell">${escapeHtml(p.date || '')}</div>
      <div class="pg-cell" style="text-align:right;">${escapeHtml(p.orderDesc || '')}</div>
      <div class="pg-cell">${escapeHtml(p.method || 'كاش')}</div>
      <div class="pg-cell">${fmt(p.amount)}</div>
      <div class="pg-cell">${escapeHtml(p.note || '')}</div>
    </div>`).join('');

  const html = `
    <div class="print-sheet">
      ${buildPrintHeader()}
      <div class="print-title">كشف حساب عميل</div>
      <div class="print-meta">
        <div><strong>العميل:</strong> ${escapeHtml(customer.name)}${customer.phone ? ' — ' + escapeHtml(customer.phone) : ''}</div>
        <div><strong>تاريخ الكشف:</strong> ${todayStr()}</div>
      </div>
      ${orders.length ? `<div class="pg-table">${orderHead}${orderRows}</div>` : '<div class="print-intro">لا توجد طلبات مسجلة لهذا العميل.</div>'}
      ${allPayments.length ? `<div class="print-intro" style="font-weight:800; margin-top:10px;">تفصيل الدفعات</div><div class="pg-table">${payHead}${payRows}</div>` : ''}
      <div class="pg-table" style="margin-top:14px;">
        <div class="pg-row" style="grid-template-columns:65% 35%;"><div class="pg-cell" style="text-align:right; font-weight:700;">إجمالي المطلوب</div><div class="pg-cell">${fmt(totalRequired)} ج.م</div></div>
        <div class="pg-row" style="grid-template-columns:65% 35%;"><div class="pg-cell" style="text-align:right; font-weight:700;">إجمالي المدفوع</div><div class="pg-cell">${fmt(totalPaid)} ج.م</div></div>
        <div class="pg-row" style="grid-template-columns:65% 35%;"><div class="pg-cell" style="text-align:right; font-weight:700;">إجمالي المتبقي</div><div class="pg-cell">${fmt(totalRemaining)} ج.م</div></div>
      </div>
      ${buildPrintFooter()}
    </div>
  `;
  doPrint(html);
}

function printQuote(q) {
  let grand = 0;
  const NOUNS = { pallet: 'البالتة', box: 'الصندوق', reel: 'بكرة السحاب' };
  const qTypes = [...new Set(q.items.map(i => i.type || 'pallet'))];
  const qNoun = qTypes.length === 1 ? (NOUNS[qTypes[0]] || 'البالتة') : 'المنتجات';
  const itemsRows = q.items.map((item, idx) => {
    const total = quoteItemTotal(item);
    grand += total;
    return `
    <div class="pg-row">
      <div class="pg-cell">${idx + 1}</div>
      <div class="pg-cell pg-right">${escapeHtml(item.bayan)}</div>
      <div class="pg-cell">${item.qty ?? 1}</div>
      <div class="pg-cell">${item.price !== '' && item.price !== null ? fmt(parseFloat(item.price) || 0) : ''}</div>
      <div class="pg-cell">${fmt(total)}</div>
    </div>`;
  }).join('');

  const html = `
    <div class="print-sheet">
      ${buildPrintHeader()}
      <div class="print-title">عرض سعر</div>
      <div class="print-meta">
        <div><strong>السادة شركة:</strong> ${escapeHtml(q.customerName)}</div>
        <div><strong>التاريخ:</strong> ${escapeHtml(q.date)}</div>
      </div>
      <div class="print-intro">مرسل الى سيادتكم عرض سعر ${qNoun} طبقًا للمواصفات المطلوبة :-</div>
      <div class="pg-table">
        <div class="pg-row pg-head">
          <div class="pg-cell">م</div>
          <div class="pg-cell">الصنف</div>
          <div class="pg-cell">الكمية</div>
          <div class="pg-cell">سعر الوحدة</div>
          <div class="pg-cell">السعر الإجمالي</div>
        </div>
        ${itemsRows}
        <div class="pg-row pg-foot">
          <div class="pg-cell pg-span4">إجمالي الأسعار</div>
          <div class="pg-cell">${fmt(grand)} ج.م</div>
        </div>
      </div>
      <div class="print-notes">
        ${q.notes.map(n => `<div>* ${escapeHtml(n)}</div>`).join('')}
      </div>
      <div class="print-closing">وتفضلوا بقبول وافر الاحترام والتحية ،،،،</div>
      <div class="print-sign">يعتمد<br>مدير المبيعات</div>
      ${buildPrintFooter()}
    </div>
  `;
  doPrint(html);
}

function printCustomerSummary(customer, calc, hidePrice) {
  const computed = computeCalc(calc);
  const cols = hidePrice
    ? '7% 19% 12% 14% 14% 14% 20%'
    : '6% 15% 9% 11% 11% 11% 15% 22%';
  const headers = hidePrice
    ? ['#', 'المواصفات', 'العدد', 'التخانة (مم)', 'العرض (مم)', 'الطول (سم)', 'التكعيب (سم)']
    : ['#', 'المواصفات', 'العدد', 'التخانة (مم)', 'العرض (مم)', 'الطول (سم)', 'التكعيب (سم)', 'السعر'];

  const headRow = `<div class="pg-row pg-head" style="grid-template-columns:${cols};">${headers.map(h => `<div class="pg-cell">${h}</div>`).join('')}</div>`;

  const rows = calc.rows.map((row, idx) => {
    const cells = [
      idx + 1, escapeHtml(row.spec), row.count || '', row.thickness || '', row.width || '', row.length || '',
      fmtV(computed.rowsCalc[idx].volume)
    ];
    if (!hidePrice) cells.push(fmt3(computed.rowsCalc[idx].rowPrice) + ' ج.م');
    return `<div class="pg-row" style="grid-template-columns:${cols};">${cells.map(c => `<div class="pg-cell">${c}</div>`).join('')}</div>`;
  }).join('');

  const summaryRows = [
    ['إجمالي التكعيب للوحدة (سم)', fmtV(computed.totalVolume)],
    ['إجمالي التكعيب للطلبية (سم)', fmtV(computed.totalVolumeOrder)],
    ['عدد الطلبية', computed.quantity]
  ];
  if (!hidePrice) {
    summaryRows.push(
      ['سعر الخشب للوحدة الواحدة', fmt3(computed.totalWoodPricePerUnit) + ' ج.م'],
      ['إجمالي سعر الخشب (بعد الكمية)', fmt3(computed.totalWoodPrice) + ' ج.م'],
      ['إجمالي تكلفة التصنيع للطلبية', fmt3(computed.afterCosts) + ' ج.م'],
      ['الإجمالي الكلي للطلبية (بعد الربحية)', fmt3(computed.finalPrice) + ' ج.م']
    );
  }
  const summaryHtml = summaryRows.map(([label, val]) => `
    <div class="pg-row" style="grid-template-columns:65% 35%;">
      <div class="pg-cell" style="text-align:right; font-weight:700;">${label}</div>
      <div class="pg-cell">${val}</div>
    </div>`).join('');

  const html = `
    <div class="print-sheet">
      ${buildPrintHeader()}
      <div class="print-title">${escapeHtml(calc.palletName || calc.name || 'حاسبة تكعيب')} - ${escapeHtml(customer.name)}</div>
      <div class="print-meta">
        <div><strong>العميل:</strong> ${escapeHtml(customer.name)}</div>
        <div><strong>تاريخ الإضافة:</strong> ${escapeHtml(calc.createdAt || '')}</div>
      </div>
      <div class="pg-table">${headRow}${rows}</div>
      <div class="pg-table" style="margin-top:10px;">${summaryHtml}</div>
      ${buildPrintFooter()}
    </div>
  `;
  doPrint(html);
}
