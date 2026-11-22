// ===================== MODERN UI HELPERS =====================
const IC = {
  wallet: '<svg class="ic" viewBox="0 0 24 24"><path d="M20 12V8H6a2 2 0 0 1 0-4h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>',
  coins: '<svg class="ic" viewBox="0 0 24 24"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4M16.71 13.88l.7.71-2.82 2.82"/></svg>',
  alert: '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>',
  check: '<svg class="ic" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>',
  search: '<svg class="ic" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>',
  plus: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  printer: '<svg class="ic" viewBox="0 0 24 24"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
  file: '<svg class="ic" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>',
  users: '<svg class="ic" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>'
};
const DEFAULT_FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230B2A5B'/%3E%3Ctext x='32' y='45' font-size='38' text-anchor='middle' fill='white' font-family='Arial' font-weight='700'%3E%D8%B9%3C/text%3E%3C/svg%3E";

function initial(name) { return ([...String(name || '').trim()][0]) || '؟'; }
function orderPaid(o) { return (o.payments || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0); }

// Customer ledger: order-level payments + account-level payments (allocated oldest-first, for display)
function ledgerOf(c) {
  const sorted = (c.accounts || []).slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const poolTotal = (c.payments || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  let pool = poolTotal, required = 0, paidOwn = 0;
  const rows = sorted.map(o => {
    const total = parseFloat(o.totalAmount) || 0;
    const own = orderPaid(o);
    const alloc = Math.min(Math.max(0, total - own), pool);
    pool -= alloc; required += total; paidOwn += own;
    return { o, total, own, alloc, paid: own + alloc, remaining: total - own - alloc };
  });
  const paid = paidOwn + poolTotal;
  return { rows, required, paid, remaining: required - paid, credit: pool, paidOwn, paidAcct: poolTotal };
}

let toastT = null;
function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.innerHTML = IC.check + '<span></span>';
  t.querySelector('span').textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 3400);
}

function resizeImageFile(file, maxSide, cb) {
  const r = new FileReader();
  r.onload = () => {
    const img = new Image();
    img.onload = () => {
      try {
        const k = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        cb(cv.toDataURL('image/png'));
      } catch (e) { cb(r.result); }
    };
    img.onerror = () => cb(r.result);
    img.src = r.result;
  };
  r.readAsDataURL(file);
}

// Favicon follows the company logo automatically
function setFavicon(href) {
  document.querySelectorAll('link[rel="icon"],link[rel="shortcut icon"],link[rel="apple-touch-icon"]').forEach(l => l.remove());
  ['icon', 'apple-touch-icon'].forEach(rel => {
    const l = document.createElement('link');
    l.rel = rel;
    const m = /^data:([^;,]+)/.exec(href); if (m && rel === 'icon') l.type = m[1];
    if (rel === 'icon') l.sizes = 'any';
    l.href = href;
    document.head.appendChild(l);
  });
}
function updateFavicon() {
  const logo = db && db.company && db.company.logo;
  if (!logo) { setFavicon(DEFAULT_FAVICON); return; }
  const img = new Image();
  img.onload = () => {
    try {
      const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S;
      const x = cv.getContext('2d');
      const k = Math.min(S / img.width, S / img.height), w = img.width * k, h = img.height * k;
      x.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
      setFavicon(cv.toDataURL('image/png'));
    } catch (e) { setFavicon(logo); }
  };
  img.onerror = () => setFavicon(logo);
  img.src = logo;
}
function updateBranding() {
  const logo = db && db.company && db.company.logo;
  ['sideBrandMark', 'authMobileMark', 'authPanelMark'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    if (logo) { el.classList.add('has-logo'); el.innerHTML = '<img alt="" src="' + logo + '">'; }
    else { el.classList.remove('has-logo'); el.textContent = 'ع'; }
  });
}

function defaultCalc() {
  return {
    id: uid(),
    name: '',
    palletName: '',
    createdAt: todayStr(),
    pricePerM3: 15000,
    profitPct: 10,
    quantity: 1,
    palletLength: '',
    palletWidth: '',
    rows: Array.from({ length: 10 }, () => ({ _id: uid(), spec: '', count: '', thickness: '', width: '', length: '', pricePerM3: 15000 })),
    costs: { 'مصانعية': 0, 'مسمار': 0, 'اكرامية': 0, 'نقل': 0, 'تبخير': 0, 'خسارة': 0 },
    type: 'pallet',
    dims: ['', '', ''],
    images: []
  };
}

function newCalc(name) {
  const c = defaultCalc();
  c.name = name;
  return c;
}

function defaultNotes() {
  return [
    'الأسعار غير شامله ضريبة القيمة المضافة .',
    'السعر شامل النقل والتوصيل .',
    'السعر شامل شهادة الحجر الزراعي (التبخير الحراري) .'
  ];
}

async function persist() {
  try { await window.api.saveData(db); } catch (e) { console.error(e); }
}
