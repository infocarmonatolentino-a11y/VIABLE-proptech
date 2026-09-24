/* =========================================================================
   ESTADO GLOBAL
   ========================================================================= */
/* Clave del autoguardado local. En modo suelto es una sola para toda la app
   ('evi_state_v1', como siempre). En modo panel, bridge.js la cambia por una
   POR ESTUDIO ('evi_state_dash_<uuid>') llamando a setAutosaveKey(): si no,
   el borrador del estudio que abras pisaría el del anterior. */
let AUTOSAVE_KEY = 'evi_state_v1';
function setAutosaveKey(k){ AUTOSAVE_KEY = k; }

let state = loadState();
let R = compute(state);

function loadState(){
  try{
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if(raw){ const parsed = JSON.parse(raw); return mergeDefaults(parsed); }
  }catch(e){}
  return defaultState();
}
function migrateVentas(arr){
  // Compatibilidad con datos guardados/exportados antes de la tabla dinámica de tipologías:
  // añade 'id' y 'categoria' si faltan, infiriendo la categoría del antiguo campo 'key'.
  if(!Array.isArray(arr) || arr.length===0) return defaultState().ventas;
  return arr.map((v,i)=>{
    let categoria = v.categoria;
    if(!categoria){
      const k = (v.key||v.label||'').toString().toLowerCase();
      if(k.includes('garaje')) categoria='garaje';
      else if(k.includes('trastero')) categoria='trastero';
      else if(k.includes('local')) categoria='local';
      else if(k.includes('vivienda')) categoria='vivienda';
      else categoria='otro';
    }
    return {
      id: v.id || ('t_legacy_'+i+'_'+Date.now().toString(36)),
      categoria,
      label: v.label || ('Tipología '+(i+1)),
      unidades: v.unidades||0,
      m2: v.m2||0,
      precio: v.precio||0,
      iva: v.iva!==undefined && v.iva!==null ? v.iva : 0.10,
      permuta: v.permuta||0,
      // regimen: 'Libre' | 'VPOGeneral' | 'VPOEspecial'. Los estudios guardados antes de esta
      // función siempre eran de mercado libre, así que 'Libre' es la migración correcta.
      regimen: v.regimen || 'Libre'
    };
  });
}
function migrateSuelo(target, src){
  // Compatibilidad con estudios guardados antes de la tabla de propietarios: el antiguo
  // precio único + régimen se convierte en una fila de un solo propietario, preservando
  // exactamente el mismo cálculo que ya tenía el usuario (incluido el régimen que se
  // aplicaba también a la parte permutada, ahora como "regimenPermuta").
  if(src && !Array.isArray(src.propietarios) && src.precio!==undefined){
    const regimen = src.regimen==='ITP' ? 'ITP' : 'IVA';
    const pct = regimen==='IVA' ? (src.ivaPct!=null?src.ivaPct:0.21) : (src.itpPct!=null?src.itpPct:0.10);
    src = { ...src,
      propietarios: [{ id:'prop_legacy_1', direccion:'', precio: src.precio||0, regimen, pct,
        pagoInicialPct: src.pagoInicialPct!=null?src.pagoInicialPct:0.10,
        pagoHito2Pct: src.pagoHito2Pct!=null?src.pagoHito2Pct:0,
        mesHito2: src.mesHito2!=null?src.mesHito2:0,
        mesFinal: src.mesFinal!=null?src.mesFinal:12 }],
      regimenPermuta: regimen, pctRegimenPermuta: pct
    };
  }
  for(const k in target){
    if(src && Object.prototype.hasOwnProperty.call(src,k)){
      if(k==='propietarios' && Array.isArray(src[k])) target[k] = src[k];
      else target[k] = src[k];
    }
  }
  return target;
}
function migratePartidas(arr){
  // Compatibilidad con datos guardados antes de que la tabla de partidas fuera dinámica:
  // añade 'id' si falta, sin tocar labels/valores existentes.
  if(!Array.isArray(arr) || arr.length===0) return defaultState().construccion.partidas;
  return arr.map((p,i)=>({
    id: p.id || ('pc_legacy_'+i+'_'+Date.now().toString(36)),
    label: p.label || ('Partida '+(i+1)),
    m2: p.m2||0,
    eurM2: p.eurM2||0
  }));
}
function mergeDefaults(parsed){
  const d = defaultState();
  function deepMerge(target, src){
    for(const k in target){
      if(src && Object.prototype.hasOwnProperty.call(src,k)){
        if(k==='ventas' && Array.isArray(src[k])){ target[k] = migrateVentas(src[k]); }
        else if(k==='partidas' && Array.isArray(src[k])){ target[k] = migratePartidas(src[k]); }
        else if(k==='suelo' && typeof src[k]==='object'){ target[k] = migrateSuelo(target[k], src[k]); }
        else if(Array.isArray(target[k])){ target[k] = src[k]; }
        else if(typeof target[k]==='object' && target[k]!==null){ deepMerge(target[k], src[k]); }
        else { target[k] = src[k]; }
      }
    }
    return target;
  }
  return deepMerge(d, parsed);
}
function saveState(){ try{ localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(state)); localStorage.setItem(AUTOSAVE_KEY+'_ts', new Date().toISOString()); }catch(e){} }

