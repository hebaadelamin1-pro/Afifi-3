// ===================== CALCULATOR UI (reusable) =====================
function renderCalculator(container, calc, onChange, specsList) {
  (calc.rows || []).forEach(r => { if (r.pricePerM3 === undefined) r.pricePerM3 = calc.pricePerM3 ?? 15000; });
  if (!calc.type) calc.type = 'pallet';
  if (!calc.dims) calc.dims = ['', '', ''];
  if (!calc.costs) calc.costs = {};
  const specs = specsList || specOptions;
  container.innerHTML = `
    <div class="calc2">
      <div class="calc2-main">
        <div class="calc2-card calc2-top">
          <div class="calc2-row1">
            ${typesHtml(calc)}
            <div class="field grow">
              <label>${TYPE_META[calc.type || 'pallet'].nameLabel}</label>
              <input type="text" class="pallet-name-input" value="${escapeHtml(calc.palletName || '')}" placeholder="مثال: ${TYPE_META[calc.type || 'pallet'].example}">
            </div>
            <div class="field readonly-field date">
              <label>تاريخ الإضافة</label>
              <input type="text" value="${escapeHtml(calc.createdAt || '')}" readonly>
            </div>
          </div>
          <div class="calc2-params">
            <div class="field">
              <label>نسبة الربح %</label>
              <input type="number" class="profit-pct-input" value="${calc.profitPct ?? ''}">
            </div>
            <div class="field">
              <label>عدد الطلبية</label>
              <input type="number" class="quantity-input" min="1" value="${calc.quantity ?? 1}">
            </div>
            ${dimsHtml(calc)}
          </div>
        </div>

        <div class="calc2-card calc2-table">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>المكوّن / الوصف</th>
                  <th>العدد</th>
                  <th>التخانة (مم)</th>
                  <th>العرض (مم)</th>
                  <th>الطول (سم)</th>
                  <th>سعر المتر المكعب (ج.م)</th><th>إجمالي التكعيب (سم)</th><th>التكلفة (ج.م)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody class="rows-body"></tbody>
            </table>
          </div>
          <div class="calc2-tfoot"><button class="add-row-btn">+ إضافة صف</button></div>
        </div>

        <div class="costs-box">
          <div class="costs-head">
            <h3>تكاليف إضافية للوحدة الواحدة (ج.م)</h3>
            <div class="extra-add"><input type="text" class="extra-new-name" placeholder="إضافة أخرى: اكتب الاسم"><input type="number" class="extra-new-val" placeholder="المبلغ"><button type="button" class="icon-btn open add-extra-btn">+ إضافة</button></div>
          </div>
          <div class="extras-list"></div>
        </div>
      </div>

      <aside class="calc2-side">
        <div class="summary-box">
          <div class="summary-row"><span class="lbl">إجمالي التكعيب للوحدة (سم)</span><span class="val sumVolume">0</span></div>
          <div class="summary-row"><span class="lbl">إجمالي التكعيب للطلبية (سم)</span><span class="val sumVolumeOrder">0</span></div>
          <div class="summary-row"><span class="lbl">سعر الخشب للوحدة الواحدة</span><span class="val sumWoodPricePerUnit">0 ج.م</span></div>
          <div class="summary-row"><span class="lbl">إجمالي سعر الخشب (بعد الكمية)</span><span class="val sumWoodPrice">0 ج.م</span></div>
          <div class="summary-row"><span class="lbl">إجمالي التكاليف الإضافية</span><span class="val sumCosts">0 ج.م</span></div>
          <div class="summary-row"><span class="lbl">إجمالي تكلفة التصنيع للطلبية</span><span class="val sumAfterCosts">0 ج.م</span></div>
          <div class="summary-row mfg"><span class="lbl">سعر التصنيع للقطعة الواحدة</span><span class="val sumUnitCost">0 ج.م</span></div>
          <div class="summary-row gain"><span class="lbl">سعر الربح للقطعة الواحدة</span><span class="val sumGainUnit">0 ج.م</span></div>
          <div class="summary-row"><span class="lbl">سعر بيع القطعة الواحدة</span><span class="val sumUnitPrice">0 ج.م</span></div>
          <div class="summary-row final"><span class="lbl">الإجمالي الكلي للطلبية (بعد الربحية)</span><span class="val finalPrice">0 ج.م</span></div>
          <div class="summary-row gain"><span class="lbl">إجمالي ربح الطلبية</span><span class="val sumGain">0 ج.م</span></div>
          <div class="summary-note">الهامش قبل المصروفات العامة، وليس صافي ربح.</div>
        </div>

        <div class="deposit-box2">
          <div class="dep-head"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12V8H6a2 2 0 0 1 0-4h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg><h3>تحديد العربون والتحصيل</h3></div>
          <div class="dep-grid">
            <div class="field">
              <label>نوع العربون</label>
              <select class="dep-type">
                <option value="pct" ${(calc.depositType || 'pct') === 'pct' ? 'selected' : ''}>نسبة مئوية (%)</option>
                <option value="fixed" ${calc.depositType === 'fixed' ? 'selected' : ''}>مبلغ ثابت (ج.م)</option>
              </select>
            </div>
            <div class="field">
              <label>قيمة العربون</label>
              <input type="number" step="any" min="0" class="dep-val" value="${calc.depositValue ?? ''}" placeholder="0">
            </div>
          </div>
          <div class="dep-sum">
            <div class="dep"><small>العربون المستحق</small><b class="depAmount">0 ج.م</b></div>
            <div class="rem"><small>المتبقي عند التسليم</small><b class="depRemaining">0 ج.م</b></div>
          </div>
          <div class="dep-warn depWarn"></div>
        </div>

        <div class="images-box">
          <div class="images-head">
            <h3>صور المنتج</h3>
            <label class="upload-btn">📷 رفع صورة
              <input type="file" class="image-upload-input" accept="image/*" multiple>
            </label>
          </div>
          <div class="images-grid"></div>
        </div>
      </aside>
    </div>
  `;

  container.querySelector('.pallet-name-input').addEventListener('input', e => {
    calc.palletName = e.target.value; onChange();
  });

  container.querySelector('.profit-pct-input').addEventListener('input', e => {
    calc.profitPct = e.target.value; onChange(); recomputeSummary(container, calc);
  });
  container.querySelector('.quantity-input').addEventListener('input', e => {
    calc.quantity = e.target.value; onChange(); recomputeSummary(container, calc);
  });
  container.querySelectorAll('.dim-input').forEach(inp => inp.addEventListener('input', e => {
    const i = +inp.dataset.i;
    if (calc.type === 'pallet' || !calc.type) { if (i === 0) calc.palletLength = e.target.value; else calc.palletWidth = e.target.value; }
    else { if (!calc.dims) calc.dims = ['', '', '']; calc.dims[i] = e.target.value; }
    onChange();
  }));
  container.querySelectorAll('.type-btn').forEach(b => b.addEventListener('click', () => {
    calc.type = b.dataset.type; onChange(); renderCalculator(container, calc, onChange, specs);
  }));

  container.querySelector('.add-row-btn').addEventListener('click', () => {
    calc.rows.push({ _id: uid(), spec: '', count: '', thickness: '', width: '', length: '', pricePerM3: (calc.rows.length ? calc.rows[calc.rows.length - 1].pricePerM3 : calc.pricePerM3) ?? 15000 });
    buildRows(container, calc, onChange, specs);
    onChange();
  });

  container.querySelector('.dep-type').addEventListener('change', e => { calc.depositType = e.target.value; onChange(); recomputeSummary(container, calc); });
  container.querySelector('.dep-val').addEventListener('input', e => { calc.depositValue = e.target.value; onChange(); recomputeSummary(container, calc); });

  renderExtras(container, calc, onChange);

  container.querySelector('.image-upload-input').addEventListener('change', e => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        calc.images.push(reader.result);
        renderImages(container, calc, onChange);
        onChange();
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  });

  buildRows(container, calc, onChange, specs);
  renderImages(container, calc, onChange);
  recomputeSummary(container, calc);
}

