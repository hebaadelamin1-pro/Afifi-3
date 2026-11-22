
// ===================== STATE =====================
let db = null;
let currentCustomerId = null;
let currentCalcId = null;
let currentQuoteEditing = null; // working copy of quote being added/edited
let confirmCallback = null;

const specOptions = ["فرش", "روباط", "شاسيه", "دكم", "عوارض"];

function uid() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

function fmt(n) {
  if (isNaN(n) || n === null || n === undefined) n = 0;
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

// Calculator-specific formatter: always shows exactly 3 decimal digits
function fmt3(n) {
  if (isNaN(n) || n === null || n === undefined) n = 0;
  return n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

