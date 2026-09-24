/* =========================================================================
   UTILIDADES DE FORMATO Y ACCESO A ESTADO
   ========================================================================= */
const fmtEUR0 = new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0});
const fmtEUR2 = new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:2});
const fmtNum0 = new Intl.NumberFormat('es-ES',{maximumFractionDigits:0});
const fmtNum2 = new Intl.NumberFormat('es-ES',{maximumFractionDigits:2});
function fmtPct(x, dec){ if(x===''||x===null||x===undefined||isNaN(x)) return '—'; return (x*100).toLocaleString('es-ES',{minimumFractionDigits:dec===undefined?1:dec, maximumFractionDigits:dec===undefined?1:dec})+'%'; }
function eur(x){ if(x===''||x===null||x===undefined||isNaN(x)) return '—'; return fmtEUR0.format(x); }
function eur2(x){ if(x===''||x===null||x===undefined||isNaN(x)) return '—'; return fmtEUR2.format(x); }
function num(x,d){ if(x===''||x===null||x===undefined||isNaN(x)) return '—'; return (d? fmtNum2:fmtNum0).format(x); }
function money(x){ const cls = x<0?'neg':(x>0?'':''); return `<span class="${cls}">${eur(x)}</span>`; }
function moneyCell(x){ const cls = x<0?'neg':''; return `<td class="num ${cls}">${eur(x)}</td>`; }

function getByPath(obj, path){ return path.split('.').reduce((o,k)=>(o==null?o:o[k]), obj); }
function setByPath(obj, path, value){
  const parts = path.split('.');
  let cur = obj;
  for(let i=0;i<parts.length-1;i++) cur = cur[parts[i]];
  cur[parts[parts.length-1]] = value;
}
