// ===================== CUSTOMER ACCOUNTS (orders & payments) =====================
function renderCustomerAccounts(customer) {
  if (!customer.accounts) customer.accounts = [];
  if (!customer.payments) customer.payments = [];
  const root = document.getElementById('customerAccountsRoot');
  const L = ledgerOf(customer);
  const rowOf = {}; L.rows.forEach(r => rowOf[r.o.id] = r);
  const pct = L.required > 0 ? Math.min(100, Math.max(0, Math.round(L.paid / L.required * 100))) : 0;
  const isCredit = L.remaining < -0.005;

  root.innerHTML = `
    <div class="kpi-row">
      <div class="kpi"><div class="kpi-ic">${IC.file}</div><div><small>إجمالي المطلوب</small><strong><span class="num">${fmt(L.required)}</span><i>ج.م</i></strong></div></div>
      <div class="kpi paid"><div class="kpi-ic">${IC.wallet}</div><div><small>إجمالي المدفوع</small><strong><span class="num">${fmt(L.paid)}</span><i>ج.م</i></strong></div></div>
      <div class="kpi ${isCredit ? 'credit' : 'due'}"><div class="kpi-ic">${IC.alert}</div><div><small>${isCredit ? 'رصيد زائد للعميل' : 'إجمالي المتبقي'}</small><strong><span class="num">${fmt(Math.abs(L.remaining))}</span><i>ج.م</i></strong></div></div>
    </div>
    <div class="progress-card"><div class="progress-head"><span>نسبة التحصيل</span><b>${pct}%</b></div><div class="progress"><span style="width:${pct}%"></span></div></div>

    <div class="accounts-box">
      <div class="box-head">
        <h3>الطلبات والدفعات</h3>
        <div class="box-actions">
          <button class="success-btn btn-sm" data-act="collect">${IC.wallet}تسجيل تحصيل</button>
          <button class="primary-btn btn-sm" id="addOrderBtn">${IC.plus}طلب شغل جديد</button>
          <button class="secondary-btn btn-sm" id="printStatementBtn">${IC.printer}كشف حساب</button>
        </div>
      </div>
      <div class="orders-list"></div>
    </div>

    <div class="accounts-box">
      <div class="box-head"><h3>تحصيلات على الحساب العام <span class="chip info">${customer.payments.length}</span></h3></div>
      <div class="acct-pays"></div>
    </div>
  `;

  root.querySelector('[data-act="collect"]').addEventListener('click', () => openPaymentModal(customer, '', true));
  root.querySelector('#printStatementBtn').addEventListener('click', () => printCustomerStatement(customer));

  const list = root.querySelector('.orders-list');
  if (!customer.accounts.length) {
    list.innerHTML = `<div class="empty-state" style="padding:22px;">لا توجد طلبات مسجلة لهذا العميل بعد — أضف "طلب شغل جديد" وحدد العربون من نافذة الطلب</div>`;
  } else {
    customer.accounts.forEach(order => {
      const r = rowOf[order.id] || { total: parseFloat(order.totalAmount) || 0, own: orderPaid(order), alloc: 0, paid: orderPaid(order), remaining: (parseFloat(order.totalAmount) || 0) - orderPaid(order) };
      const dep = parseFloat(order.depositAmount) || 0;
      const depChip = dep > 0
        ? (r.paid + 0.005 >= dep
            ? `<span class="chip ok">${IC.check} العربون مستلم (${fmt(dep)})</span>`
            : `<span class="chip warn">العربون المطلوب ${fmt(dep)} — المتبقي منه ${fmt(dep - r.paid)}</span>`)
        : '';
      const pctOrder = r.total > 0 ? Math.min(100, Math.max(0, Math.round(r.paid / r.total * 100))) : 0;
      const card = document.createElement('div');
      card.className = 'order-card';
      card.innerHTML = `
        <div class="order-head">
          <div>
            <div class="order-title">${escapeHtml(order.description || 'طلب شغل')}</div>
            <div class="order-sub">
              <span>${escapeHtml(order.date || '')}${order.quoteId ? ' • من عرض سعر' : ''}</span>
              <span class="chip ${r.remaining <= 0.005 ? 'ok' : 'due'}">${r.remaining <= 0.005 ? 'مدفوع بالكامل' : 'متبقي عليه'}</span>
              ${depChip}
            </div>
          </div>
          <div class="order-amounts">
            ${(r.tax || 0) > 0.005
              ? `<span>الإجمالي<strong class="num">${fmt(r.sub)}</strong></span><span class="tx">الضريبة<strong class="num">${fmt(r.tax)}</strong></span><span>الإجمالي بعد الضريبة<strong class="num">${fmt(r.total)}</strong></span>`
              : `<span>الإجمالي<strong class="num">${fmt(r.total)}</strong></span>`}
            <span class="ok">المدفوع<strong class="num">${fmt(r.paid)}</strong></span>
            <span class="${r.remaining > 0.005 ? 'due' : 'ok'}">المتبقي<strong class="num">${fmt(r.remaining)}</strong></span>
          </div>
          <div class="order-actions">
            <button class="icon-btn sales" data-action="sales">${window.__slCart || ''}مبيعات</button>
            <button class="icon-btn pay" data-action="pay">+ تحصيل</button>
            <button class="icon-btn edit" data-action="edit">تعديل</button>
            <button class="icon-btn delete" data-action="delete">حذف</button>
          </div>
        </div>
        <div class="order-bar"><div class="progress"><span style="width:${pctOrder}%"></span></div></div>
        ${r.alloc > 0 ? `<div class="order-sub" style="margin-top:6px;">منها ${fmt(r.alloc)} ج.م من التحصيلات العامة (موزّعة على الأقدم أولاً)</div>` : ''}
        <div class="payments-list"></div>
      `;
      const paymentsBox = card.querySelector('.payments-list');
      (order.payments || []).forEach((p, pIdx) => {
        const row = document.createElement('div');
        row.className = 'payment-row';
        const receiptsHtml = (p.receipts && p.receipts.length)
          ? `<span class="payment-receipts">${p.receipts.map(receiptThumb).join('')}</span>` : '';
        row.innerHTML = `<span>${escapeHtml(p.date || '')} • ${escapeHtml(p.method || 'كاش')}${p.note ? ' — ' + escapeHtml(p.note) : ''}${receiptsHtml}</span><span><span class="amt"><span class="num">${fmt(p.amount)}</span> ج.م</span> <button class="del-payment" title="حذف الدفعة">✕</button></span>`;
        row.querySelector('.del-payment').addEventListener('click', () => {
          openConfirm('هل تريد حذف هذه الدفعة؟', () => { order.payments.splice(pIdx, 1); persist(); renderCustomerAccounts(customer); });
        });
        paymentsBox.appendChild(row);
      });
      if (!(order.payments || []).length) paymentsBox.style.display = 'none';

      card.querySelector('[data-action="sales"]').addEventListener('click', () => openSales(customer.id, order.id));
      card.querySelector('[data-action="pay"]').addEventListener('click', () => openPaymentModal(customer, order.id, true));
      card.querySelector('[data-action="edit"]').addEventListener('click', () => openOrderModal(customer, order.id));
      card.querySelector('[data-action="delete"]').addEventListener('click', () => {
        openConfirm(`هل تريد حذف طلب "${order.description}"؟`, () => {
          customer.accounts = customer.accounts.filter(o => o.id !== order.id);
          persist();
          renderCustomerAccounts(customer);
        });
      });
      list.appendChild(card);
    });
  }

  const ap = root.querySelector('.acct-pays');
  if (!customer.payments.length) {
    ap.innerHTML = `<div class="empty-state" style="padding:18px;">لا توجد تحصيلات على الحساب العام — استخدم "تسجيل تحصيل" واختر "على الحساب العام"</div>`;
  } else {
    customer.payments.slice().reverse().forEach(p => {
      const row = document.createElement('div');
      row.className = 'payment-row';
      const receiptsHtml = (p.receipts && p.receipts.length)
        ? `<span class="payment-receipts">${p.receipts.map(receiptThumb).join('')}</span>` : '';
      row.innerHTML = `<span>${escapeHtml(p.date || '')} • ${escapeHtml(p.method || 'كاش')}${p.note ? ' — ' + escapeHtml(p.note) : ''}${receiptsHtml}</span><span><span class="amt"><span class="num">${fmt(p.amount)}</span> ج.م</span> <button class="del-payment" title="حذف">✕</button></span>`;
      row.querySelector('.del-payment').addEventListener('click', () => {
        openConfirm('هل تريد حذف هذا التحصيل؟', () => {
          customer.payments = customer.payments.filter(x => x.id !== p.id);
          persist(); renderCustomerAccounts(customer);
        });
      });
      ap.appendChild(row);
    });
  }

  root.querySelector('#addOrderBtn').addEventListener('click', () => openOrderModal(customer, null));
}

