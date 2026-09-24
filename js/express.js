// Logo de la portada: vive junto al botón "Imprimir / PDF" (no en Inputs — no tiene que ver
// con rellenar el estudio). Se lee como base64 con FileReader y se guarda dentro del propio
// `state`, así que viaja con el estudio en localStorage y en el JSON exportado/importado — el
// PDF siempre lleva el logo correcto sin depender de nada externo. Se llama UNA sola vez al
// arrancar la app (el panel es HTML estático, no se vuelve a renderizar con cada input).
/* =========================================================================
   CÁLCULO EXPRESS — sin anteproyecto, mismo motor compute() de siempre
   ========================================================================= */
// Construye un `state` completo y sintético a partir de los 12 campos del Express +
// defaultState() para todo lo demás (honorarios, licencias, financiación...). El motor que
// se ejecuta después es exactamente el mismo compute() del estudio completo — el Express no
// tiene ninguna fórmula financiera propia, solo reglas de reparto declaradas para rellenar lo
// que el estudio completo pide desglosado y aquí no se pregunta campo a campo.
// Distinto del "Valorador de suelo por residual" (sección T.02): aquél trabaja sobre TU
// estudio completo ya relleno con datos reales; este arranca de cero sin necesitar ningún
// dato previo en Inputs — son complementarios, no la misma herramienta.
function leerInputsExpress(){
  const num = id => parseFloat(document.getElementById(id).value) || 0;
  return {
    techoSR: num('exp_techoSR'), techoBR: num('exp_techoBR'), m2Local: num('exp_m2Local'),
    pctVPO: num('exp_pctVPO')/100, precioVPO: num('exp_precioVPO'),
    costeSR: num('exp_costeSR'), costeBR: num('exp_costeBR'),
    precioVivienda: num('exp_precioVivienda'), precioLocal: num('exp_precioLocal'), precioParking: num('exp_precioParking'),
    duracion: Math.max(6, num('exp_duracion')),
    precioSuelo: num('exp_precioSuelo'), margenObjetivo: num('exp_margenObjetivo')/100
  };
}

