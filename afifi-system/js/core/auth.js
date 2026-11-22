// ===================== AUTH =====================
let currentUser = null;

async function sha256(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function isAdmin() { return !!currentUser && currentUser.role === 'admin'; }

function showApp() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('accountName').textContent = currentUser.username;
  document.getElementById('accountAvatar').textContent = initial(currentUser.username);
  document.getElementById('accountRole').textContent = currentUser.role === 'admin' ? 'مدير عام' : 'مستخدم';
  document.getElementById('accountName').textContent = currentUser.fullName || currentUser.username;
  applyNavAccess();
}

function afterLogin() {
  showApp();
  renderGeneralView();
  renderCustomersList();
  renderQuotesList();
  renderCompanyForm();
  renderUsersList();
  showView('general');
}

async function handleSetupSubmit() {
  const fullName = (document.getElementById('setupFullName').value || '').trim();
  const username = document.getElementById('setupUsername').value.trim();
  const pass = document.getElementById('setupPassword').value;
  const pass2 = document.getElementById('setupPasswordConfirm').value;
  const errEl = document.getElementById('setupError');
  errEl.textContent = '';
  if (!username || !pass) { errEl.textContent = 'من فضلك أدخل اسم المستخدم وكلمة المرور'; return; }
  if (pass !== pass2) { errEl.textContent = 'كلمة المرور غير متطابقة'; return; }
  const passwordHash = await sha256(pass);
  const user = normalizeUser({ id: uid(), fullName: fullName || username, username, passwordHash, role: 'admin', createdAt: todayStr() });
  db.users.push(user);
  await persist();
  currentUser = user;
  afterLogin();
}

async function handleLoginSubmit() {
  const username = document.getElementById('loginUsername').value.trim();
  const pass = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  const user = db.users.find(u => u.username === username);
  const hash = await sha256(pass);
  if (!user || hash !== user.passwordHash) { errEl.textContent = 'اسم المستخدم أو كلمة المرور غير صحيحة'; return; }
  if (user.active === false || user.canLogin === false) { errEl.textContent = 'هذا الحساب موقوف أو غير مسموح له بتسجيل الدخول'; return; }
  currentUser = user;
  afterLogin();
}

document.getElementById('setupSubmitBtn').addEventListener('click', handleSetupSubmit);
document.getElementById('loginSubmitBtn').addEventListener('click', handleLoginSubmit);
['setupPassword', 'setupPasswordConfirm'].forEach(idn => {
  document.getElementById(idn).addEventListener('keydown', e => { if (e.key === 'Enter') handleSetupSubmit(); });
});
document.getElementById('loginPassword').addEventListener('keydown', e => { if (e.key === 'Enter') handleLoginSubmit(); });

document.getElementById('logoutBtn').addEventListener('click', () => {
  currentUser = null;
  applyActionPerms();
  document.getElementById('app').style.display = 'none';
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginError').textContent = '';
  document.getElementById('authSetupForm').style.display = 'none';
  document.getElementById('authLoginForm').style.display = 'block';
  ['setupFullName','setupUsername','setupPassword','setupPasswordConfirm'].forEach(i => document.getElementById(i).value = '');
  const tt = document.getElementById('toast'); if (tt) tt.classList.remove('show');
});
