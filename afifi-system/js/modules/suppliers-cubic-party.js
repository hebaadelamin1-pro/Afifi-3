
/* ===================== v6 MODULE: Suppliers · Cubic · Party form · Client tax ===================== */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const E=s=>escapeHtml(s==null?'':String(s));
const save=()=>persist();

/* ---------- exact decimal arithmetic (BigInt) ---------- */
function sc(v,d=6){let s=String(v==null?'':v).trim().replace(/,/g,'');if(!/^-?\d*\.?\d*$/.test(s)||s===''||s==='.'||s==='-')return 0n;
  const neg=s[0]==='-';if(neg)s=s.slice(1);let [i,f='']=s.split('.');const up=f.length>d&&+f[d]>=5;f=(f+'0'.repeat(d)).slice(0,d);
  const b=BigInt((i||'0')+f)+(up?1n:0n);return neg?-b:b;}
function mulDec(vals,out){let p=1n;vals.forEach(v=>p*=sc(v));const sh=6*vals.length-out;
  if(sh<=0)return p*10n**BigInt(-sh);const dv=10n**BigInt(sh);return (p+dv/2n)/dv;}
function rescale(b,from,to){if(from<=to)return b*10n**BigInt(to-from);const dv=10n**BigInt(from-to);return (b+dv/2n)/dv;}
function bstr(b,d,group=true){const neg=b<0n;if(neg)b=-b;const s=b.toString().padStart(d+1,'0');let i=s.slice(0,s.length-d);
  if(group)i=i.replace(/\B(?=(\d{3})+$)/g,',');return (neg?'-':'')+i+(d?'.'+s.slice(-d):'');}
const money=c=>bstr(c,2);               // cents -> text
const m3txt=b=>bstr(rescale(b,18,4),4); // 1e-18 m3 -> 4 decimals (as in Excel)

/* ---------- purchases math ---------- */
function pcalc(r){
  const ov=r.total!==undefined&&r.total!==null&&String(r.total).trim()!=='';
  const hasQP=String(r.qty||'').trim()!==''&&String(r.price||'').trim()!=='';
  const total=ov?mulDec([r.total],2):(hasQP?mulDec([r.qty,r.price],2):0n);
  const paid=mulDec([r.paid||0],2);return {total,paid,due:total-paid};}
function sums(rows){let t=0n,p=0n;rows.forEach(r=>{const c=pcalc(r);t+=c.total;p+=c.paid});return {total:t,paid:p,due:t-p};}

/* ---------- data ---------- */
function ensure(){
  if(!db)return;
  if(!db.suppliers){db.suppliers=SEED.map(s=>({id:uid(),type:'company',name:s.name,phone:'',phones:[],address:'',addresses:[],commercialReg:'',taxId:'',createdAt:todayStr(),
    purchases:s.rows.map(r=>Object.assign({},r,{id:uid()})),cubic:[]}));persist();}
  db.suppliers.forEach(s=>{s.purchases=s.purchases||[];s.cubic=s.cubic||[];s.phones=s.phones||[];s.addresses=s.addresses||[];});
}
const _mig=window.migrateDb;window.migrateDb=function(){_mig();ensure();};

/* ---------- sidebar: collapse + dropdown ---------- */
const side=document.querySelector('.sidebar');
const LS={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
const tg=document.createElement('button');tg.className='side-toggle';tg.id='sideToggle';tg.title='طي / توسيع القائمة';
tg.innerHTML='<svg class="ic" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>';
side.querySelector('.brand').after(tg);
if(LS.get('sx_collapsed')==='1')side.classList.add('collapsed');
tg.onclick=()=>{side.classList.toggle('collapsed');LS.set('sx_collapsed',side.classList.contains('collapsed')?'1':'0');};
/* قائمة الموردين الفرعية (طي/فتح) تُدار من js/core/navigation-general.js */

/* ---------- routing ---------- */
const MY=['suppliers','supplier-detail','purchases','cubic','cubic-edit'];
const _sv=window.showView;
window.showView=function(name){
  if(db)ensure();
  if(!MY.includes(name))return _sv(name);
  if(typeof canAccessView==='function'&&currentUser&&!canAccessView(name))return _sv(name);
  document.querySelectorAll('.view').forEach(v=>v.style.display='none');
  $('view-'+name).style.display='block';
  if(name==='suppliers')renderSuppliers();
  if(name==='purchases')renderPurchasesPage();
  if(name==='cubic')renderCubicPage();
  setNavActive(name);
};

/* ---------- generic mini modal ---------- */
function modal(html,w){const o=document.createElement('div');o.className='modal-overlay';o.style.display='flex';
  o.innerHTML='<div class="modal" style="width:'+(w||480)+'px;max-width:94vw">'+html+'</div>';document.body.appendChild(o);
  o.close=()=>o.remove();return o;}

/* ================= SUPPLIERS LIST ================= */
function renderSuppliers(){
  const root=$('suppliersRoot');
  if(!db.suppliers.length){root.innerHTML='<div class="sx-card sx-empty">لا يوجد موردون بعد — اضغط "+ إضافة مورد جديد"</div>';return;}
  root.innerHTML='<div class="sx-bar"><input id="supQ" placeholder="بحث باسم المورد أو الهاتف..." style="min-width:260px"></div><div class="sx-card sx-wrap"><table class="sx-table"><thead><tr><th>#</th><th>المورد</th><th>النوع</th><th>الهاتف</th><th>الحركات</th><th>إجمالي المشتريات</th><th>المسدد</th><th>المستحق</th><th></th></tr></thead><tbody id="supBody"></tbody></table></div>';
  const draw=()=>{const q=($('supQ').value||'').trim().toLowerCase();
    $('supBody').innerHTML=db.suppliers.filter(s=>!q||(s.name+' '+s.phone).toLowerCase().includes(q)).map((s,i)=>{const t=sums(s.purchases);
      return `<tr><td>${i+1}</td><td><b>${E(s.name)}</b></td><td><span class="sx-chip ${s.type==='company'?'co':''}">${s.type==='company'?'شركة':'فرد'}</span></td><td dir="ltr" style="text-align:right">${E(s.phone||'—')}</td><td>${s.purchases.length}</td><td>${money(t.total)}</td><td class="ok">${money(t.paid)}</td><td class="${t.due>0n?'due':'ok'}">${money(t.due)}</td>
      <td style="white-space:nowrap"><button class="sx-act open" data-o="${s.id}">فتح حساب</button><button class="sx-act" data-q="${s.id}">عرض سعر</button><button class="sx-act" data-e="${s.id}">تعديل</button><button class="sx-act del" data-d="${s.id}">حذف</button></td></tr>`}).join('')||'<tr><td colspan="9" class="sx-empty">لا نتائج</td></tr>';
    $('supBody').querySelectorAll('[data-o]').forEach(b=>b.onclick=()=>openSupplier(b.dataset.o));
    $('supBody').querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>window.openSupplierQuoteForm&&window.openSupplierQuoteForm(null,b.dataset.q));
    $('supBody').querySelectorAll('[data-e]').forEach(b=>b.onclick=()=>openParty('supplier',b.dataset.e));
    $('supBody').querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{const s=db.suppliers.find(x=>x.id===b.dataset.d);
      openConfirm(`حذف المورد "${s.name}" وكل مشترياته وتكعيباته؟`,()=>{db.suppliers=db.suppliers.filter(x=>x.id!==s.id);save();renderSuppliers();});});};
  $('supQ').oninput=draw;draw();
}
$('addSupplierBtn').onclick=()=>openParty('supplier',null);