/* =========================================================================
   PLANTILLA DE SUPUESTOS Y BIBLIOTECA DE ESTUDIOS GUARDADOS
   Nada de esto toca compute() ni el motor de cálculo: son capas de
   almacenamiento/organización sobre el mismo "state" y las mismas funciones
   de aplicar estado (mergeDefaults + renderInputs + recalcAndRenderOutputs)
   que ya usan Restablecer/Exportar/Importar.
   ========================================================================= */
const PLANTILLA_KEY = 'evi_plantilla_v1';
const ESTUDIOS_KEY = 'evi_estudios_v1';

// La "plantilla de supuestos" es SOLO la parte de los datos que casi nunca cambia de un
// estudio a otro: honorarios, licencias, comercialización, otros gastos, financiación, y
// los dos porcentajes generales de construcción (gastos generales+beneficio industrial e
// IVA de obra). Deliberadamente NO incluye las partidas de construcción (m²/€/m² de cada
// partida), porque sus filas y superficies sí son propias de cada solar concreto.
function getPlantillaFromState(s){
  return {
    honorarios: s.honorarios,
    licencias: s.licencias,
    comercial: s.comercial,
    otros: s.otros,
    financiacion: s.financiacion,
    construccion: { ggbiPct: s.construccion.ggbiPct, ivaObraPct: s.construccion.ivaObraPct }
  };
}
function hayPlantillaGuardada(){
  try{ return !!localStorage.getItem(PLANTILLA_KEY); }catch(e){ return false; }
}

/* --- Resaltado temporal de campos tras "+ Nuevo estudio" ---
   Objetivo: que se note a simple vista qué campos se han vaciado a valores de ejemplo
   (hay que rellenarlos con los datos del solar nuevo) y cuáles se han conservado de la
   plantilla de supuestos guardada. Es puramente visual: no toca "state" ni compute(). */
