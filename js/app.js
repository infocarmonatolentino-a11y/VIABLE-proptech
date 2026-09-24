/* =========================================================================
   KPI RIBBON + CHECKS
   ========================================================================= */
function renderKpiBar(){
  document.getElementById('kpiBeneficioNeto').innerHTML = `<span class="${R.beneficioNeto<0?'neg':'pos'}">${eur(R.beneficioNeto)}</span>`;
  document.getElementById('kpiBeneficioNeto').className = 'kpi-value '+(R.beneficioNeto<0?'neg':'pos');
  document.getElementById('kpiTir').textContent = fmtPct(R.tirAnual,1);
  document.getElementById('kpiTir').className = 'kpi-value '+(R.tirAnual===null?'':(R.tirAnual<0?'neg':'pos'));
  document.getElementById('kpiMirr').textContent = fmtPct(R.mirrAnual,1);
  document.getElementById('kpiMirr').className = 'kpi-value '+(R.mirrAnual===null?'':(R.mirrAnual<0?'neg':'pos'));
  document.getElementById('kpiVan').textContent = eur(R.van);
  document.getElementById('kpiVan').className = 'kpi-value '+(R.van<0?'neg':'pos');
  document.getElementById('kpiPayback').textContent = R.payback===''?'No recupera':('Mes '+R.payback);
  document.getElementById('kpiPayback').className = 'kpi-value';
  document.getElementById('kpiMargen').textContent = fmtPct(R.margenVentas,1);
  document.getElementById('kpiMargen').className = 'kpi-value '+(R.margenVentas<CONFIG.margenMin?'neg':'pos');
  document.getElementById('kpiRoeTotal').textContent = fmtPct(R.roeNetoEquityTotalAnualizado,1);
  document.getElementById('kpiRoeTotal').className = 'kpi-value '+(R.roeNetoEquityTotalAnualizado===null?'':(R.roeNetoEquityTotalAnualizado<0?'neg':'pos'));

  const checksDefs = [
    { key:'densidad', label:'Densidad' },
    { key:'edificabilidad', label:'Edificabilidad' },
    { key:'prestamoRepagado', label:'Préstamo repagado' },
    { key:'coherencia', label:'Coherencia financ.' },
    { key:'margenMinimo', label:'Margen ≥'+fmtPct(CONFIG.margenMin,0) },
    { key:'ltv', label:'LTV ≤'+fmtPct(state.financiacion.ltvMax,0) },
    { key:'margenEntregaValido', label:'Margen entrega ≥0' }
  ];
  if(R.permutaActiva) checksDefs.push({ key:'ivaPermutaCubierto', label:'IVA permuta cubierto' });
  if(R.preventasMinPct>0) checksDefs.push({ key:'preventasGateSinBloqueos', label:'Gate preventas OK' });
  if(state.urban.plazasExigidas>0) checksDefs.push({ key:'plazasAparcamiento', label:'Plazas garaje OK' });
  if(state.urban.reservaVPOPct>0) checksDefs.push({ key:'reservaVPO', label:'Reserva VPO OK' });
  // Umbrales de Configuración maestra: solo se muestran si Dirección los ha fijado.
  if(CONFIG.costeConstruccionMin) checksDefs.push({ key:'costeConstruccionMin', label:'Coste obra ≥'+eur(CONFIG.costeConstruccionMin)+'/m²' });
  if(CONFIG.precioVentaMin) checksDefs.push({ key:'precioVentaMin', label:'Precio venta ≥'+eur(CONFIG.precioVentaMin)+'/m²' });
  document.getElementById('checksRow').innerHTML = checksDefs.map(c=>{
    const ok = R.checks[c.key];
    const cls = ok?'ok':(c.key==='margenMinimo'||c.key==='ltv'||c.key==='ivaPermutaCubierto'||c.key==='costeConstruccionMin'||c.key==='precioVentaMin'?'warn':'bad');
    const titulo = c.key==='costeConstruccionMin'
      ? `Coste de construcción repercutido actual: ${eur(R.costeConstruccionRepercutido)}/m² de techo (PEM entre techo sobre + bajo rasante). Mínimo fijado por Dirección: ${eur(CONFIG.costeConstruccionMin)}/m². Por debajo del mínimo, el presupuesto de obra probablemente está infravalorado.`
      : c.key==='precioVentaMin'
      ? `Precio de venta medio de vivienda actual: ${eur(R.precioVentaMedioVivienda)}/m². Mínimo de referencia fijado por Dirección: ${eur(CONFIG.precioVentaMin)}/m².`
      : '';
    return `<div class="chk"${titulo?` title="${titulo.replace(/"/g,'&quot;')}"`:''}><span class="dot ${cls}"></span>${c.label}</div>`;
  }).join('');
}