/* ================= SUPPLIER ACCOUNT / PURCHASES / CUBIC (v7) ================= */
let SX={sid:null,csid:null,ssid:null,ptab:'entry',from:'cubic'};
let PF={q:'',sid:''};let CE=null;
const curSup=()=>db.suppliers.find(s=>s.id===SX.sid);
const sByName=n=>db.suppliers.find(s=>s.name.trim()===String(n||'').trim());
const dl=()=>`<datalist id="supDL">${db.suppliers.map(s=>`<option value="${E(s.name)}">`).join('')}</datalist>`;
const isoD=v=>{v=String(v||'').trim();const m=/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(v);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:v;};
const fd=d=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(d||'');return m?`${+m[3]}/${m[2]}/${m[1]}`:'';};
const later=(()=>{let t;return()=>{clearTimeout(t);t=setTimeout(save,350);};})();
const blankP=()=>({id:uid(),date:todayStr(),item:'',permit:'',qty:'',price:'',total:'',paid:'',payTo:'',notes:''});
const findR=tr=>db.suppliers.find(x=>x.id===tr.dataset.s).purchases.find(x=>x.id===tr.dataset.r);

function openSupplier(id){SX.sid=id;fillDetail();showView('supplier-detail');}
function fillDetail(){const s=curSup();if(!s)return;$('sdName').textContent=s.name;$('sdAvatar').textContent=initial(s.name);
  $('sdSub').textContent=[s.type==='company'?'شركة':'فرد',s.phone,s.address].filter(Boolean).join(' • ');
  const r=$('supplierDetailRoot');
  r.innerHTML='<div id="sdGrid"></div><div class="sx-card" style="padding:16px;margin-top:16px"><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px"><h3 style="margin:0">تكعيبات المورد</h3><button class="primary-btn" id="sdNewCub">+ فتح تكعيب جديد</button></div><div id="sdCubs"></div></div>';
  renderGrid($('sdGrid'),s);cubList($('sdCubs'),s,'supplier-detail');
  $('sdNewCub').onclick=()=>openCubic(s.id,null,'supplier-detail');}
$('backToSuppliersBtn').onclick=()=>showView('suppliers');
$('sdEditBtn').onclick=()=>openParty('supplier',SX.sid);

