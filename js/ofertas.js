// Comparador de ofertas: cada "oferta" es una foto fija (deep clone) de state.suelo completo
// —forma de pago, propietarios, calendario— con un nombre. Se guardan varias para compararlas
// en la pestaña "Comparador ofertas" sin perder la configuración actual de trabajo.
let _ofertaIdCounter = 0;
function genOfertaId(){ _ofertaIdCounter++; return 'of_'+Date.now().toString(36)+'_'+_ofertaIdCounter; }

function renderOfertasList(){
  const host = document.getElementById('ofertasListHost');
  if(!host) return;
  if(!state.ofertasComparativas || state.ofertasComparativas.length===0){
    host.innerHTML = `<div class="card-hint">Todavía no has guardado ninguna oferta. Configura la sección 4 como quieras y pulsa "Guardar configuración actual como oferta".</div>`;
    return;
  }
  host.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Nombre de la oferta</th><th>Forma de pago</th><th class="num">Nº propietarios</th><th class="num">Precio total (€)</th><th></th></tr></thead>
        <tbody>
          ${state.ofertasComparativas.map(o=>{
            const precioTotal = (o.suelo.propietarios||[]).reduce((a,p)=>a+(p.precio||0),0);
            const formaPagoLabel = o.suelo.formaPago==='efectivo'?'Efectivo':(o.suelo.formaPago==='permuta'?'Permuta':'Mixta');
            return `<tr data-oferta-id="${o.id}">
              <td><input type="text" class="ofertaNombreInput" data-oferta-id="${o.id}" value="${escapeHtml(o.nombre)}"></td>
              <td>${formaPagoLabel}</td>
              <td class="num">${(o.suelo.propietarios||[]).length}</td>
              <td class="num">${eur(precioTotal)}</td>
              <td class="num" style="white-space:nowrap;">
                <button type="button" class="btn ofertaCargarBtn" data-oferta-id="${o.id}">Cargar</button>
                <button type="button" class="btn ofertaDuplicarBtn" data-oferta-id="${o.id}">Duplicar</button>
                <button type="button" class="row-del-btn ofertaEliminarBtn" data-oferta-id="${o.id}" title="Eliminar esta oferta">✕</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function bindOfertasUI(){
  const btnGuardar = document.getElementById('btnGuardarOferta');
  if(btnGuardar){
    btnGuardar.onclick = ()=>{
      const nombreInput = document.getElementById('nombreNuevaOferta');
      const nombre = (nombreInput.value||'').trim() || ('Oferta '+(state.ofertasComparativas.length+1));
      state.ofertasComparativas.push({ id: genOfertaId(), nombre, suelo: JSON.parse(JSON.stringify(state.suelo)) });
      nombreInput.value = '';
      saveState();
      renderOfertasList();
      renderComparador();
    };
  }
  const host = document.getElementById('ofertasListHost');
  if(!host || host._bound) return; // el listener delegado se pone una sola vez, sobrevive a los re-renders de la lista
  host._bound = true;
  host.addEventListener('click', async e=>{
    const cargarBtn = e.target.closest('.ofertaCargarBtn');
    const duplicarBtn = e.target.closest('.ofertaDuplicarBtn');
    const eliminarBtn = e.target.closest('.ofertaEliminarBtn');
    if(cargarBtn){
      const oferta = state.ofertasComparativas.find(o=>o.id===cargarBtn.dataset.ofertaId);
      if(!oferta) return;
      if(!await confirmar({
        titulo:`¿Cargar "${oferta.nombre}" en la sección 4?`,
        texto:'Sustituye la configuración actual del suelo. La oferta guardada no se toca y sigue disponible.',
        aceptar:'Cargar oferta'
      })) return;
      state.suelo = JSON.parse(JSON.stringify(oferta.suelo));
      renderInputs();
      recalcAndRenderOutputs();
    } else if(duplicarBtn){
      const oferta = state.ofertasComparativas.find(o=>o.id===duplicarBtn.dataset.ofertaId);
      if(!oferta) return;
      state.ofertasComparativas.push({ id: genOfertaId(), nombre: oferta.nombre+' (copia)', suelo: JSON.parse(JSON.stringify(oferta.suelo)) });
      saveState();
      renderOfertasList();
    } else if(eliminarBtn){
      const oferta = state.ofertasComparativas.find(o=>o.id===eliminarBtn.dataset.ofertaId);
      if(!oferta) return;
      if(!await confirmar({
        titulo:`¿Eliminar la oferta "${oferta.nombre}"?`,
        texto:'Se borra la copia guardada de esta estructura de compra. No se puede deshacer.',
        aceptar:'Eliminar', peligroso:true
      })) return;
      state.ofertasComparativas = state.ofertasComparativas.filter(o=>o.id!==eliminarBtn.dataset.ofertaId);
      saveState();
      renderOfertasList();
      renderComparador();
    }
  });
  host.addEventListener('input', e=>{
    const inp = e.target.closest('.ofertaNombreInput');
    if(!inp) return;
    const oferta = state.ofertasComparativas.find(o=>o.id===inp.dataset.ofertaId);
    if(oferta){ oferta.nombre = inp.value; saveState(); renderComparador(); }
  });
}

function bindGenericInputs(){
  const host = document.getElementById('inputsHost');
  host.querySelectorAll('input[data-path], textarea[data-path]').forEach(inp=>{
    inp.addEventListener('input', e=>{
      const path = e.target.dataset.path;
      const isPercent = e.target.dataset.percent==='1';
      const type = e.target.type;
      let val = e.target.value;
      if(type==='number'){
        val = parseFloat(val); if(isNaN(val)) val=0;
        if(isPercent) val = val/100;
      }
      setByPath(state, path, val);
      recalcAndRenderOutputs();
      updateInputHints();
    });
  });
  document.getElementById('mesCalendarioInicioSelect').addEventListener('change', e=>{
    state.cronograma.mesCalendarioInicio = parseInt(e.target.value, 10);
    recalcAndRenderOutputs();
    updateInputHints();
  });
  document.getElementById('regimenPermutaSelect').addEventListener('change', e=>{
    state.suelo.regimenPermuta = e.target.value;
    recalcAndRenderOutputs();
    updateInputHints();
  });
  document.getElementById('momentoPermutaSelect').addEventListener('change', e=>{
    state.suelo.momentoPermutaIva = e.target.value;
    recalcAndRenderOutputs();
    updateInputHints();
  });
  document.getElementById('formaPagoSelect').addEventListener('change', e=>{
    state.suelo.formaPago = e.target.value;
    if(e.target.value==='efectivo'){
      // al volver a efectivo, se limpian las unidades en permuta para que no queden
      // "fantasma" si se reactiva la permuta más adelante
      state.ventas.forEach(v=>{ v.permuta = 0; });
    }
    renderVentasTable();
    recalcAndRenderOutputs();
    updateInputHints();
  });
}

function updateInputHints(){
  const a = document.getElementById('calcEdifConsumida'); if(a) a.value = fmtPct(R.edifConsumida,1);
  const b = document.getElementById('calcEdifLibre'); if(b) b.value = num(R.edifLibre)+' m²';
  const cp = document.getElementById('calcPlazasPlanificadas');
  if(cp) cp.value = R.plazasPlanificadas+' ud.'+(state.urban.plazasExigidas>0 ? (R.checks.plazasAparcamiento?' ✓':' — insuficientes ('+state.urban.plazasExigidas+' exigidas)') : '');
  const cme = document.getElementById('calcMesEntrega'); if(cme) cme.value = 'Mes '+R.mesEntrega;
  const cdp = document.getElementById('calcDurProyecto'); if(cdp) cdp.value = R.durProyecto+' meses';
  const cvpo = document.getElementById('calcPctVPO');
  if(cvpo) cvpo.value = fmtPct(R.pctVPOActual,1)+(state.urban.reservaVPOPct>0 ? (R.checks.reservaVPO?' ✓':' — falta llegar a '+fmtPct(state.urban.reservaVPOPct,0)) : '');

  const rp = document.getElementById('railProjectName'); if(rp) rp.textContent = state.project.name.replace(/^Promoción\s*/i,'').replace(/"/g,'');

  const permutaOn = state.suelo.formaPago !== 'efectivo';
  const wrap1 = document.getElementById('permutaFieldsWrap'); if(wrap1) wrap1.style.display = permutaOn?'':'none';
  const wrap2 = document.getElementById('permutaBaseWrap'); if(wrap2) wrap2.style.display = permutaOn?'':'none';
  const wrapRp = document.getElementById('regimenPermutaWrap'); if(wrapRp) wrapRp.style.display = permutaOn?'':'none';
  const wrapRpp = document.getElementById('pctRegimenPermutaWrap'); if(wrapRpp) wrapRpp.style.display = permutaOn?'':'none';
  const wrapMp = document.getElementById('momentoPermutaWrap'); if(wrapMp) wrapMp.style.display = permutaOn?'':'none';
  const firmaOn = permutaOn && state.suelo.momentoPermutaIva!=='escrituracion';
  const wrapMfp = document.getElementById('mesFirmaPermutaWrap'); if(wrapMfp) wrapMfp.style.display = firmaOn?'':'none';
  const wrapAvp = document.getElementById('avalPermutaPctWrap'); if(wrapAvp) wrapAvp.style.display = permutaOn?'':'none';
  const wrapAvc = document.getElementById('avalPermutaCalcWrap'); if(wrapAvc) wrapAvc.style.display = permutaOn?'':'none';
  const cap = document.getElementById('calcAvalPermuta'); if(cap) cap.value = eur(R.avalPermutaCoste);
  const aph = document.getElementById('avalPermutaHelper');
  if(aph) aph.textContent = R.mesesAvalPermuta>0 ? `Vigente ${R.mesesAvalPermuta} meses (de la firma a la entrega)` : 'La firma de la permuta ya coincide con la entrega, o es posterior — revisa el mes de la firma';
  const vp = document.getElementById('calcValorPermuta'); if(vp) vp.value = eur(R.valorPermutaTotal);
  const bt = document.getElementById('calcBaseTotal'); if(bt) bt.value = eur(R.precioBaseTotal);

  ['ivaPermutaFieldsWrap','pctIvaPermutaWrap','ivaPermutaCubiertoWrap','ivaPermutaCargoWrap'].forEach(id=>{
    const w = document.getElementById(id); if(w) w.style.display = permutaOn?'':'none';
  });
  const ivp = document.getElementById('calcIvaPermuta'); if(ivp) ivp.value = eur(R.ivaRepercutidoPermutaTotal);
  const ivc = document.getElementById('calcIvaPermutaCubierto'); if(ivc) ivc.value = eur(R.ivaPermutaCubierto);
  const ivg = document.getElementById('calcIvaPermutaCargo'); if(ivg) ivg.value = eur(R.ivaPermutaACargoPromotora);

  const fph = document.getElementById('formaPagoHelper');
  if(fph){
    if(state.suelo.formaPago==='efectivo') fph.textContent = 'El solar se paga íntegramente en dinero, repartido entre los propietarios de la tabla de abajo.';
    else fph.textContent = `Marca en la tabla de precios de venta (sección 3) qué unidades se entregan al propietario del solar en vez de venderse. Su valor de mercado se suma automáticamente al coste del suelo. El resto de propietarios (tabla de abajo) siguen cobrando en efectivo con su propio régimen fiscal.`;
  }

  updateVentasComputedCells();
  updatePartidasComputedCells();
  updatePropietariosComputedCells();
  updateSubnavProgress();
}

// Progreso real de la sub-navegación de Inputs: un punto se rellena con el color de su
// familia en cuanto la sección tiene algún dato distinto del valor de fábrica. Comparación
// puramente de lectura contra defaultState() — nunca modifica el estado real de la app.
const SECTION_STATE_KEYS = {
  'sec-1':['project'], 'sec-2':['urban'], 'sec-3':['ventas'], 'sec-4':['suelo'],
  'sec-5':['construccion'], 'sec-6':['honorarios'], 'sec-7':['licencias'],
  'sec-8':['comercial'], 'sec-9':['otros'], 'sec-10':['financiacion'], 'sec-11':['cronograma']
};
function sectionHasData(secId){
  const keys = SECTION_STATE_KEYS[secId];
  if(!keys) return false;
  const def = defaultState();
  return keys.some(k=>JSON.stringify(state[k])!==JSON.stringify(def[k]));
}
function updateSubnavProgress(){
  document.querySelectorAll('.subnav a[href^="#sec-"]').forEach(a=>{
    const secId = a.getAttribute('href').slice(1);
    a.classList.toggle('touched', sectionHasData(secId));
  });
}

// Resalta en la sub-navegación la sección por la que se está desplazando ahora mismo.
// Se reconstruye cada vez que renderInputs() recrea las 11 tarjetas (p.ej. al añadir/quitar
// una fila), desconectando primero el observer anterior para no acumular duplicados.
let _inputsScrollSpy = null;
function setupInputsScrollSpy(){
  if(_inputsScrollSpy) _inputsScrollSpy.disconnect();
  const cards = document.querySelectorAll('#inputsHost .card[id^="sec-"]');
  if(!cards.length) return;
  _inputsScrollSpy = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(!entry.isIntersecting) return;
      document.querySelectorAll('.subnav a').forEach(a=>a.classList.remove('active'));
      const link = document.querySelector(`.subnav a[href="#${entry.target.id}"]`);
      if(link) link.classList.add('active');
    });
  }, { rootMargin:'-15% 0px -70% 0px', threshold:0 });
  cards.forEach(c=>_inputsScrollSpy.observe(c));
}

