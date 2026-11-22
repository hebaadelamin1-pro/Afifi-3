
/* ===================== v7: calculator tax · statements · print designs · Excel ===================== */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const E=s=>escapeHtml(s==null?'':String(s));
const sc=(v,d=6)=>{let t=String(v==null?'':v).trim();if(!/^-?\d+(\.\d+)?$/.test(t))return 0n;const neg=t[0]==='-';if(neg)t=t.slice(1);let [i,f='']=t.split('.');f=(f+'0'.repeat(d)).slice(0,d);const b=BigInt(i+f);return neg?-b:b;};
const bstr=(b,d)=>{const s=b.toString().padStart(d+1,'0');return s.slice(0,s.length-d)+'.'+s.slice(-d);};
const NS='http://www.w3.org/2000/svg';

/* ---------- 1) Tax box under the deposit section (calculator) ---------- */
function taxOf(calc,fp){const v=parseFloat(calc.taxValue)||0;if(!calc.taxEnabled||v<=0)return 0;return calc.taxType==='fixed'?v:fp*v/100;}
function wireTax(container,calc,onChange){
  const dep=container.querySelector('.deposit-box2');if(!dep||container.querySelector('.tax-box2'))return;
  const d=document.createElement('div');d.className='deposit-box2 tax-box2';
  d.innerHTML=`<div class="dep-head"><svg class="ic" viewBox="0 0 24 24"><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 .7V2l-1 .7-3-2-3 2-3-2-3 2z"/><path d="M9 9h.01M15 15h.01M15 9l-6 6"/></svg><h3>الضريبة (اختياري)</h3></div>
  <label class="check-row"><input type="checkbox" class="tx-on"> إضافة ضريبة على هذا الطلب</label>
  <div class="tx-body" style="display:none;margin-top:10px"><div class="dep-grid"><div class="field"><label>نوع الضريبة</label><select class="tx-type"><option value="percent">نسبة مئوية (%)</option><option value="fixed">مبلغ ثابت (ج.م)</option></select></div><div class="field"><label>قيمة الضريبة</label><input type="number" step="any" min="0" class="tx-val" placeholder="0"></div></div>
  <div class="dep-sum"><div class="dep"><small>الإجمالي الأساسي</small><b class="txSub">0</b></div><div class="dep"><small>قيمة الضريبة</small><b class="txAmt">0</b></div></div>
  <div class="dep-sum" style="margin-top:8px"><div class="dep"><small>الإجمالي بعد الضريبة</small><b class="txTot">0</b></div><div class="rem"><small>المتبقي عند التسليم (بعد الضريبة)</small><b class="txRem">0</b></div></div></div>`;
  dep.after(d);
  const q=x=>d.querySelector(x);
  const upd=()=>{const c=computeCalc(calc),fp=c.finalPrice,t=taxOf(calc,fp),dp=calcDeposit(calc,c);
    q('.txSub').textContent=fmt3(fp)+' ج.م';q('.txAmt').textContent=fmt3(t)+' ج.م';q('.txTot').textContent=fmt3(fp+t)+' ج.م';q('.txRem').textContent=fmt3(fp+t-dp.amount)+' ج.م';};
  q('.tx-on').checked=!!calc.taxEnabled;q('.tx-type').value=calc.taxType||'percent';q('.tx-val').value=calc.taxValue??'';
  const vis=()=>q('.tx-body').style.display=q('.tx-on').checked?'':'none';vis();
  q('.tx-on').onchange=e=>{calc.taxEnabled=e.target.checked;vis();onChange();upd();};
  q('.tx-type').onchange=e=>{calc.taxType=e.target.value;onChange();upd();};
  q('.tx-val').oninput=e=>{calc.taxValue=e.target.value;onChange();upd();};
  d.__upd=upd;upd();
}
const _rc=window.renderCalculator;
window.renderCalculator=function(container,calc,onChange,sl){_rc(container,calc,onChange,sl);wireTax(container,calc,onChange);};
const _rs=window.recomputeSummary;
window.recomputeSummary=function(container,calc){_rs(container,calc);const b=container.querySelector('.tax-box2');if(b&&b.__upd)b.__upd();};
// carry the tax from the calculator to the client's order
$('calcToOrderBtn').addEventListener('click',()=>{
  const cu=db.customers.find(c=>c.id===currentCustomerId);const calc=cu&&cu.calculators.find(c=>c.id===currentCalcId);if(!calc)return;
  const o=(cu.accounts||[]).find(x=>x.calcId===calc.id);if(!o)return;
  o.taxEnabled=!!calc.taxEnabled&&(parseFloat(calc.taxValue)||0)>0;o.taxType=calc.taxType||'percent';o.taxValue=o.taxEnabled?String(calc.taxValue):'';
  persist();if(o.taxEnabled)showToast('تمت إضافة الضريبة للطلب');
});

