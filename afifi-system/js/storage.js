
(function(){
const K='afifi_db_v1';let mem=null,ok=true;
try{localStorage.setItem('__t','1');localStorage.removeItem('__t')}catch(e){ok=false}
const DEF=()=>({company:{name:'عفيفي لتصنيع الأخشاب',nameEn:'Afifi for the manufacture of wood',logo:'',phones:['01018634006','01270335255','034599489'],email:'afifiwood@gmail.com',factoryAddress:'جمهورية مصر العربية - محافظة الإسكندرية - برج العرب - المنطقة الصناعية الثانية - بلوك 18 - قطعة 50',showroomAddress:'جمهورية مصر العربية - محافظة الإسكندرية - طريق إسكندرية مطروح الساحلي - العجمي – الكيلو 20.5'},general:null,customers:[],quotes:[],users:[]});
function warn(){if(document.getElementById('storeWarn'))return;const b=document.createElement('div');b.id='storeWarn';b.textContent='⚠ هذه النافذة لا تسمح بحفظ البيانات. حمّل ملف البرنامج وافتحه من جهازك (Chrome)، أو استخدم "حفظ نسخة احتياطية" باستمرار.';document.body.prepend(b)}
if(!ok)warn();
window.api={
 loadData:async()=>{let r=null;try{r=localStorage.getItem(K)}catch(e){}const d=DEF();
  if(r){try{const p=JSON.parse(r);return{...d,...p,company:{...d.company,...(p.company||{})}}}catch(e){}}return mem||d},
 saveData:async d=>{mem=d;try{localStorage.setItem(K,JSON.stringify(d))}catch(e){warn()}return true},
 printPage:async()=>window.print(),
 exportBackup:async d=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:'application/json'}));a.download='afifi-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();return true}
};
document.getElementById('restoreBtn').addEventListener('click',()=>document.getElementById('restoreFile').click());
document.getElementById('restoreFile').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const o=JSON.parse(r.result);if(!o||!Array.isArray(o.customers))throw 0;if(!confirm('سيتم استبدال كل البيانات الحالية بالنسخة المختارة. هل أنت متأكد؟'))return;localStorage.setItem(K,JSON.stringify(o));location.reload()}catch(err){alert('الملف غير صالح أو لا يمكن الحفظ في هذه النافذة.')}};r.readAsText(f)});
})();
