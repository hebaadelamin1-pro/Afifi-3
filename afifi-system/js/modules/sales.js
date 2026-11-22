
/* ===================== قسم المبيعات ===================== */
(function () {
'use strict';

const $ = id => document.getElementById(id);
const esc = s => escapeHtml(s);
const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; };
const rd = (x, d = 2) => { if (!isFinite(x)) return 0; const s = String(x); if (/e/i.test(s)) return Math.round(x * 10 ** d) / 10 ** d; return Number(Math.round(s + 'e' + d) + 'e-' + d); };
const m2 = n => rd(n, 2).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n3 = n => rd(n, 3).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const n4 = n => rd(n, 4).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const nf = n => rd(n, 3).toLocaleString('en-US', { maximumFractionDigits: 3 });
const dmy = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || ''); };
const safe = s => String(s || '').replace(/[\\/:*?"<>|]/g, ' ').trim();

const TN = {
  pallet: { label: 'بالتة خشبية', noun: 'البالتة', nameLabel: 'اسم البالتة', plural: 'بالتات' },
  box: { label: 'صندوق خشبي', noun: 'الصندوق', nameLabel: 'اسم الصندوق', plural: 'صناديق' },
  reel: { label: 'بكرة سحاب', noun: 'بكرة السحاب', nameLabel: 'اسم بكرة السحاب', plural: 'بكرات' }
};
const STEPS = [['quote', 'عرض السعر'], ['po', 'أمر التوريد'], ['mo', 'أمر التصنيع'], ['grn', 'إذن استلام مخازن']];

let C = null, O = null, S = null, calc = null, T = TN.pallet, step = 'quote', selGrn = null, pvTimer = null, saveTimer = null;

/* ---------- مسارات البيانات ---------- */
const gp = (o, p) => p.split('.').reduce((a, k) => a == null ? a : a[k], o);
const sp = (o, p, v) => { const k = p.split('.'), l = k.pop(); k.reduce((a, x) => a[x], o)[l] = v; };
const later = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => persist(), 350); };

/* ---------- إنشاء بيانات المبيعات لأول مرة (من الحاسبة والطلب) ---------- */
function cfg() { return db.salesCfg = db.salesCfg || {}; }
function seqNo(key, prefix) { const c = cfg(); c[key] = (c[key] || 0) + 1; return prefix + new Date().getFullYear() + '-' + String(c[key]).padStart(3, '0'); }
function sizeOf(k) { if (!k) return ''; const t = k.type || 'pallet'; const v = t === 'pallet' ? [k.palletLength, k.palletWidth] : (k.dims || []); return v.filter(x => x !== '' && x != null).join('*'); }

function ensure() {
  const s = O.sales = O.sales || {};
  const qty = O.quantity || (calc ? String(computeCalc(calc).quantity) : '1');
  const unit = O.unitPrice || (calc ? String(rd(computeCalc(calc).unitPrice)) : '');
  const nm = O.description || (calc && (calc.palletName || calc.name)) || T.label;
  if (!s.quote) s.quote = { no: seqNo('quote', 'Q-'), date: todayStr(), customer: C.name, items: [{ bayan: nm, qty: String(qty), price: String(unit), size: sizeOf(calc) }], taxOn: false, taxPct: '14', notesText: defaultNotes().join('\n') };
  if (!s.po) s.po = { no: '', date: todayStr(), place: 'الإسكندرية', issuer: C.name, to: db.company.name, formNo: '', footNote: '',
    items: s.quote.items.map(i => ({ name: i.bayan, unit: 'عدد', qty: i.qty, price: i.price })), specs: '', vatPct: '14', termsText: '',
    signers: [{ title: '', name: '' }, { title: '', name: '' }, { title: '', name: '' }], file: null };
  if (!s.mo) s.mo = moFresh();
  if (!s.grns) s.grns = [];
  return s;
}
function moFresh() {
  const rows = calc ? (calc.rows || []).filter(r => r.spec || num(r.count) || num(r.thickness) || num(r.width) || num(r.length)).map(r => ({ spec: r.spec || '', count: r.count, th: r.thickness, w: r.width, l: r.length })) : [];
  if (!rows.length) rows.push({ spec: '', count: '', th: '', w: '', l: '' });
  return { no: seqNo('mo', 'MO-'), date: todayStr(), company: C.name, name: (calc && calc.palletName) || O.description || '', qty: O.quantity || (calc ? String(computeCalc(calc).quantity) : ''),
    price: calc ? String(calc.pricePerM3 || '') : '', profit: calc ? String(calc.profitPct || '') : '', poNo: '', notes: '', rows };
}

/* ---------- الحسابات ---------- */
function qTotals() {
  const q = S.quote; let sub = 0;
  const items = q.items.map(i => { const t = rd(num(i.qty) * num(i.price)); sub += t; return t; });
  sub = rd(sub); const tax = q.taxOn ? rd(sub * num(q.taxPct) / 100) : 0;
  return { items, sub, tax, total: rd(sub + tax) };
}
function poTotals() {
  const p = S.po; let sub = 0;
  const items = p.items.map(i => { const t = rd(num(i.qty) * num(i.price)); sub += t; return t; });
  sub = rd(sub); const tax = rd(sub * num(p.vatPct) / 100);
  return { items, sub, tax, total: rd(sub + tax) };
}
function moCalc() {
  const mo = S.mo, q = num(mo.qty), p = num(mo.price), pct = num(mo.profit);
  let sumF = 0, sumH = 0, sumG = 0;
  const rows = mo.rows.map(r => { const c = num(r.count), t = num(r.th), w = num(r.w), l = num(r.l); const F = c * t * w * l, G = q * c, H = G * t * w * l / 1e8; sumF += F; sumG += G; sumH += H; return { F, G, H }; });
  const unitPrice = sumF * p / 1e8;
  return { rows, sumF, sumG, sumH, unitM3: sumF / 1e8, unitPrice, profitUnit: unitPrice * pct / 100, profitTotal: unitPrice * pct / 100 * q, woodTotal: sumH * p, q };
}
function delivered(idx) { let n = 0; (S.grns || []).forEach(g => g.items.forEach(i => { if (String(i.po) === String(idx)) n += num(i.qty); })); return n; }
function grnTotal(g) { return g.items.reduce((s, i) => s + num(i.qty), 0); }

/* ---------- عناصر الفورم ---------- */
const val = (p) => { const v = gp(S, p); return v == null ? '' : v; };
const F = (p, label, o = {}) => `<div class="sl-f ${o.cls || ''}"><label>${label}</label><input ${o.type ? `type="${o.type}"` : 'type="text"'} ${o.type === 'number' ? 'step="any" inputmode="decimal"' : ''} data-k="${p}" value="${esc(val(p))}" ${o.ph ? `placeholder="${esc(o.ph)}"` : ''} ${o.ro ? 'readonly' : ''} ${o.list ? `list="${o.list}"` : ''}></div>`;
const TA = (p, label, rows, ph) => `<div class="sl-f"><label>${label}</label><textarea data-k="${p}" rows="${rows || 3}" ${ph ? `placeholder="${esc(ph)}"` : ''}>${esc(val(p))}</textarea></div>`;
const cell = (p, o = {}) => `<td><input ${o.type === 'num' ? 'type="number" step="any" inputmode="decimal"' : 'type="text"'} data-k="${p}" value="${esc(val(p))}" ${o.ph ? `placeholder="${esc(o.ph)}"` : ''} ${o.list ? `list="${o.list}"` : ''} style="${o.w ? 'min-width:' + o.w + 'px' : ''}"></td>`;
const X = (path) => `<td><button class="sl-x" data-del="${path}" title="حذف">✕</button></td>`;
const specDL = `<datalist id="slSpecs">${specOptions.map(s => `<option value="${esc(s)}">`).join('')}</datalist>`;

function summaryBar() {
  const L = ledgerOf(C).rows.find(r => r.o.id === O.id) || { total: num(O.totalAmount), paid: orderPaid(O), remaining: num(O.totalAmount) - orderPaid(O) };
  return `<div class="sl-summary">
    <div class="sl-chipbox"><small>نوع المنتج</small><b>${T.label}</b></div>
    <div class="sl-chipbox"><small>البيان</small><b>${esc(O.description || '—')}</b></div>
    <div class="sl-chipbox"><small>الإجمالي</small><b class="num">${m2(L.total)} ج.م</b></div>
    <div class="sl-chipbox ok"><small>المدفوع</small><b class="num">${m2(L.paid)} ج.م</b></div>
    <div class="sl-chipbox ${L.remaining > 0.005 ? 'due' : 'ok'}"><small>المتبقي</small><b class="num">${m2(L.remaining)} ج.م</b></div></div>`;
}