/* ---------- 2) Statement model ---------- */
const cents=x=>Math.round((parseFloat(x)||0)*100);
const fC=c=>(c/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const fD=d=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(d||'');return m?`${+m[3]}/${m[2]}/${m[1]}`:(d||'');};
function supModel(s){const rows=s.purchases.map(r=>{const c=pcalcX(r);return {date:r.date,desc:[r.item||'—',r.permit?'(إذن '+r.permit+')':'',r.payTo?'— '+r.payTo:''].filter(Boolean).join(' '),qty:r.qty||'',price:r.price||'',total:Number(c.total),paid:Number(c.paid)};});
  return {partyLabel:'اسم المورد',partyName:s.name,rows};}
function pcalcX(r){ // same exact math as the purchases table
  const ov=r.total!==undefined&&r.total!==null&&String(r.total).trim()!=='';const qp=String(r.qty||'').trim()!==''&&String(r.price||'').trim()!=='';
  const total=ov?mulDecX([r.total]):(qp?mulDecX([r.qty,r.price]):0n);return {total,paid:mulDecX([r.paid||0])};}
function mulDecX(v){let p=1n;v.forEach(x=>{let t=String(x).trim().replace(/,/g,'');if(!/^-?\d*\.?\d+$|^-?\d+\.?$/.test(t))t='0';const neg=t[0]==='-';if(neg)t=t.slice(1);let [i,f='']=t.split('.');const up=f.length>6&&+f[6]>=5;f=(f+'000000').slice(0,6);let b=BigInt((i||'0')+f)+(up?1n:0n);p*=neg?-b:b;});
  const sh=6*v.length-2;if(sh<=0)return p;const dv=10n**BigInt(sh);return (p+dv/2n)/dv;}
function cliModel(c){const L=ledgerOf(c);const rows=[];
  const pay=(p)=>({date:p.date,desc:'تحصيل'+(p.method?' ('+p.method+')':'')+(p.note?' — '+p.note:''),qty:'',price:'',total:0,paid:cents(p.amount)});
  L.rows.forEach(r=>{const o=r.o;rows.push({date:o.date,desc:o.description||'طلب شغل',qty:o.quantity||'',price:o.unitPrice||'',total:cents(r.sub),paid:0});
    if(r.tax>0.005)rows.push({date:o.date,desc:'ضريبة — '+(o.description||'طلب'),qty:'',price:'',total:cents(r.tax),paid:0});
    (o.payments||[]).forEach(p=>rows.push(pay(p)));});
  (c.payments||[]).forEach(p=>rows.push(pay(p)));
  return {partyLabel:'اسم العميل',partyName:c.name,rows};}
function applyPeriod(rows,from,to){
  let r=rows.slice().sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  if(from){const bef=r.filter(x=>(x.date||'')<from);r=r.filter(x=>(x.date||'')>=from);
    if(bef.length)r.unshift({date:from,desc:'رصيد سابق',qty:'',price:'',total:bef.reduce((a,x)=>a+x.total,0),paid:bef.reduce((a,x)=>a+x.paid,0)});}
  if(to)r=r.filter(x=>(x.date||'')<=to);return r;}

/* ---------- 3) Print entities (which company is printing) ---------- */
function entities(){
  const c=db.company||{};if(!db.printEntities){db.printEntities=[{id:'e2',name:'عفيفي لتصنيع الأخشاب',nameEn:'',phone:'',address:''}];persist();}
  const main={id:'main',name:c.name||'الشركة',nameEn:c.nameEn||'',phone:(c.phones||[]).join(' - '),address:[c.factoryAddress&&'المصنع: '+c.factoryAddress,c.showroomAddress&&'المعرض: '+c.showroomAddress].filter(Boolean).join(' | '),logo:c.logo};
  return [main].concat(db.printEntities.map(e=>Object.assign({logo:c.logo},e)));}