/* ================= PURCHASES GRID (Excel-style) ================= */
function renderGrid(root,sup){
  const all=!sup;let rows=[];
  (all?db.suppliers:[sup]).forEach(s=>s.purchases.forEach(r=>rows.push({s,r})));
  if(all&&PF.sid)rows=rows.filter(x=>x.s.id===PF.sid);
  if(PF.q){const q=PF.q.toLowerCase();rows=rows.filter(x=>(x.r.item+' '+x.r.permit+' '+x.r.notes+' '+x.r.payTo+' '+x.s.name).toLowerCase().includes(q));}
  if(all)rows.sort((a,b)=>(a.r.date||'9').localeCompare(b.r.date||'9'));
  const head=['التاريخ','اسم المورد','رقم الاذن','اسم الصنف','الوزن الصافي او الامتار','القيمة','الاجمالي','المسدد','المستحق','جهة السداد','ملاحظات',''];
  const num='inputmode="decimal" dir="ltr"';
  const trH=({s,r})=>{const c=pcalc(r);const I=(k,x='')=>`<td><input data-k="${k}" ${x} value="${E(r[k])}"></td>`;
    return `<tr data-s="${s.id}" data-r="${r.id}"><td><input type="date" data-k="date" value="${E(r.date)}"></td><td><input list="supDL" data-k="sup" value="${E(s.name)}"></td>${I('permit')}${I('item')}${I('qty',num)}${I('price',num)}<td><input class="tot" data-k="total" ${num} value="${E(r.total)}" placeholder="${money(c.total)}"></td>${I('paid',num)}<td><input data-k="due" readonly tabindex="-1" class="xd" value="${money(c.due)}"></td>${I('payTo')}${I('notes')}<td><button class="sx-act del" data-del>✕</button></td></tr>`;};
  root.innerHTML=dl()+`<div class="sx-kpis" id="xk"></div><div class="sx-bar">${all?`<input list="supDL" id="pfSup" onfocus="this.select()" placeholder="🔍 اختر المورد (أو اتركه فارغاً لكل الموردين)" value="${E(PF.sid?(db.suppliers.find(s=>s.id===PF.sid)||{}).name:'')}" style="min-width:280px">`:''}<input id="pfQ" placeholder="بحث بالصنف / الإذن / الملاحظات..." value="${E(PF.q)}" style="min-width:230px"><button class="primary-btn" id="pfAdd">+ صف جديد</button></div><div class="sx-card sx-wrap xg-wrap"><table class="sx-table xg"><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(trH).join('')}</tbody></table></div><div class="hint" style="margin-top:8px">اكتب مباشرة في الخانات مثل الإكسل: <b>Enter</b> ينزل للصف التالي (ويضيف صفاً جديداً في آخر الجدول)، ويمكنك لصق صفوف منسوخة من الإكسل. الإجمالي = الوزن × القيمة تلقائياً، ويمكنك كتابته يدوياً للأرصدة المرحّلة.</div>`;
  const kpi=()=>{const t=sums(rows.map(x=>x.r));$('xk').innerHTML=`<div class="sx-kpi"><small>إجمالي المشتريات</small><b>${money(t.total)}</b></div><div class="sx-kpi ok"><small>المسدد</small><b>${money(t.paid)}</b></div><div class="sx-kpi due"><small>المستحق</small><b>${money(t.due)}</b></div>`;};kpi();
  const tb=root.querySelector('tbody');
  const addRow=(after)=>{let s=after?db.suppliers.find(x=>x.id===after.dataset.s):(sup||db.suppliers.find(x=>x.id===PF.sid)||db.suppliers[0]);if(!s)return null;
    const r=blankP();if(after){r.date=findR(after).date||r.date;}s.purchases.push(r);rows.push({s,r});tb.insertAdjacentHTML('beforeend',trH({s,r}));save();return tb.lastElementChild;};
  const upd=tr=>{const c=pcalc(findR(tr));tr.querySelector('.tot').placeholder=money(c.total);tr.querySelector('[data-k="due"]').value=money(c.due);kpi();};
  root.oninput=e=>{const i=e.target,tr=i.closest('tr');if(!tr||!i.dataset.k||i.dataset.k==='sup'||i.dataset.k==='due')return;findR(tr)[i.dataset.k]=i.value;upd(tr);later();};
  root.onchange=e=>{const i=e.target;
    if(i.id==='pfSup'){const n=sByName(i.value);PF.sid=n?n.id:'';renderGrid(root,sup);return;}
    if(i.id==='pfQ'){PF.q=i.value.trim();renderGrid(root,sup);return;}
    if(i.dataset.k!=='sup')return;const tr=i.closest('tr');const os=db.suppliers.find(x=>x.id===tr.dataset.s);let ns=sByName(i.value);
    if(!ns){const nm=i.value.trim();if(!nm||!confirm('المورد "'+nm+'" غير موجود. إضافته كمورد جديد؟')){i.value=os.name;return;}
      ns={id:uid(),type:'company',name:nm,phone:'',phones:[],address:'',addresses:[],commercialReg:'',taxId:'',createdAt:todayStr(),purchases:[],cubic:[]};db.suppliers.push(ns);}
    if(os===ns)return;const r=findR(tr);os.purchases=os.purchases.filter(x=>x!==r);ns.purchases.push(r);tr.dataset.s=ns.id;save();};
  root.onkeydown=e=>{if(e.key!=='Enter'||e.target.tagName!=='INPUT'||!e.target.dataset.k)return;const i=e.target,tr=i.closest('tr');e.preventDefault();
    let nx=tr.nextElementSibling||addRow(tr);const n=nx&&nx.querySelector(`[data-k="${i.dataset.k}"]`);if(n){n.focus();n.select&&n.select();}};
  root.onpaste=e=>{const i=e.target,tr=i.closest&&i.closest('tr');const t=(e.clipboardData||window.clipboardData).getData('text');if(!tr||!i.dataset.k||!/[\t\n]/.test(t.trim()))return;e.preventDefault();
    const keys=[...tr.querySelectorAll('input[data-k]')].map(x=>x.dataset.k);const ci=keys.indexOf(i.dataset.k);let cur=tr;
    t.replace(/\r/g,'').replace(/\n+$/,'').split('\n').forEach((ln,li)=>{if(li>0)cur=cur.nextElementSibling||addRow(cur);
      ln.split('\t').forEach((v,k)=>{const key=keys[ci+k];if(!key||key==='due')return;const inp=cur.querySelector(`[data-k="${key}"]`);v=v.trim();if(key==='date')v=isoD(v);inp.value=v;inp.dispatchEvent(new Event(key==='sup'?'change':'input',{bubbles:true}));});});};
  root.onclick=e=>{const t=e.target;
    if(t.id==='pfAdd'){const n=addRow(tb.lastElementChild);if(n){n.scrollIntoView({block:'center'});n.querySelector('[data-k="date"]').focus();}else alert('أضف مورداً أولاً');return;}
    if(t.dataset.del!==undefined){const tr=t.closest('tr');openConfirm('حذف هذا الصف؟',()=>{const s=db.suppliers.find(x=>x.id===tr.dataset.s),r=findR(tr);s.purchases=s.purchases.filter(x=>x!==r);rows=rows.filter(x=>x.r!==r);tr.remove();save();kpi();});}};
}