let orderModalCustomer = null;
let orderModalEditId = null;
let depositSrc = 'pct';
const r2 = n => Math.round(n * 100) / 100;

function orderTaxAmt(base) {
  if (!document.getElementById('orderTaxOn').checked) return 0;
  const v = parseFloat(document.getElementById('orderTaxValue').value) || 0;
  if (v <= 0) return 0;
  return document.getElementById('orderTaxType').value === 'fixed' ? r2(v) : r2(base * v / 100);
}

function recalcDeposit(src) {
  const base = parseFloat(document.getElementById('orderAmountInput').value) || 0;
  const taxAmt = orderTaxAmt(base);
  const total = r2(base + taxAmt);
  const taxBox = document.getElementById('orderTaxCalc');
  if (taxBox) taxBox.textContent = taxAmt > 0 ? `الإجمالي ${fmt(base)} + الضريبة ${fmt(taxAmt)} = ${fmt(total)} ج.م بعد الضريبة` : '';
  const pctEl = document.getElementById('orderDepositPctInput');
  const amtEl = document.getElementById('orderDepositAmountInput');
  if (src === 'total') src = depositSrc;
  if (src === 'pct') {
    depositSrc = 'pct';
    const p = parseFloat(pctEl.value);
    amtEl.value = (!isNaN(p) && total > 0) ? r2(total * p / 100) : '';
  } else if (src === 'amt') {
    depositSrc = 'amt';
    const a = parseFloat(amtEl.value);
    pctEl.value = (!isNaN(a) && total > 0) ? r2(a / total * 100) : '';
  }
  const dep = parseFloat(amtEl.value) || 0;
  const box = document.getElementById('orderDepositCalc');
  if (!dep) box.textContent = 'اتركه فارغاً لو الطلب بدون عربون.';
  else if (total && dep > total) box.textContent = '⚠ العربون أكبر من إجمالي الطلب';
  else box.textContent = `العربون ${fmt(dep)} ج.م — المتبقي بعده ${fmt(total - dep)} ج.م`;
}