function buildExpressState(inp, precioSuelo){
  const st = defaultState();
  // --- Cronograma: se deriva TODO de la única duración total que da el usuario, con un
  // reparto proporcional declarado (no oculto): 30% esperando licencia, 55% de obra, 5% de
  // margen de gestión de entrega, 10% de escrituración — y las preventas arrancan a mitad del
  // periodo de espera de licencia, no al mismo tiempo que la obra (la lección del gate de
  // preventas: empezar a vender tarde exige más capital propio).
  const D = inp.duracion;
  const mesObra = Math.max(1, Math.round(D*0.30));
  const margen = Math.max(0, Math.round(D*0.05));
  const mesesEscr = Math.max(1, Math.round(D*0.10));
  const durObra = Math.max(3, D - mesObra - margen - mesesEscr);
  const mesVentas = Math.max(0, Math.round(mesObra*0.5));
  const durVentas = Math.max(1, mesObra + durObra - mesVentas);
  st.cronograma = { mesCalendarioInicio:0, mesObra, durObra, mesVentas, durVentas, pctEntradaVentas:0.20, mesesEscr, mesesMargenEntrega:margen };

  // --- Superficies y urbanismo: sin dato de densidad máxima ni plazas exigidas reales (no se
  // preguntan en Express), así que se neutralizan esos checks en vez de lanzar falsas alarmas
  // sobre un límite legal que aquí no se conoce.
  st.urban = { supSolar:0, edifMax:inp.techoSR, densidadMax:999999, supSR:inp.techoSR, supBR:inp.techoBR, supTerrazas:0, plazasExigidas:0, reservaVPOPct:0, notasAdicionales:'' };

  // --- Ventas: reparto vivienda libre/VPO por densidad estimada (1 vivienda libre/100m²t,
  // 1 VPO/75m²t — varía según tipología real, es una estimación, no una medición), local y
  // parking. Sin trastero separado: todo el techo bajo rasante se trata como plazas de parking.
  const techoViviendaSR = Math.max(0, inp.techoSR - inp.m2Local);
  const techoVPO_m2 = techoViviendaSR*inp.pctVPO;
  const techoLibre_m2 = techoViviendaSR - techoVPO_m2;
  const unidadesLibre = Math.max(0, Math.round(techoLibre_m2/100));
  const unidadesVPO = inp.pctVPO>0 ? Math.max(0, Math.round(techoVPO_m2/75)) : 0;
  const m2PromLibre = unidadesLibre>0 ? techoLibre_m2/unidadesLibre : 0;
  const m2PromVPO = unidadesVPO>0 ? techoVPO_m2/unidadesVPO : 0;
  const plazasParking = Math.max(0, Math.round(inp.techoBR/27));
  st.ventas = [];
  if(unidadesLibre>0) st.ventas.push({ id:'exp_v1', categoria:'vivienda', label:'Vivienda libre (estimado)', unidades:unidadesLibre, m2:m2PromLibre, precio:inp.precioVivienda, iva:0.10, permuta:0, regimen:'Libre' });
  if(unidadesVPO>0) st.ventas.push({ id:'exp_v2', categoria:'vivienda', label:'Vivienda VPO (estimado)', unidades:unidadesVPO, m2:m2PromVPO, precio:inp.precioVPO, iva:0.10, permuta:0, regimen:'VPOGeneral' });
  if(inp.m2Local>0) st.ventas.push({ id:'exp_v3', categoria:'local', label:'Local comercial (estimado)', unidades:1, m2:inp.m2Local, precio:inp.precioLocal, iva:0.21, permuta:0, regimen:'Libre' });
  if(plazasParking>0) st.ventas.push({ id:'exp_v4', categoria:'garaje', label:'Plaza de parking (estimado)', unidades:plazasParking, m2:1, precio:inp.precioParking, iva:0.21, permuta:0, regimen:'Libre' });
  if(st.ventas.length===0) st.ventas.push({ id:'exp_v0', categoria:'vivienda', label:'(sin superficie)', unidades:0, m2:0, precio:0, iva:0.10, permuta:0, regimen:'Libre' });

  // --- Construcción: dos partidas agregadas, sobre y bajo rasante, al €/m² declarado.
  st.construccion.partidas = [
    { id:'exp_c1', label:'Construcción sobre rasante (estimado)', m2:inp.techoSR, eurM2:inp.costeSR },
    { id:'exp_c2', label:'Construcción bajo rasante (estimado)', m2:inp.techoBR, eurM2:inp.costeBR }
  ];

  // --- Suelo: 100% efectivo, sin permuta (eso exige negociación ya conocida, no es de
  // Express), 10% de arras + 90% al mes de inicio de obra — el mismo patrón por defecto que
  // usa el estudio completo. El % de ITP se autocalcula con la escala progresiva de Cataluña,
  // igual que en la sección 4 del estudio completo.
  st.suelo.formaPago = 'efectivo';
  st.suelo.propietarios = [{ id:'exp_p1', direccion:'(Cálculo Express)', precio:precioSuelo, regimen:'ITP', pct:itpEfectivoCataluna(precioSuelo), pagoInicialPct:0.10, pagoHito2Pct:0, mesHito2:0, mesFinal:mesObra }];

  // Honorarios, licencias, comercial, otros gastos y financiación se dejan tal cual los trae
  // defaultState() — son los mismos % ya calibrados en el estudio completo, no dependen de
  // este solar en concreto.
  return { st, unidadesLibre, unidadesVPO, plazasParking, mesObra, durObra, mesVentas, durVentas, margen, mesesEscr };
}

function bisectarPrecioSueloParaMargen(inp, margenObjetivo){
  // Mismo patrón de bisección que ya usa compute() para los puntos de equilibrio de
  // Sensibilidad, y que usa resolverFactorSueloPorMargen() para el Valorador de suelo — aquí
  // aplicado sobre el estado sintético del Express en vez del estudio completo.
  const evalFn = precio => compute(buildExpressState(inp, precio).st).margenVentas - margenObjetivo;
  let lo = 0, hi = Math.max(1, compute(buildExpressState(inp, 0).st).ingresosTotal); // el suelo no puede razonablemente superar el total de ingresos
  let flo = evalFn(lo), fhi = evalFn(hi);
  if(isNaN(flo)) return null;
  if(flo<0) return null; // ni siquiera con suelo gratis se llega al margen exigido
  if(isNaN(fhi) || fhi>0) return hi; // con el máximo del rango, todavía no baja lo suficiente — se ofrece el techo del rango como mejor estimación
  for(let i=0;i<60;i++){
    const mid=(lo+hi)/2, fmid=evalFn(mid);
    if(Math.abs(fmid)<0.0005) return mid;
    if(flo*fmid<0){ hi=mid; fhi=fmid; } else { lo=mid; flo=fmid; }
  }
  return (lo+hi)/2;
}

