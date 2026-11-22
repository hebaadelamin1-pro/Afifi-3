// ===================== NAVIGATION =====================
// حالة تبويب العملاء: confirmed (مؤكد) | prospect (محتمل) | all (الكل)
let custTab = 'all';
let custQuery = '';
let currentViewName = 'general';

// مجموعات القائمة الجانبية (الضغط على الأب يُظهر / يُخفي العناصر الفرعية)
const NAV_GROUPS = [
  { id: 'navClients', parent: 'clientsParent', main: 'customers', store: 'sx_grp_clients', def: true,
    views: ['customers', 'customer-detail', 'customer-calc', 'sales'] },
  { id: 'navQuotes', parent: 'quotesParent', main: 'quotes', store: 'sx_grp_quotes', def: true,
    views: ['quotes', 'quote-form', 'quotes-suppliers'] },
  { id: 'navSuppliers', parent: 'suppliersParent', main: 'suppliers', store: 'sx_sub', def: false,
    views: ['suppliers', 'supplier-detail', 'purchases', 'cubic', 'cubic-edit'] }
];
const _LS = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
};
function navGroupOf(view) { return NAV_GROUPS.find(g => g.views.includes(view)); }
function setGroupOpen(g, open, remember) {
  const el = document.getElementById(g.id), par = document.getElementById(g.parent);
  if (!el || !par) return;
  el.classList.toggle('open', !!open);
  par.setAttribute('aria-expanded', !!open);
  if (remember !== false) _LS.set(g.store, open ? '1' : '0');
}
NAV_GROUPS.forEach(g => {
  const v = _LS.get(g.store);
  setGroupOpen(g, v === null ? g.def : v === '1', false);
  const par = document.getElementById(g.parent);
  if (!par) return;
  const toggle = () => {
    const side = document.querySelector('.sidebar');
    let open = !document.getElementById(g.id).classList.contains('open');
    if (side && side.classList.contains('collapsed')) { side.classList.remove('collapsed'); _LS.set('sx_collapsed', '0'); open = true; }
    setGroupOpen(g, open);
    // عند الفتح: لو إحنا مش في صفحة من المجموعة، افتح الصفحة الرئيسية لها
    if (open && navGroupOf(currentViewName) !== g) showView(g.main === 'customers' ? 'customers' : g.main);
  };
  par.addEventListener('click', toggle);
  par.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
});

// أي زر في القائمة يجب تمييزه عند الدخول لصفحة معينة
function navKeyFor(view) {
  if (['customers', 'customer-detail', 'customer-calc', 'sales'].includes(view)) {
    let t = custTab;
    if (view !== 'customers') { const c = (typeof db !== 'undefined' && db) ? db.customers.find(x => x.id === currentCustomerId) : null; t = c ? (c.status || 'confirmed') : 'all'; }
    return t === 'prospect' ? 'clients-prospect' : t === 'confirmed' ? 'clients-confirmed' : null;
  }
  if (view === 'quote-form') return 'quotes';
  if (view === 'cubic-edit') return 'cubic';
  if (view === 'supplier-detail') return null;
  return view;
}
function setNavActive(view) {
  currentViewName = view;
  if (['customer-detail', 'customer-calc', 'sales'].includes(view)) { const c = db && db.customers.find(x => x.id === currentCustomerId); document.body.dataset.cs = c ? (c.status || 'confirmed') : ''; } else document.body.dataset.cs = '';
  const key = navKeyFor(view), g = navGroupOf(view);
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === key));
  NAV_GROUPS.forEach(x => {
    const par = document.getElementById(x.parent);
    if (par) par.classList.toggle('active', x === g && !key);
  });
  if (g) setGroupOpen(g, true, false);
}

function showView(name) {
  if (name === 'clients-confirmed') { custTab = 'confirmed'; name = 'customers'; }
  else if (name === 'clients-prospect') { custTab = 'prospect'; name = 'customers'; }
  if (typeof canAccessView === 'function' && currentUser && !canAccessView(name)) {
    const first = typeof firstAllowedView === 'function' ? firstAllowedView() : null;
    name = first || 'noperm';
  }
  document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
  document.getElementById('view-' + name).style.display = 'block';
  if (name === 'collections') renderCollectionsView();
  if (name === 'customers') renderCustomersList();
  if (name === 'quotes') renderQuotesList();
  if (name === 'quotes-suppliers' && window.renderSupplierQuotes) window.renderSupplierQuotes();
  setNavActive(name);
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.view));
});

// ===================== GENERAL CALCULATOR =====================
function renderGeneralView() {
  if (!db.general) db.general = defaultCalc();
  const root = document.getElementById('generalCalcRoot');
  renderCalculator(root, db.general, persist);
}