function recalcOrderTotal() {
  const qty = parseFloat(document.getElementById('orderQtyInput').value);
  const unitPrice = parseFloat(document.getElementById('orderUnitPriceInput').value);
  if (!isNaN(qty) && !isNaN(unitPrice) && qty > 0 && unitPrice > 0) {
    document.getElementById('orderAmountInput').value = r2(qty * unitPrice);
  }
  recalcDeposit('total');
}

function openOrderModal(customer, orderId) {
  orderModalCustomer = customer;
  orderModalEditId = orderId;
  document.getElementById('orderModalTitle').textContent = orderId ? 'تعديل الطلب' : 'طلب شغل جديد';
  const isNew = !orderId;
  document.getElementById('orderDepositReceivedRow').style.display = isNew ? '' : 'none';
  document.getElementById('orderDepositReceived').checked = false;
  document.getElementById('orderDepositMethodWrap').style.display = 'none';
  if (orderId) {
    const o = customer.accounts.find(x => x.id === orderId);
    document.getElementById('orderDescInput').value = o.description || '';
    document.getElementById('orderQtyInput').value = o.quantity ?? '';
    document.getElementById('orderUnitPriceInput').value = o.unitPrice ?? '';
    document.getElementById('orderAmountInput').value = o.totalAmount ?? '';
    document.getElementById('orderDateInput').value = o.date || todayStr();
    document.getElementById('orderDepositPctInput').value = o.depositPct ?? '';
    document.getElementById('orderDepositAmountInput').value = o.depositAmount ?? '';
    depositSrc = o.depositSrc || (o.depositPct ? 'pct' : 'amt');
  } else {
    ['orderDescInput', 'orderQtyInput', 'orderUnitPriceInput', 'orderAmountInput', 'orderDepositPctInput', 'orderDepositAmountInput']
      .forEach(id => document.getElementById(id).value = '');
    document.getElementById('orderDateInput').value = todayStr();
    depositSrc = 'pct';
  }
  {
    const o2 = orderId ? customer.accounts.find(x => x.id === orderId) : null;
    document.getElementById('orderTaxOn').checked = !!(o2 && o2.taxEnabled);
    document.getElementById('orderTaxType').value = (o2 && o2.taxType) || 'percent';
    document.getElementById('orderTaxValue').value = (o2 && o2.taxEnabled) ? (o2.taxValue ?? '') : '';
    document.getElementById('orderTaxBody').style.display = document.getElementById('orderTaxOn').checked ? '' : 'none';
  }
  recalcDeposit('none');
  document.getElementById('orderModalOverlay').style.display = 'flex';
}