const PLANTILLA_PATH_PREFIXES = ['honorarios.','licencias.','comercial.','otros.','financiacion.'];
const PLANTILLA_EXACT_PATHS = ['construccion.ggbiPct','construccion.ivaObraPct'];
function isPlantillaPath(path){
  if(PLANTILLA_EXACT_PATHS.includes(path)) return true;
  return PLANTILLA_PATH_PREFIXES.some(pref=>path.startsWith(pref));
}
let _hlNuevoEstudioActive = false;
function clearNuevoEstudioHighlight(){
  if(!_hlNuevoEstudioActive) return;
  _hlNuevoEstudioActive = false;
  document.querySelectorAll('.hl-rellenar, .hl-conservado').forEach(el=>el.classList.remove('hl-rellenar','hl-conservado'));
  document.querySelectorAll('.hl-rellenar-zone').forEach(el=>{
    el.classList.remove('hl-rellenar-zone');
    const note = el.querySelector('.hl-rellenar-zone-note');
    if(note) note.remove();
  });
  const banner = document.getElementById('nuevoEstudioBanner');
  if(banner) banner.remove();
}
function checkNuevoEstudioAllDone(){
  const quedan = document.querySelectorAll('.hl-rellenar, .hl-conservado, .hl-rellenar-zone').length;
  if(quedan===0) clearNuevoEstudioHighlight();
}
function applyNuevoEstudioHighlight(hadPlantilla){
  clearNuevoEstudioHighlight();
  _hlNuevoEstudioActive = true;
  const host = document.getElementById('inputsHost');
  if(!host) return;

  // 1) Campos sueltos (fieldHTML con data-path): se comparan contra las claves de la plantilla.
  //    Cada campo se marca a título individual, y se le engancha su propio listener de "una
  //    sola vez": en cuanto ESE campo concreto se edita, se completa él solo — los demás
  //    siguen en naranja/verde exactamente igual hasta que les toque su turno.
  host.querySelectorAll('[data-path]').forEach(inp=>{
    const field = inp.closest('.field');
    if(!field) return;
    const cls = (hadPlantilla && isPlantillaPath(inp.dataset.path)) ? 'hl-conservado' : 'hl-rellenar';
    field.classList.add(cls);
    const onDone = ()=>{ field.classList.remove('hl-rellenar','hl-conservado'); checkNuevoEstudioAllDone(); };
    inp.addEventListener('input', onDone, {once:true});
    inp.addEventListener('change', onDone, {once:true});
  });

  // 2) Tablas dinámicas (ventas, propietarios, partidas de obra): siempre son propias del
  //    solar nuevo, nunca vienen de la plantilla -> se marcan en bloque como "a rellenar".
  //    Cada tabla es su propia unidad: se completa ENTERA en cuanto se edita cualquier celda
  //    dentro de ella, independientemente de las demás tablas o campos sueltos.
  const zonas = [
    document.getElementById('ventasTableHost'),
    document.getElementById('propietariosTableHost'),
    document.querySelector('#sec-5 .table-wrap'),
  ].filter(Boolean);
  zonas.forEach(zone=>{
    zone.classList.add('hl-rellenar-zone');
    const note = document.createElement('div');
    note.className = 'hl-rellenar-zone-note';
    note.textContent = '✎ Valores de ejemplo — sustituye cada fila por los datos reales del solar.';
    zone.prepend(note);
    const onZoneDone = ()=>{
      zone.classList.remove('hl-rellenar-zone');
      const n = zone.querySelector('.hl-rellenar-zone-note');
      if(n) n.remove();
      checkNuevoEstudioAllDone();
    };
    zone.addEventListener('input', onZoneDone, {once:true});
    zone.addEventListener('change', onZoneDone, {once:true});
  });

  // 3) Banner explicativo arriba del todo, con botón para quitar el resaltado a mano (para
  //    quien no quiera rellenar literalmente todo antes de seguir) — se retira solo, además,
  //    en cuanto se completa el último campo o tabla pendiente, o al guardar el estudio.
  const banner = document.createElement('div');
  banner.id = 'nuevoEstudioBanner';
  banner.innerHTML = hadPlantilla
    ? `<span><b class="rellenar">■ Naranja</b> = valores de ejemplo, te toca rellenarlos con los datos del solar nuevo. <b class="conservado">■ Verde</b> = conservado de tu plantilla de supuestos. Cada campo se completa por su cuenta en cuanto lo editas.</span><button type="button" class="btn" id="btnCerrarNuevoEstudioBanner">Entendido, quitar resaltado</button>`
    : `<span><b class="rellenar">■ Naranja</b> = valores de ejemplo (todavía no tienes una plantilla de supuestos guardada, así que no hay nada conservado). Cada campo se completa por su cuenta en cuanto lo editas.</span><button type="button" class="btn" id="btnCerrarNuevoEstudioBanner">Entendido, quitar resaltado</button>`;
  host.prepend(banner);
  document.getElementById('btnCerrarNuevoEstudioBanner').addEventListener('click', clearNuevoEstudioHighlight);
}
function updatePlantillaHint(){
  const el = document.getElementById('plantillaHint');
  if(!el) return;
  el.textContent = hayPlantillaGuardada()
    ? 'Tienes una plantilla de supuestos guardada: "+ Nuevo estudio" arrancará con tus honorarios, licencias, comercialización, otros gastos y financiación ya rellenos.'
    : 'Aún no has guardado ninguna plantilla de supuestos: "+ Nuevo estudio" arrancará con los valores de ejemplo. Rellena Honorarios/Licencias/Comercialización/Otros gastos/Financiación como los usas siempre y pulsa "Guardar como plantilla de supuestos".';
}