function entityForm(ent,done){
  const ex=ent&&ent.id!=='main'?db.printEntities.find(x=>x.id===ent.id):null;
  const o=document.createElement('div');o.className='modal-overlay';o.style.cssText='display:flex;z-index:9999';
  const f=(k,l)=>`<div class="modal-field"><label>${l}</label><input data-k="${k}" value="${E(ex?ex[k]:'')}"></div>`;
  o.innerHTML=`<div class="modal" style="width:460px;max-width:94vw"><h2>${ex?'تعديل جهة الطباعة':'جهة طباعة جديدة'}</h2>${f('name','اسم الشركة / الجهة')}${f('nameEn','الاسم بالإنجليزية (اختياري)')}${f('phone','أرقام الهاتف')}${f('address','العنوان')}<div class="modal-actions">${ex?'<button class="danger-btn" id="eD">حذف</button>':''}<button class="secondary-btn" id="eX">إلغاء</button><button class="primary-btn" id="eS">حفظ</button></div></div>`;
  document.body.appendChild(o);o.querySelector('#eX').onclick=()=>o.remove();
  if(ex)o.querySelector('#eD').onclick=()=>{db.printEntities=db.printEntities.filter(x=>x.id!==ex.id);persist();o.remove();done('main');};
  o.querySelector('#eS').onclick=()=>{const v={};o.querySelectorAll('[data-k]').forEach(i=>v[i.dataset.k]=i.value.trim());if(!v.name){alert('أدخل الاسم');return;}
    let id;if(ex){Object.assign(ex,v);id=ex.id;}else{id=uid();db.printEntities.push(Object.assign({id},v));}persist();o.remove();done(id);};
}

