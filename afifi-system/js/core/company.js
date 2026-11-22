// ===================== COMPANY SETTINGS =====================
function renderCompanyForm() {
  const root = document.getElementById('companyFormRoot');
  const c = db.company;
  root.innerHTML = `
    <div class="sheet" style="padding:20px 24px;">
      <div class="quote-form-grid">
        <div class="field">
          <label>اسم الشركة (عربي)</label>
          <input type="text" class="company-name" value="${escapeHtml(c.name || '')}">
        </div>
        <div class="field">
          <label>اسم الشركة (إنجليزي)</label>
          <input type="text" class="company-name-en" value="${escapeHtml(c.nameEn || '')}">
        </div>
        <div class="field">
          <label>أرقام الهاتف (مفصولة بفاصلة)</label>
          <input type="text" class="company-phones" value="${escapeHtml((c.phones || []).join(', '))}">
        </div>
        <div class="field">
          <label>البريد الإلكتروني</label>
          <input type="text" class="company-email" value="${escapeHtml(c.email || '')}">
        </div>
        <div class="field" style="grid-column: span 2;">
          <label>عنوان المصنع</label>
          <input type="text" class="company-factory" value="${escapeHtml(c.factoryAddress || '')}">
        </div>
        <div class="field" style="grid-column: span 2;">
          <label>عنوان المعرض</label>
          <input type="text" class="company-showroom" value="${escapeHtml(c.showroomAddress || '')}">
        </div>
      </div>
      <div class="images-box">
        <h3>شعار الشركة</h3>
        <label class="upload-btn">📷 رفع شعار
          <input type="file" class="logo-upload-input" accept="image/*">
        </label>
        <div class="images-grid logo-preview"></div>
      </div>
      <div class="modal-actions" style="justify-content:flex-start;">
        <button class="primary-btn" id="saveCompanyBtn">💾 حفظ بيانات الشركة</button>
      </div>
    </div>
  `;

  function renderLogoPreview() {
    const grid = root.querySelector('.logo-preview');
    grid.innerHTML = '';
    if (c.logo) {
      const div = document.createElement('div');
      div.className = 'img-thumb';
      div.innerHTML = `<img src="${c.logo}"><button class="del-img" title="حذف الشعار">✕</button>`;
      div.querySelector('.del-img').addEventListener('click', () => { c.logo = ''; persist(); updateFavicon(); updateBranding(); renderLogoPreview(); });
      grid.appendChild(div);
    }
  }
  renderLogoPreview();

  root.querySelector('.logo-upload-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    resizeImageFile(file, 512, url => {
      c.logo = url; persist(); updateFavicon(); updateBranding(); renderLogoPreview();
      showToast('تم تحديث الشعار وأيقونة المتصفح');
    });
    e.target.value = '';
  });

  root.querySelector('#saveCompanyBtn').addEventListener('click', () => {
    c.name = root.querySelector('.company-name').value.trim();
    c.nameEn = root.querySelector('.company-name-en').value.trim();
    c.phones = root.querySelector('.company-phones').value.split(',').map(s => s.trim()).filter(Boolean);
    c.email = root.querySelector('.company-email').value.trim();
    c.factoryAddress = root.querySelector('.company-factory').value.trim();
    c.showroomAddress = root.querySelector('.company-showroom').value.trim();
    persist();
    alert('تم حفظ بيانات الشركة');
  });
}