// Acción real de "Nuevo estudio", compartida por el botón de la barra de herramientas y por
// la pantalla de bienvenida — un único sitio que decide qué significa "empezar de cero",
// para que nunca puedan desincronizarse.
function iniciarNuevoEstudio(){
  const hadPlantilla = hayPlantillaGuardada();
  let base = defaultState();
  if(hadPlantilla){
    try{ base = mergeDefaults(JSON.parse(localStorage.getItem(PLANTILLA_KEY))); }catch(e){}
  }
  state = base;
  saveState();
  renderInputs();
  recalcAndRenderOutputs();
  applyNuevoEstudioHighlight(hadPlantilla);
}

/* =========================================================================
   PANTALLA DE BIENVENIDA
   Se muestra al abrir la app, ENCIMA de todo, mientras el estudio ya cargado
   (el autoguardado o, si no hay, el de ejemplo) sigue calculado por debajo sin
   cambios. Cada opción llama a una acción que ya existe y ya está probada
   (iniciarNuevoEstudio, cargarEstudioGuardado, o el propio input de importar);
   esta pantalla no añade ninguna lógica de datos nueva, solo decide CUÁNDO se
   aplican, de forma explícita y visible en vez de silenciosa al abrir el archivo.
   ========================================================================= */
function formatRelativeTime(iso){
  if(!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs/60000);
  if(mins < 1) return 'justo ahora';
  if(mins < 60) return 'hace '+mins+' min';
  const hours = Math.round(mins/60);
  if(hours < 24) return 'hace '+hours+' h';
  const days = Math.round(hours/24);
  if(days === 1) return 'ayer';
  if(days < 7) return 'hace '+days+' días';
  return new Date(iso).toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'});
}
function hideWelcomeOverlay(){
  const el = document.getElementById('welcomeOverlay');
  if(el) el.style.display = 'none';
}
function setupWelcomeScreen(){
  const overlay = document.getElementById('welcomeOverlay');
  const optionsHost = document.getElementById('welcomeOptions');
  const subPanel = document.getElementById('welcomeSubPanel');
  if(!overlay || !optionsHost) return;

  let tsRaw = null, hayAutosave = false;
  try{ tsRaw = localStorage.getItem(AUTOSAVE_KEY+'_ts'); hayAutosave = !!localStorage.getItem(AUTOSAVE_KEY); }catch(e){}
  const nombreActual = (state.project && state.project.name) || 'Estudio sin nombre';

  const opciones = [];
  if(hayAutosave){
    opciones.push({ id:'continuar', icon:'▶', secondary:false,
      label:'Continuar: "'+nombreActual+'"',
      sub: tsRaw ? ('Editado '+formatRelativeTime(tsRaw)) : 'Tu última sesión en este navegador' });
  }
  opciones.push({ id:'nuevo', icon:'+', secondary:hayAutosave,
    label:'Empezar un estudio nuevo', sub:'Datos de ejemplo listos para sustituir por los del nuevo solar' });
  opciones.push({ id:'abrir', icon:'📂', secondary:true,
    label:'Abrir uno de mis estudios guardados', sub: getEstudiosGuardados().length+' estudio(s) guardado(s) en este navegador' });
  opciones.push({ id:'importar', icon:'📄', secondary:true,
    label:'Importar un archivo JSON', sub:'Desde una copia exportada anteriormente' });

  optionsHost.innerHTML = opciones.map(o=>`
    <button type="button" class="welcome-opt${o.secondary?' is-secondary':''}" data-opt="${o.id}">
      <span class="welcome-opt-icon">${o.icon}</span>
      <span class="welcome-opt-text">
        <div class="welcome-opt-label">${escapeHtml(o.label)}</div>
        <div class="welcome-opt-sub">${escapeHtml(o.sub)}</div>
      </span>
    </button>`).join('');

  function mostrarListaEstudiosEnBienvenida(){
    const list = getEstudiosGuardados().slice().sort((a,b)=> new Date(b.fecha)-new Date(a.fecha));
    subPanel.style.display = 'block';
    optionsHost.style.display = 'none';
    subPanel.innerHTML = '<button type="button" class="welcome-back" id="welcomeBack">← Volver</button>'
      + (list.length===0
          ? '<div class="estudios-empty">Todavía no has guardado ningún estudio con nombre.</div>'
          : list.map(e=>`
            <div class="estudio-row">
              <div class="estudio-info">
                <div class="estudio-nombre">${escapeHtml(e.nombre)}</div>
                <div class="estudio-fecha">${new Date(e.fecha).toLocaleString('es-ES',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
              </div>
              <div class="estudio-actions">
                <button type="button" class="btn-mini" data-id="${e.id}">Cargar</button>
              </div>
            </div>`).join(''));
    document.getElementById('welcomeBack').addEventListener('click', ()=>{
      subPanel.style.display = 'none';
      optionsHost.style.display = 'flex';
    });
    subPanel.querySelectorAll('button[data-id]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const entry = list.find(x=>x.id===btn.dataset.id);
        if(!entry) return;
        cargarEstudioGuardado(entry, true);   // skipConfirm: la bienvenida ya es la elección
        hideWelcomeOverlay();
      });
    });
  }

  optionsHost.querySelectorAll('.welcome-opt').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const opt = btn.dataset.opt;
      if(opt==='continuar'){ hideWelcomeOverlay(); }
      else if(opt==='nuevo'){ iniciarNuevoEstudio(); hideWelcomeOverlay(); }
      else if(opt==='importar'){ hideWelcomeOverlay(); document.getElementById('fileImport').click(); }
      else if(opt==='abrir'){ mostrarListaEstudiosEnBienvenida(); }
    });
  });
}

