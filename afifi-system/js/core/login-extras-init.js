// ===================== LOGIN UI EXTRAS =====================
document.querySelectorAll('.pw-toggle').forEach(b => b.addEventListener('click', () => {
  const inp = document.getElementById(b.dataset.target);
  inp.type = inp.type === 'password' ? 'text' : 'password';
}));
document.getElementById('loginUsername').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('loginPassword').focus(); });
document.getElementById('setupUsername').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('setupPassword').focus(); });

// ===================== INIT =====================
async function init() {
  document.getElementById('authScreen').style.display = 'flex';

  db = await window.api.loadData();
  if (!db.general) db.general = defaultCalc();
  if (!db.users) db.users = [];
  migrateDb();
  updateFavicon(); updateBranding();

  if (db.users.length === 0) {
    document.getElementById('authSetupForm').style.display = 'block';
    document.getElementById('authLoginForm').style.display = 'none';
  } else {
    document.getElementById('authSetupForm').style.display = 'none';
    document.getElementById('authLoginForm').style.display = 'block';
  }
}

init();