/* ================= PURCHASES PAGE: entry + statement ================= */
function renderPurchasesPage(){const r=$('purchasesRoot');
  r.innerHTML=`<div class="sx-tabs"><button data-pt="entry" class="${SX.ptab==='entry'?'on':''}">تسجيل المشتريات</button><button data-pt="stmt" class="${SX.ptab==='stmt'?'on':''}">كشف حساب مورد</button></div><div id="pgBody"></div>`;
  r.querySelectorAll('[data-pt]').forEach(b=>b.onclick=()=>{SX.ptab=b.dataset.pt;renderPurchasesPage();});
  SX.ptab==='entry'?renderGrid($('pgBody'),null):renderStmt($('pgBody'));}
function stmtRows(s){const m=new Map();s.purchases.forEach(r=>{const c=pcalc(r),k=(r.date||'')+'|'+(r.item||'').trim();const o=m.get(k)||{date:r.date||'',item:(r.item||'').trim(),t:0n,p:0n};o.t+=c.total;o.p+=c.paid;m.set(k,o);});
  return [...m.values()].sort((a,b)=>(a.date||'9').localeCompare(b.date||'9'));}
function renderStmt(root){const s=db.suppliers.find(x=>x.id===SX.ssid);let run=0n,T=0n,P=0n;
  const body=s?stmtRows(s).map(o=>{run+=o.t-o.p;T+=o.t;P+=o.p;return `<tr><td>${fd(o.date)}</td><td>${E(o.item)}</td><td>${money(o.t)}</td><td class="ok">${o.p?money(o.p):''}</td><td class="${o.t-o.p>0n?'due':'ok'}">${money(o.t-o.p)}</td><td><b>${money(run)}</b></td></tr>`;}).join(''):'';
  root.innerHTML=dl()+`<div class="sx-bar"><input list="supDL" id="stPick" onfocus="this.select()" placeholder="🔍 اختر المورد لعرض كشف الحساب..." value="${s?E(s.name):''}" style="min-width:300px">${s?'<button class="primary-btn" id="stGo">🖨 طباعة / PDF / Excel</button>':''}</div>`+
  (s?`<div class="sx-kpis"><div class="sx-kpi"><small>إجمالي المشتريات</small><b>${money(T)}</b></div><div class="sx-kpi ok"><small>المسدد</small><b>${money(P)}</b></div><div class="sx-kpi due"><small>المستحق (الرصيد)</small><b>${money(T-P)}</b></div></div><div class="sx-card sx-wrap xg-wrap"><table class="sx-table"><thead><tr><th>التاريخ</th><th>اسم الصنف</th><th>الإجمالي</th><th>المسدد</th><th>المستحق</th><th>الرصيد التراكمي</th></tr></thead><tbody>${body}</tbody><tfoot><tr><td colspan="2">الإجمالي</td><td>${money(T)}</td><td>${money(P)}</td><td>${money(T-P)}</td><td></td></tr></tfoot></table></div>`:'<div class="sx-card sx-empty">اختر مورداً من الخانة بالأعلى ليظهر كشف حسابه كما في الإكسل</div>');
  $('stPick').onchange=e=>{const n=sByName(e.target.value);SX.ssid=n?n.id:null;renderStmt(root);};
  if(s)$('stGo').onclick=()=>window.openSupplierStatement(s.id);}

/* ================= WOOD CUBIC ================= */
// م³ = عدد × تخانة(مم) × عرض(مم) × طول(سم) ÷ 100,000,000  (نفس معادلة الإكسل)
const M12=r=>(mulDec([r.n,r.t,r.w,r.l],12)+50000000n)/100000000n;
const mtxt=b=>bstr(rescale(b,12,4),4);
const bTot=b=>b.rows.reduce((a,r)=>a+M12(r),0n);
const bVal=b=>(bTot(b)*sc(b.price)+5000000000000000n)/10000000000000000n;
const cT=c=>{let m=0n,v=0n;c.bundles.forEach(b=>{m+=bTot(b);v+=bVal(b);});return {m,v,n:c.bundles.length};};
const newB=()=>({id:uid(),doc:'',date:todayStr(),price:'',permit:'',rows:[{n:'',t:'',w:'',l:''},{n:'',t:'',w:'',l:''}]});
function cubList(root,s,from){
  const L=(s.cubic||[]).filter(c=>c.bundles).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  root.innerHTML=L.length?`<div class="sx-wrap"><table class="sx-table"><thead><tr><th>التاريخ</th><th>مسؤول الشحن</th><th>السائق</th><th>رقم العربية</th><th>الربطات</th><th>إجمالي م³</th><th>القيمة</th><th></th></tr></thead><tbody>${L.map(c=>{const T=cT(c);return `<tr data-c="${c.id}"><td>${fd(c.date)}</td><td>${E(c.boss)}</td><td>${E(c.driver)}</td><td>${E(c.plate)}</td><td>${T.n}</td><td dir="ltr">${mtxt(T.m)}</td><td>${money(T.v)}</td><td style="white-space:nowrap"><button class="sx-act" data-op>فتح</button><button class="sx-act" data-pr>طباعة</button><button class="sx-act" data-xl>Excel</button><button class="sx-act del" data-dc>حذف</button></td></tr>`;}).join('')}</tbody></table></div>`:'<div class="sx-empty">لا توجد تكعيبات محفوظة لهذا المورد بعد</div>';
  root.onclick=e=>{const t=e.target,tr=t.closest('tr');if(!tr)return;const c=s.cubic.find(x=>x.id===tr.dataset.c);
    if(t.dataset.op!==undefined)openCubic(s.id,c.id,from);else if(t.dataset.pr!==undefined)printDoc(cubHtml(s,c));else if(t.dataset.xl!==undefined)xlsDoc(cubHtml(s,c),'تكعيب - '+s.name);
    else if(t.dataset.dc!==undefined)openConfirm('حذف هذا التكعيب نهائياً؟',()=>{s.cubic=s.cubic.filter(x=>x.id!==c.id);save();cubList(root,s,from);});};}