function updatePrintCover(){
  const logo = document.getElementById('printCoverLogo');
  if(logo){
    if(state.project.logoDataUrl){ logo.src = state.project.logoDataUrl; logo.style.display = ''; }
    else { logo.style.display = 'none'; }
  }
  const t = document.getElementById('printCoverTitle'); if(t) t.textContent = state.project.name;
  const a = document.getElementById('printCoverAddress'); if(a) a.textContent = state.project.address;
  const m = document.getElementById('printCoverMeta');
  if(m){
    m.innerHTML = `
      Promotor: ${state.project.promoter}<br>
      Tipología: ${state.project.typology}<br>
      Fecha del estudio: ${state.project.date}<br>
      Forma de pago del suelo: ${state.suelo.formaPago==='efectivo'?'Efectivo':(state.suelo.formaPago==='permuta'?'Permuta':'Mixta (permuta + efectivo)')}<br>
      Documento generado: ${new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'})}`;
  }
  const k = document.getElementById('printCoverKpis');
  if(k){
    k.innerHTML = `
      <div><div class="l">Beneficio neto</div><div class="v">${eur(R.beneficioNeto)}</div></div>
      <div><div class="l">TIR anual equity</div><div class="v">${fmtPct(R.tirAnual,1)}</div></div>
      <div><div class="l">MIRR anual</div><div class="v">${fmtPct(R.mirrAnual,1)}</div></div>
      <div><div class="l">VAN equity</div><div class="v">${eur(R.van)}</div></div>
      <div><div class="l">Payback</div><div class="v">${R.payback===''?'—':'Mes '+R.payback}</div></div>
      <div><div class="l">ROE anual (equity total)</div><div class="v">${fmtPct(R.roeNetoEquityTotalAnualizado,1)}</div></div>`;
  }
  const legal = document.getElementById('printCoverLegal');
  if(legal) legal.textContent = AVISO_LEGAL_FIJO;
}

/* =========================================================================
   ORQUESTACIÓN
   ========================================================================= */
function recalcAndRenderOutputs(){
  saveState();
  R = compute(state);
  renderKpiBar();
  renderIngresos();
  renderCostes();
  renderFinanciacion();
  renderCashflow();
  renderResumen();
  renderSensibilidad();
  renderComparador();
  renderResidual();
  renderNotas();
  updatePrintCover();
  // Las celdas calculadas que viven DENTRO de la propia pestaña Inputs (Importe impuesto y
  // % Final de cada propietario, PVP/Total de cada tipología, Base de cada partida, "Base
  // total de la operación"...) no se repintan solas al recalcular — solo updateInputHints()
  // las actualiza. Se llama aquí, y no solo dentro de renderInputs(), para que queden
  // correctas sin importar en qué orden se llame a renderInputs()/recalcAndRenderOutputs()
  // (Nuevo estudio, cargar un estudio guardado, Restablecer, Importar JSON, pantalla de
  // bienvenida...). Es seguro llamarla aquí: usa siempre comprobaciones "if(el)" antes de
  // tocar cada campo, así que no falla aunque algún elemento aún no exista en el DOM.
  updateInputHints();
}

function switchTab(tab){
  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active', p.dataset.panel===tab));
  document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
  document.getElementById('rail').classList.remove('open');
  window.scrollTo({top:0, behavior:'instant'});
}

document.getElementById('nav').addEventListener('click', e=>{
  const btn = e.target.closest('button[data-tab]');
  if(btn) switchTab(btn.dataset.tab);
});
document.getElementById('menuBtn').addEventListener('click', ()=> document.getElementById('rail').classList.toggle('open'));
document.getElementById('btnPrint').addEventListener('click', ()=>{ updatePrintCover(); window.print(); });