/* ---------- نماذج الإدخال لكل خطوة ---------- */
function formQuote() {
  const q = S.quote;
  return `<div class="sl-card"><h3>بيانات العرض</h3><div class="sl-row">
      ${F('quote.no', 'رقم العرض')}${F('quote.date', 'التاريخ', { type: 'date' })}${F('quote.customer', 'السادة (اسم العميل)')}</div></div>
    <div class="sl-card"><h3>بنود العرض <small>${T.label}</small></h3><div class="sl-tbl-wrap"><table class="sl-tbl"><thead><tr><th>#</th><th>${T.nameLabel} / البيان</th><th>المقاس</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th><th></th></tr></thead><tbody>
      ${q.items.map((it, i) => `<tr><td class="mut">${i + 1}</td>${cell(`quote.items.${i}.bayan`, { ph: 'مثال: ' + exampleName(), w: 120 })}${cell(`quote.items.${i}.size`, { ph: '100*120', w: 64 })}${cell(`quote.items.${i}.qty`, { type: 'num', w: 56 })}${cell(`quote.items.${i}.price`, { type: 'num', w: 76 })}<td class="c num" data-sum="qi${i}"></td>${q.items.length > 1 ? X(`quote.items.${i}`) : '<td></td>'}</tr>`).join('')}
      </tbody></table></div><button class="sl-add" data-add="quote.items">+ إضافة بند</button>
      ${calc ? `<button class="sl-add" data-act="qFromCalc" style="margin-inline-start:8px">↻ تحديث السعر والكمية من الحاسبة</button>` : ''}
      <div id="slCalc"></div></div>
    <div class="sl-card"><h3>الضريبة والملاحظات</h3><div class="sl-row" style="align-items:end">
      <label class="sl-check"><input type="checkbox" data-k="quote.taxOn" ${q.taxOn ? 'checked' : ''}> إضافة ضريبة القيمة المضافة</label>${F('quote.taxPct', 'نسبة الضريبة %', { type: 'number' })}</div>
      <div style="margin-top:10px">${TA('quote.notesText', 'الملاحظات (كل سطر ملاحظة)', 5)}</div></div>`;
}
function exampleName() { return T === TN.box ? 'صندوق خشبي 80×60×50' : T === TN.reel ? 'بكرة سحاب 120×80' : 'بالتة 113×113 دكم جديدة'; }

function formPO() {
  const p = S.po;
  const file = p.file ? `<div class="sl-file"><span>📎</span><b>${esc(p.file.name)}</b><button class="secondary-btn btn-sm" data-act="poView">عرض</button><button class="secondary-btn btn-sm" data-act="poDown">تنزيل</button><button class="secondary-btn btn-sm" data-act="poDel" style="color:var(--m-due)">حذف</button></div>` : '';
  return `<div class="sl-card"><h3>الملف الأصلي لأمر التوريد <small>PDF أو صورة</small></h3>${file}
      <label class="sl-up" style="margin-top:${p.file ? 10 : 0}px"><input type="file" id="slPoFile" accept="application/pdf,image/*">⬆ ${p.file ? 'استبدال الملف' : 'رفع ملف أمر التوريد الذي أرسلته الشركة'}</label>
      <div class="sl-hint">يُحفظ الملف داخل الطلب ويمكن فتحه وتنزيله في أي وقت. الأفضل ملفات أقل من 2.5 ميجا.</div></div>
    <div class="sl-card"><h3>بيانات أمر التوريد</h3><div class="sl-row">
      ${F('po.no', 'رقم أمر التوريد', { ph: 'مثال: 699/2026' })}${F('po.date', 'التاريخ', { type: 'date' })}${F('po.place', 'المدينة')}
      ${F('po.issuer', 'الجهة المُصدِرة للأمر')}${F('po.to', 'السادة / (المورّد)')}${F('po.formNo', 'رقم النموذج (اختياري)', { ph: 'QF .03.03.05' })}</div></div>
    <div class="sl-card"><h3>الأصناف</h3><div class="sl-tbl-wrap"><table class="sl-tbl"><thead><tr><th>م</th><th>الصنف</th><th>الوحدة</th><th>الكمية المطلوبة</th><th>سعر الوحدة (جم)</th><th>الإجمالي (جم)</th><th></th></tr></thead><tbody>
      ${p.items.map((it, i) => `<tr><td class="mut">${i + 1}</td>${cell(`po.items.${i}.name`, { w: 130 })}${cell(`po.items.${i}.unit`, { w: 52 })}${cell(`po.items.${i}.qty`, { type: 'num', w: 64 })}${cell(`po.items.${i}.price`, { type: 'num', w: 76 })}<td class="c num" data-sum="pi${i}"></td>${p.items.length > 1 ? X(`po.items.${i}`) : '<td></td>'}</tr>`).join('')}
      </tbody></table></div><button class="sl-add" data-add="po.items">+ إضافة صنف</button>
      <div style="margin-top:10px">${TA('po.specs', 'المواصفات', 5, 'مثال: عدد الألواح الفرش 7 عرض 10 سم سمك 3/4 بوصة ...')}</div>
      <div class="sl-row" style="margin-top:10px">${F('po.vatPct', 'ضريبة القيمة المضافة %', { type: 'number' })}</div><div id="slCalc"></div></div>
    <div class="sl-card"><h3>الكميات المُسلَّمة <small>تُخصم تلقائياً من أذون الاستلام</small></h3><div id="slTrack"></div></div>
    <div class="sl-card"><h3>شروط التوريد</h3>${TA('po.termsText', 'كل سطر شرط (يُرقَّم تلقائياً)', 5, 'التسليم: مصانعنا ببرج العرب.\nالدفع: تحويل عقب التوريد.\nالتوريد: فورًا.')}</div>
    <div class="sl-card"><h3>التوقيعات</h3><div class="sl-tbl-wrap"><table class="sl-tbl"><thead><tr><th>الوظيفة</th><th>الاسم</th></tr></thead><tbody>
      ${p.signers.map((s, i) => `<tr>${cell(`po.signers.${i}.title`, { ph: 'مثال: مدير المشتريات المحلية' })}${cell(`po.signers.${i}.name`, { ph: 'الاسم' })}</tr>`).join('')}</tbody></table></div>
      <div style="margin-top:8px">${F('po.footNote', 'ملاحظة أسفل الصفحة (اختياري)', { ph: 'This is an e-form and no need to be signed or stamped' })}</div></div>`;
}

function formMO() {
  const mo = S.mo;
  return `${specDL}<div class="sl-card"><h3>بيانات أمر التصنيع ${calc ? '<button class="secondary-btn btn-sm" data-act="moFromCalc">↻ تحديث من الحاسبة</button>' : ''}</h3><div class="sl-row">
      ${F('mo.no', 'رقم أمر التصنيع')}${F('mo.date', 'التاريخ', { type: 'date' })}${F('mo.company', 'الشركة')}
      ${F('mo.name', T.nameLabel)}${F('mo.poNo', 'رقم أمر التوريد', { ph: S.po.no ? S.po.no + ' (من أمر التوريد)' : 'اتركه فارغاً لسحبه من أمر التوريد' })}
      ${F('mo.qty', 'العدد المطلوب تقطيعه', { type: 'number' })}${F('mo.price', 'سعر المتر المكعب (ج.م)', { type: 'number' })}${F('mo.profit', 'الربحية %', { type: 'number' })}</div></div>
    <div class="sl-card"><h3>المواصفات والتكعيب</h3><div class="sl-tbl-wrap"><table class="sl-tbl sl-mo"><thead><tr><th>المواصفات</th><th>العدد</th><th>التخانة (مم)</th><th>العرض (مم)</th><th>الطول (سم)</th><th>تكعيب الواحدة</th><th>عدد القطع</th><th>تكعيب الخشب (م³)</th><th></th></tr></thead><tbody>
      ${mo.rows.map((r, i) => `<tr>${cell(`mo.rows.${i}.spec`, { list: 'slSpecs', w: 110 })}${cell(`mo.rows.${i}.count`, { type: 'num', w: 60 })}${cell(`mo.rows.${i}.th`, { type: 'num', w: 70 })}${cell(`mo.rows.${i}.w`, { type: 'num', w: 70 })}${cell(`mo.rows.${i}.l`, { type: 'num', w: 70 })}<td class="mut num" data-sum="mF${i}"></td><td class="mut num" data-sum="mG${i}"></td><td class="mut num" data-sum="mH${i}"></td>${mo.rows.length > 1 ? X(`mo.rows.${i}`) : '<td></td>'}</tr>`).join('')}
      </tbody></table></div><button class="sl-add" data-add="mo.rows">+ إضافة صف</button><div id="slCalc"></div></div>
    <div class="sl-card"><h3>ملاحظات</h3>${TA('mo.notes', 'ملاحظات التصنيع (اختياري)', 3)}</div>`;
}

