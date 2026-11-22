// ===================== CALCULATION =====================
function rowM3Price(r, fb) { return r.pricePerM3 === undefined ? fb : (parseFloat(r.pricePerM3) || 0); }
function computeCalc(calc) {
  const price = parseFloat(calc.pricePerM3) || 0;
  const profit = parseFloat(calc.profitPct) || 0;
  const q = parseFloat(calc.quantity) || 1;
  let totalVolume = 0, woodUnit = 0;
  const rowsCalc = calc.rows.map(r => {
    const volume = (parseFloat(r.count) || 0) * (parseFloat(r.thickness) || 0) * (parseFloat(r.width) || 0) * (parseFloat(r.length) || 0); // تكعيب الإكسل
    const rowPrice = volume * rowM3Price(r, price) / 100000000; // تخانة مم × عرض مم × طول سم ÷ 1e8 = م³
    totalVolume += volume; woodUnit += rowPrice;
    return { volume, rowPrice };
  });
  let extras = 0, loss = 0;
  Object.entries(calc.costs || {}).forEach(([k, v]) => { const n = parseFloat(v) || 0; if (k === 'خسارة') loss = n; else extras += n; });
  // الخسارة تُخصم مرة واحدة بقيمتها بالضبط (بدون أن تتضاعف بنسبة الربح)
  const baseCost = woodUnit + extras;                  // الخشب + التكاليف الإضافية (قبل الخسارة)
  const unitCost = baseCost - loss;                    // سعر التصنيع للقطعة
  const unitPrice = baseCost * (1 + profit / 100) - loss; // سعر بيع القطعة: الربح على الأساس، ثم تُخصم الخسارة مرة واحدة
  return { rowsCalc, totalVolume, totalVolumeOrder: totalVolume * q, totalWoodPricePerUnit: woodUnit, totalWoodPrice: woodUnit * q,
    totalCosts: (extras - loss) * q, afterCosts: unitCost * q, unitCost, finalPrice: unitPrice * q, unitPrice,
    gainUnit: unitPrice - unitCost, gain: (unitPrice - unitCost) * q, quantity: q };
}

function calcThicknessSummary(calc) {
  const thicknesses = calc.rows.map(r => parseFloat(r.thickness)).filter(t => t > 0);
  if (!thicknesses.length) return '';
  const uniq = [...new Set(thicknesses)];
  return uniq.map(t => t + ' مللي').join(' / ');
}

const TYPE_META = {
  pallet: { label: 'بالتة خشبية', nameLabel: 'اسم البالتة', example: 'بالتة 113×113 دكم جديدة', dims: ['طول الطبلية (سم)', 'عرض الطبلية (سم)'] },
  box: { label: 'صندوق خشبي', nameLabel: 'اسم الصندوق', example: 'صندوق خشبي 80×60×50 سم', dims: ['العرض (سم)', 'الارتفاع (سم)', 'الطول (سم)'] },
  reel: { label: 'بكرة سحاب', nameLabel: 'اسم بكرة السحاب', example: 'بكرة سحاب 120×80 سم', dims: ['طول البكرة (سم)', 'قطر البكرة (سم)'] }
};
const EXTRA_PRESETS = ['مصانعية', 'مسمار', 'اكرامية', 'نقل', 'تبخير', 'خسارة'];
function fmtV(n) {
  if (isNaN(n) || n === null || n === undefined) n = 0;
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
function typesHtml(calc) {
  return `<div class="types-row">${Object.keys(TYPE_META).map(k => `<button type="button" class="type-btn ${calc.type === k ? 'on' : ''}" data-type="${k}">${TYPE_META[k].label}</button>`).join('')}</div>`;
}
function dimsHtml(calc) {
  const t = calc.type || 'pallet';
  return TYPE_META[t].dims.map((label, i) => {
    const val = t === 'pallet' ? (i === 0 ? calc.palletLength : calc.palletWidth) : (calc.dims || [])[i];
    return `<div class="field"><label>${label}</label><input type="number" class="dim-input" data-i="${i}" value="${val ?? ''}"></div>`;
  }).join('');
}
let pickMenuEl = null;
function openPickMenu(btn, items, onPick, placeholder) {
  if (!pickMenuEl) {
    pickMenuEl = document.createElement('div');
    pickMenuEl.id = 'pickMenu';
    document.body.appendChild(pickMenuEl);
    document.addEventListener('click', e => { if (!e.target.closest('#pickMenu') && !e.target.closest('[data-pickbtn]')) pickMenuEl.style.display = 'none'; });
  }
  const m = pickMenuEl;
  m.innerHTML = items.map((it, i) => `<button type="button" data-idx="${i}">${escapeHtml(it)}</button>`).join('') +
    `<div class="own"><input type="text" placeholder="${placeholder}"><button type="button" class="own-add">إضافة</button></div>`;
  m.style.display = 'block';
  const r = btn.getBoundingClientRect();
  m.style.top = Math.max(8, Math.min(r.bottom + 4, innerHeight - m.offsetHeight - 10)) + 'px';
  m.style.left = Math.max(8, Math.min(r.left, innerWidth - m.offsetWidth - 8)) + 'px';
  const done = v => { v = (v || '').trim(); if (!v) return; onPick(v); m.style.display = 'none'; };
  m.onclick = e => {
    e.stopPropagation();
    const b = e.target.closest('button'); if (!b) return;
    if (b.classList.contains('own-add')) done(m.querySelector('input').value); else done(items[b.dataset.idx]);
  };
  m.querySelector('input').onkeydown = e => { if (e.key === 'Enter') done(e.target.value); };
  m.querySelector('input').focus();
}
function renderExtras(container, calc, onChange) {
  if (!calc.costs) calc.costs = {};
  EXTRA_PRESETS.forEach(k => { if (!(k in calc.costs)) calc.costs[k] = 0; });
  const keys = [...EXTRA_PRESETS, ...Object.keys(calc.costs).filter(k => !EXTRA_PRESETS.includes(k))];
  const list = container.querySelector('.extras-list');
  list.innerHTML = keys.map(k => `<div class="extra-cell"><label><span>${escapeHtml(k)}${k === 'خسارة' ? ' (تُخصم)' : ''}</span>${EXTRA_PRESETS.includes(k) ? '' : `<button type="button" class="extra-del" data-del="${escapeHtml(k)}" title="حذف">✕</button>`}</label><input type="number" step="any" class="extra-input" data-k="${escapeHtml(k)}" value="${calc.costs[k] ?? 0}"></div>`).join('');
  list.querySelectorAll('.extra-input').forEach(inp => inp.addEventListener('input', e => { calc.costs[inp.dataset.k] = e.target.value; onChange(); recomputeSummary(container, calc); }));
  list.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => { delete calc.costs[b.dataset.del]; onChange(); renderExtras(container, calc, onChange); recomputeSummary(container, calc); }));
  const nm = container.querySelector('.extra-new-name'), vl = container.querySelector('.extra-new-val');
  container.querySelector('.add-extra-btn').onclick = () => {
    const name = nm.value.trim(); if (!name) { nm.focus(); return; }
    calc.costs[name] = parseFloat(vl.value) || 0; onChange(); renderExtras(container, calc, onChange); recomputeSummary(container, calc);
  };
}