function renderCubicPage(){const r=$('cubicRoot');if(!db.suppliers.length){r.innerHTML='<div class="sx-card sx-empty">أضف مورداً أولاً</div>';return;}
  let s=db.suppliers.find(x=>x.id===SX.csid);if(!s){s=db.suppliers[0];SX.csid=s.id;}
  r.innerHTML=dl()+`<div class="sx-bar"><input list="supDL" id="cbPick" onfocus="this.select()" placeholder="🔍 ابحث عن المورد..." value="${E(s.name)}" style="min-width:300px"><button class="primary-btn" id="cbNew">+ تكعيب جديد</button></div><div class="sx-card" style="padding:16px"><h3 style="margin:0 0 12px">تكعيبات ${E(s.name)}</h3><div id="cbList"></div></div>`;
  cubList($('cbList'),s,'cubic');
  $('cbPick').onchange=e=>{const n=sByName(e.target.value);if(n){SX.csid=n.id;renderCubicPage();}};
  $('cbNew').onclick=()=>openCubic(s.id,null,'cubic');}
function openCubic(sid,cid,from){const s=db.suppliers.find(x=>x.id===sid);const ex=cid&&s.cubic.find(c=>c.id===cid);SX.from=from||'cubic';
  CE={s,isNew:!ex,c:JSON.parse(JSON.stringify(ex||{id:uid(),date:todayStr(),boss:'',driver:'',plate:'',phone:'',bundles:[newB()]}))};showView('cubic-edit');drawCE();}