document.getElementById('orderQtyInput').addEventListener('input', recalcOrderTotal);
document.getElementById('orderUnitPriceInput').addEventListener('input', recalcOrderTotal);
document.getElementById('orderAmountInput').addEventListener('input', () => recalcDeposit('total'));
document.getElementById('orderDepositPctInput').addEventListener('input', () => recalcDeposit('pct'));
document.getElementById('orderDepositAmountInput').addEventListener('input', () => recalcDeposit('amt'));
document.getElementById('orderTaxOn').addEventListener('change', e => {
  document.getElementById('orderTaxBody').style.display = e.target.checked ? '' : 'none';
  const tv = document.getElementById('orderTaxValue');
  if (e.target.checked && !tv.value) tv.value = '14';
  recalcDeposit('total');
});
document.getElementById('orderTaxType').addEventListener('change', () => recalcDeposit('total'));
document.getElementById('orderTaxValue').addEventListener('input', () => recalcDeposit('total'));
document.getElementById('orderDepositReceived').addEventListener('change', e => {
  document.getElementById('orderDepositMethodWrap').style.display = e.target.checked ? '' : 'none';
});

document.getElementById('cancelOrderModalBtn').addEventListener('click', () => {
  document.getElementById('orderModalOverlay').style.display = 'none';
});

document.getElementById('saveOrderModalBtn').addEventListener('click', () => {
  const desc = document.getElementById('orderDescInput').value.trim();
  const quantity = document.getElementById('orderQtyInput').value;
  const unitPrice = document.getElementById('orderUnitPriceInput').value;
  const amount = document.getElementById('orderAmountInput').value;
  const date = document.getElementById('orderDateInput').value || todayStr();
  const depositPct = document.getElementById('orderDepositPctInput').value;
  const depositAmount = document.getElementById('orderDepositAmountInput').value;
  if (!desc) { alert('من فضلك أدخل وصف الطلب'); return; }
  const baseTotal = parseFloat(amount) || 0;
  const taxAmtSave = orderTaxAmt(baseTotal);
  const taxEnabled = taxAmtSave > 0;
  const taxType = document.getElementById('orderTaxType').value;
  const taxValue = taxEnabled ? document.getElementById('orderTaxValue').value : '';
  const total = r2(baseTotal + taxAmtSave), dep = parseFloat(depositAmount) || 0;
  if (dep > 0 && total > 0 && dep > total) { alert('قيمة العربون أكبر من إجمالي الطلب، راجع الأرقام'); return; }
  if (dep > 0 && !total) { alert('أدخل المبلغ الإجمالي للطلب أولاً ليُحسب العربون'); return; }
  if (!orderModalCustomer.accounts) orderModalCustomer.accounts = [];
  let order;
  if (orderModalEditId) {
    order = orderModalCustomer.accounts.find(x => x.id === orderModalEditId);
    if (order) Object.assign(order, { description: desc, quantity, unitPrice, totalAmount: amount, date, depositPct, depositAmount, depositSrc, taxEnabled, taxType, taxValue });
  } else {
    order = { id: uid(), description: desc, quantity, unitPrice, totalAmount: amount, date, depositPct, depositAmount, depositSrc, taxEnabled, taxType, taxValue, payments: [] };
    orderModalCustomer.accounts.push(order);
    if (document.getElementById('orderDepositReceived').checked && dep > 0) {
      order.payments.push({ id: uid(), amount: String(dep), method: document.getElementById('orderDepositMethod').value, date, note: 'عربون', receipts: [] });
    }
  }
  persist();
  document.getElementById('orderModalOverlay').style.display = 'none';
  renderCustomerAccounts(orderModalCustomer);
  if (!orderModalEditId && dep > 0 && document.getElementById('orderDepositReceived').checked) showToast(`تم تسجيل العربون ${fmt(dep)} ج.م`);
});