function formGRN() {
  const g = S.grns.find(x => x.id === selGrn);
  const list = S.grns.length ? S.grns.map(x => `<button class="sl-grn ${x.id === selGrn ? 'on' : ''}" data-sel="${x.id}"><b>إذن ${esc(x.no)}</b><small>${dmy(x.date)} • ${nf(grnTotal(x))} قطعة</small></button>`).join('') : '<div class="sl-empty" style="padding:6px 0">لا توجد أذون استلام بعد — اضغط "إذن جديد"</div>';
  let ed = '';
  if (g) {
    const gi = S.grns.indexOf(g), po = S.po;
    ed = `<div class="sl-card"><h3>بيانات الإذن <button class="secondary-btn btn-sm" data-act="grnDel" style="color:var(--m-due)">حذف هذا الإذن</button></h3><div class="sl-row">
      ${F(`grns.${gi}.no`, 'رقم الإذن')}${F(`grns.${gi}.date`, 'التاريخ', { type: 'date' })}${F(`grns.${gi}.customer`, 'اسم العميل')}
      ${F(`grns.${gi}.mobile`, 'رقم الموبايل')}${F(`grns.${gi}.poNo`, 'رقم أمر التوريد', { ph: po.no || '' })}</div></div>
      <div class="sl-card"><h3>الأصناف المسلَّمة</h3><div class="sl-tbl-wrap"><table class="sl-tbl"><thead><tr><th>م</th><th>البيان</th><th>العدد</th><th>المقاس</th><th>ملاحظات</th><th>يخصم من بند أمر التوريد</th><th></th></tr></thead><tbody>
      ${g.items.map((it, i) => `<tr><td class="mut">${i + 1}</td>${cell(`grns.${gi}.items.${i}.name`, { w: 150 })}${cell(`grns.${gi}.items.${i}.qty`, { type: 'num', w: 70 })}${cell(`grns.${gi}.items.${i}.size`, { w: 80 })}${cell(`grns.${gi}.items.${i}.note`, { w: 110 })}
        <td><select data-k="grns.${gi}.items.${i}.po"><option value="">— بدون —</option>${po.items.map((p, k) => `<option value="${k}" ${String(it.po) === String(k) ? 'selected' : ''}>${k + 1}. ${esc(p.name || 'صنف')}</option>`).join('')}</select></td>${g.items.length > 1 ? X(`grns.${gi}.items.${i}`) : '<td></td>'}</tr>`).join('')}
      </tbody></table></div><button class="sl-add" data-add="grns.${gi}.items">+ إضافة صف</button><div id="slCalc"></div></div>
      <div class="sl-card"><h3>الاستلام</h3><div class="sl-row">${F(`grns.${gi}.receiver`, 'استلمت أنا السيد /')}${F(`grns.${gi}.truck`, 'رقم العربية /')}</div>
      <div class="sl-hint">خانة التوقيع تُترك فارغة في الطباعة ليوقّع المستلم بخط اليد.</div></div>`;
  }
  return `<div class="sl-card"><h3>أذون الاستلام <button class="primary-btn btn-sm" data-act="grnNew">+ إذن جديد</button></h3><div class="sl-grns">${list}</div></div>
    ${ed}<div class="sl-card"><h3>متابعة أمر التوريد <small>العدد المسلَّم يُخصم تلقائياً من المطلوب</small></h3><div id="slTrack"></div></div>`;
}



/* ---------- تصميم المستندات (طباعة / PDF) ---------- */
const NAVY = `@page{size:A4;margin:12mm}*{box-sizing:border-box}html,body{margin:0}body{font-family:Cairo,Tahoma,Arial,sans-serif;color:#0f1e3d;direction:rtl;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:13px;line-height:1.55}
@media screen{body{padding:12mm}}
.dh{display:flex;align-items:center;gap:16px;border-bottom:3px solid #0B2A5B;padding-bottom:10px;margin-bottom:12px}
.dh .lg{width:78px;height:78px;border:1px solid #dbe4f2;border-radius:12px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex:none;color:#9aa8c4;font-size:11px}.dh .lg img{max-width:100%;max-height:100%}
.dh .nm{flex:1;text-align:center}.dh .nm b{display:block;font-size:24px;color:#0B2A5B;font-weight:800}.dh .nm span{font-size:13px;color:#5b6b8c;direction:ltr;display:block}
.ttl{background:#0B2A5B;color:#fff;text-align:center;font-weight:800;font-size:19px;border-radius:10px;padding:6px;margin:4px auto 14px;width:52%}
.meta{display:flex;justify-content:space-between;gap:10px;margin-bottom:8px;font-size:14px;flex-wrap:wrap}
.intro{margin:8px 0;font-size:14px}
table.t{width:100%;border-collapse:collapse;margin:8px 0}
table.t th{background:#0B2A5B;color:#fff;padding:8px 6px;border:1px solid #0B2A5B;font-weight:700;font-size:12.5px}
table.t td{border:1px solid #9fb0cf;padding:7px 8px;text-align:center;font-size:13px;vertical-align:middle}
table.t td.r{text-align:right}table.t td.sp{text-align:right;white-space:pre-wrap;line-height:1.8;font-size:12.5px}
table.t tr.tot td{background:#E6EEFB;font-weight:800}table.t tr.g td{background:#0B2A5B;color:#fff}
.nt{margin-top:12px;font-size:13px}.nt b{color:#0B2A5B}.nt div{margin:2px 0}
.cl{text-align:center;font-weight:700;margin:18px 0 8px}
.sg{display:flex;justify-content:space-around;gap:10px;margin-top:26px;text-align:center;font-weight:700}.sg div{min-width:140px}.sg small{display:block;color:#51607f;font-weight:600;margin-top:4px}
.ft{margin-top:22px;border-top:2px solid #0B2A5B;padding-top:8px;font-size:11.5px;color:#41506f;text-align:center;line-height:1.7}
.po-h{text-align:center;font-size:22px;font-weight:800;color:#0B2A5B;margin-bottom:4px}.po-d{text-align:left;font-weight:700;margin:6px 0 10px}
.po-t{text-align:center;font-weight:800;font-size:17px;text-decoration:underline;margin:8px 0 14px}
.po-trm{margin-top:12px}.po-trm b{text-decoration:underline}.po-trm ol{margin:6px 0;padding-inline-start:22px}.po-trm li{margin:3px 0}
.po-f{display:flex;justify-content:space-between;margin-top:18px;font-size:11px;color:#51607f;direction:ltr}
.mo-i{width:100%;border-collapse:collapse;margin-bottom:10px}.mo-i td{border:1px solid #9fb0cf;padding:7px 9px;font-size:13px}.mo-i td.l{background:#E6EEFB;font-weight:700;color:#0B2A5B;width:15%}.mo-i td.v{font-weight:800;width:10%;text-align:center}
.sm{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}.sm div{border:1px solid #9fb0cf;border-radius:10px;padding:8px 10px;background:#f6f9ff}.sm small{display:block;color:#51607f;font-weight:600;font-size:11.5px}.sm b{font-size:15px;color:#0B2A5B}.sm div.hl{background:#0B2A5B}.sm div.hl small{color:#cfe0ff}.sm div.hl b{color:#fff}`;

const BROWN = `@page{size:A4;margin:10mm}*{box-sizing:border-box}html,body{margin:0}
body{font-family:Cairo,Tahoma,Arial,sans-serif;color:#2a2118;direction:rtl;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:13px;line-height:1.5}
@media screen{body{padding:10mm;background:#fff}}
.w{--ink:#2a2118;--mute:#7a6a5c;--line:#e7ded3;--soft:#faf6f1;--deep:#3b2414;--wood:#6B3F24;--copper:#b9783a}
.w-top{display:flex;align-items:stretch;gap:16px;padding-bottom:16px;border-bottom:3px solid var(--wood);position:relative}
.w-top:after{content:"";position:absolute;right:0;bottom:-3px;width:88px;height:3px;background:var(--copper)}
.w-brand{display:flex;align-items:center;gap:14px;flex:1;min-width:0}
.w-logo{width:78px;height:78px;border:1px solid var(--line);border-radius:16px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;flex:none;color:var(--mute);font-size:11px;font-weight:700;text-align:center;padding:4px}
.w-logo img{max-width:100%;max-height:100%}
.w-co b{display:block;font-size:24px;font-weight:800;color:var(--deep);line-height:1.25}
.w-co span{display:block;font-size:12px;color:var(--mute);direction:ltr;text-align:right;letter-spacing:.2px}
.w-ttl{flex:none;text-align:left;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;gap:6px}
.w-ttl h1{margin:0;font-size:25px;font-weight:800;color:var(--wood);line-height:1.2}
.w-ttl small{font-size:11px;letter-spacing:2px;color:var(--mute);text-transform:uppercase;direction:ltr}
.w-no{display:inline-flex;align-items:center;gap:8px;background:var(--deep);color:#fff;border-radius:999px;padding:5px 16px;font-weight:800;font-size:15px}
.w-no i{font-style:normal;font-size:11px;font-weight:600;color:#e9cfae}
.w-info{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin:16px 0 14px}
.w-box{grid-column:span 2;border:1px solid var(--line);background:var(--soft);border-radius:14px;padding:9px 14px;min-height:56px}
.w-box.wide{grid-column:span 4}
.w-box small{display:block;font-size:11px;color:var(--mute);font-weight:700;margin-bottom:2px}
.w-box b{display:block;font-size:15px;color:var(--ink);font-weight:800;min-height:20px;overflow-wrap:anywhere}
.w-box.hl{background:#fff;border-color:var(--wood);box-shadow:inset 0 0 0 1px var(--wood)}
.w-box.hl b{font-size:19px;color:var(--wood)}
.w-tbl{border:1px solid var(--line);border-radius:16px;overflow:hidden}
table.w-t{width:100%;border-collapse:collapse}
table.w-t thead th{background:var(--deep);color:#fff;font-weight:700;font-size:12.5px;padding:10px 8px;text-align:center;border:0}
table.w-t tbody td{height:31px;padding:3px 10px;text-align:center;font-weight:700;font-size:13px;border-bottom:1px solid var(--line);border-left:1px solid var(--line)}
table.w-t tbody td:last-child{border-left:0}
table.w-t tbody tr:nth-child(even) td{background:#fcfaf7}
table.w-t tbody tr:last-child td{border-bottom:0}
table.w-t td.r{text-align:right}
table.w-t td.k{color:var(--mute);font-weight:700;width:7%}
.w-sum{display:flex;align-items:center;justify-content:space-between;background:linear-gradient(90deg,var(--wood),var(--deep));color:#fff;padding:11px 18px;font-weight:800;font-size:14px}
.w-sum b{background:#fff;color:var(--deep);border-radius:10px;padding:2px 18px;font-size:19px;min-width:90px;text-align:center}
.w-rc{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}
.w-line{border:1px solid var(--line);border-radius:14px;padding:10px 14px;min-height:54px;display:flex;align-items:flex-end;gap:10px}
.w-line small{font-size:12.5px;color:var(--mute);font-weight:700;white-space:nowrap}
.w-line span{flex:1;border-bottom:1.5px dotted #b8a590;min-height:24px;font-weight:800;font-size:14.5px;padding:0 6px;text-align:center}
.w-sign{grid-column:1/-1;min-height:78px;align-items:flex-start}
.w-sign span{min-height:46px;align-self:flex-end}
.w-foot{margin-top:14px;padding-top:8px;border-top:1px solid var(--line);font-size:10.5px;color:var(--mute);text-align:center;line-height:1.7}`;