function buildRows(container, calc, onChange, specsList) {
  const specs = specsList || specOptions;
  const tbody = container.querySelector('.rows-body');
  tbody.innerHTML = '';
  calc.rows.forEach((row, idx) => {
    const tr = document.createElement('tr');
    // if a row's saved spec is no longer in the customer's list, still show it so data isn't lost
    const optionsList = (row.spec && !specs.includes(row.spec)) ? [...specs, row.spec] : specs;
    tr.innerHTML = `
      <td class="rownum">${idx + 1}</td>
      <td><button type="button" class="spec-pick ${row.spec ? 'has-value' : ''}" data-pickbtn="1">${row.spec ? escapeHtml(row.spec) : 'اختر المكوّن'}</button></td>
      <td><input type="number" class="count-input" value="${row.count ?? ''}" placeholder="0"></td>
      <td><input type="number" class="thickness-input" value="${row.thickness ?? ''}" placeholder="0"></td>
      <td><input type="number" class="width-input" value="${row.width ?? ''}" placeholder="0"></td>
      <td><input type="number" class="length-input" value="${row.length ?? ''}" placeholder="0"></td>
      <td><input type="number" class="price-input" value="${row.pricePerM3 ?? ''}" placeholder="0"></td>
      <td class="calc volume-cell">0</td>
      <td class="calc row-cost">0</td>
      <td class="del-cell"><button class="row-del-btn" title="حذف الصف">✕</button></td>
    `;
    const pickBtn = tr.querySelector('.spec-pick');
    pickBtn.addEventListener('click', () => openPickMenu(pickBtn, [...new Set([...specs, ...(db.componentLib || [])])], v => {
      if (![...specs, ...(db.componentLib || [])].includes(v)) { db.componentLib = db.componentLib || []; db.componentLib.push(v); persist(); }
      row.spec = v; pickBtn.textContent = v; pickBtn.classList.add('has-value'); onChange();
    }, 'إضافة: اكتب وصفًا جديدًا (يُحفظ للمرات القادمة)'));
    tr.querySelector('.count-input').addEventListener('input', e => { row.count = e.target.value; onChange(); recomputeSummary(container, calc); });
    tr.querySelector('.thickness-input').addEventListener('input', e => { row.thickness = e.target.value; onChange(); recomputeSummary(container, calc); });
    tr.querySelector('.width-input').addEventListener('input', e => { row.width = e.target.value; onChange(); recomputeSummary(container, calc); });
    tr.querySelector('.length-input').addEventListener('input', e => { row.length = e.target.value; onChange(); recomputeSummary(container, calc); });
    tr.querySelector('.price-input').addEventListener('input', e => { row.pricePerM3 = e.target.value; onChange(); recomputeSummary(container, calc); });
    tr.querySelector('.row-del-btn').addEventListener('click', () => {
      calc.rows = calc.rows.filter(r => r._id !== row._id);
      buildRows(container, calc, onChange, specs);
      onChange();
    });
    tbody.appendChild(tr);
  });
  recomputeSummary(container, calc);
}