function drawCE(){const {s,c}=CE,r=$('cubicEditRoot');const num='type="number" step="any" inputmode="decimal"';
  const F=(k,l,t='text')=>`<div class="modal-field"><label>${l}</label><input type="${t}" data-cf="${k}" value="${E(c[k])}"></div>`;
  r.innerHTML=`<div class="sx-card" style="padding:16px;margin-bottom:14px"><h3 style="margin:0 0 10px">تكعيب — ${E(s.name)}</h3><div class="ce-grid">${F('date','التاريخ','date')}${F('boss','مسؤول الشحن')}${F('driver','اسم السائق')}${F('plate','رقم العربية')}${F('phone','رقم تليفون السائق')}</div></div>
  <div class="sx-kpis"><div class="sx-kpi"><small>عدد الربطات</small><b id="ceN"></b></div><div class="sx-kpi ok"><small>إجمالي التكعيب</small><b id="ceG" dir="ltr"></b></div><div class="sx-kpi"><small>إجمالي القيمة</small><b id="ceV"></b></div></div>
  ${c.bundles.map((b,bi)=>`<div class="cb-card" data-b="${b.id}"><div class="cb-head"><b>ربطة #${bi+1}</b><input class="sx-in" data-bf="doc" placeholder="رقم الاستند" value="${E(b.doc)}"><input class="sx-in" data-bf="permit" placeholder="رقم إذن الاستلام" value="${E(b.permit)}"><input type="date" class="sx-in" data-bf="date" value="${E(b.date)}"><input class="sx-in" data-bf="price" ${num} placeholder="السعر" value="${E(b.price)}" style="width:110px"><span style="flex:1"></span><button class="sx-act del" data-delb>حذف الربطة</button></div>
  <div class="sx-wrap"><table class="cb-table"><thead><tr><th>عدد</th><th>تخانة (مم)</th><th>عرض (مم)</th><th>طول (سم)</th><th>م³</th><th></th></tr></thead><tbody>${b.rows.map((x,ri)=>`<tr data-r="${ri}">${['n','t','w','l'].map(k=>`<td><input ${num} data-rf="${k}" value="${E(x[k])}"></td>`).join('')}<td class="m3" dir="ltr">${mtxt(M12(x))}</td><td><button class="sx-act del" data-delr>✕</button></td></tr>`).join('')}</tbody></table></div>
  <div style="margin:8px 0"><button class="pm-add" data-addr>+ إضافة صف</button></div><div class="cb-total"><span>اجمالي تكعيب الربطة${b.price?' • القيمة: '+money(bVal(b)):''}</span><span dir="ltr">${mtxt(bTot(b))} م³</span></div></div>`).join('')}
  <div class="sx-bar"><button class="secondary-btn" id="ceAddB">+ ربطة جديدة</button><span style="flex:1"></span><button class="secondary-btn" id="cePr">🖨 طباعة</button><button class="secondary-btn" id="ceXl">Excel</button><button class="primary-btn" id="ceSave">💾 حفظ</button></div>`;
  const tot=()=>{const T=cT(c);$('ceN').textContent=T.n;$('ceG').textContent=mtxt(T.m)+' م³';$('ceV').textContent=money(T.v);};tot();
  const bOf=el=>c.bundles.find(x=>x.id===el.closest('.cb-card').dataset.b);
  r.oninput=e=>{const i=e.target;
    if(i.dataset.cf){c[i.dataset.cf]=i.value;return;}
    if(i.dataset.bf){bOf(i)[i.dataset.bf]=i.value;if(i.dataset.bf==='price')tot();return;}
    if(i.dataset.rf){const b=bOf(i),tr=i.closest('tr');b.rows[+tr.dataset.r][i.dataset.rf]=i.value;tr.querySelector('.m3').textContent=mtxt(M12(b.rows[+tr.dataset.r]));
      i.closest('.cb-card').querySelector('.cb-total span:last-child').textContent=mtxt(bTot(b))+' م³';tot();}};
  r.onkeydown=e=>{const i=e.target;if(e.key!=='Enter'||!i.dataset.rf)return;e.preventDefault();const b=bOf(i),ri=+i.closest('tr').dataset.r,bi=c.bundles.indexOf(b);
    if(ri===b.rows.length-1){b.rows.push({n:'',t:'',w:'',l:''});drawCE();}
    const n=$('cubicEditRoot').querySelectorAll('.cb-card')[bi].querySelectorAll('tbody tr')[ri+1];const f=n&&n.querySelector(`[data-rf="${i.dataset.rf}"]`);if(f)f.focus();};
  r.onclick=e=>{const t=e.target;
    if(t.id==='ceAddB'){c.bundles.push(newB());drawCE();return;}
    if(t.id==='ceSave'){const i=s.cubic.findIndex(x=>x.id===c.id);if(i>=0)s.cubic[i]=c;else s.cubic.push(c);CE.isNew=false;save();showToast('تم حفظ التكعيب');return;}
    if(t.id==='cePr'){printDoc(cubHtml(s,c));return;}
    if(t.id==='ceXl'){xlsDoc(cubHtml(s,c),'تكعيب - '+s.name);return;}
    const card=t.closest('.cb-card');if(!card)return;const b=bOf(t);
    if(t.dataset.addr!==undefined){b.rows.push({n:'',t:'',w:'',l:''});drawCE();}
    else if(t.dataset.delr!==undefined){b.rows.splice(+t.closest('tr').dataset.r,1);if(!b.rows.length)b.rows.push({n:'',t:'',w:'',l:''});drawCE();}
    else if(t.dataset.delb!==undefined)openConfirm('حذف هذه الربطة؟',()=>{c.bundles=c.bundles.filter(x=>x!==b);if(!c.bundles.length)c.bundles.push(newB());drawCE();});};}