function wrap(title, css, body) { return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap"><style>${css}</style></head><body>${body}</body></html>`; }
function head() { const c = db.company; return `<div class="dh"><div class="lg">${c.logo ? `<img src="${c.logo}">` : 'الشعار'}</div><div class="nm"><b>${esc(c.name)}</b><span>${esc(c.nameEn)}</span></div></div>`; }
function foot() { const c = db.company; return `<div class="ft">المصنع: ${esc(c.factoryAddress)}<br>المعرض: ${esc(c.showroomAddress)}<br>للتواصل: <span dir="ltr">${(c.phones || []).join(' - ')}</span>${c.email ? ' - ' + esc(c.email) : ''}</div>`; }
const lines = t => String(t || '').split('\n').map(s => s.trim()).filter(Boolean);

function docQuote() {
  const q = S.quote, t = qTotals(), notes = lines(q.notesText);
  return wrap('عرض سعر - ' + q.customer, NAVY, `${head()}<div class="ttl">عرض سعر</div>
  <div class="meta"><div>السادة شركة: <b>${esc(q.customer) || '..............'}</b></div><div>التاريخ: <b>${dmy(q.date)}</b></div><div>رقم العرض: <b dir="ltr">${esc(q.no)}</b></div></div>
  <p class="intro">تحية طيبة وبعد،<br>مرسل إلى سيادتكم عرض سعر ${T.noun} طبقًا للمواصفات المطلوبة :-</p>
  <table class="t"><thead><tr><th style="width:42px">م</th><th>البيان</th><th>المقاس</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>
  ${q.items.map((i, k) => `<tr><td>${k + 1}</td><td class="r">${esc(i.bayan)}</td><td dir="ltr">${esc(i.size)}</td><td>${nf(num(i.qty))}</td><td>${m2(num(i.price))}</td><td>${m2(t.items[k])}</td></tr>`).join('')}
  <tr class="tot"><td colspan="5">إجمالي الأسعار</td><td>${m2(t.sub)} ج.م</td></tr>
  ${q.taxOn ? `<tr class="tot"><td colspan="5">ضريبة القيمة المضافة ${nf(num(q.taxPct))}%</td><td>${m2(t.tax)} ج.م</td></tr><tr class="tot g"><td colspan="5">الإجمالي بعد الضريبة</td><td>${m2(t.total)} ج.م</td></tr>` : ''}
  </tbody></table>${notes.length ? `<div class="nt"><b>ملاحظات:</b>${notes.map(n => `<div>* ${esc(n)}</div>`).join('')}</div>` : ''}
  <div class="cl">وتفضلوا بقبول وافر الاحترام والتحية ،،،،</div><div class="sg"><div>يعتمد<small>مدير المبيعات</small></div></div>${foot()}`);
}

function docPO() {
  const p = S.po, t = poTotals(), trm = lines(p.termsText);
  return wrap('أمر توريد ' + p.no, NAVY, `<div class="po-h">${esc(p.issuer)}</div><div class="po-d">${esc(p.place)} في ${dmy(p.date)}</div>
  <div class="po-t">أمر توريد ${p.no ? '(' + esc(p.no) + ')' : ''}</div>
  <p><b>السادة / ${esc(p.to)}</b></p><p><b>تحية طيبة وبعد،</b></p><p><b>برجاء التكرم نحو توريد ما يلي :-</b></p>
  <table class="t"><thead><tr><th style="width:38px">م</th><th>الصنف</th><th>الوحدة</th><th>الكمية المطلوبة</th><th>سعر الوحدة (جم)</th><th>إجمالي السعر (جم)</th></tr></thead><tbody>
  ${p.items.map((i, k) => `<tr><td>${k + 1}</td><td class="r">${esc(i.name)}</td><td>${esc(i.unit)}</td><td>${nf(num(i.qty))}</td><td>${m2(num(i.price))}</td><td>${m2(t.items[k])}</td></tr>`).join('')}
  ${p.specs.trim() ? `<tr><td></td><td class="sp" colspan="5"><b>المواصفات :</b> ${esc(p.specs)}</td></tr>` : ''}
  <tr class="tot"><td colspan="5">إجمالي السعر غير شامل ضريبة القيمة المضافة</td><td>${m2(t.sub)}</td></tr>
  <tr class="tot"><td colspan="5">يضاف ضريبة قيمة مضافة ${nf(num(p.vatPct))}%</td><td>${m2(t.tax)}</td></tr>
  <tr class="tot"><td colspan="5">إجمالي السعر شامل ضريبة القيمة المضافة</td><td>${m2(t.total)}</td></tr></tbody></table>
  ${trm.length ? `<div class="po-trm"><b>شروط التوريد :-</b><ol>${trm.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>` : ''}
  <div class="cl">و تفضلوا بقبول فائق الاحترام و التقدير</div>
  <div class="sg">${p.signers.map(s => `<div>${esc(s.title) || '&nbsp;'}<small>${esc(s.name)}</small></div>`).join('')}</div>
  <div class="po-f"><span>${esc(p.formNo)}</span><span>${esc(p.footNote)}</span></div>`);
}

function docMO() {
  const mo = S.mo, c = moCalc(), po = mo.poNo || S.po.no;
  return wrap('أمر تصنيع - ' + mo.company, NAVY, `${head()}<div class="ttl">أمر تصنيع</div>
  <table class="mo-i"><tr><td class="l">التاريخ</td><td class="v">${dmy(mo.date)}</td><td class="l">سعر المتر³ (ج.م)</td><td class="v">${m2(num(mo.price))}</td><td class="l">الشركة</td><td class="v">${esc(mo.company)}</td><td class="l">رقم أمر التوريد</td><td class="v">${esc(po)}</td></tr>
  <tr><td class="l">${T.nameLabel}</td><td class="v" colspan="3">${esc(mo.name)}</td><td class="l">العدد المطلوب تقطيعه</td><td class="v">${nf(num(mo.qty))}</td><td class="l">الربحية</td><td class="v">${nf(num(mo.profit))}%</td></tr></table>
  <table class="t"><thead><tr><th>المواصفات</th><th>العدد</th><th>التخانة (مم)</th><th>العرض (مم)</th><th>الطول (سم)</th><th>إجمالي تكعيب ${T.noun} الواحدة</th><th>إجمالي عدد القطع المطلوبة</th><th>إجمالي تكعيب الخشب المطلوب (م³)</th></tr></thead><tbody>
  ${mo.rows.map((r, i) => `<tr><td class="r">${esc(r.spec)}</td><td>${nf(num(r.count))}</td><td>${nf(num(r.th))}</td><td>${nf(num(r.w))}</td><td>${nf(num(r.l))}</td><td>${nf(c.rows[i].F)}</td><td>${nf(c.rows[i].G)}</td><td>${n3(c.rows[i].H)}</td></tr>`).join('')}
  <tr class="tot"><td colspan="5">الإجمالي</td><td>${nf(c.sumF)}</td><td>${nf(c.sumG)}</td><td>${n3(c.sumH)}</td></tr></tbody></table>
  <div class="sm"><div><small>تكعيب ${T.noun} الواحدة (م³)</small><b>${n4(c.unitM3)}</b></div><div><small>سعر ${T.noun} الواحدة (ج.م)</small><b>${m2(c.unitPrice)}</b></div><div><small>ربح ${T.noun} الواحدة (ج.م)</small><b>${m2(c.profitUnit)}</b></div>
  <div><small>إجمالي تكعيب الخشب المطلوب (م³)</small><b>${n3(c.sumH)}</b></div><div class="hl"><small>إجمالي سعر الخشب المطلوب (ج.م)</small><b>${m2(c.woodTotal)}</b></div><div><small>إجمالي ربح الطلبية (ج.م)</small><b>${m2(c.profitTotal)}</b></div></div>
  ${mo.notes.trim() ? `<div class="nt"><b>ملاحظات:</b> ${esc(mo.notes)}</div>` : ''}${foot()}`);
}

function docGRN(g) {
  if (!g) return wrap('إذن مخازن', BROWN, '<div style="padding:40px;text-align:center;color:#888">اختر إذناً أو أنشئ إذناً جديداً لعرضه هنا</div>');
  const c = db.company, rows = g.items.slice(); while (rows.length < 12) rows.push(null);
  const phones = (c.phones || []).join(' - ');
  return wrap('إذن مخازن ' + g.no, BROWN, `<div class="w">
  <div class="w-top">
    <div class="w-brand"><div class="w-logo">${c.logo ? `<img src="${c.logo}">` : esc(c.nameEn || c.name)}</div><div class="w-co"><b>${esc(c.name)}</b><span>${esc(c.nameEn)}</span></div></div>
    <div class="w-ttl"><h1>إذن استلام مخازن</h1><small>Warehouse Receipt</small><div class="w-no"><i>رقم الإذن</i>${esc(g.no)}</div></div>
  </div>
  <div class="w-info">
    <div class="w-box"><small>التاريخ</small><b>${dmy(g.date)}</b></div>
    <div class="w-box"><small>رقم الموبايل</small><b dir="ltr" style="text-align:right">${esc(g.mobile)}</b></div>
    <div class="w-box"><small>رقم أمر التوريد</small><b>${esc(g.poNo || S.po.no)}</b></div>
    <div class="w-box" style="grid-column:span 6"><small>اسم العميل</small><b>${esc(g.customer)}</b></div>
  </div>
  <div class="w-tbl"><table class="w-t"><thead><tr><th style="width:7%">م</th><th style="width:37%">البيان</th><th style="width:12%">العدد</th><th style="width:16%">المقاس</th><th>ملاحظات</th></tr></thead><tbody>
  ${rows.map((i, k) => i ? `<tr><td class="k">${k + 1}</td><td class="r">${esc(i.name)}</td><td>${nf(num(i.qty))}</td><td dir="ltr">${esc(i.size)}</td><td>${esc(i.note)}</td></tr>` : `<tr><td class="k">${k + 1}</td><td></td><td></td><td></td><td></td></tr>`).join('')}
  </tbody></table>
  <div class="w-sum"><span>إجمالي الكمية</span><b>${nf(grnTotal(g))}</b></div></div>
  <div class="w-rc">
    <div class="w-line"><small>استلمت أنا السيد /</small><span>${esc(g.receiver)}</span></div>
    <div class="w-line"><small>رقم العربية /</small><span>${esc(g.truck)}</span></div>
    <div class="w-line w-sign"><small>التوقيع /</small><span></span></div>
  </div>
  <div class="w-foot">${c.factoryAddress ? 'المصنع: ' + esc(c.factoryAddress) : ''}${c.showroomAddress ? ' &nbsp;•&nbsp; المعرض: ' + esc(c.showroomAddress) : ''}${phones ? '<br>للتواصل: <span dir="ltr">' + phones + '</span>' : ''}</div>
  </div>`);
}

/* ---------- ملفات Excel (xlsx حقيقي بدون مكتبات) ---------- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return b => { let c = ~0; for (let i = 0; i < b.length; i++) c = t[(c ^ b[i]) & 255] ^ (c >>> 8); return (~c) >>> 0; }; })();
function zip(files) {
  const en = new TextEncoder(), parts = [], cd = []; let off = 0;
  files.forEach(f => {
    const nm = en.encode(f.name), d = en.encode(f.data), crc = CRC(d);
    const lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(12, 0x21, true); lh.setUint32(14, crc, true); lh.setUint32(18, d.length, true); lh.setUint32(22, d.length, true); lh.setUint16(26, nm.length, true);
    parts.push(lh.buffer, nm, d);
    const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(14, 0x21, true); ch.setUint32(16, crc, true); ch.setUint32(20, d.length, true); ch.setUint32(24, d.length, true); ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
    cd.push(ch.buffer, nm); off += 30 + nm.length + d.length;
  });
  const cds = cd.reduce((a, b) => a + (b.byteLength !== undefined ? b.byteLength : b.length), 0);
  const end = new DataView(new ArrayBuffer(22)); end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cds, true); end.setUint32(16, off, true);
  return new Blob(parts.concat(cd, [end.buffer]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
const XE = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ref = (r, c) => String.fromCharCode(65 + c) + r;
const serial = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5) + 25569 : 0; };
// أنماط الخلايا (فهارس cellXfs)
const ST = { def: 0, title: 1, hdr: 2, txt: 3, money: 4, date: 5, totL: 6, totM: 7, bold: 8, ctr: 9, int: 10, n3: 11, hdrB: 12, titleB: 13, lblB: 14, totLB: 15, n4: 16, cbold: 17, totI: 18, totN3: 19, muted: 20, totIB: 21, note: 22, dateB: 23 };
function SB() {
  const cells = [], merges = [], hts = [];
  const o = {
    cells, merges, hts,
    s(r, c, v, st) { cells.push({ r, c, t: 's', v: String(v == null ? '' : v), st }); },
    n(r, c, v, st, f) { cells.push({ r, c, t: 'n', v: isFinite(v) ? v : 0, st, f }); },
    mg(r, c1, c2, v, st, num2, f) { if (num2) o.n(r, c1, v, st, f); else o.s(r, c1, v, st); for (let c = c1 + 1; c <= c2; c++) o.s(r, c, '', st); merges.push(ref(r, c1) + ':' + ref(r, c2)); },
    h(r, v) { hts[r] = v; }
  };
  return o;
}
function xlsxBlob(sheetName, sb, cols, land) {
  const by = {}; sb.cells.forEach(x => (by[x.r] = by[x.r] || []).push(x));
  const rows = Object.keys(by).map(Number).sort((a, b) => a - b).map(r => `<row r="${r}"${sb.hts[r] ? ` ht="${sb.hts[r]}" customHeight="1"` : ''}>${by[r].sort((a, b) => a.c - b.c).map(x => x.t === 's' ? `<c r="${ref(r, x.c)}" s="${x.st}" t="inlineStr"><is><t xml:space="preserve">${XE(x.v)}</t></is></c>` : `<c r="${ref(r, x.c)}" s="${x.st}">${x.f ? `<f>${XE(x.f)}</f>` : ''}<v>${x.v}</v></c>`).join('')}</row>`).join('');
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView rightToLeft="1" workbookViewId="0" showGridLines="0"/></sheetViews><sheetFormatPr defaultRowHeight="19"/><cols>${cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData>${sb.merges.length ? `<mergeCells count="${sb.merges.length}">${sb.merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : ''}<pageMargins left=".4" right=".4" top=".5" bottom=".5" header=".3" footer=".3"/><pageSetup paperSize="9" orientation="${land ? 'landscape' : 'portrait'}" fitToWidth="1" fitToHeight="0"/></worksheet>`;
  const B = '<border><left style="thin"><color rgb="FF999999"/></left><right style="thin"><color rgb="FF999999"/></right><top style="thin"><color rgb="FF999999"/></top><bottom style="thin"><color rgb="FF999999"/></bottom><diagonal/></border>';
  const xf = (nf2, font, fill, bd, h, wrap2) => `<xf numFmtId="${nf2}" fontId="${font}" fillId="${fill}" borderId="${bd}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="${h}" vertical="center"${wrap2 ? ' wrapText="1"' : ''}/></xf>`;
  const xfs = [
    xf(0, 0, 0, 0, 'right'), xf(0, 3, 0, 0, 'center'), xf(0, 2, 2, 1, 'center', 1), xf(0, 0, 0, 1, 'right', 1), xf(164, 0, 0, 1, 'center'), xf(165, 0, 0, 1, 'center'),
    xf(0, 1, 3, 1, 'right'), xf(164, 1, 3, 1, 'center'), xf(0, 1, 0, 0, 'right'), xf(0, 0, 0, 1, 'center', 1), xf(167, 0, 0, 1, 'center'), xf(166, 0, 0, 1, 'center'),
    xf(0, 2, 4, 1, 'center', 1), xf(0, 4, 4, 1, 'center'), xf(0, 1, 5, 1, 'right'), xf(0, 1, 5, 1, 'right'), xf(168, 0, 0, 1, 'center'), xf(0, 1, 0, 1, 'center'),
    xf(167, 1, 3, 1, 'center'), xf(166, 1, 3, 1, 'center'), xf(0, 6, 0, 0, 'right'), xf(167, 1, 5, 1, 'center'), xf(0, 0, 0, 0, 'right', 1), xf(165, 1, 0, 1, 'center')
  ];
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="5"><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/><numFmt numFmtId="166" formatCode="#,##0.000"/><numFmt numFmtId="167" formatCode="#,##0.###"/><numFmt numFmtId="168" formatCode="#,##0.0000"/></numFmts>
  <fonts count="7"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="16"/><color rgb="FF0B2A5B"/><name val="Arial"/></font><font><b/><sz val="14"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><sz val="11"/><name val="Arial"/></font><font><sz val="10"/><color rgb="FF6B7A99"/><name val="Arial"/></font></fonts>
  <fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B2A5B"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE6EEFB"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF6B3F24"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1E6DC"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>${B}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs></styleSheet>`;
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships', P = 'http://schemas.openxmlformats.org/package/2006/relationships', H = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  return zip([
    { name: '[Content_Types].xml', data: `${H}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { name: '_rels/.rels', data: `${H}<Relationships xmlns="${P}"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', data: `${H}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${R}"><sheets><sheet name="${XE(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `${H}<Relationships xmlns="${P}"><Relationship Id="rId1" Type="${R}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${R}/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', data: styles }, { name: 'xl/worksheets/sheet1.xml', data: sheet }
  ]);
}
function saveBlob(b, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }

function xQuote() {
  const q = S.quote, t = qTotals(), sb = SB(), notes = lines(q.notesText); let r = 1;
  sb.mg(r, 0, 5, db.company.name, ST.title); sb.h(r, 30); r++;
  sb.mg(r, 0, 5, 'عرض سعر', ST.hdr); sb.h(r, 24); r++;
  sb.mg(r, 0, 2, 'السادة شركة: ' + q.customer, ST.totL); sb.mg(r, 3, 5, 'التاريخ: ' + dmy(q.date) + '   |   رقم العرض: ' + q.no, ST.totL); r++;
  sb.mg(r, 0, 5, 'مرسل إلى سيادتكم عرض سعر ' + T.noun + ' طبقًا للمواصفات المطلوبة :-', ST.note); r++;
  ['م', 'البيان', 'المقاس', 'الكمية', 'سعر الوحدة', 'الإجمالي'].forEach((h, i) => sb.s(r, i, h, ST.hdr)); sb.h(r, 22); r++;
  const first = r;
  q.items.forEach((i, k) => { sb.n(r, 0, k + 1, ST.ctr); sb.s(r, 1, i.bayan, ST.txt); sb.s(r, 2, i.size, ST.ctr); sb.n(r, 3, num(i.qty), ST.int); sb.n(r, 4, num(i.price), ST.money); sb.n(r, 5, t.items[k], ST.money, `ROUND(D${r}*E${r},2)`); r++; });
  const last = r - 1, tot = r;
  sb.mg(r, 0, 4, 'إجمالي الأسعار', ST.totL); sb.n(r, 5, t.sub, ST.totM, `SUM(F${first}:F${last})`); r++;
  if (q.taxOn) {
    sb.mg(r, 0, 4, 'ضريبة القيمة المضافة ' + nf(num(q.taxPct)) + '%', ST.totL); sb.n(r, 5, t.tax, ST.totM, `ROUND(F${tot}*${num(q.taxPct)}/100,2)`); r++;
    sb.mg(r, 0, 4, 'الإجمالي بعد الضريبة', ST.totL); sb.n(r, 5, t.total, ST.totM, `F${tot}+F${tot + 1}`); r++;
  }
  r++; if (notes.length) { sb.mg(r, 0, 5, 'ملاحظات:', ST.bold); r++; notes.forEach(n => { sb.mg(r, 0, 5, '* ' + n, ST.note); r++; }); }
  r++; sb.mg(r, 0, 5, 'وتفضلوا بقبول وافر الاحترام والتحية ،،،،', ST.bold); r++; sb.mg(r, 0, 5, 'يعتمد — مدير المبيعات', ST.bold);
  return xlsxBlob('عرض سعر', sb, [6, 44, 14, 12, 16, 18]);
}

function xPO() {
  const p = S.po, t = poTotals(), sb = SB(), trm = lines(p.termsText); let r = 1;
  sb.mg(r, 0, 5, p.issuer, ST.title); sb.h(r, 30); r++;
  sb.mg(r, 0, 5, 'أمر توريد ' + (p.no ? '(' + p.no + ')' : ''), ST.hdr); sb.h(r, 24); r++;
  sb.mg(r, 0, 5, p.place + ' في ' + dmy(p.date), ST.totL); r++;
  sb.mg(r, 0, 5, 'السادة / ' + p.to, ST.bold); r++; sb.mg(r, 0, 5, 'برجاء التكرم نحو توريد ما يلي :-', ST.bold); r++;
  ['م', 'الصنف', 'الوحدة', 'الكمية المطلوبة', 'سعر الوحدة (جم)', 'إجمالي السعر (جم)'].forEach((h, i) => sb.s(r, i, h, ST.hdr)); sb.h(r, 22); r++;
  const first = r;
  p.items.forEach((i, k) => { sb.n(r, 0, k + 1, ST.ctr); sb.s(r, 1, i.name, ST.txt); sb.s(r, 2, i.unit, ST.ctr); sb.n(r, 3, num(i.qty), ST.int); sb.n(r, 4, num(i.price), ST.money); sb.n(r, 5, t.items[k], ST.money, `ROUND(D${r}*E${r},2)`); r++; });
  const last = r - 1;
  if (p.specs.trim()) { sb.s(r, 0, '', ST.txt); sb.mg(r, 1, 5, 'المواصفات : ' + p.specs, ST.txt); sb.h(r, Math.max(22, 18 * (p.specs.split('\n').length + Math.floor(p.specs.length / 70)))); r++; }
  const tot = r;
  sb.mg(r, 0, 4, 'إجمالي السعر غير شامل ضريبة القيمة المضافة', ST.totL); sb.n(r, 5, t.sub, ST.totM, `SUM(F${first}:F${last})`); r++;
  sb.mg(r, 0, 4, 'يضاف ضريبة قيمة مضافة ' + nf(num(p.vatPct)) + '%', ST.totL); sb.n(r, 5, t.tax, ST.totM, `ROUND(F${tot}*${num(p.vatPct)}/100,2)`); r++;
  sb.mg(r, 0, 4, 'إجمالي السعر شامل ضريبة القيمة المضافة', ST.totL); sb.n(r, 5, t.total, ST.totM, `F${tot}+F${tot + 1}`); r++;
  if (trm.length) { r++; sb.mg(r, 0, 5, 'شروط التوريد :-', ST.bold); r++; trm.forEach((x, i) => { sb.mg(r, 0, 5, (i + 1) + '- ' + x, ST.note); r++; }); }
  r++; sb.mg(r, 0, 5, 'و تفضلوا بقبول فائق الاحترام و التقدير', ST.bold); r += 2;
  p.signers.forEach((s, i) => { sb.mg(r, i * 2, i * 2 + 1, s.title, ST.cbold); sb.mg(r + 1, i * 2, i * 2 + 1, s.name, ST.ctr); });
  r += 3; if (p.formNo || p.footNote) sb.mg(r, 0, 5, [p.formNo, p.footNote].filter(Boolean).join('   —   '), ST.muted);
  return xlsxBlob('أمر توريد', sb, [6, 44, 10, 16, 18, 20]);
}

function xMO() {
  const mo = S.mo, c = moCalc(), sb = SB(); let r = 1;
  sb.mg(r, 0, 7, 'أمر تصنيع', ST.titleB); sb.h(r, 28); r++;
  sb.s(r, 0, 'التاريخ', ST.lblB); sb.n(r, 1, serial(mo.date), ST.date); sb.s(r, 2, 'سعر المتر³ (ج.م)', ST.lblB); sb.n(r, 3, num(mo.price), ST.money); sb.s(r, 4, 'الشركة', ST.lblB); sb.s(r, 5, mo.company, ST.ctr); sb.s(r, 6, 'رقم أمر التوريد', ST.lblB); sb.s(r, 7, mo.poNo || S.po.no, ST.ctr); const infoR = r; r++;
  sb.s(r, 0, T.nameLabel, ST.lblB); sb.mg(r, 1, 3, mo.name, ST.ctr); sb.s(r, 4, 'العدد المطلوب تقطيعه', ST.lblB); sb.n(r, 5, num(mo.qty), ST.int); sb.s(r, 6, 'الربحية %', ST.lblB); sb.n(r, 7, num(mo.profit), ST.int); const info2 = r; r += 2;
  ['المواصفات', 'العدد', 'التخانة (مم)', 'العرض (مم)', 'الطول (سم)', 'إجمالي تكعيب ' + T.noun + ' الواحدة', 'إجمالي عدد القطع المطلوبة', 'إجمالي تكعيب الخشب المطلوب (م³)'].forEach((h, i) => sb.s(r, i, h, ST.hdrB)); sb.h(r, 36); r++;
  const first = r;
  mo.rows.forEach((x, i) => {
    sb.s(r, 0, x.spec, ST.txt); sb.n(r, 1, num(x.count), ST.int); sb.n(r, 2, num(x.th), ST.int); sb.n(r, 3, num(x.w), ST.int); sb.n(r, 4, num(x.l), ST.int);
    sb.n(r, 5, c.rows[i].F, ST.int, `B${r}*C${r}*D${r}*E${r}`); sb.n(r, 6, c.rows[i].G, ST.int, `$F$${info2}*B${r}`); sb.n(r, 7, c.rows[i].H, ST.n3, `G${r}*C${r}*D${r}*E${r}/100000000`); r++;
  });
  const last = r - 1, tot = r;
  sb.mg(r, 0, 4, 'الإجمالي', ST.totLB); sb.n(r, 5, c.sumF, ST.totIB, `SUM(F${first}:F${last})`); sb.n(r, 6, c.sumG, ST.totIB, `SUM(G${first}:G${last})`); sb.n(r, 7, c.sumH, ST.totN3, `SUM(H${first}:H${last})`); r += 2;
  const line = (label, v, st, f) => { sb.mg(r, 0, 4, label, ST.totLB); sb.n(r, 5, v, st, f); r++; };
  line('تكعيب ' + T.noun + ' الواحدة (م³)', c.unitM3, ST.n4, `F${tot}/100000000`);
  const up = r; line('سعر ' + T.noun + ' الواحدة (ج.م)', c.unitPrice, ST.money, `F${tot}*$D$${infoR}/100000000`);
  const pu = r; line('ربح ' + T.noun + ' الواحدة (ج.م)', c.profitUnit, ST.money, `F${up}*$H$${info2}/100`);
  line('إجمالي ربح الطلبية (ج.م)', c.profitTotal, ST.money, `F${pu}*$F$${info2}`);
  line('إجمالي سعر الخشب المطلوب (ج.م)', c.woodTotal, ST.money, `H${tot}*$D$${infoR}`);
  if (mo.notes.trim()) { r++; sb.mg(r, 0, 7, 'ملاحظات: ' + mo.notes, ST.note); }
  return xlsxBlob('أمر تصنيع', sb, [20, 10, 14, 14, 14, 24, 24, 28]);
}

function xGRN(g) {
  const sb = SB(), c = db.company; let r = 1;
  sb.mg(r, 0, 5, c.name, ST.titleB); sb.h(r, 32); r++;
  sb.mg(r, 0, 5, 'اذن مخازن', ST.hdrB); sb.h(r, 24); r++;
  sb.s(r, 0, 'رقم الإذن', ST.lblB); sb.s(r, 1, g.no, ST.cbold); sb.s(r, 2, 'التاريخ', ST.lblB); sb.n(r, 3, serial(g.date), ST.dateB); sb.s(r, 4, 'رقم الموبايل', ST.lblB); sb.s(r, 5, g.mobile, ST.cbold); r++;
  sb.s(r, 0, 'رقم أمر التوريد', ST.lblB); sb.s(r, 1, g.poNo || S.po.no, ST.cbold); sb.s(r, 2, 'اسم العميل', ST.lblB); sb.mg(r, 3, 5, g.customer, ST.cbold); r += 2;
  ['م', 'البيان', 'العدد', 'المقاس', 'ملاحظات', ''].forEach((h, i) => { if (i < 4) sb.s(r, i, h, ST.hdrB); }); sb.mg(r, 4, 5, 'ملاحظات', ST.hdrB); r++;
  const first = r, n = Math.max(10, g.items.length);
  for (let k = 0; k < n; k++) { const i = g.items[k]; if (i) { sb.n(r, 0, k + 1, ST.ctr); sb.s(r, 1, i.name, ST.txt); sb.n(r, 2, num(i.qty), ST.int); sb.s(r, 3, i.size, ST.ctr); sb.mg(r, 4, 5, i.note, ST.txt); } else { sb.s(r, 0, '', ST.ctr); sb.s(r, 1, '', ST.txt); sb.s(r, 2, '', ST.int); sb.s(r, 3, '', ST.ctr); sb.mg(r, 4, 5, '', ST.txt); } sb.h(r, 22); r++; }
  const last = r - 1;
  sb.mg(r, 0, 1, 'إجمالي الكمية', ST.totLB); sb.n(r, 2, grnTotal(g), ST.totIB, `SUM(C${first}:C${last})`); sb.mg(r, 3, 5, '', ST.totLB); r += 2;
  sb.mg(r, 0, 5, 'استلمت أنا السيد / ' + (g.receiver || '..............................................'), ST.bold); sb.h(r, 28); r += 2;
  sb.mg(r, 0, 5, 'رقم العربيه / ' + (g.truck || '..............................................'), ST.bold); sb.h(r, 28); r += 2;
  sb.mg(r, 0, 5, 'التوقيع / ..............................................', ST.bold); sb.h(r, 28);
  return xlsxBlob('إذن مخازن', sb, [8, 40, 14, 18, 18, 18], true);
}

/* ---------- الطباعة ---------- */
function printHtml(html) {
  const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;left:-9999px;bottom:0;width:297mm;height:210mm;border:0'; document.body.appendChild(f);
  f.onload = () => setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { alert('تعذرت الطباعة'); } setTimeout(() => f.remove(), 120000); }, 800);
  f.srcdoc = html;
}