function renderImages(container, calc, onChange) {
  const grid = container.querySelector('.images-grid');
  grid.innerHTML = '';
  calc.images.forEach((src, idx) => {
    const div = document.createElement('div');
    div.className = 'img-thumb';
    div.innerHTML = `<img src="${src}"><button class="del-img" title="حذف الصورة">✕</button>`;
    div.querySelector('.del-img').addEventListener('click', () => {
      calc.images.splice(idx, 1);
      renderImages(container, calc, onChange);
      onChange();
    });
    grid.appendChild(div);
  });
}

function recomputeSummary(container, calc) {
  const computed = computeCalc(calc);
  const trs = container.querySelectorAll('.rows-body tr');
  trs.forEach((tr, idx) => {
    const vcell = tr.querySelector('.volume-cell');
    if (vcell && computed.rowsCalc[idx]) vcell.textContent = fmtV(computed.rowsCalc[idx].volume);
    const rc = vcell.parentElement.querySelector('.row-cost'); if (rc) rc.textContent = fmt(computed.rowsCalc[idx].rowPrice);
  });
  container.querySelector('.sumVolume').textContent = fmtV(computed.totalVolume);
  container.querySelector('.sumVolumeOrder').textContent = fmtV(computed.totalVolumeOrder);
  container.querySelector('.sumWoodPricePerUnit').textContent = fmt3(computed.totalWoodPricePerUnit) + ' ج.م';
  container.querySelector('.sumWoodPrice').textContent = fmt3(computed.totalWoodPrice) + ' ج.م';
  container.querySelector('.sumCosts').textContent = fmt3(computed.totalCosts) + ' ج.م';
  container.querySelector('.sumAfterCosts').textContent = fmt3(computed.afterCosts) + ' ج.م';
  container.querySelector('.finalPrice').textContent = fmt3(computed.finalPrice) + ' ج.م';
  container.querySelector('.sumUnitCost').textContent = fmt3(computed.unitCost) + ' ج.م';
  container.querySelector('.sumUnitPrice').textContent = fmt3(computed.unitPrice) + ' ج.م';
  container.querySelector('.sumGainUnit').textContent = fmt3(computed.gainUnit) + ' ج.م';
  container.querySelector('.sumGain').textContent = fmt3(computed.gain) + ' ج.م';
  const dp = calcDeposit(calc, computed);
  container.querySelector('.depAmount').textContent = fmt3(dp.amount) + ' ج.م';
  container.querySelector('.depRemaining').textContent = fmt3(dp.remaining) + ' ج.م';
  container.querySelector('.depWarn').textContent = dp.over ? '⚠ العربون أكبر من إجمالي الطلبية' : '';
}

function calcDeposit(calc, computed) {
  const c = computed || computeCalc(calc);
  const type = calc.depositType || 'pct';
  const val = parseFloat(calc.depositValue) || 0;
  const amount = type === 'pct' ? c.finalPrice * val / 100 : val;
  return { type, val, amount, remaining: c.finalPrice - amount, over: amount > c.finalPrice + 0.005 };
}