/* ---------- 4) Statement document + 5 designs ---------- */
const DESIGNS=[['d1','كلاسيكي (جدول رسمي)'],['d2','عصري أزرق'],['d2 g','عصري أخضر'],['d3','تنفيذي ذهبي'],['d4','مبسط (توفير حبر)']];
const CSS=`@page{size:A4;margin:10mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font-family:'Cairo','Tajawal',Tahoma,Arial,sans-serif;color:#111;direction:rtl;font-size:12px;background:#fff}
.pg{padding:6mm 4mm}.hd{display:flex;align-items:center;gap:12px}.hd img{max-height:60px;max-width:90px;object-fit:contain}
.hd .nm{flex:1}.hd .nm b{display:block;font-size:20px;font-weight:800}.hd .nm i{font-style:normal;font-size:11px;opacity:.85}.hd .ct{font-size:10.5px;max-width:230px;line-height:1.6}
.tt{text-align:center;font-size:21px;font-weight:800;margin:14px 0 8px}.mt{display:flex;justify-content:space-between;gap:10px;margin-bottom:8px;font-size:12.5px}
table{width:100%;border-collapse:collapse}th,td{padding:6px 8px;text-align:center}td.ds{text-align:right}thead{display:table-header-group}tfoot{display:table-row-group}tr{page-break-inside:avoid}
.sm{display:flex;gap:10px;margin-top:14px}.sm div{flex:1;padding:9px;text-align:center}.sm b{display:block;font-size:15px;margin-top:3px}.ft{margin-top:16px;font-size:10.5px;text-align:center;opacity:.8}
.d1 .hd{border-bottom:2px solid #000;padding-bottom:8px}.d1 table{border:1.5px solid #000}.d1 th{background:#d9d9d9;border:1px solid #000}.d1 td{border:1px solid #777}.d1 tfoot td{background:#d9d9d9;font-weight:800;border:1px solid #000}.d1 .tt{text-decoration:underline}.d1 .sm div{border:1px solid #000}
.d2{--a:#0B2A5B;--b:#2563EB;--t:#F2F6FD}.d2.g{--a:#0b5d3b;--b:#12A150;--t:#EEF9F2}.d2 .hd{background:linear-gradient(90deg,var(--a),var(--b));color:#fff;padding:14px 16px;border-radius:14px}.d2 .hd img{background:#fff;border-radius:10px;padding:4px}
.d2 .tt{color:var(--a)}.d2 th{background:var(--a);color:#fff}.d2 tbody tr:nth-child(even){background:var(--t)}.d2 td{border-bottom:1px solid #e3eaf4}.d2 tfoot td{background:var(--t);font-weight:800;color:var(--a);border-top:2px solid var(--a)}.d2 .sm div{background:var(--t);border-radius:12px}
.d3{border:3px double #9A7B2F;padding:9mm 7mm}.d3 .hd{flex-direction:column;text-align:center}.d3 .hd .ct{max-width:none}.d3 .tt{color:#7a5c14;letter-spacing:2px;border-top:1px solid #9A7B2F;border-bottom:1px solid #9A7B2F;padding:6px 0}
.d3 th{border-bottom:2px solid #9A7B2F;color:#7a5c14}.d3 td{border-bottom:1px dotted #aaa}.d3 tfoot td{border-top:2px solid #9A7B2F;font-weight:800}.d3 .sm div{border:1px solid #9A7B2F}
.d4{font-size:11px}.d4 .hd .nm b{font-size:15px}.d4 .hd img{display:none}.d4 .tt{font-size:15px;margin:8px 0}.d4 th{border-top:1.5px solid #000;border-bottom:1.5px solid #000}.d4 td{border-bottom:.5px solid #bbb;padding:4px 6px}.d4 tfoot td{border-top:1.5px solid #000;font-weight:800}.d4 .sm div{border:.5px solid #888}`;
function totals(rows){let T=0,P=0,Q=0n;rows.forEach(r=>{T+=r.total;P+=r.paid;const q=String(r.qty||'').trim();if(/^-?\d+(\.\d+)?$/.test(q))Q+=sc(q);});return {T,P,N:T-P,Q};}
function qtxt(Q){if(Q===0n)return '';return bstr(Q,6,false).replace(/\.?0+$/,'');}
function stmtDoc(M,o,ent){
  const rows=M.rows,t=totals(rows);let run=0;const rb=!!o.runBal;
  const body=rows.map(r=>{const n=r.total-r.paid;run+=n;return `<tr><td>${fD(r.date)}</td><td class="ds">${E(r.desc)}</td><td>${E(r.qty)}</td><td>${E(r.price)}</td><td>${r.total?fC(r.total):''}</td><td>${r.paid?fC(r.paid):''}</td><td>${fC(n)}</td>${rb?`<td>${fC(run)}</td>`:''}</tr>`;}).join('')||`<tr><td colspan="${rb?8:7}">لا توجد حركات في هذه الفترة</td></tr>`;
  const per=(o.from||o.to)?`الفترة: ${o.from?'من '+fD(o.from):''} ${o.to?'إلى '+fD(o.to):''}`:'كل الفترات';
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>كشف حساب - ${E(M.partyName)}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap"><style>${CSS}</style></head><body><div class="pg ${o.design}">
  <div class="hd">${ent.logo?`<img src="${ent.logo}">`:''}<div class="nm"><b>${E(ent.name)}</b>${ent.nameEn?`<i>${E(ent.nameEn)}</i>`:''}</div><div class="ct">${E(ent.address)}${ent.address&&ent.phone?'<br>':''}${E(ent.phone)}</div></div>
  <div class="tt">كشف حساب</div><div class="mt"><div><b>${M.partyLabel}:</b> ${E(M.partyName)}</div><div>${per}</div><div>تاريخ الإصدار: ${fD(todayStr())}</div></div>
  <table><thead><tr><th>التاريخ</th><th>البيان</th><th>العدد</th><th>القيمة</th><th>الإجمالي المستحق</th><th>المسدد</th><th>الصافي المستحق</th>${rb?'<th>الرصيد التراكمي</th>':''}</tr></thead><tbody>${body}</tbody>
  <tfoot><tr><td colspan="2">الإجمالي (Grand Total)</td><td>${qtxt(t.Q)}</td><td></td><td>${fC(t.T)}</td><td>${fC(t.P)}</td><td>${fC(t.N)}</td>${rb?'<td></td>':''}</tr></tfoot></table>
  <div class="sm"><div>إجمالي المستحق<b>${fC(t.T)} ج.م</b></div><div>إجمالي المسدد<b>${fC(t.P)} ج.م</b></div><div>الرصيد المتبقي<b>${fC(t.N)} ج.م</b></div></div>
  <div class="ft">${E(ent.name)}${ent.phone?' — '+E(ent.phone):''}</div></div></body></html>`;}

/* real printing through a hidden frame */
function printHtml(html){const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-9999px;bottom:0;width:210mm;height:297mm;border:0';document.body.appendChild(f);
  f.onload=()=>setTimeout(()=>{try{f.contentWindow.focus();f.contentWindow.print();}catch(e){alert('تعذرت الطباعة');}setTimeout(()=>f.remove(),120000);},700);f.srcdoc=html;}

/* ---------- 5) real .xlsx writer (no libraries, works offline) ---------- */
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return b=>{let c=~0;for(let i=0;i<b.length;i++)c=t[(c^b[i])&255]^(c>>>8);return (~c)>>>0;};})();
function zip(files){const en=new TextEncoder(),parts=[],cd=[];let off=0;
  files.forEach(f=>{const nm=en.encode(f.name),d=en.encode(f.data),crc=CRC(d);
    const lh=new DataView(new ArrayBuffer(30));lh.setUint32(0,0x04034b50,true);lh.setUint16(4,20,true);lh.setUint16(6,0x0800,true);lh.setUint16(8,0,true);lh.setUint16(10,0,true);lh.setUint16(12,0x21,true);lh.setUint32(14,crc,true);lh.setUint32(18,d.length,true);lh.setUint32(22,d.length,true);lh.setUint16(26,nm.length,true);lh.setUint16(28,0,true);
    parts.push(lh.buffer,nm,d);
    const ch=new DataView(new ArrayBuffer(46));ch.setUint32(0,0x02014b50,true);ch.setUint16(4,20,true);ch.setUint16(6,20,true);ch.setUint16(8,0x0800,true);ch.setUint16(14,0x21,true);ch.setUint32(16,crc,true);ch.setUint32(20,d.length,true);ch.setUint32(24,d.length,true);ch.setUint16(28,nm.length,true);ch.setUint32(42,off,true);
    cd.push(ch.buffer,nm);off+=30+nm.length+d.length;});
  const cds=cd.reduce((a,b)=>a+(b.byteLength!==undefined?b.byteLength:b.length),0);
  const end=new DataView(new ArrayBuffer(22));end.setUint32(0,0x06054b50,true);end.setUint16(8,files.length,true);end.setUint16(10,files.length,true);end.setUint32(12,cds,true);end.setUint32(16,off,true);
  return new Blob(parts.concat(cd,[end.buffer]),{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});}
const X=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function xlsx(M,o,ent){
  const rows=M.rows,rb=!!o.runBal,L='ABCDEFGH';let r=1;const out=[];const merges=[];
  const S=(ref,v,st)=>`<c r="${ref}" s="${st}" t="inlineStr"><is><t xml:space="preserve">${X(v)}</t></is></c>`;
  const N=(ref,v,st,f)=>`<c r="${ref}" s="${st}">${f?`<f>${f}</f>`:''}<v>${v}</v></c>`;
  const last=rb?'H':'G';
  out.push(`<row r="1" ht="26" customHeight="1">${S('A1',ent.name,1)}</row>`);merges.push(`A1:${last}1`);
  out.push(`<row r="2">${S('A2','كشف حساب',1)}</row>`);merges.push(`A2:${last}2`);
  const per=(o.from||o.to)?`${o.from?'من '+fD(o.from):''} ${o.to?'إلى '+fD(o.to):''}`:'كل الفترات';
  out.push(`<row r="3">${S('A3',M.partyLabel+': '+M.partyName,8)}${S('E3',per,8)}</row>`);merges.push('A3:D3','E3:'+last+'3');
  const H=['التاريخ','البيان','العدد','القيمة','الإجمالي المستحق','المسدد','الصافي المستحق'].concat(rb?['الرصيد التراكمي']:[]);
  out.push(`<row r="5" ht="22" customHeight="1">${H.map((h,i)=>S(L[i]+'5',h,2)).join('')}</row>`);
  let n=6,run=0;const first=6;
  rows.forEach(x=>{const net=x.total-x.paid;run+=net;
    const ser=/^\d{4}-\d{2}-\d{2}/.test(x.date||'')?Math.round(Date.UTC(+x.date.slice(0,4),+x.date.slice(5,7)-1,+x.date.slice(8,10))/864e5)+25569:null;
    const q=String(x.qty||'').trim(),pr=String(x.price||'').trim();
    out.push(`<row r="${n}">${ser?N('A'+n,ser,5):S('A'+n,x.date||'',3)}${S('B'+n,x.desc,3)}${/^-?\d+(\.\d+)?$/.test(q)?N('C'+n,q,4):S('C'+n,q,3)}${/^-?\d+(\.\d+)?$/.test(pr)?N('D'+n,pr,4):S('D'+n,pr,3)}${N('E'+n,x.total/100,4)}${N('F'+n,x.paid/100,4)}${N('G'+n,net/100,4,`E${n}-F${n}`)}${rb?N('H'+n,run/100,4,`SUM(G$${first}:G${n})`):''}</row>`);n++;});
  const t=totals(rows),e=n-1,sm=c=>`SUM(${c}${first}:${c}${Math.max(e,first)})`;
  out.push(`<row r="${n}">${S('A'+n,'الإجمالي (Grand Total)',6)}${S('B'+n,'',6)}${N('C'+n,qtxt(t.Q)||0,7,sm('C'))}${S('D'+n,'',6)}${N('E'+n,t.T/100,7,sm('E'))}${N('F'+n,t.P/100,7,sm('F'))}${N('G'+n,t.N/100,7,sm('G'))}${rb?S('H'+n,'',6):''}</row>`);
  const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews><cols><col min="1" max="1" width="13" customWidth="1"/><col min="2" max="2" width="38" customWidth="1"/><col min="3" max="4" width="13" customWidth="1"/><col min="5" max="8" width="19" customWidth="1"/></cols><sheetData>${out.join('')}</sheetData><mergeCells count="${merges.length}">${merges.map(m=>`<mergeCell ref="${m}"/>`).join('')}</mergeCells><pageMargins left=".4" right=".4" top=".5" bottom=".5" header=".3" footer=".3"/><pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/></worksheet>`;
  const B='<border><left style="thin"><color rgb="FF999999"/></left><right style="thin"><color rgb="FF999999"/></right><top style="thin"><color rgb="FF999999"/></top><bottom style="thin"><color rgb="FF999999"/></bottom><diagonal/></border>';
  const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts><fonts count="4"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="16"/><name val="Arial"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B2A5B"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE6EEFB"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>${B}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="9"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="right" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf><xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf><xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="164" fontId="1" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`;
  const R='http://schemas.openxmlformats.org/officeDocument/2006/relationships',P='http://schemas.openxmlformats.org/package/2006/relationships';
  return zip([
   {name:'[Content_Types].xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`},
   {name:'_rels/.rels',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${P}"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`},
   {name:'xl/workbook.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${R}"><sheets><sheet name="كشف حساب" sheetId="1" r:id="rId1"/></sheets></workbook>`},
   {name:'xl/_rels/workbook.xml.rels',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${P}"><Relationship Id="rId1" Type="${R}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${R}/styles" Target="styles.xml"/></Relationships>`},
   {name:'xl/styles.xml',data:styles},{name:'xl/worksheets/sheet1.xml',data:sheet}]);}