/* ---------- الواجهة ---------- */
function curGrn() { return (S.grns || []).find(x => x.id === selGrn) || null; }
function docNow() { return step === 'quote' ? docQuote() : step === 'po' ? docPO() : step === 'mo' ? docMO() : docGRN(curGrn()); }
function fileBase() {
  const nm = { quote: 'عرض سعر', po: 'أمر توريد', mo: 'أمر تصنيع', grn: 'إذن مخازن' }[step];
  const extra = step === 'quote' ? S.quote.no : step === 'po' ? S.po.no : step === 'mo' ? S.mo.no : (curGrn() || {}).no;
  return safe(nm + ' - ' + (C.name) + (extra ? ' - ' + extra : ''));
}
function stepDone(k) { return !!(S.done && S.done[k]) || (k === 'po' && !!(S.po.file || S.po.no)) || (k === 'grn' && (S.grns || []).length > 0); }
function markDone(k) { S.done = S.done || {}; if (!S.done[k]) { S.done[k] = true; paintSteps(); } }
function stepNote(k) {
  if (k === 'quote') return S.quote.no || '';
  if (k === 'po') return S.po.no ? 'رقم ' + S.po.no : (S.po.file ? 'ملف مرفوع' : 'لم يُسجَّل');
  if (k === 'mo') return S.mo.no || '';
  return (S.grns || []).length ? S.grns.length + ' إذن' : 'لم يُسجَّل';
}
function paintSteps() {
  $('slSteps').innerHTML = STEPS.map(([k, n], i) => `<button class="sl-step ${step === k ? 'on' : ''} ${stepDone(k) ? 'done' : ''}" data-step="${k}"><span class="no">${stepDone(k) ? '✓' : i + 1}</span><span><span class="tt">${n}</span><br><span class="st">${esc(stepNote(k))}</span></span></button>`).join('');
}
function totBox(rows) { return `<div class="sl-tot">${rows.map(([l, v, g]) => `<div class="${g ? 'g' : ''}"><span>${l}</span><b class="num">${v}</b></div>`).join('')}</div>`; }
function trackHtml() {
  const po = S.po;
  if (!po.items.some(i => num(i.qty) > 0)) return '<div class="sl-empty">أدخل أصناف وكميات أمر التوريد أولاً ليظهر الخصم هنا</div>';
  return `<div class="sl-track">${po.items.map((i, k) => { const ord = num(i.qty), del = delivered(k), rem = ord - del, pct = ord > 0 ? Math.min(100, Math.round(del / ord * 100)) : 0;
    return `<div class="it"><div class="hd"><span>${k + 1}. ${esc(i.name || 'صنف')}</span><span>${pct}%</span></div><div class="sl-prog"><span style="width:${pct}%"></span></div><div class="nm"><span>المطلوب: <b>${nf(ord)}</b></span><span class="fin">المُسلَّم: <b>${nf(del)}</b></span><span class="rem">المتبقي: <b>${nf(Math.max(0, rem))}</b></span></div>${rem < 0 ? `<div class="sl-warn">⚠ المُسلَّم أكبر من المطلوب بمقدار ${nf(-rem)}</div>` : ''}</div>`; }).join('')}</div>`;
}
function live() {
  const set = (k, v) => { const e = document.querySelector(`[data-sum="${k}"]`); if (e) e.textContent = v; };
  const box = $('slCalc');
  if (step === 'quote') { const t = qTotals(); t.items.forEach((x, i) => set('qi' + i, m2(x))); box.innerHTML = totBox([['الإجمالي', m2(t.sub) + ' ج.م'], ...(S.quote.taxOn ? [['الضريبة ' + nf(num(S.quote.taxPct)) + '%', m2(t.tax) + ' ج.م'], ['الإجمالي بعد الضريبة', m2(t.total) + ' ج.م', 1]] : [])]); }
  else if (step === 'po') { const t = poTotals(); t.items.forEach((x, i) => set('pi' + i, m2(x))); box.innerHTML = totBox([['الإجمالي غير شامل الضريبة', m2(t.sub) + ' ج.م'], ['ضريبة القيمة المضافة ' + nf(num(S.po.vatPct)) + '%', m2(t.tax) + ' ج.م'], ['الإجمالي شامل الضريبة', m2(t.total) + ' ج.م', 1]]); if ($('slTrack')) $('slTrack').innerHTML = trackHtml(); }
  else if (step === 'mo') { const c = moCalc(); c.rows.forEach((x, i) => { set('mF' + i, nf(x.F)); set('mG' + i, nf(x.G)); set('mH' + i, n3(x.H)); });
    box.innerHTML = `<div class="sl-kpis"><div><small>إجمالي تكعيب ${T.noun} الواحدة (م³)</small><b class="num">${n4(c.unitM3)}</b></div><div><small>سعر ${T.noun} الواحدة (ج.م)</small><b class="num">${m2(c.unitPrice)}</b></div><div><small>ربح ${T.noun} الواحدة (ج.م)</small><b class="num">${m2(c.profitUnit)}</b></div><div><small>إجمالي عدد القطع</small><b class="num">${nf(c.sumG)}</b></div><div><small>إجمالي تكعيب الخشب (م³)</small><b class="num">${n3(c.sumH)}</b></div><div class="hl"><small>إجمالي سعر الخشب المطلوب (ج.م)</small><b class="num">${m2(c.woodTotal)}</b></div></div>`; }
  else { const g = curGrn(); if (g && box) box.innerHTML = totBox([['إجمالي الكمية في هذا الإذن', nf(grnTotal(g)), 1]]); if ($('slTrack')) $('slTrack').innerHTML = trackHtml(); }
}
function fitPv() {
  const box = $('slPvBox'), f = $('slPv'); if (!box || !f) return;
  const land = step === 'grn', w = land ? 1123 : 794, h = land ? 794 : 1123, k = Math.min(1, (box.clientWidth - 20) / w);
  f.style.width = w + 'px'; f.style.height = h + 'px'; f.style.transform = `scale(${k})`; box.style.height = (h * k + 20) + 'px';
}
function preview() { const f = $('slPv'); if (!f) return; f.srcdoc = docNow(); fitPv(); }
function schedPv() {}