document.getElementById('btnReset').addEventListener('click', async ()=>{
  if(await confirmar({
    titulo:'¿Restablecer los valores de fábrica?',
    texto:'Todo el estudio vuelve a los datos de la promoción de ejemplo. Se pierde lo que no hayas guardado o exportado.',
    aceptar:'Restablecer', peligroso:true
  })){
    state = defaultState();
    saveState();
    renderInputs();
    recalcAndRenderOutputs();
  }
});
document.getElementById('btnNuevoEstudio').addEventListener('click', async ()=>{
  const avisoPlantilla = hayPlantillaGuardada()
    ? 'Se mantienen tus honorarios, licencias, comercialización, otros gastos y financiación guardados como plantilla.'
    : 'Como todavía no has guardado ninguna plantilla de supuestos, arrancará con los valores de ejemplo en todo.';
  if(!await confirmar({
    titulo:'¿Empezar un estudio nuevo?',
    texto:'Identificación, urbanismo, precios de venta, suelo y cronograma vuelven a los valores de ejemplo, listos para sustituirlos por los del nuevo solar. '+
          avisoPlantilla+'\n\nSi quieres conservar el estudio actual, guárdalo o expórtalo antes.',
    aceptar:'Empezar de nuevo'
  })) return;
  iniciarNuevoEstudio();
});
document.getElementById('btnGuardarPlantilla').addEventListener('click', async ()=>{
  try{
    localStorage.setItem(PLANTILLA_KEY, JSON.stringify(getPlantillaFromState(state)));
    updatePlantillaHint();
    await avisar({
      titulo:'Plantilla de supuestos guardada',
      texto:'A partir de ahora, cada "+ Nuevo estudio" arrancará con estos honorarios, licencias, '+
            'comercialización, otros gastos y financiación. Solo tendrás que rellenar lo propio del solar.'
    });
  }catch(e){
    reportar('guardar plantilla local', e);
    toast('No se ha podido guardar la plantilla en este navegador.','error');
  }
});
document.getElementById('btnGuardarEstudio').addEventListener('click', async ()=>{
  const nombre = await pedirTexto({
    titulo:'Guardar este estudio',
    texto:'Se guarda en este navegador. Podrás volver a abrirlo desde "Mis estudios".',
    etiqueta:'Nombre del estudio',
    valor: state.project.name || '',
    aceptar:'Guardar'
  });
  if(!nombre) return;
  const list = getEstudiosGuardados();
  const existente = list.find(e=>e.nombre===nombre);
  if(existente && !await confirmar({
    titulo:`Ya tienes un estudio llamado "${nombre}"`,
    texto:'Si continúas, se sustituye por los datos actuales.',
    aceptar:'Sobrescribir', peligroso:true
  })) return;
  const entry = { id: existente?existente.id:('e_'+Date.now().toString(36)), nombre, fecha:new Date().toISOString(), state: JSON.parse(JSON.stringify(state)) };
  const newList = existente ? list.map(e=>e.id===existente.id?entry:e) : [...list, entry];
  if(setEstudiosGuardados(newList)){
    renderEstudiosGuardadosList();
    clearNuevoEstudioHighlight();
    toast(`Estudio guardado como "${nombre}".`,'ok');
  }
});
document.getElementById('btnMisEstudios').addEventListener('click', ()=>{
  const panel = document.getElementById('misEstudiosPanel');
  const abrir = panel.style.display==='none';
  if(abrir) renderEstudiosGuardadosList();
  panel.style.display = abrir ? 'block' : 'none';
});
// Acción real de "cargar un estudio guardado", compartida por el panel "Mis estudios" y por
// la pantalla de bienvenida.
async function cargarEstudioGuardado(entry, skipConfirm){
  if(!skipConfirm && !await confirmar({
    titulo:`¿Abrir "${entry.nombre}"?`,
    texto:'Se sustituyen todos los datos actuales. Si no los has guardado, se pierden.',
    aceptar:'Abrir estudio'
  })) return false;
  state = mergeDefaults(entry.state);
  saveState();
  renderInputs();
  recalcAndRenderOutputs();
  return true;
}
document.getElementById('misEstudiosPanel').addEventListener('click', async (e)=>{
  const btn = e.target.closest('button[data-action]');
  if(!btn) return;
  const list = getEstudiosGuardados();
  const entry = list.find(x=>x.id===btn.dataset.id);
  if(!entry) return;
  if(btn.dataset.action==='cargar'){
    if(await cargarEstudioGuardado(entry, false)) document.getElementById('misEstudiosPanel').style.display = 'none';
  } else if(btn.dataset.action==='borrar'){
    if(!await confirmar({
      titulo:`¿Eliminar "${entry.nombre}"?`,
      texto:'Se borra de este navegador y no se puede deshacer. Si quieres conservarlo, expórtalo antes a JSON.',
      aceptar:'Eliminar', peligroso:true
    })) return;
    setEstudiosGuardados(list.filter(x=>x.id!==entry.id));
    renderEstudiosGuardadosList();
    toast('Estudio eliminado de este navegador.','ok');
  }
});
document.getElementById('btnExport').addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'estudio-viabilidad-datos.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
});
document.getElementById('btnImport').addEventListener('click', ()=> document.getElementById('fileImport').click());
document.getElementById('fileImport').addEventListener('change', e=>{
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ev=>{
    try{
      const parsed = JSON.parse(ev.target.result);
      state = mergeDefaults(parsed);
      saveState();
      renderInputs();
      recalcAndRenderOutputs();
      toast('Datos importados correctamente.','ok');
    }catch(err){
      reportar('importar JSON', err);
      toast('El archivo no es un JSON válido de esta herramienta.','error');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

/* =========================================================================
   INIT
   -------------------------------------------------------------------------
   Dos modos, decididos por un único dato: si la URL trae ?id=<uuid>.

   - CON ?id=  → modo panel: la página se ha abierto desde la Torre de Control
     en su propia pestaña. bridge.js recupera la sesión de Supabase, carga ese
     estudio y monta la barra superior con "Volver al panel" y "Guardar en el
     panel". No se muestra la pantalla de bienvenida: ya sabemos qué se abre.

   - SIN ?id=  → modo suelto de siempre: 100% localStorage, pantalla de
     bienvenida, sin tocar la red. Abrir el archivo a pelo sigue funcionando
     exactamente igual que antes.
   ========================================================================= */
renderInputs();
recalcAndRenderOutputs();
bindLogoUpload();
bindExpressUI();

if(typeof hayEstudioEnLaUrl === 'function' && hayEstudioEnLaUrl()){
  document.querySelectorAll('.solo-modo-local').forEach(el=>el.style.display='none');
  arrancarModoDashboard().catch(err=>{
    console.error('Arranque en modo panel:', err);
    setEstadoBarra('Error al conectar con el panel', 'error');
  });
} else {
  setupWelcomeScreen();
}