function calcularExpress(){
  const inp = leerInputsExpress();
  const modo = document.querySelector('#expressModoSegmented .segmented-opt.active').dataset.modo;
  const host = document.getElementById('expressResultHost');
  let precioSueloFinal, meta, avisoModo = '';

  if(modo==='A'){
    precioSueloFinal = inp.precioSuelo;
    meta = buildExpressState(inp, precioSueloFinal);
  } else {
    const precioBisectado = bisectarPrecioSueloParaMargen(inp, inp.margenObjetivo);
    if(precioBisectado===null){
      host.innerHTML = `<div class="card"><div class="card-hint" style="color:var(--brick);">Ni siquiera con el suelo gratis se alcanza el ${fmtPct(inp.margenObjetivo,0)} de margen exigido con estos precios y costes — revisa los datos de venta/construcción antes de seguir negociando este solar.</div></div>`;
      return;
    }
    precioSueloFinal = precioBisectado;
    meta = buildExpressState(inp, precioSueloFinal);
  }

  // Importante: el Express deja de ser solo una "calculadora de bolsillo" que
  // se olvida al cambiar de pestaña. Se convierte en EL estudio real (mismo
  // mecanismo que usa Inputs), para que si el usuario pulsa "Guardar estudio"
  // o "Guardar en el panel" justo después, se guarde lo que ha visto en esta
  // pantalla -- y no un estudio vacío con los valores por defecto, que es lo
  // que ocurría antes (un bróker o delegado que solo usara el Express nunca
  // veía nada reflejado ni en "Mis estudios" ni en el dashboard).
  state = meta.st;
  R = compute(state);
  saveState();
  if(typeof renderKpiBar==='function') renderKpiBar();
  if(typeof updatePrintCover==='function') updatePrintCover();

  if(modo==='B'){
    avisoModo = `<div class="stat"><div class="stat-label">Precio de suelo máximo para ese margen</div><div class="stat-value" style="color:var(--moss);">${eur(precioSueloFinal)}</div></div>`;
  }

  host.innerHTML = `
    <div class="card" style="border-color:var(--moss); background:#F3F8F5;">
      <div class="card-hint" style="color:var(--moss); font-weight:600; margin-bottom:0;">✓ Este cálculo ya es tu estudio: si pulsas "Guardar estudio" (o "Guardar en el panel", si vienes del dashboard), se guardará con estos números.</div>
    </div>
    <div class="card">
      <h3>Resultado ${modo==='A'?'(Modo A — viabilidad)':'(Modo B — repercusión máxima)'}</h3>
      <div class="stat-row">
        ${avisoModo}
        <div class="stat"><div class="stat-label">Margen sobre ventas</div><div class="stat-value ${R.margenVentas<CONFIG.margenMin?'neg':'pos'}">${fmtPct(R.margenVentas,1)}</div></div>
        <div class="stat"><div class="stat-label">Beneficio neto</div><div class="stat-value">${eur(R.beneficioNeto)}</div></div>
        <div class="stat"><div class="stat-label">TIR anual equity</div><div class="stat-value">${fmtPct(R.tirAnual,1)}</div></div>
        <div class="stat"><div class="stat-label">MIRR anual</div><div class="stat-value">${fmtPct(R.mirrAnual,1)}</div></div>
        <div class="stat"><div class="stat-label">VAN equity</div><div class="stat-value">${eur(R.van)}</div></div>
        <div class="stat"><div class="stat-label">Equity punta necesario</div><div class="stat-value">${eur(R.equityPunta)}</div></div>
      </div>
    </div>
    <div class="card">
      <h3>Supuestos de reparto usados (declarados, no ocultos)</h3>
      <ul class="notes-list">
        <li>Densidad estimada: ${meta.unidadesLibre} viviendas libres (100m²t/ud.) ${meta.unidadesVPO>0?'+ '+meta.unidadesVPO+' VPO (75m²t/ud.)':''} — <b>estimación, no medición real</b>, varía según tipología del anteproyecto.</li>
        <li>Plazas de parking estimadas: ${meta.plazasParking} (1 cada 27 m² de techo bajo rasante), sin trastero separado.</li>
        <li>Cronograma derivado de ${inp.duracion} meses totales: obra desde el mes ${meta.mesObra} (${meta.durObra} meses), preventas desde el mes ${meta.mesVentas} (${meta.durVentas} meses), ${meta.margen} meses de margen de entrega, ${meta.mesesEscr} de escrituración.</li>
        <li>Honorarios, licencias, comercial, otros gastos y financiación: mismos % calibrados que el Estudio Completo (secciones 6-10 con sus valores por defecto).</li>
        <li>Suelo 100% efectivo, sin permuta, 10% de arras + 90% al inicio de obra.</li>
      </ul>
    </div>
    <div class="card" style="border-color:var(--brick); background:#FFF8F0;">
      <div class="card-hint" style="color:var(--brick); font-weight:600; margin-bottom:0;">⚠ Recuerda: esto es una estimación. No verifica densidad ni plazas de aparcamiento contra la normativa real de tu ayuntamiento (no se han pedido esos datos), ni conoce las superficies reales por vivienda. Para el cálculo preciso, pasa al Estudio Completo con los datos del anteproyecto del arquitecto.</div>
    </div>`;
}