function draw() {
  const form = step === 'quote' ? formQuote() : step === 'po' ? formPO() : step === 'mo' ? formMO() : formGRN();
  const noFile = step === 'grn' && !curGrn();
  $('slBody').innerHTML = `${summaryBar()}<div class="sl-grid"><div class="sl-actbar">
    <button class="primary-btn btn-sm" data-act="print" ${noFile ? 'disabled' : ''}>🖨 طباعة</button><button class="secondary-btn btn-sm" data-act="pdf" ${noFile ? 'disabled' : ''}>⬇ تحميل PDF</button><button class="success-btn btn-sm" data-act="xlsx" ${noFile ? 'disabled' : ''}>⬇ تحميل Excel</button></div>
    <div class="sl-form">${form}</div></div>`;
  paintSteps(); live();
}

function openSales(cid, oid) {
  C = db.customers.find(c => c.id === cid); O = C && (C.accounts || []).find(o => o.id === oid); if (!O) return;
  calc = (C.calculators || []).find(k => k.id === O.calcId) || null; T = TN[(calc && calc.type) || 'pallet'] || TN.pallet;
  S = ensure(); step = S.step || 'quote'; selGrn = (S.grns[0] || {}).id || null; persist();
  $('slAvatar').textContent = initial(C.name); $('slTitle').textContent = 'مبيعات — ' + C.name; $('slSub').textContent = (O.description || 'طلب شغل') + ' • ' + T.label;
  document.querySelectorAll('.view').forEach(v => v.style.display = 'none'); $('view-sales').style.display = 'block';
  setNavActive('sales');
  draw(); window.scrollTo(0, 0);
}
window.openSales = openSales;