// ---------- Payment / collection modal ----------
let payCtx = { customer: null, orderId: '', fixed: false };
let paymentReceiptsTemp = [];

const isPdfSrc = src => typeof src === 'string' && src.startsWith('data:application/pdf');
function receiptThumb(src) {
  return isPdfSrc(src)
    ? `<span class="payment-receipt-pdf" data-pdf="${src}" title="فتح ملف PDF">PDF</span>`
    : `<img src="${src}" class="payment-receipt-thumb">`;
}
function openPdfSrc(src) {
  try {
    const bin = atob(src.split(',')[1]);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([arr], { type: 'application/pdf' }));
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) { alert('تعذّر فتح ملف الـ PDF'); }
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-pdf]');
  if (t) { e.stopPropagation(); openPdfSrc(t.getAttribute('data-pdf')); }
});

function renderPaymentReceiptsPreview() {
  const grid = document.getElementById('paymentReceiptsPreview');
  grid.innerHTML = '';
  grid.style.display = paymentReceiptsTemp.length ? '' : 'none';
  paymentReceiptsTemp.forEach((src, idx) => {
    const div = document.createElement('div');
    div.className = 'img-thumb';
    div.innerHTML = (isPdfSrc(src) ? `<div class="pdf-tile" data-pdf="${src}" title="فتح ملف PDF">PDF<small>اضغط للفتح</small></div>` : `<img src="${src}">`) + `<button class="del-img" title="حذف">✕</button>`;
    div.querySelector('.del-img').addEventListener('click', () => {
      paymentReceiptsTemp.splice(idx, 1);
      renderPaymentReceiptsPreview();
    });
    grid.appendChild(div);
  });
}

