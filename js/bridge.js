/* =========================================================================
   PUENTE CON EL DASHBOARD — MODO "PESTAÑA PROPIA" (pantalla completa)
   -------------------------------------------------------------------------
   Sustituye al antiguo par bridge.js + iframe-adapter.js. Ya no hay iframe ni
   postMessage: el dashboard abre esta misma página en una pestaña nueva con
   ?id=<uuid-del-estudio>, y aquí dentro se hace todo directamente:

     Dashboard_v4.html  --window.open('index.html?id=…')-->  index.html

   Cómo viaja la sesión: las dos páginas están en el MISMO origen, y
   supabase-js guarda la sesión en localStorage, así que la pestaña nueva
   recupera al mismo usuario con sb.auth.getSession(). No se pasa ningún
   token por la URL (quedaría en el historial del navegador y en los logs) ni
   por sessionStorage.

   SIN ?id= la app funciona exactamente igual que siempre: 100% local,
   localStorage, pantalla de bienvenida, sin tocar la red. Este archivo solo
   se activa cuando hay un id en la URL.
   ========================================================================= */

let BRIDGE = null;   // null = modo local de toda la vida

/* ---------- utilidades ---------- */
function estaConectadoAlDashboard(){ return BRIDGE !== null; }
function puedeGuardarEnDashboard(){ return !!(BRIDGE && BRIDGE.editable); }

// El dashboard guarda configuracion_maestra en snake_case; aquí se traduce a
// las claves que usa CONFIG (config.js).
function mapConfigMaestraRow(row){
  if(!row) return {};
  const out = {};
  if(row.margen_min != null)              out.margenMin = row.margen_min;
  if(row.tipo_interes != null)            out.tipoInteresDefecto = row.tipo_interes;
  if(row.coste_construccion_min != null)  out.costeConstruccionMin = row.coste_construccion_min;
  if(row.precio_venta_min != null)        out.precioVentaMin = row.precio_venta_min;
  if(row.regimen_fiscal != null)          out.regimenFiscalDefecto = row.regimen_fiscal;
  return out;
}

// Misma regla que usa el dashboard para sus alertas de equipo: por debajo del
// mínimo pero a menos de 4 puntos → riesgo medio; 4 puntos o más → alto.
function calcularRiesgo(margen, margenMin){
  if(margen == null || isNaN(margen)) return 'ok';
  if(margen < margenMin - 0.04) return 'high';
  if(margen < margenMin) return 'mid';
  return 'ok';
}

// La columna `updated_at` es la que permite detectar que otra persona ha
// guardado por encima. Si todavía no la has creado en Supabase (ver
// PENDIENTES-Y-SQL.md), el UPDATE fallaría entero y no se podría guardar
// nada — así que se reintenta sin ella y la app sigue funcionando, solo que
// sin aviso de colisión.
async function actualizarEstudio(client, estudioId, payload){
  let res = await client.from('estudios').update(payload).eq('id', estudioId).select('updated_at').single();
  if(res.error && /updated_at/.test(res.error.message||'')){
    const { updated_at, ...sinFecha } = payload;
    console.warn('La tabla `estudios` no tiene columna updated_at — guardando sin control de concurrencia.');
    res = await client.from('estudios').update(sinFecha).eq('id', estudioId).select('id').single();
  }
  return res;
}

/* =========================================================================
   ARRANQUE EN MODO DASHBOARD
   Lo llama app.js al final del init. Devuelve true si ha tomado el control
   (hay ?id=), false si toca seguir en modo local.
   ========================================================================= */