function newGrn() {
  const po = S.po, it0 = po.items[0], rem0 = it0 ? Math.max(0, num(it0.qty) - delivered(0)) : 0, c = cfg(), no = c.grnNext || 30040; c.grnNext = no + 1;
  const g = { id: uid(), no: String(no), date: todayStr(), customer: C.name, mobile: C.phone || '', poNo: po.no || '', receiver: '', truck: '',
    items: [{ name: (it0 && it0.name) || O.description || '', qty: rem0 ? String(rem0) : (O.quantity || ''), size: sizeOf(calc) || (S.quote.items[0] && S.quote.items[0].size) || '', note: '', po: it0 ? '0' : '' }] };
  S.grns.push(g); selGrn = g.id; persist(); draw();
}

function readFile(file) {
  if (!file) return;
  if (!(file.type === 'application/pdf' || file.type.startsWith('image/') || /\.pdf$/i.test(file.name))) { alert('اختر ملف PDF أو صورة'); return; }
  if (file.size > 2.5 * 1024 * 1024 && !confirm('حجم الملف أكبر من 2.5 ميجا وقد يُبطئ السيستم أو لا يُحفظ. هل تريد المتابعة؟')) return;
  const r = new FileReader(); r.onload = () => { S.po.file = { name: file.name, type: file.type || 'application/pdf', data: r.result, size: file.size }; persist(); draw(); showToast('تم رفع ملف أمر التوريد'); }; r.readAsDataURL(file);
}
async function fileBlob() { const r = await fetch(S.po.file.data); return r.blob(); }