document.getElementById('paymentReceiptInput').addEventListener('change', e => {
  const files = Array.from(e.target.files || []);
  files.forEach(file => {
    const okType = file.type.startsWith('image/') || file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (!okType) { alert('الملف "' + file.name + '" غير مدعوم — ارفع صورة أو PDF فقط'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      let data = reader.result;
      if (/\.pdf$/i.test(file.name) && !isPdfSrc(data)) data = data.replace(/^data:[^;,]*/, 'data:application/pdf');
      paymentReceiptsTemp.push(data); renderPaymentReceiptsPreview(); };
    reader.readAsDataURL(file);
  });
  e.target.value = '';
});

function fillPaymentTargets() {
  const sel = document.getElementById('paymentTargetSelect');
  const c = payCtx.customer;
  const orders = c ? (c.accounts || []) : [];
  sel.innerHTML = '<option value="">على الحساب العام (تُخصم من إجمالي المتبقي)</option>' +
    orders.map(o => `<option value="${o.id}">طلب: ${escapeHtml(o.description || 'طلب شغل')} — ${fmt(o.totalAmount)} ج.م</option>`).join('');
  sel.value = payCtx.orderId || '';
}

function currentTargetRemaining() {
  const c = payCtx.customer; if (!c) return 0;
  const L = ledgerOf(c);
  const id = document.getElementById('paymentTargetSelect').value;
  if (id) { const r = L.rows.find(x => x.o.id === id); return r ? r.remaining : 0; }
  return L.remaining;
}

function updatePaymentInfo() {
  const box = document.getElementById('paymentInfo');
  const c = payCtx.customer;
  if (!c) { box.innerHTML = '<span style="color:var(--m-mute);font-size:13px;">اختر العميل أولاً</span>'; return; }
  const cur = currentTargetRemaining();
  const amt = parseFloat(document.getElementById('paymentAmountInput').value) || 0;
  const after = cur - amt;
  box.innerHTML = `<div><small>المتبقي الآن</small><b class="num">${fmt(cur)}</b></div><div class="arrow">←</div><div class="after"><small>بعد هذه الدفعة</small><b class="num" style="color:${after < -0.005 ? 'var(--m-warn)' : 'var(--m-ok)'}">${fmt(after)}</b></div>`;
}

function openPaymentModal(customer, orderId, fixed) {
  payCtx = { customer: customer || null, orderId: orderId || '', fixed: !!(fixed && customer) };
  paymentReceiptsTemp = [];
  const csel = document.getElementById('paymentCustomerSelect');
  csel.innerHTML = '<option value="">— اختر العميل —</option>' + db.customers.filter(c => c.status !== 'prospect').map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  csel.value = customer ? customer.id : '';
  document.getElementById('paymentCustomerWrap').style.display = payCtx.fixed ? 'none' : '';
  fillPaymentTargets();
  document.getElementById('paymentAmountInput').value = '';
  document.getElementById('paymentMethodInput').value = 'كاش';
  document.getElementById('paymentDateInput').value = todayStr();
  document.getElementById('paymentNoteInput').value = '';
  renderPaymentReceiptsPreview();
  updatePaymentInfo();
  document.getElementById('paymentModalOverlay').style.display = 'flex';
  setTimeout(() => document.getElementById(payCtx.fixed ? 'paymentAmountInput' : 'paymentCustomerSelect').focus(), 50);
}

document.getElementById('paymentCustomerSelect').addEventListener('change', e => {
  payCtx.customer = db.customers.find(c => c.id === e.target.value) || null;
  payCtx.orderId = '';
  fillPaymentTargets(); updatePaymentInfo();
});
document.getElementById('paymentTargetSelect').addEventListener('change', e => { payCtx.orderId = e.target.value; updatePaymentInfo(); });
document.getElementById('paymentAmountInput').addEventListener('input', updatePaymentInfo);
document.getElementById('paymentFullBtn').addEventListener('click', () => {
  const v = currentTargetRemaining();
  if (v > 0) { document.getElementById('paymentAmountInput').value = r2(v); updatePaymentInfo(); }
});

document.getElementById('cancelPaymentModalBtn').addEventListener('click', () => {
  document.getElementById('paymentModalOverlay').style.display = 'none';
});

function refreshAfterPayment(c) {
  const vis = id => { const e = document.getElementById(id); return e && e.style.display !== 'none'; };
  if (vis('view-customer-detail') && currentCustomerId === c.id) renderCustomerAccounts(c);
  if (vis('view-collections')) renderCollectionsView();
  if (vis('view-customers')) renderCustomersList();
}

document.getElementById('savePaymentModalBtn').addEventListener('click', () => {
  const c = payCtx.customer;
  if (!c) { alert('من فضلك اختر العميل'); return; }
  const amount = document.getElementById('paymentAmountInput').value;
  if (!amount || parseFloat(amount) <= 0) { alert('من فضلك أدخل مبلغ صحيح'); return; }
  const pay = {
    id: uid(), amount,
    method: document.getElementById('paymentMethodInput').value,
    date: document.getElementById('paymentDateInput').value || todayStr(),
    note: document.getElementById('paymentNoteInput').value.trim(),
    receipts: paymentReceiptsTemp.slice()
  };
  const orderId = document.getElementById('paymentTargetSelect').value;
  if (orderId) {
    const o = (c.accounts || []).find(x => x.id === orderId);
    if (o) { if (!o.payments) o.payments = []; o.payments.push(pay); }
  } else {
    if (!c.payments) c.payments = [];
    c.payments.push(pay);
  }
  persist();
  document.getElementById('paymentModalOverlay').style.display = 'none';
  showToast(`تم تحصيل ${fmt(parseFloat(amount))} ج.م من ${c.name}`);
  refreshAfterPayment(c);
});

document.getElementById('collectBtn').addEventListener('click', () => {
  const c = db.customers.find(x => x.id === currentCustomerId);
  if (c) openPaymentModal(c, '', true);
});
document.getElementById('collectBtnTop').addEventListener('click', () => openPaymentModal(null, '', false));

function renderCustomerCalcsList(customer) {
  const root = document.getElementById('customerCalcsListRoot');
  if (!customer.calculators.length) {
    root.innerHTML = `<div class="list-card"><div class="empty-state">لا توجد حاسبات لهذا العميل بعد — اضغط "+ حاسبة جديدة"</div></div>`;
    return;
  }
  root.innerHTML = `<div class="list-card">${customer.calculators.map((calc, idx) => {
    const computed = computeCalc(calc);
    return `
    <div class="list-row" data-calc-id="${calc.id}">
      <div class="list-main">
        <strong>${escapeHtml(calc.name || ('حاسبة ' + (idx + 1)))}</strong>
        <div class="list-sub">${TYPE_META[calc.type || 'pallet'].label + ' • '}${calc.palletName ? escapeHtml(calc.palletName) + ' • ' : ''}الإجمالي الكلي للطلبية (بعد الربحية): ${fmt(computed.finalPrice)} ج.م${calc.createdAt ? ' • أُضيف في ' + escapeHtml(calc.createdAt) : ''}</div>
      </div>
      <div class="list-actions">
        <button class="icon-btn open" data-action="open">فتح</button>
        <button class="icon-btn edit" data-action="rename">إعادة تسمية</button>
        <button class="icon-btn print" data-action="print">طباعة</button>
        <button class="icon-btn print" data-action="printNoPrice">طباعة بدون سعر</button>
        <button class="icon-btn delete" data-action="delete">حذف</button>
      </div>
    </div>
  `;
  }).join('')}</div>`;

  root.querySelectorAll('.list-row').forEach(row => {
    const calcId = row.dataset.calcId;
    row.querySelector('[data-action="open"]').addEventListener('click', () => openCustomerCalcDetail(customer.id, calcId));
    row.querySelector('[data-action="rename"]').addEventListener('click', () => {
      const calc = customer.calculators.find(c => c.id === calcId);
      const newName = prompt('اسم الحاسبة:', calc.name || '');
      if (newName !== null) {
        calc.name = newName.trim();
        persist();
        renderCustomerCalcsList(customer);
      }
    });
    row.querySelector('[data-action="print"]').addEventListener('click', () => {
      const calc = customer.calculators.find(c => c.id === calcId);
      printCustomerSummary(customer, calc, false);
    });
    row.querySelector('[data-action="printNoPrice"]').addEventListener('click', () => {
      const calc = customer.calculators.find(c => c.id === calcId);
      printCustomerSummary(customer, calc, true);
    });
    row.querySelector('[data-action="delete"]').addEventListener('click', () => {
      const calc = customer.calculators.find(c => c.id === calcId);
      openConfirm(`هل تريد حذف "${calc.name}"؟`, () => {
        customer.calculators = customer.calculators.filter(c => c.id !== calcId);
        persist();
        renderCustomerCalcsList(customer);
      });
    });
  });
}

function openCustomerCalcDetail(customerId, calcId) {
  currentCustomerId = customerId;
  currentCalcId = calcId;
  const customer = db.customers.find(c => c.id === customerId);
  const calc = customer.calculators.find(c => c.id === calcId);
  if (!calc) return;
  document.getElementById('customerCalcName').textContent = customer.name + ' — ' + (calc.name || 'حاسبة');
  const root = document.getElementById('customerCalcRoot');
  renderCalculator(root, calc, persist, customer.specs);
  document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
  document.getElementById('view-customer-calc').style.display = 'block';
}

document.getElementById('backToCustomersBtn').addEventListener('click', () => showView('customers'));
document.getElementById('backToCustomerBtn').addEventListener('click', () => {
  const customer = db.customers.find(c => c.id === currentCustomerId);
  if (customer) openCustomerDetail(customer.id);
  else showView('customers');
});
document.getElementById('addCustomerBtn').addEventListener('click', () => openCustomerModal(null));

document.getElementById('addCalcBtn').addEventListener('click', () => {
  const customer = db.customers.find(c => c.id === currentCustomerId);
  if (!customer) return;
  const name = 'حاسبة ' + (customer.calculators.length + 1);
  customer.calculators.push(newCalc(name));
  persist();
  renderCustomerCalcsList(customer);
});

document.getElementById('calcToOrderBtn').addEventListener('click', () => {
  const customer = db.customers.find(c => c.id === currentCustomerId);
  const calc = customer && customer.calculators.find(c => c.id === currentCalcId);
  if (!calc) return;
  const c = computeCalc(calc);
  if (!c.finalPrice) { alert('الإجمالي الكلي للطلبية = صفر. أكمل بيانات الحاسبة أولاً.'); return; }
  const d = calcDeposit(calc, c);
  const dep = Math.min(Math.max(d.amount, 0), c.finalPrice);
  const data = {
    description: calc.palletName || calc.name || 'طلب شغل',
    quantity: String(c.quantity), unitPrice: String(r2(c.unitPrice)), totalAmount: String(r2(c.finalPrice)),
    depositPct: dep ? String(d.type === 'pct' ? d.val : r2(dep / c.finalPrice * 100)) : '',
    depositAmount: dep ? String(r2(dep)) : '', depositSrc: d.type === 'pct' ? 'pct' : 'amt'
  };
  if (!customer.accounts) customer.accounts = [];
  const existing = customer.accounts.find(o => o.calcId === calc.id);
  if (existing) {
    Object.assign(existing, data);
    showToast('تم تحديث الطلب المرتبط بالحاسبة');
  } else {
    customer.accounts.push(Object.assign({ id: uid(), date: todayStr(), payments: [], calcId: calc.id }, data));
    showToast('تمت إضافة الطلب إلى حساب العميل (مع العربون)');
  }
  persist();
  openCustomerDetail(customer.id);
});

document.getElementById('printCustomerCalcBtn').addEventListener('click', () => {
  const customer = db.customers.find(c => c.id === currentCustomerId);
  const calc = customer && customer.calculators.find(c => c.id === currentCalcId);
  if (customer && calc) printCustomerSummary(customer, calc, false);
});

document.getElementById('printCustomerCalcNoPriceBtn').addEventListener('click', () => {
  const customer = db.customers.find(c => c.id === currentCustomerId);
  const calc = customer && customer.calculators.find(c => c.id === currentCalcId);
  if (customer && calc) printCustomerSummary(customer, calc, true);
});

// Customer modal
let customerModalMode = 'add';
let customerModalEditId = null;

function openCustomerModal(id) {
  customerModalMode = id ? 'edit' : 'add';
  customerModalEditId = id;
  const overlay = document.getElementById('customerModalOverlay');
  document.getElementById('customerModalTitle').textContent = id ? 'تعديل بيانات العميل' : 'إضافة عميل';
  if (id) {
    const c = db.customers.find(x => x.id === id);
    document.getElementById('customerNameInput').value = c.name || '';
    document.getElementById('customerPhoneInput').value = c.phone || '';
    document.getElementById('customerAddressInput').value = c.address || '';
  } else {
    document.getElementById('customerNameInput').value = '';
    document.getElementById('customerPhoneInput').value = '';
    document.getElementById('customerAddressInput').value = '';
  }
  overlay.style.display = 'flex';
}

document.getElementById('cancelCustomerModalBtn').addEventListener('click', () => {
  document.getElementById('customerModalOverlay').style.display = 'none';
});

document.getElementById('saveCustomerModalBtn').addEventListener('click', () => {
  const name = document.getElementById('customerNameInput').value.trim();
  if (!name) { alert('من فضلك أدخل اسم العميل'); return; }
  const phone = document.getElementById('customerPhoneInput').value.trim();
  const address = document.getElementById('customerAddressInput').value.trim();

  if (customerModalMode === 'add') {
    db.customers.push({ id: uid(), name, phone, address, createdAt: todayStr(), specs: [...specOptions], accounts: [], calculators: [newCalc('حاسبة 1')] });
  } else {
    const c = db.customers.find(x => x.id === customerModalEditId);
    if (c) { c.name = name; c.phone = phone; c.address = address; }
  }
  persist();
  document.getElementById('customerModalOverlay').style.display = 'none';
  renderCustomersList();
});