function bindExpressUI(){
  const seg = document.getElementById('expressModoSegmented');
  const precioSueloWrap = document.getElementById('exp_precioSuelo_wrap');
  const margenObjetivoWrap = document.getElementById('exp_margenObjetivo_wrap');
  if(seg){
    seg.querySelectorAll('.segmented-opt').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        seg.querySelectorAll('.segmented-opt').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        const esModoB = btn.dataset.modo==='B';
        precioSueloWrap.style.display = esModoB?'none':'';
        margenObjetivoWrap.style.display = esModoB?'':'none';
      });
    });
  }
  const pctVPOInput = document.getElementById('exp_pctVPO');
  const precioVPOWrap = document.getElementById('exp_precioVPO_wrap');
  if(pctVPOInput){
    pctVPOInput.addEventListener('input', ()=>{
      precioVPOWrap.style.display = (parseFloat(pctVPOInput.value)||0)>0 ? '' : 'none';
    });
  }
  const btnCalcular = document.getElementById('btnCalcularExpress');
  if(btnCalcular) btnCalcular.addEventListener('click', calcularExpress);
}

function bindLogoUpload(){
  const toggleBtn = document.getElementById('btnLogoToggle');
  const panel = document.getElementById('logoPanel');
  const input = document.getElementById('logoUploadInput');
  const preview = document.getElementById('logoPreviewImg');
  const btnQuitar = document.getElementById('btnQuitarLogo');
  if(!input || !toggleBtn || !panel) return;

  if(state.project.logoDataUrl){ preview.src = state.project.logoDataUrl; preview.style.display = ''; btnQuitar.style.display = ''; }

  toggleBtn.addEventListener('click', e=>{
    e.stopPropagation();
    panel.style.display = panel.style.display==='none' ? 'block' : 'none';
  });
  document.addEventListener('click', e=>{
    if(panel.style.display!=='none' && !panel.contains(e.target) && e.target!==toggleBtn) panel.style.display = 'none';
  });
  panel.addEventListener('click', e=>e.stopPropagation());

  input.addEventListener('change', e=>{
    const file = e.target.files[0];
    if(!file) return;
    if(file.size > 2*1024*1024){
      toast('La imagen pesa más de 2 MB. Usa un logo más ligero para no hinchar el archivo del estudio.','aviso',{duracion:7000});
      input.value=''; return;
    }
    const reader = new FileReader();
    reader.onload = ev=>{
      state.project.logoDataUrl = ev.target.result;
      preview.src = state.project.logoDataUrl;
      preview.style.display = '';
      btnQuitar.style.display = '';
      saveState();
      updatePrintCover();
    };
    reader.readAsDataURL(file);
  });
  if(btnQuitar){
    btnQuitar.addEventListener('click', ()=>{
      state.project.logoDataUrl = '';
      preview.src = ''; preview.style.display = 'none';
      btnQuitar.style.display = 'none';
      input.value = '';
      saveState();
      updatePrintCover();
    });
  }
}