function body() {
  const b = $('slBody');
  const onIn = e => {
    const el = e.target, k = el.dataset && el.dataset.k; if (!k) return;
    sp(S, k, el.type === 'checkbox' ? el.checked : el.value);
    if (/^grns\.\d+\.no$/.test(k) && /^\d+$/.test(el.value)) { const c = cfg(); c.grnNext = Math.max(c.grnNext || 0, parseInt(el.value, 10) + 1); }
    markDone(step); later(); live(); schedPv(); paintSteps();
  };
  b.addEventListener('input', onIn);
  b.addEventListener('change', e => { if (e.target.id === 'slPoFile') { readFile(e.target.files[0]); return; } if (e.target.tagName === 'SELECT') onIn(e); });
  b.addEventListener('click', async e => {
    const t = e.target.closest('[data-add],[data-del],[data-act],[data-sel]'); if (!t) return;
    if (t.dataset.sel) { selGrn = t.dataset.sel; draw(); return; }
    if (t.dataset.add) { const key = t.dataset.add.replace(/\.\d+\./g, '.#.'); const mk = { 'quote.items': () => ({ bayan: '', qty: '1', price: '', size: '' }), 'po.items': () => ({ name: '', unit: 'عدد', qty: '', price: '' }), 'mo.rows': () => ({ spec: '', count: '', th: '', w: '', l: '' }), 'grns.#.items': () => ({ name: '', qty: '', size: '', note: '', po: '' }) }[key]; if (mk) { gp(S, t.dataset.add).push(mk()); later(); draw(); } return; }
    if (t.dataset.del) { const p = t.dataset.del.split('.'), i = +p.pop(); gp(S, p.join('.')).splice(i, 1); later(); draw(); return; }
    const a = t.dataset.act;
    if (a === 'print') { markDone(step); persist(); printHtml(docNow()); }
    else if (a === 'pdf') { markDone(step); persist(); showToast('في نافذة الطباعة اختر "حفظ كـ PDF"'); printHtml(docNow()); }
    else if (a === 'xlsx') { markDone(step); persist(); const g = curGrn(); saveBlob(step === 'quote' ? xQuote() : step === 'po' ? xPO() : step === 'mo' ? xMO() : xGRN(g), fileBase() + '.xlsx'); }
    else if (a === 'qFromCalc') { if (!calc) return; const c = computeCalc(calc), it = S.quote.items[0]; it.bayan = calc.palletName || calc.name || it.bayan; it.qty = String(c.quantity); it.price = String(rd(c.unitPrice)); it.size = sizeOf(calc); later(); draw(); showToast('تم التحديث من الحاسبة'); }
    else if (a === 'moFromCalc') { openConfirm('سيتم استبدال المواصفات والأرقام الحالية بما في الحاسبة. متابعة؟', () => { const keep = { no: S.mo.no, poNo: S.mo.poNo, notes: S.mo.notes }; S.mo = Object.assign(moFresh(), keep); cfg().mo = Math.max(0, (cfg().mo || 1) - 1); later(); draw(); }); }
    else if (a === 'poView') { const bl = await fileBlob(); window.open(URL.createObjectURL(bl), '_blank'); }
    else if (a === 'poDown') { saveBlob(await fileBlob(), S.po.file.name); }
    else if (a === 'poDel') { openConfirm('حذف الملف المرفوع؟', () => { S.po.file = null; persist(); draw(); }); }
    else if (a === 'grnNew') newGrn();
    else if (a === 'grnDel') { const g = curGrn(); if (g) openConfirm('هل تريد حذف إذن رقم ' + g.no + '؟', () => { S.grns = S.grns.filter(x => x.id !== g.id); selGrn = (S.grns[0] || {}).id || null; persist(); draw(); }); }
  });
  $('slSteps').addEventListener('click', e => { const t = e.target.closest('[data-step]'); if (!t) return; step = S.step = t.dataset.step; persist(); draw(); });
  $('slBack').addEventListener('click', () => { persist(); if (C) openCustomerDetail(C.id); else showView('customers'); });
  window.addEventListener('resize', fitPv);
}
body();

/* ---------- ربط الأزرار: كارت الطلب + صفحة الحاسبة ---------- */
const CART = '<svg class="ic" viewBox="0 0 24 24"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L21 8H6"/></svg>';
window.__slCart = CART;
const hb = document.querySelector('#view-customer-calc .view-header');
if (hb) {
  const b = document.createElement('button'); b.className = 'secondary-btn'; b.id = 'calcToSalesBtn'; b.innerHTML = CART + 'مبيعات';
  hb.insertBefore(b, $('printCustomerCalcBtn'));
  b.addEventListener('click', () => {
    const cu = db.customers.find(c => c.id === currentCustomerId), k = cu && cu.calculators.find(x => x.id === currentCalcId); if (!k) return;
    let o = (cu.accounts || []).find(x => x.calcId === k.id);
    if (!o) { if (!computeCalc(k).finalPrice) { alert('الإجمالي الكلي للطلبية = صفر. أكمل بيانات الحاسبة أولاً.'); return; } $('calcToOrderBtn').click(); o = (cu.accounts || []).find(x => x.calcId === k.id); }
    if (o) openSales(cu.id, o.id);
  });
}

})();