function getEstudiosGuardados(){
  try{ return JSON.parse(localStorage.getItem(ESTUDIOS_KEY))||[]; }catch(e){ return []; }
}
function setEstudiosGuardados(list){
  try{ localStorage.setItem(ESTUDIOS_KEY, JSON.stringify(list)); return true; }
  catch(e){
    reportar('guardar estudios en localStorage', e);
    toast('No hay sitio en la memoria de este navegador. Exporta el estudio a JSON como copia de seguridad.','error',{duracion:9000});
    return false;
  }
}
function renderEstudiosGuardadosList(){
  const panel = document.getElementById('misEstudiosPanel');
  if(!panel) return;
  const list = getEstudiosGuardados().slice().sort((a,b)=> new Date(b.fecha)-new Date(a.fecha));
  if(list.length===0){
    panel.innerHTML = '<div class="estudios-empty">Todavía no has guardado ningún estudio con nombre. Usa "Guardar estudio" para poder volver a él más adelante.</div>';
    return;
  }
  panel.innerHTML = list.map(e=>`
    <div class="estudio-row">
      <div class="estudio-info">
        <div class="estudio-nombre">${escapeHtml(e.nombre)}</div>
        <div class="estudio-fecha">${new Date(e.fecha).toLocaleString('es-ES',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
      </div>
      <div class="estudio-actions">
        <button type="button" class="btn-mini" data-action="cargar" data-id="${e.id}">Cargar</button>
        <button type="button" class="btn-mini btn-mini-danger" data-action="borrar" data-id="${e.id}">Eliminar</button>
      </div>
    </div>`).join('');
}
