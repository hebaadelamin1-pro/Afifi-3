// ===================== BACKUP =====================
document.getElementById('backupBtn').addEventListener('click', async () => {
  const ok = await window.api.exportBackup(db);
  if (ok) alert('تم حفظ النسخة الاحتياطية بنجاح');
});

// ===================== MIGRATION (upgrade older saved data) =====================
function migrateDb() {
  (db.users || []).forEach(u => normalizeUser(u));
  if (!db.branches) db.branches = [{ id: uid(), name: 'المصنع', kind: 'فرع' }, { id: uid(), name: 'المعرض', kind: 'فرع' }];
  if (!db.supplierQuotes) db.supplierQuotes = [];
  db.customers.forEach(customer => {
    if (!customer.createdAt) customer.createdAt = todayStr();
    if (!customer.status) customer.status = 'confirmed';
    if (!customer.specs) {
      customer.specs = [...specOptions];
    }
    if (!customer.accounts) {
      customer.accounts = [];
    }
    if (!customer.calculators) {
      if (customer.calculator) {
        const calc = customer.calculator;
        calc.id = calc.id || uid();
        calc.name = calc.name || 'حاسبة 1';
        calc.createdAt = calc.createdAt || todayStr();
        calc.palletName = calc.palletName || '';
        customer.calculators = [calc];
        delete customer.calculator;
      } else {
        customer.calculators = [];
      }
    }
    customer.calculators.forEach(calc => {
      if (!calc.createdAt) calc.createdAt = todayStr();
      if (calc.palletName === undefined) calc.palletName = '';
      if (!calc.type) calc.type = 'pallet';
      if (!calc.dims) calc.dims = ['', '', ''];
      if (!calc.costs) calc.costs = {};
      (calc.rows || []).forEach(r => { if (r.pricePerM3 === undefined) r.pricePerM3 = calc.pricePerM3 ?? 15000; });
    });
  });
}