/* ---------- 6) Statement dialog ---------- */
window.openStatementDialog=function(build){
  const pf=db.printPrefs=db.printPrefs||{design:'d1',entity:'main',runBal:false};
  const ov=document.createElement('div');ov.className='modal-overlay';ov.style.cssText='display:flex;z-index:9000';
  ov.innerHTML=`<div class="modal" style="width:1040px;max-width:96vw;max-height:94vh"><h2>كشف حساب — الطباعة والتصدير</h2>
  <div style="display:grid;grid-template-columns:minmax(260px,320px) 1fr;gap:18px" id="sdGrid"><div>
   <div class="modal-field"><label>تصميم الطباعة</label><div id="dsList" style="display:grid;gap:6px"></div></div>
   <div class="modal-field"><label>الجهة التي تُطبع باسمها</label><div style="display:flex;gap:6px"><select id="enSel" style="flex:1"></select><button class="secondary-btn" id="enAdd" title="جهة جديدة">+</button><button class="secondary-btn" id="enEd" title="تعديل">✎</button></div></div>
   <div class="modal-grid2"><div class="modal-field"><label>من تاريخ</label><input type="date" id="stFrom"></div><div class="modal-field"><label>إلى تاريخ</label><input type="date" id="stTo"></div></div>
   <label class="check-row"><input type="checkbox" style="width:auto" id="stRun"> إظهار عمود الرصيد التراكمي</label>
   <div style="display:grid;gap:8px;margin-top:14px"><button class="primary-btn" id="stPrint">🖨 طباعة</button><button class="secondary-btn" id="stPdf">⬇ حفظ كـ PDF</button><button class="success-btn" id="stXls">⬇ تصدير Excel (.xlsx)</button><button class="secondary-btn" id="stClose">إغلاق</button></div>
   <div style="font-size:11.5px;color:var(--m-mute);margin-top:8px">لحفظ PDF: اختر "حفظ كـ PDF / Save as PDF" كوجهة في نافذة الطباعة.</div></div>
   <div id="pvWrap" style="background:#E9EEF6;border-radius:14px;padding:10px;overflow:hidden;min-height:300px"><iframe id="pv" style="border:0;background:#fff;width:794px;height:1123px;transform-origin:top right;display:block;margin-inline-start:auto"></iframe></div></div></div>`;
  document.body.appendChild(ov);const q=x=>ov.querySelector(x);
  const opts=()=>({design:pf.design,from:q('#stFrom').value,to:q('#stTo').value,runBal:q('#stRun').checked});
  const cur=()=>{const o=opts(),M=build(),ents=entities();M.rows=applyPeriod(M.rows,o.from,o.to);return {o,M,ent:ents.find(e=>e.id===pf.entity)||ents[0]};};
  const fit=()=>{const w=q('#pvWrap').clientWidth-20,sc2=Math.min(1,w/794),f=q('#pv');f.style.transform=`scale(${sc2})`;q('#pvWrap').style.height=(1123*sc2+20)+'px';};
  const draw=()=>{const c=cur();q('#pv').srcdoc=stmtDoc(c.M,c.o,c.ent);fit();};
  const drawD=()=>{q('#dsList').innerHTML=DESIGNS.map(([k,n])=>`<label style="display:flex;gap:8px;align-items:center;border:1.5px solid ${pf.design===k?'var(--m-blue2)':'var(--m-line)'};background:${pf.design===k?'var(--m-soft)':'#fff'};border-radius:12px;padding:9px 12px;cursor:pointer;font-weight:700"><input type="radio" style="width:auto;flex:none;margin:0" name="dz" value="${k}" ${pf.design===k?'checked':''}>${n}</label>`).join('');
    q('#dsList').querySelectorAll('input').forEach(i=>i.onchange=()=>{pf.design=i.value;persist();drawD();draw();});};
  const drawE=()=>{const es=entities();if(!es.find(e=>e.id===pf.entity))pf.entity='main';q('#enSel').innerHTML=es.map(e=>`<option value="${e.id}" ${e.id===pf.entity?'selected':''}>${E(e.name)}</option>`).join('');};
  q('#stRun').checked=!!pf.runBal;drawD();drawE();draw();
  q('#enSel').onchange=e=>{pf.entity=e.target.value;persist();draw();};
  q('#enAdd').onclick=()=>entityForm(null,id=>{pf.entity=id;persist();drawE();draw();});
  q('#enEd').onclick=()=>{const e=entities().find(x=>x.id===pf.entity);if(e.id==='main'){alert('بيانات الشركة الأساسية تُعدَّل من صفحة "بيانات الشركة".');return;}entityForm(e,id=>{pf.entity=id;persist();drawE();draw();});};
  ['#stFrom','#stTo'].forEach(s=>q(s).onchange=draw);q('#stRun').onchange=()=>{pf.runBal=q('#stRun').checked;persist();draw();};
  const go=()=>{const c=cur();return stmtDoc(c.M,c.o,c.ent);};
  q('#stPrint').onclick=()=>printHtml(go());
  q('#stPdf').onclick=()=>{showToast('في نافذة الطباعة اختر "حفظ كـ PDF"');printHtml(go());};
  q('#stXls').onclick=()=>{const c=cur(),b=xlsx(c.M,c.o,c.ent),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='كشف حساب - '+c.M.partyName+'.xlsx';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},2000);};
  q('#stClose').onclick=()=>{ov.remove();window.removeEventListener('resize',fit);};window.addEventListener('resize',fit);
};

/* ---------- 7) hook buttons ---------- */
const hb=document.querySelector('#view-supplier-detail .head-actions');
const sb=document.createElement('button');sb.className='primary-btn';sb.id='sdStmtBtn';sb.textContent='🖨 كشف حساب';hb.prepend(sb);
sb.onclick=()=>{const sid=document.getElementById('sdName').textContent;const s=db.suppliers.find(x=>x.name===sid);if(s)openStatementDialog(()=>supModel(db.suppliers.find(x=>x.id===s.id)));};
window.openSupplierStatement=function(id){openStatementDialog(()=>supModel(db.suppliers.find(x=>x.id===id)));};
window.printCustomerStatement=function(c){openStatementDialog(()=>cliModel(db.customers.find(x=>x.id===c.id)||c));};
})();