// El id del estudio viaja en el FRAGMENTO (#id=...), no en la query (?id=...).
// Motivo: muchos servidores estáticos (entre ellos "serve", el que se usa en
// las pruebas locales) redirigen "/index.html" a "/" para tener una URL
// "limpia" — y esa redirección puede perder la query string por el camino,
// dejando la app sin saber qué estudio abrir. El fragmento nunca llega a
// viajar al servidor (el navegador lo recorta antes de pedir la página), así
// que ningún redirect del servidor puede perderlo: sobrevive siempre, tanto
// abriendo el archivo a pelo (file://) como detrás de cualquier servidor.
// Se mantiene la lectura de ?id= como respaldo por si alguien escribe o
// guarda un enlace antiguo a mano.
function obtenerIdEstudioDeUrl(){
  const porHash = new URLSearchParams(location.hash.replace(/^#/, '')).get('id');
  if(porHash) return porHash;
  return new URLSearchParams(location.search).get('id');
}

function hayEstudioEnLaUrl(){
  return !!obtenerIdEstudioDeUrl();
}

async function arrancarModoDashboard(){
  const estudioId = obtenerIdEstudioDeUrl();
  if(!estudioId) return false;

  hideWelcomeOverlay();            // en modo dashboard la bienvenida no pinta nada
  mostrarBarraDashboard();
  setEstadoBarra('Conectando…');

  if(typeof window.supabase === 'undefined' || !window.supabase.createClient){
    setEstadoBarra('Sin conexión con la base de datos — trabajando en local', 'error');
    return true;
  }
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data:{ session } } = await client.auth.getSession();
  if(!session){
    await pantallaSinSesion();
    return true;
  }

  // Perfil (para saber si es Dirección) + estudio
  const [{ data: perfil }, { data: fila, error: errEstudio }] = await Promise.all([
    client.from('perfiles').select('id, nombre, rol, organizacion_id').eq('id', session.user.id).single(),
    client.from('estudios').select('*').eq('id', estudioId).single()
  ]);

  if(errEstudio || !fila){
    reportar('abrir estudio desde el panel', errEstudio);
    setEstadoBarra('No se ha podido abrir este estudio', 'error');
    await avisar({
      titulo:'No se ha podido abrir el estudio',
      texto:'O no existe, o tu usuario no tiene permiso para verlo. Vuelve al panel e inténtalo de nuevo.',
      tipo:'error', aceptar:'Volver al panel'
    });
    location.href = 'Dashboard_v4.html';
    return true;
  }

  // Configuración maestra ANTES de construir ningún estado nuevo, para que el
  // tipo de interés por defecto de un estudio nuevo sea el que fija Dirección.
  let configRow = null;
  if(perfil && perfil.organizacion_id){
    const { data } = await client.from('configuracion_maestra').select('*').eq('organizacion_id', perfil.organizacion_id).single();
    configRow = data;
  }
  setConfigMaestra(mapConfigMaestraRow(configRow));

  // Plantilla de supuestos de la EMPRESA (honorarios, licencias, comercial, otros,
  // financiación). Antes vivía solo en el localStorage de cada delegado, así que
  // cada uno tenía la suya y se perdía al cambiar de ordenador. Ahora, conectados
  // al panel, la fuente de verdad es la tabla `plantillas` de la organización.
  let plantillaOrg = null;
  if(perfil && perfil.organizacion_id){
    const { data } = await client.from('plantillas')
      .select('id, nombre, datos, created_at')
      .eq('organizacion_id', perfil.organizacion_id)
      .order('created_at', { ascending:false }).limit(1);
    if(data && data.length && data[0].datos && Object.keys(data[0].datos).length) plantillaOrg = data[0];
  }

  // BUG real, encontrado por el usuario en producción (23/09/2026): faltaba
  // comprobar que el estudio es de TU PROPIA empresa. Con solo mirar
  // creado_por y el rol, alguien que fuera Dirección de su empresa veía como
  // "editable" cualquier estudio que otra empresa le compartiera, porque
  // "soy admin" daba igual de qué organización. Los campos quedaban
  // desbloqueados, pero al guardar la política de seguridad de la base de
  // datos (que sí mira la organización) rechazaba el cambio devolviendo
  // "0 filas" — un error que no explicaba nada de lo que pasaba de verdad.
  // Esta condición ahora es un reflejo exacto de la política RLS de
  // `estudios_update` en sql/00-esquema-completo.sql: mismo organizacion_id,
  // y (lo creaste tú o eres Dirección DE ESA MISMA empresa).
  const editable = !!perfil && fila.organizacion_id === perfil.organizacion_id &&
    (fila.creado_por === session.user.id || perfil.rol === 'admin');

  BRIDGE = {
    client, estudioId,
    userId: session.user.id,
    perfil: perfil || null,
    editable,
    plantillaOrg,
    estado: fila.estado || 'borrador',
    updatedAt: fila.updated_at || null,   // para detectar ediciones de otro usuario
    dirty: false,
    listoParaMarcarSucio: false,
    ultimoGuardado: null
  };

  iniciarRegistro({
    cliente: client, app: 'viabilidad',
    usuarioId: session.user.id,
    organizacionId: perfil ? perfil.organizacion_id : null
  });

  // A partir de aquí el autoguardado local es POR ESTUDIO, no uno global
  // compartido: si no, el estudio B pisaría el borrador del estudio A.
  setAutosaveKey('evi_state_dash_' + estudioId);

  await aplicarEstudio(fila, plantillaOrg);
  pintarBarraDashboard(fila);
  if(!editable){
    bloquearEdicionSoloLectura();
    marcarComoVisto(client, estudioId, session.user.id);
  }
  vigilarCambios();
  engancharBotonPlantilla();
  return true;
}

// Decide con qué datos arranca la pantalla:
//   - el estudio ya tenía `datos` guardados  → esos
//   - el estudio es nuevo y está vacío       → estado de ejemplo LIMPIO, nunca
//     el localStorage del estudio anterior (ese era el fallo grave del modo iframe)
//   - existe un borrador local más reciente  → se ofrece recuperarlo
async function aplicarEstudio(fila, plantillaOrg){
  const tieneDatos = fila.datos && Object.keys(fila.datos).length > 0;
  const esNuevoYVacio = !tieneDatos;

  if(tieneDatos){
    state = mergeDefaults(fila.datos);
  } else if(plantillaOrg){
    // Estudio nuevo y vacío: arranca con los supuestos de la empresa ya puestos.
    state = mergeDefaults(plantillaOrg.datos);
    setEstadoBarra('Nuevo estudio con la plantilla "'+plantillaOrg.nombre+'"', 'ok');
  } else {
    state = defaultState();
  }

  // Nombre y ubicación mandan siempre desde el panel: es lo que el equipo ve
  // en la tabla de estudios, no puede haber dos verdades.
  if(fila.nombre) state.project.name = fila.nombre;
  if(fila.ubicacion) state.project.address = fila.ubicacion;

  let seRecuperoBorrador = false;
  const borrador = leerBorradorLocal();
  const borradorMasNuevo = borrador && (!fila.updated_at || new Date(borrador.ts) > new Date(fila.updated_at));
  if(borradorMasNuevo && await confirmar({
      titulo:'Tienes cambios sin guardar en este estudio',
      texto:'Se editaron ' + formatRelativeTime(borrador.ts) + ' y nunca llegaron al panel. '+
            'Si los descartas, se abre la última versión guardada.',
      aceptar:'Recuperar mis cambios', cancelar:'Descartarlos'
    })){
    state = mergeDefaults(borrador.state);
    if(fila.nombre) state.project.name = fila.nombre;
    seRecuperoBorrador = true;
  }

  saveState();
  renderInputs();
  recalcAndRenderOutputs();

  // Misma guía naranja/verde que ya existía para "+ Nuevo estudio" en modo
  // local (aplicarNuevoEstudioHighlight ya estaba hecha y probada — el único
  // hueco era que este flujo, el de abrir un estudio recién creado desde el
  // panel, nunca la llamaba). No tiene sentido si se ha recuperado un
  // borrador local: en ese caso el usuario ya llevaba un rato editando.
  if(esNuevoYVacio && !seRecuperoBorrador && typeof applyNuevoEstudioHighlight==='function'){
    applyNuevoEstudioHighlight(!!plantillaOrg);
  }
}

function leerBorradorLocal(){
  try{
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    const ts = localStorage.getItem(AUTOSAVE_KEY + '_ts');
    if(!raw || !ts) return null;
    return { state: JSON.parse(raw), ts };
  }catch(e){ return null; }
}

/* =========================================================================
   BARRA SUPERIOR DEL MODO DASHBOARD
   ========================================================================= */
function mostrarBarraDashboard(){
  if(document.getElementById('barraDashboard')) return;
  document.body.classList.add('con-barra-dashboard');
  const bar = document.createElement('div');
  bar.id = 'barraDashboard';
  bar.innerHTML = `
    <a class="bd-volver" id="bdVolver" href="Dashboard_v4.html">← Volver al panel</a>
    <div class="bd-titulo" id="bdTitulo">Estudio de viabilidad</div>
    <select class="bd-select" id="bdSelectEstado" title="Estado del estudio, el mismo que ve Dirección en el panel" style="display:none;">
      <option value="borrador">Borrador</option>
      <option value="construccion">En construcción</option>
      <option value="revision">En revisión</option>
      <option value="aprobado">Aprobado</option>
      <option value="descartado">Descartado</option>
    </select>
    <div class="bd-estado" id="bdEstado">Conectando…</div>
    <button type="button" class="bd-guardar" id="bdGuardar" style="display:none;">Guardar en el panel</button>`;
  document.body.prepend(bar);

  document.getElementById('bdGuardar').addEventListener('click', ()=>guardarEnDashboard(true));

  // El estado del estudio (borrador / en revisión / aprobado…) se puede cambiar
  // desde aquí: es donde se está trabajando de verdad. Se guarda con el resto.
  document.getElementById('bdSelectEstado').addEventListener('change', e=>{
    if(BRIDGE){ BRIDGE.estado = e.target.value; marcarSucio(); }
  });

  // Ctrl/Cmd + S guarda, como en cualquier hoja de cálculo
  document.addEventListener('keydown', e=>{
    if((e.ctrlKey||e.metaKey) && e.key && e.key.toLowerCase()==='s'){
      e.preventDefault();
      if(puedeGuardarEnDashboard()) guardarEnDashboard(true);
    }
  });
}

function pintarBarraDashboard(fila){
  document.getElementById('bdTitulo').textContent = fila.nombre || 'Estudio sin nombre';
  const btn = document.getElementById('bdGuardar');
  const sel = document.getElementById('bdSelectEstado');
  sel.value = fila.estado || 'borrador';
  if(BRIDGE.editable){
    btn.style.display = '';
    sel.style.display = '';
    if(!/plantilla/.test(document.getElementById('bdEstado').textContent)) setEstadoBarra('Todo guardado', 'ok');
  } else {
    btn.style.display = 'none';
    setEstadoBarra('Solo lectura — no eres el creador de este estudio', 'warn');
  }
}

/* =========================================================================
   SOLO LECTURA: bloquear la edición de verdad en pantalla
   -------------------------------------------------------------------------
   El permiso real ya lo garantiza Supabase (RLS): quien no es dueño del
   estudio no puede escribir en `estudios` aunque manipule la consola del
   navegador. Esto es solo para que la experiencia sea honesta: que no
   parezca editable cuando no se va a guardar nada.
   Los inputs se repintan dinámicamente al cambiar de pestaña (renderInputs,
   renderVentasTable...), así que un MutationObserver vuelve a aplicar el
   bloqueo a cualquier campo nuevo que aparezca, sin tener que tocar cada
   función de renderizado una por una.
   ========================================================================= */
function bloquearEdicionSoloLectura(){
  document.body.classList.add('viable-solo-lectura');
  const area = document.querySelector('.app') || document.body;

  const desactivarNuevos = () => {
    area.querySelectorAll('input:not([disabled]), select:not([disabled]), textarea:not([disabled])')
      .forEach(el => { el.disabled = true; });
  };
  desactivarNuevos();
  new MutationObserver(desactivarNuevos).observe(area, { childList:true, subtree:true });

  // El input de logo ya queda cubierto arriba (es un <input type="file">), pero
  // "Quitar logo" es un <button> -- lo del solar es del creador, un invitado de
  // solo lectura no debe poder tocarlo.
  const btnQuitarLogo = document.getElementById('btnQuitarLogo');
  if(btnQuitarLogo) btnQuitarLogo.disabled = true;
}

// Marca la propia fila de estudios_compartidos como "visto" la primera vez
// que se abre (no pisa 'descartado' si el destinatario ya la había archivado).
// No bloqueante: si falla (por ejemplo, versión de la base de datos sin la
// columna `estado` todavía), la app sigue funcionando con normalidad.
async function marcarComoVisto(client, estudioId, userId){
  try{
    await client.from('estudios_compartidos')
      .update({ estado:'visto' })
      .eq('estudio_id', estudioId).eq('perfil_id', userId).eq('estado', 'enviado');
  }catch(e){ reportar('marcar estudio como visto', e); }
}

function setEstadoBarra(txt, tipo){
  const el = document.getElementById('bdEstado');
  if(!el) return;
  el.textContent = txt;
  el.className = 'bd-estado' + (tipo ? ' is-'+tipo : '');
}

async function pantallaSinSesion(){
  setEstadoBarra('Sesión no iniciada', 'error');
  const btn = document.getElementById('bdGuardar');
  if(btn) btn.style.display = 'none';
  await avisar({
    titulo:'No hay ninguna sesión iniciada',
    texto:'Entra primero en el panel (Torre de Control) y abre el estudio desde ahí: esta pestaña usa la misma sesión.',
    tipo:'aviso', aceptar:'Ir al panel'
  });
  location.href = 'Dashboard_v4.html';
}

/* =========================================================================
   CAMBIOS SIN GUARDAR
   saveState() se dispara en cada tecleo (autoguardado local). Lo envolvemos
   para marcar "hay cambios sin guardar" sin tocar nada del resto de la app.
   ========================================================================= */
function vigilarCambios(){
  const originalSaveState = saveState;
  saveState = function(){
    originalSaveState();
    if(BRIDGE && BRIDGE.editable && BRIDGE.listoParaMarcarSucio) marcarSucio();
  };
  // Las llamadas a saveState() del propio arranque no cuentan como edición
  setTimeout(()=>{ if(BRIDGE) BRIDGE.listoParaMarcarSucio = true; }, 400);

  window.addEventListener('beforeunload', e=>{
    if(BRIDGE && BRIDGE.dirty){
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  });
}

function marcarSucio(){
  if(!BRIDGE || BRIDGE.dirty) return;
  BRIDGE.dirty = true;
  setEstadoBarra('Cambios sin guardar', 'warn');
}

/* =========================================================================
   PLANTILLA DE SUPUESTOS DE LA EMPRESA
   Conectados al panel, "Guardar como plantilla de supuestos" deja de escribir
   en el localStorage de este navegador y pasa a guardar en la tabla
   `plantillas` de la organización, para todo el equipo.
   ========================================================================= */
function engancharBotonPlantilla(){
  const btn = document.getElementById('btnGuardarPlantilla');
  if(!btn || !BRIDGE) return;
  const clon = btn.cloneNode(true);       // quita el listener local que puso app.js
  btn.parentNode.replaceChild(clon, btn);

  if(!BRIDGE.editable || !BRIDGE.perfil || BRIDGE.perfil.rol !== 'admin'){
    clon.disabled = true;
    clon.title = 'La plantilla de supuestos de la empresa la fija Dirección.';
    return;
  }
  clon.textContent = 'Guardar como plantilla de la empresa';
  clon.title = 'Honorarios, licencias, comercialización, otros gastos y financiación quedarán como punto de partida de todos los estudios nuevos del equipo.';
  clon.addEventListener('click', guardarPlantillaEmpresa);

  const hint = document.getElementById('plantillaHint');
  if(hint) hint.textContent = BRIDGE.plantillaOrg
    ? 'Plantilla de supuestos de la empresa en uso: "'+BRIDGE.plantillaOrg.nombre+'". Los estudios nuevos arrancan con estos honorarios, licencias, comercialización, otros gastos y financiación.'
    : 'La empresa todavía no tiene plantilla de supuestos. Cuando Dirección guarde una, los estudios nuevos arrancarán con ella.';
}

async function guardarPlantillaEmpresa(){
  if(!BRIDGE || !BRIDGE.perfil) return;
  const sugerido = (BRIDGE.plantillaOrg && BRIDGE.plantillaOrg.nombre) || 'Supuestos estándar';
  const nombre = await pedirTexto({
    titulo:'Guardar como plantilla de la empresa',
    texto:'Se guardan honorarios, licencias, comercialización, otros gastos, financiación y los porcentajes generales de construcción de este estudio. '+
          'Todos los estudios nuevos del equipo arrancarán con estos valores.',
    etiqueta:'Nombre de la plantilla',
    valor: sugerido,
    aceptar:'Guardar para el equipo'
  });
  if(!nombre) return;

  const datos = getPlantillaFromState(state);
  const fila = {
    organizacion_id: BRIDGE.perfil.organizacion_id,
    nombre, datos,
    creado_por: BRIDGE.userId
  };
  const existente = BRIDGE.plantillaOrg;
  const { data, error } = existente
    ? await BRIDGE.client.from('plantillas').update({ nombre, datos }).eq('id', existente.id).select().single()
    : await BRIDGE.client.from('plantillas').insert(fila).select().single();

  if(error){
    reportar('guardar plantilla de empresa', error);
    toast('No se ha podido guardar la plantilla de la empresa.','error');
    return;
  }
  BRIDGE.plantillaOrg = data;
  engancharBotonPlantilla();
  setEstadoBarra('Plantilla de la empresa guardada ✓', 'ok');
}

/* =========================================================================
   GUARDADO EXPLÍCITO HACIA SUPABASE
   Mismo patrón que el botón "Guardar cambios" del panel: primero conserva el
   estado ANTERIOR en historial_versiones, después escribe el nuevo `datos` +
   resultados (tir, margen, riesgo) en la fila de `estudios`. Añade control de
   concurrencia: si otro usuario ha guardado este mismo estudio desde que lo
   abriste, avisa antes de pisarlo.
   ========================================================================= */
async function guardarEnDashboard(interactivo){
  if(!BRIDGE) return { ok:false, error:'No conectado al panel (modo local).' };
  if(!BRIDGE.editable) return { ok:false, error:'Estudio en solo lectura.' };

  const { client, estudioId, userId } = BRIDGE;
  const btn = document.getElementById('bdGuardar');
  if(btn){ btn.disabled = true; btn.textContent = 'Guardando…'; }
  setEstadoBarra('Guardando…');

  try{
    let { data: actual, error: errRead } = await client.from('estudios')
      .select('nombre, ubicacion, estado, datos, updated_at').eq('id', estudioId).single();
    if(errRead && /updated_at/.test(errRead.message||'')){
      ({ data: actual, error: errRead } = await client.from('estudios')
        .select('nombre, ubicacion, estado, datos').eq('id', estudioId).single());
    }
    if(errRead) throw errRead;

    // ¿Alguien ha guardado por encima mientras trabajabas?
    if(interactivo && BRIDGE.updatedAt && actual.updated_at && actual.updated_at !== BRIDGE.updatedAt){
      const seguir = await confirmar({
        titulo:'Alguien ha guardado este estudio mientras lo tenías abierto',
        texto:'Si continúas, tus números sustituirán a los suyos. Su versión queda en el historial y se puede recuperar.',
        aceptar:'Guardar de todas formas', cancelar:'No guardar'
      });
      if(!seguir){
        setEstadoBarra('Guardado cancelado', 'warn');
        return { ok:false, error:'cancelado' };
      }
    }

    // 1) versión anterior al historial
    const { error: errHist } = await client.from('historial_versiones').insert({
      estudio_id: estudioId,
      datos: { nombre: actual.nombre, ubicacion: actual.ubicacion, estado: actual.estado, ...(actual.datos||{}) },
      guardado_por: userId
    });
    if(errHist) throw errHist;

    // 2) nueva versión + resultados que el panel muestra en su tabla
    const riesgo = calcularRiesgo(R.margenVentas, CONFIG.margenMin);
    const payload = {
      datos: state,
      tir: R.tirAnual,
      margen: R.margenVentas,
      riesgo,
      // Métricas que el panel lista sin leer `datos` entero. Todo lo que aparece
      // en las columnas de la Vista de equipo sale de aquí, así que añadir una
      // columna nueva allí solo exige añadir una clave a este objeto.
      resumen: {
        viviendas:        R.unidadesResidenciales,
        densidadMax:      state.urban.densidadMax,
        supSolar:         state.urban.supSolar,
        techoSR:          state.urban.supSR,
        techoBR:          state.urban.supBR,
        precioVentaMedio: R.precioVentaMedioVivienda,
        costeObraM2:      R.costeConstruccionRepercutido,
        repercusionSuelo: R.repercusionSueloPorVivienda,
        pctVPO:           R.pctVPOActual,
        van:              R.van,
        payback:          R.payback,
        mesEntrega:       R.mesEntrega
      },
      estado: BRIDGE.estado || actual.estado || 'borrador',
      nombre: (state.project.name || actual.nombre || '').trim() || 'Estudio sin nombre',
      ubicacion: (state.project.address || '').trim() || actual.ubicacion,
      updated_at: new Date().toISOString()
    };
    const { data: guardada, error: errUpd } = await actualizarEstudio(client, estudioId, payload);
    if(errUpd) throw errUpd;

    BRIDGE.updatedAt = (guardada && guardada.updated_at) || payload.updated_at;
    BRIDGE.dirty = false;
    BRIDGE.ultimoGuardado = new Date();
    document.getElementById('bdTitulo').textContent = payload.nombre;
    setEstadoBarra('Guardado ✓ ' + BRIDGE.ultimoGuardado.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}), 'ok');
    return { ok:true, riesgo };

  }catch(err){
    reportar('guardar estudio en el panel', err);
    setEstadoBarra('No se ha podido guardar', 'error');
    if(interactivo) await avisar({
      titulo:'No se ha podido guardar en el panel',
      texto:((err && err.message) || 'Error desconocido') + '\n\n'+
            'Tus datos siguen en esta pestaña y en el autoguardado local. Puedes reintentarlo o exportarlos a JSON como copia.',
      tipo:'error'
    });
    return { ok:false, error:(err && err.message) || 'No se pudo guardar.' };
  }finally{
    if(btn){ btn.disabled = false; btn.textContent = 'Guardar en el panel'; }
  }
}