$('ceBack').onclick=()=>{if(SX.from==='supplier-detail'){fillDetail();showView('supplier-detail');}else showView('cubic');};
function cubHtml(s,c){const T=cT(c);const th='style="border:1px solid #999;padding:5px 8px;background:#e8f0fb"',td='style="border:1px solid #999;padding:5px 8px;text-align:center"';
  return `<html dir="rtl"><head><meta charset="utf-8"><title>تكعيب ${E(s.name)}</title><style>body{font-family:Cairo,Tahoma,Arial,sans-serif;padding:18px;color:#111}table{border-collapse:collapse;margin:8px 0 14px;min-width:60%}@page{size:A4;margin:12mm}</style></head><body><h2>تكعيب خشب — ${E(s.name)}</h2>
  <table><tr><td ${th}>التاريخ</td><td ${td}>${fd(c.date)}</td><td ${th}>مسؤول الشحن</td><td ${td}>${E(c.boss)}</td><td ${th}>اسم السائق</td><td ${td}>${E(c.driver)}</td></tr><tr><td ${th}>رقم العربية</td><td ${td}>${E(c.plate)}</td><td ${th}>تليفون السائق</td><td ${td}>${E(c.phone)}</td><td ${th}>عدد الربطات</td><td ${td}>${T.n}</td></tr></table>
  ${c.bundles.map((b,i)=>`<h4>ربطة #${i+1} — استند: ${E(b.doc)} — إذن الاستلام: ${E(b.permit)} — التاريخ: ${fd(b.date)}${b.price?' — السعر: '+E(b.price):''}</h4><table><tr><th ${th}>عدد</th><th ${th}>تخانة (مم)</th><th ${th}>عرض (مم)</th><th ${th}>طول (سم)</th><th ${th}>م³</th></tr>${b.rows.filter(x=>x.n||x.t||x.w||x.l).map(x=>`<tr><td ${td}>${E(x.n)}</td><td ${td}>${E(x.t)}</td><td ${td}>${E(x.w)}</td><td ${td}>${E(x.l)}</td><td ${td}>${mtxt(M12(x))}</td></tr>`).join('')}<tr><td ${th} colspan="4">إجمالي الربطة${b.price?' (القيمة '+money(bVal(b))+')':''}</td><td ${th}>${mtxt(bTot(b))}</td></tr></table>`).join('')}
  <h3>إجمالي التكعيب: ${mtxt(T.m)} م³ ${T.v?' — إجمالي القيمة: '+money(T.v):''}</h3></body></html>`;}
function printDoc(html){const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-9999px;width:210mm;height:297mm;border:0';document.body.appendChild(f);
  f.contentDocument.open();f.contentDocument.write(html);f.contentDocument.close();setTimeout(()=>{f.contentWindow.focus();f.contentWindow.print();setTimeout(()=>f.remove(),1500);},300);}
function xlsDoc(html,name){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+html],{type:'application/vnd.ms-excel'}));a.download=name+'.xls';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},800);}

/* ================= UNIFIED PARTY FORM (client / supplier) ================= */
function openParty(kind,id){
  ensure();
  const list=kind==='client'?db.customers:db.suppliers;const ex=id?list.find(x=>x.id===id):null;
  const S={type:ex?.type||'individual',phones:(ex?.phones||[]).map(p=>({...p})),addrs:(ex?.addresses||[]).slice()};
  const cl=kind==='client',lbl=cl?'العميل':'المورد';
  const m=modal(`<h2>${id?'تعديل بيانات':'إضافة'} ${lbl}</h2>
  <div class="modal-field"><label>نوع ${lbl}</label><div class="seg"><label><input type="radio" name="ptype" value="individual">فرد</label><label><input type="radio" name="ptype" value="company">شركة</label></div></div>
  ${cl?`<div class="modal-field"><label>حالة العميل</label><div class="seg"><label><input type="radio" name="pstatus" value="confirmed">عميل الشركة (مؤكد)</label><label><input type="radio" name="pstatus" value="prospect">عميل محتمل</label></div></div>`:''}
  <div class="modal-field"><label id="lName"></label><input type="text" id="pName"></div>
  <div id="coBox" class="pm-sec"><div class="modal-grid2"><div class="modal-field"><label>السجل التجاري</label><input id="pReg"></div><div class="modal-field"><label>البطاقة الضريبية</label><input id="pTax"></div></div></div>
  <div class="modal-field"><label>رقم الهاتف الرئيسي <span style="color:var(--m-due)">*</span></label><input id="pPhone" type="tel" dir="ltr" style="text-align:right"></div>
  <div id="phBox"></div><button class="pm-add" id="phAdd">+ إضافة رقم هاتف آخر</button>
  <div class="modal-field"><label id="lAddr"></label><input id="pAddr"></div>
  <div id="adBox"></div><button class="pm-add" id="adAdd">+ إضافة عنوان ثانوي</button>

  <div class="modal-actions"><button class="secondary-btn" id="px">إلغاء</button><button class="primary-btn" id="ps">حفظ</button></div>`,540);
  const q=s=>m.querySelector(s);
  const drawPh=()=>{q('#phBox').innerHTML=S.phones.map((p,i)=>`<div class="pm-extra"><input type="tel" dir="ltr" placeholder="رقم الهاتف" data-pi="${i}" data-f="phone" value="${E(p.phone)}"><input placeholder="الاسم / الوظيفة / الدور في التوريد" data-pi="${i}" data-f="who" value="${E(p.who)}"><button class="pm-x" data-pdel="${i}">✕</button></div>`).join('');};
  const drawAd=()=>{q('#adBox').innerHTML=S.addrs.map((a,i)=>`<div class="pm-addr"><input placeholder="عنوان ثانوي (فرع / مخزن...)" data-ai="${i}" value="${E(a)}"><button class="pm-x" data-adel="${i}">✕</button></div>`).join('');};
  const apply=()=>{const co=S.type==='company';q('#coBox').style.display=co?'':'none';q('#adAdd').style.display=co?'':'none';q('#adBox').style.display=co?'':'none';
    q('#lName').textContent=co?'الاسم التجاري للشركة':'الاسم';q('#lAddr').textContent=co?'العنوان الرئيسي':'العنوان (اختياري)';};
  const curSt=ex?(ex.status||'confirmed'):(typeof custTab!=='undefined'&&custTab==='prospect'?'prospect':'confirmed');
  m.querySelectorAll('[name=pstatus]').forEach(r=>{r.checked=r.value===curSt;});
  m.querySelectorAll('[name=ptype]').forEach(r=>{r.checked=r.value===S.type;r.onchange=()=>{S.type=r.value;apply();};});
  q('#pName').value=ex?.name||'';q('#pReg').value=ex?.commercialReg||'';q('#pTax').value=ex?.taxId||'';q('#pPhone').value=ex?.phone||'';q('#pAddr').value=ex?.address||'';

  drawPh();drawAd();apply();
  q('#phAdd').onclick=()=>{S.phones.push({phone:'',who:''});drawPh();};
  q('#adAdd').onclick=()=>{S.addrs.push('');drawAd();};
  m.addEventListener('input',e=>{const t=e.target;if(t.dataset.pi!==undefined)S.phones[+t.dataset.pi][t.dataset.f]=t.value;if(t.dataset.ai!==undefined)S.addrs[+t.dataset.ai]=t.value;});
  m.addEventListener('click',e=>{const t=e.target;if(t.dataset.pdel!==undefined){S.phones.splice(+t.dataset.pdel,1);drawPh();}if(t.dataset.adel!==undefined){S.addrs.splice(+t.dataset.adel,1);drawAd();}});
  q('#px').onclick=m.close;
  q('#ps').onclick=()=>{const name=q('#pName').value.trim(),phone=q('#pPhone').value.trim();
    if(!name){alert(S.type==='company'?'أدخل الاسم التجاري':'أدخل الاسم');return;}
    if(!phone){alert('رقم الهاتف الرئيسي مطلوب');return;}
    const co=S.type==='company';
    const stEl=m.querySelector('[name=pstatus]:checked');
    const data={type:S.type,name,phone,phones:S.phones.filter(p=>p.phone.trim()).map(p=>({phone:p.phone.trim(),who:(p.who||'').trim()})),address:q('#pAddr').value.trim(),
      addresses:co?S.addrs.map(a=>a.trim()).filter(Boolean):[],commercialReg:co?q('#pReg').value.trim():'',taxId:co?q('#pTax').value.trim():'',...(cl?{status:stEl?stEl.value:'confirmed'}:{})};
    if(ex)Object.assign(ex,data);
    else if(cl)db.customers.push(Object.assign({id:uid(),createdAt:todayStr(),specs:[...specOptions],accounts:[],calculators:[newCalc('حاسبة 1')]},data));
    else db.suppliers.push(Object.assign({id:uid(),createdAt:todayStr(),purchases:[],cubic:[]},data));
    save();m.close();
    if(cl){renderCustomersList();if($('view-customer-detail').style.display!=='none'&&ex&&currentCustomerId===ex.id)openCustomerDetail(ex.id);if($('view-collections').style.display!=='none')renderCollectionsView();}
    else{if($('view-supplier-detail').style.display!=='none')fillDetail();else renderSuppliers();}
  };
}
window.openCustomerModal=id=>openParty('client',id);

/* ================= CLIENT TAX (clients only) ================= */
window.ledgerOf=function(c){
  const sorted=(c.accounts||[]).slice().sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  const subs=sorted.map(o=>Number(mulDec([o.totalAmount||0],2)));      // cents
  const subTotal=subs.reduce((a,b)=>a+b,0);
  const taxes=sorted.map((o,i)=>{if(!o.taxEnabled||!(+o.taxValue>0))return 0;
    return o.taxType==='fixed'?Number(mulDec([o.taxValue],2)):Number((BigInt(subs[i])*sc(o.taxValue)+50000000n)/100000000n);});
  const poolTotal=(c.payments||[]).reduce((s,p)=>s+(parseFloat(p.amount)||0),0);
  let pool=poolTotal,required=0,paidOwn=0,tax=0;
  const rows=sorted.map((o,i)=>{const sub=subs[i]/100,tx=taxes[i]/100,total=sub+tx,own=orderPaid(o);
    const alloc=Math.min(Math.max(0,total-own),pool);pool-=alloc;required+=total;paidOwn+=own;tax+=tx;
    return {o,sub,tax:tx,total,own,alloc,paid:own+alloc,remaining:total-own-alloc};});
  const paid=paidOwn+poolTotal;
  return {rows,required,paid,remaining:required-paid,credit:pool,paidOwn,paidAcct:poolTotal,subtotal:subTotal/100,tax,taxEnabled:tax>0.005};
};
function finRows(sub,tax,total,paid,rem,showTax){const n=x=>fmt(Math.round(x*100)/100);
  const top=showTax?`<div class="fin-row"><span>الإجمالي الأساسي</span><b class="num">${n(sub)} ج.م</b></div><div class="fin-row tax"><span>قيمة الضريبة</span><b class="num">${n(tax)} ج.م</b></div><div class="fin-row"><span>الإجمالي بعد الضريبة</span><b class="num">${n(total)} ج.م</b></div>`:`<div class="fin-row"><span>الإجمالي</span><b class="num">${n(total)} ج.م</b></div>`;
  return top+`<div class="fin-row paid"><span>المدفوع</span><b class="num">${n(paid)} ج.م</b></div><div class="fin-row rem"><span>المتبقي</span><b class="num">${n(rem)} ج.م</b></div>`;}
const _rca=window.renderCustomerAccounts;
window.renderCustomerAccounts=function(c){_rca(c);const L=ledgerOf(c);const d=document.createElement('div');d.className='fin-card';d.style.marginTop='16px';
  d.innerHTML='<h3>الملخص المالي</h3>'+finRows(L.subtotal,L.tax,L.required,L.paid,L.remaining,L.taxEnabled);$('customerAccountsRoot').appendChild(d);};
window.updatePaymentInfo=function(){
  const box=$('paymentInfo'),c=payCtx.customer;
  if(!c){box.innerHTML='<span style="color:var(--m-mute);font-size:13px;">اختر العميل أولاً</span>';return;}
  const L=ledgerOf(c),id=$('paymentTargetSelect').value,amt=parseFloat($('paymentAmountInput').value)||0;
  let sub=L.subtotal,tax=L.tax,total=L.required,paid=L.paid,rem=L.remaining;
  if(id){const r=L.rows.find(x=>x.o.id===id);if(r){sub=r.sub;tax=r.tax;total=r.total;paid=r.paid;rem=r.remaining;}}
  const after=rem-amt;
  box.style.display='block';
  box.innerHTML='<div class="fin-box">'+finRows(sub,tax,total,paid,rem,tax>0.005)+`<div class="fin-row" style="border-top:2px solid var(--m-line);margin-top:4px"><span>المتبقي بعد هذه الدفعة</span><b class="num" style="color:${after<-0.005?'var(--m-blue)':'var(--m-ok)'}">${fmt(Math.round(after*100)/100)} ج.م</b></div></div>`;
};
})();
