/* =========================================================================
   RENDER: INPUTS
   ========================================================================= */
function fieldHTML(opts){
  // opts: {label, path, type, percent, step, suffix, helper, min}
  const raw = getByPath(state, opts.path);
  let displayVal = raw;
  if(opts.percent) displayVal = (raw*100);
  const step = opts.step!==undefined?opts.step:(opts.percent?0.1:1);
  const min = opts.min!==undefined ? `min="${opts.min}"` : '';
  return `
  <div class="field${opts.computed?' computed':''}">
    <label>${opts.label}</label>
    <div class="${opts.suffix?'with-suffix':''}">
      <input type="${opts.type||'number'}" step="${step}" ${min}
        data-path="${opts.path}" data-percent="${opts.percent?'1':'0'}"
        value="${opts.type==='text'||opts.type==='date'?raw:displayVal}"
        ${opts.computed?'readonly':''} />
      ${opts.suffix?`<span>${opts.suffix}</span>`:''}
    </div>
    ${opts.helper?`<div class="helper">${opts.helper}</div>`:''}
  </div>`;
}

function renderInputs(){
  const host = document.getElementById('inputsHost');
  host.innerHTML = `

  <div class="card" id="sec-1" data-family="estructura">
    <h3><span class="card-icon"><svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="12" r="2"/><line x1="13" y1="10" x2="18" y2="10"/><line x1="13" y1="14" x2="17" y2="14"/></svg></span><span class="n">1</span> Identificación del proyecto</h3>
    <div class="field-grid">
      ${fieldHTML({label:'Nombre del proyecto', path:'project.name', type:'text'})}
      ${fieldHTML({label:'Dirección', path:'project.address', type:'text'})}
      ${fieldHTML({label:'Fecha del estudio', path:'project.date', type:'date'})}
      ${fieldHTML({label:'Promotor', path:'project.promoter', type:'text'})}
      ${fieldHTML({label:'Tipología', path:'project.typology', type:'text'})}
    </div>
  </div>

  <div class="card" id="sec-2" data-family="estructura">
    <h3><span class="card-icon"><svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="6" height="10"/><rect x="14" y="4" width="6" height="16"/></svg></span><span class="n">2</span> Parámetros urbanísticos y superficies (m²)</h3>
    <div class="field-grid">
      ${fieldHTML({label:'Superficie del solar', path:'urban.supSolar', suffix:'m²'})}
      ${fieldHTML({label:'Edificabilidad máxima sobre rasante', path:'urban.edifMax', suffix:'m²', helper:'Techo computable según normativa'})}
      ${fieldHTML({label:'Densidad máxima (viviendas)', path:'urban.densidadMax', suffix:'ud.', helper:'Nº máximo de unidades permitidas'})}
      ${fieldHTML({label:'Sup. construida sobre rasante', path:'urban.supSR', suffix:'m²', helper:'Viviendas + zonas comunes · computa edificabilidad'})}
      ${fieldHTML({label:'Sup. construida bajo rasante', path:'urban.supBR', suffix:'m²', helper:'Garajes y trasteros · no computa edificabilidad'})}
      ${fieldHTML({label:'Sup. de terrazas y balcones', path:'urban.supTerrazas', suffix:'m²', helper:'Privativas no computables'})}
      ${fieldHTML({label:'Plazas de aparcamiento exigidas por normativa', path:'urban.plazasExigidas', suffix:'ud.', helper:'0 = sin dato / no verificado todavía. Se contrasta contra las plazas de garaje de la sección 3 (Ventas)'})}
      ${fieldHTML({label:'% mínimo de techo destinado a VPO', path:'urban.reservaVPOPct', percent:true, suffix:'%', helper:'Reserva urbanística obligatoria de vivienda protegida (habitual en promociones por encima de cierto umbral). 0% = sin exigencia. Se contrasta contra el régimen de cada fila de vivienda en la sección 3 (Ventas)'})}
      <div class="field computed"><label>% de techo en VPO actualmente planificado</label><input readonly value="" id="calcPctVPO"><div class="helper">Techo de viviendas en régimen VPO (general o especial) sobre el total de sup. sobre rasante</div></div>
      <div class="field computed"><label>Edificabilidad consumida</label><input readonly value="" id="calcEdifConsumida"><div class="helper">Aviso si &lt;100%: queda techo sin agotar</div></div>
      <div class="field computed"><label>Edificabilidad sin consumir</label><input readonly value="" id="calcEdifLibre"><div class="helper">Potencial de ingresos adicional</div></div>
      <div class="field computed"><label>Plazas de garaje planificadas (Ventas)</label><input readonly value="" id="calcPlazasPlanificadas"><div class="helper">Suma de unidades de categoría "Garaje" en la sección 3</div></div>
      <div class="field field-full">
        <label>Notas urbanísticas adicionales</label>
        <textarea data-path="urban.notasAdicionales" rows="3" placeholder="Ej. altura reguladora, nº de plantas, % de ocupación, retranqueos, usos permitidos, clave urbanística... — informativo, no afecta a ningún cálculo">${escapeHtml(state.urban.notasAdicionales||'')}</textarea>
        <div class="helper">Campo libre solo para referencia — no interviene en ningún cálculo de la app</div>
      </div>
    </div>
  </div>

  <div class="card" id="sec-4" data-family="construccion">
    <h3><span class="card-icon"><svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18"/><path d="M5 20V10l7-6 7 6v10"/><path d="M9.5 20v-6h5v6"/></svg></span><span class="n">3</span> Adquisición del suelo</h3>
    <div class="field-grid">
      <div class="field">
        <label>Forma de pago del suelo</label>
        <div class="segmented" id="formaPagoSegmented" role="radiogroup" aria-label="Forma de pago del suelo">
          <button type="button" class="segmented-opt" data-value="efectivo">Efectivo</button>
          <button type="button" class="segmented-opt" data-value="permuta">Permuta</button>
          <button type="button" class="segmented-opt" data-value="mixta">Mixta</button>
        </div>
        <select data-path="suelo.formaPago" id="formaPagoSelect" style="display:none;" aria-hidden="true">
          <option value="efectivo">Efectivo (100% en metálico)</option>
          <option value="permuta">Permuta (entrega de unidades)</option>
          <option value="mixta">Mixta (unidades + efectivo)</option>
        </select>
        <div class="helper" id="formaPagoHelper"></div>
      </div>
      <div class="field computed" id="permutaFieldsWrap" style="display:none;">
        <label>Valor de mercado entregado en permuta</label>
        <input readonly id="calcValorPermuta">
        <div class="helper">Suma automática de las unidades marcadas como "permuta" en la tabla de precios de venta (sección 3)</div>
      </div>
      <div class="field" id="regimenPermutaWrap" style="display:none;">
        <label>Régimen fiscal de la permuta</label>
        <select data-path="suelo.regimenPermuta" id="regimenPermutaSelect">
          <option value="IVA">IVA (empresario, deducible)</option>
          <option value="ITP">ITP (particular, no deducible)</option>
        </select>
        <div class="helper">Del propietario que recibe las unidades — puede tributar distinto al resto</div>
      </div>
      <div class="field" id="pctRegimenPermutaWrap" style="display:none;">
        ${fieldHTML({label:'% de ese régimen (permuta)', path:'suelo.pctRegimenPermuta', percent:true, suffix:'%', helper:'Si es ITP en Cataluña: 10% hasta 600.000€, 11% hasta 900.000€, 12% hasta 1.500.000€, 13% en adelante (escala progresiva por tramos, no plana) — calcula tú el tipo efectivo sobre el valor total permutado, este campo no se autocalcula'})}
      </div>
      <div class="field" id="momentoPermutaWrap" style="display:none;">
        <label>Momento de la permuta</label>
        <select data-path="suelo.momentoPermutaIva" id="momentoPermutaSelect">
          <option value="firma">En la firma de la permuta (lo habitual: un único momento)</option>
          <option value="escrituracion">Repartido durante la escrituración de las ventas</option>
        </select>
        <div class="helper">De aquí depende cuándo se devenga el IVA de la permuta y desde cuándo corre el aval bancario de abajo</div>
      </div>
      <div class="field" id="mesFirmaPermutaWrap" style="display:none;">
        ${fieldHTML({label:'Mes de la firma de la permuta', path:'suelo.mesFirmaPermuta', suffix:'mes'})}
      </div>
      <div class="field" id="avalPermutaPctWrap" style="display:none;">
        ${fieldHTML({label:'Aval bancario de la permuta (% anual)', path:'suelo.avalPermutaPctAnual', percent:true, suffix:'%/año', helper:'Garantía a favor del propietario por si la promotora quiebra antes de entregarle sus unidades — sobre el valor de mercado permutado'})}
      </div>
      <div class="field computed" id="avalPermutaCalcWrap" style="display:none;">
        <label>Coste del aval de la permuta</label>
        <input readonly id="calcAvalPermuta">
        <div class="helper" id="avalPermutaHelper"></div>
      </div>
    </div>

    <h4 style="margin:18px 0 8px;">Propietarios / vendedores del suelo (parte en efectivo)</h4>
    <div class="helper" style="margin-bottom:10px;">Un suelo en desarrollo suele tener varios propietarios distintos, cada uno con su propio precio pactado y su propio régimen fiscal — añade una fila por cada uno.</div>
    <div id="propietariosTableHost"></div>

    <div class="field-grid" style="margin-top:18px;">
      <div class="field computed" id="permutaBaseWrap" style="display:none;">
        <label>Base total de la operación (efectivo + permuta)</label>
        <input readonly id="calcBaseTotal">
        <div class="helper">Es la base sobre la que se calculan comisión y notaría</div>
      </div>
      <div class="field computed" id="ivaPermutaFieldsWrap" style="display:none;">
        <label>IVA repercutido por la permuta</label>
        <input readonly id="calcIvaPermuta">
        <div class="helper">Devengo anticipado (art. 75.Dos LIVA) por las unidades entregadas — se calcula con el tipo de IVA de cada fila</div>
      </div>
      <div class="field" id="pctIvaPermutaWrap" style="display:none;">
        ${fieldHTML({label:'% del IVA cubierto en efectivo por el permutante', path:'suelo.pctIvaPermutaCubierto', percent:true, suffix:'%', helper:'0% = lo adelantas tú; 100% = te lo cubre íntegro el propietario del suelo'})}
      </div>
      <div class="field computed" id="ivaPermutaCubiertoWrap" style="display:none;">
        <label>Aportación del permutante</label>
        <input readonly id="calcIvaPermutaCubierto">
        <div class="helper">Entra en caja con el mismo calendario que el pago del suelo</div>
      </div>
      <div class="field computed" id="ivaPermutaCargoWrap" style="display:none;">
        <label>A cargo de la promotora</label>
        <input readonly id="calcIvaPermutaCargo">
        <div class="helper">Compite por caja/financiación como cualquier otro pago</div>
      </div>
      ${fieldHTML({label:'Comisión inmobiliaria', path:'suelo.comisionPct', percent:true, suffix:'%', helper:'% sobre la base total (efectivo + permuta)'})}
      ${fieldHTML({label:'Notaría, registro y gestoría', path:'suelo.notariaPct', percent:true, suffix:'%', helper:'% sobre la base total (efectivo + permuta)'})}
      ${fieldHTML({label:'Tipo de IVA general', path:'suelo.ivaGeneral', percent:true, suffix:'%', helper:'Servicios profesionales, comisiones, honorarios'})}
    </div>
    <div class="subsection-divider">
      <h4>Comparador de ofertas <span class="subsection-hint">— guarda esta configuración del suelo como una oferta con nombre para compararla luego en la pestaña "Comparador ofertas"</span></h4>
      <div style="display:flex; gap:8px; align-items:center;">
        <input type="text" id="nombreNuevaOferta" placeholder="Nombre de la oferta, ej. 'Oferta A'" style="flex:1;">
        <button type="button" class="btn" id="btnGuardarOferta">+ Guardar oferta</button>
      </div>
      <div id="ofertasListHost"></div>
    </div>
  </div>

  <div class="card" id="sec-7" data-family="fiscal">
    <h3><span class="card-icon"><svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8.5" r="5.5"/><path d="M9.2 8.5l1.8 1.8 3.6-3.6"/><path d="M8.3 13.5l-1.8 6 5.5-2.7 5.5 2.7-1.8-6"/></svg></span><span class="n">4</span> Licencias, tasas e impuestos de la obra</h3>
    <div class="field-grid">
      ${fieldHTML({label:'Tasa de licencia de obras', path:'licencias.tasaPct', percent:true, suffix:'%', helper:'% s/PC'})}
      ${fieldHTML({label:'ICIO', path:'licencias.icioPct', percent:true, suffix:'%', helper:'% s/PC · máximo legal 4%'})}
      ${fieldHTML({label:'Licencia de primera ocupación', path:'licencias.ocupacionPct', percent:true, suffix:'%', helper:'% s/PC'})}
      ${fieldHTML({label:'AJD obra nueva y división horizontal', path:'licencias.ajdPct', percent:true, suffix:'%', helper:'% s/ventas · no deducible'})}
    </div>
  </div>

  <div class="card" id="sec-5" data-family="construccion">
    <h3><span class="card-icon"><svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V9"/><path d="M4 9h13"/><path d="M13 9v5"/><path d="M13 13l4 4"/><path d="M4 21h6"/></svg></span><span class="n">5</span> Costes de construcción</h3>
    <div class="card-hint">Añade tantas partidas como necesite el presupuesto real — no hay límite de filas. Pon el nombre que quieras a cada una (cimentación especial, fachada singular, fotovoltaica...). Para una partida a precio cerrado en vez de €/m², deja m²=1 y pon el importe total en €/m².</div>
    <div id="partidasTableHost"></div>
    <div class="field-grid" style="margin-top:14px;">
      ${fieldHTML({label:'Gastos generales (13%) + beneficio industrial (6%)', path:'construccion.ggbiPct', percent:true, suffix:'%', helper:'PEM → Presupuesto de contrata'})}
      ${fieldHTML({label:'Tipo de IVA de la construcción', path:'construccion.ivaObraPct', percent:true, suffix:'%', helper:'Obra de vivienda, deducible'})}
    </div>
  </div>

  <div class="card" id="sec-3" data-family="producto">
    <h3><span class="card-icon"><svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2H4a1 1 0 00-1 1v8a1 1 0 00.29.71l9 9a1 1 0 001.42 0l7.29-7.29a1 1 0 000-1.42l-9-9A1 1 0 0012 2z"/><circle cx="7.5" cy="7.5" r="1.4" fill="currentColor" stroke="none"/></svg></span><span class="n">6</span> Precios de venta por tipología</h3>
    <div class="card-hint">Añade tantas tipologías como necesites — no hay límite de filas. Cada fila lleva su categoría (para que la app sepa qué es vivienda a efectos de densidad, superficie vendible y precio medio), unidades, m²/ud. y €/m² (o €/ud. si dejas m²/ud.=1, útil para plazas de garaje, trasteros o áticos con precio cerrado).</div>
    <div id="ventasTableHost"></div>
  </div>

  <div class="card" id="sec-8" data-family="comercial">
    <h3><span class="card-icon"><svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5v3a1 1 0 001 1h2l4 3.5v-11.5l-4 3.5H4a1 1 0 00-1 1z"/><path d="M14.5 9a3.5 3.5 0 010 6"/><path d="M17.5 6.5a7.5 7.5 0 010 11"/></svg></span><span class="n">7</span> Comercialización y escrituras <span style="font-weight:400; color:var(--ink-soft); font-size:12px;">(% sobre ventas)</span></h3>
    <div class="field-grid">
      ${fieldHTML({label:'Marketing y publicidad', path:'comercial.mktPct', percent:true, suffix:'%'})}
      ${fieldHTML({label:'Comisión de ventas', path:'comercial.comVtaPct', percent:true, suffix:'%'})}
    </div>
  </div>

  <div class="card" id="sec-6" data-family="construccion">
    <h3><span class="card-icon"><svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M14 3v6h6"/><line x1="8" y1="13.5" x2="16" y2="13.5"/><line x1="8" y1="17" x2="12.5" y2="17"/></svg></span><span class="n">8</span> Honorarios técnicos <span style="font-weight:400; color:var(--ink-soft); font-size:12px;">(% sobre Presupuesto de Contrata)</span></h3>
    <div class="field-grid">
      ${fieldHTML({label:'Proyecto básico y de ejecución (arquitecto)', path:'honorarios.proyectoPct', percent:true, suffix:'%'})}
      ${fieldHTML({label:'Dirección de obra (arquitecto y aparejador)', path:'honorarios.direccionPct', percent:true, suffix:'%'})}
      ${fieldHTML({label:'Coordinación de seguridad y salud', path:'honorarios.sysPct', percent:true, suffix:'%'})}
      ${fieldHTML({label:'Control de calidad y OCT', path:'honorarios.octPct', percent:true, suffix:'%'})}
    </div>
  </div>

  <div class="card" id="sec-9" data-family="comercial">
    <h3><span class="card-icon"><svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5a2 2 0 012-2h11a2 2 0 012 2v2H3z"/><path d="M3 9.5v7a2 2 0 002 2h12a2 2 0 002-2v-5a2 2 0 00-2-2H6"/><circle cx="16" cy="15" r="1.3" fill="currentColor" stroke="none"/></svg></span><span class="n">9</span> Otros gastos</h3>
    <div class="field-grid">
      ${fieldHTML({label:'Conexiones a suministros', path:'otros.conexPct', percent:true, suffix:'%', helper:'% s/PC'})}
      ${fieldHTML({label:'Seguro decenal y todo riesgo construcción', path:'otros.segurosPct', percent:true, suffix:'%', helper:'% s/PC'})}
      ${fieldHTML({label:'Estructura del promotor', path:'otros.estructuraPct', percent:true, suffix:'%', helper:'% s/ventas'})}
      ${fieldHTML({label:'IBI y mantenimiento del solar', path:'otros.ibiAnual', suffix:'€/año'})}
      ${fieldHTML({label:'Posventa y garantías', path:'otros.posventaPct', percent:true, suffix:'%', helper:'% s/PC'})}
      ${fieldHTML({label:'Aval de cantidades a cuenta', path:'otros.avalPct', percent:true, suffix:'%', helper:'% s/anticipos'})}
      ${fieldHTML({label:'Imprevistos', path:'otros.imprevPct', percent:true, suffix:'%', helper:'% s/ suelo+PC+honorarios+licencias'})}
    </div>
  </div>

  <div class="card" id="sec-10" data-family="fiscal">
    <h3><span class="card-icon"><svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="2.6"/><circle cx="17" cy="17" r="2.6"/><line x1="18" y1="6" x2="6" y2="18"/></svg></span><span class="n">10</span> Financiación y fiscalidad</h3>
    <div class="field-grid">
      ${fieldHTML({label:'Préstamo promotor: % sobre coste de construcción (LTC)', path:'financiacion.ltc', percent:true, suffix:'%', helper:'Sobre construcción+honorarios+licencias+comercial+otros — el suelo NUNCA se incluye aquí, se paga con capital propio'})}
      ${fieldHTML({label:'Tope LTV sobre valor de venta', path:'financiacion.ltvMax', percent:true, suffix:'%', helper:'El banco concede el MENOR de LTC y LTV — en operaciones con mucho margen, este suele ser el que realmente ata corto el préstamo'})}
      ${fieldHTML({label:'% mínimo de preventas para disponer del préstamo', path:'financiacion.preventasMinPct', percent:true, suffix:'%', helper:'Condición habitual del banco: no se dispone nada de la línea hasta no llevar contratado este % de anticipos. 0% = sin condicionante (se dispone según necesidad desde el inicio de obra)'})}
      ${fieldHTML({label:'% del suelo que también financia el préstamo', path:'financiacion.pctSueloFinanciable', percent:true, suffix:'%', helper:'0% (más habitual) = el suelo siempre va con capital propio, nunca con el préstamo. 100% = facilidad combinada suelo+construcción, el suelo compite por LTC/LTV igual que cualquier otro coste. Cualquier valor intermedio financia solo una parte.'})}
      ${fieldHTML({label:'Tipo de interés nominal anual', path:'financiacion.tipoInteres', percent:true, suffix:'%', helper:'Mensual sobre saldo dispuesto'})}
      ${fieldHTML({label:'Comisión de apertura', path:'financiacion.comApertura', percent:true, suffix:'%', helper:'% s/principal'})}
      ${fieldHTML({label:'Tasación y notaría de la hipoteca', path:'financiacion.gastosHipoteca', percent:true, suffix:'%', helper:'% s/principal'})}
      ${fieldHTML({label:'Tasa de descuento anual (para el VAN)', path:'financiacion.tasaDescuento', percent:true, suffix:'%', helper:'Coste de oportunidad del capital propio'})}
      ${fieldHTML({label:'Impuesto de sociedades', path:'financiacion.isPct', percent:true, suffix:'%'})}
      ${fieldHTML({label:'Tasa de reinversión (para la TIR modificada / MIRR)', path:'financiacion.mirrTasaReinversion', percent:true, suffix:'%', helper:'Tasa conservadora a la que se asume que se reinvierte la caja positiva intermedia. Los flujos negativos se financian al tipo de interés del préstamo de arriba.'})}
    </div>
  </div>

  <div class="card" id="sec-11" data-family="comercial">
    <h3><span class="card-icon"><svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/></svg></span><span class="n">11</span> Cronograma <span style="font-weight:400; color:var(--ink-soft); font-size:12px;">(mes 0 = compra del solar)</span></h3>
    <div class="field-grid">
      <div class="field">
        <label>Mes de inicio real del proyecto (calendario)</label>
        <select data-path="cronograma.mesCalendarioInicio" id="mesCalendarioInicioSelect">
          <option value="0">Enero</option>
          <option value="1">Febrero</option>
          <option value="2">Marzo</option>
          <option value="3">Abril</option>
          <option value="4">Mayo</option>
          <option value="5">Junio</option>
          <option value="6">Julio</option>
          <option value="7">Agosto</option>
          <option value="8">Septiembre</option>
          <option value="9">Octubre</option>
          <option value="10">Noviembre</option>
          <option value="11">Diciembre</option>
        </select>
        <div class="helper">Mes real del calendario al que corresponde el "mes 0" de este cronograma (el pago inicial del solar). Se usa solo para alinear la liquidación trimestral de IVA con los trimestres fiscales reales (ene-mar, abr-jun, jul-sep, oct-dic) y para saber en qué cierre cae diciembre.</div>
      </div>
      ${fieldHTML({label:'Mes de inicio de la obra', path:'cronograma.mesObra', suffix:'mes'})}
      ${fieldHTML({label:'Duración de la obra', path:'cronograma.durObra', suffix:'meses'})}
      ${fieldHTML({label:'Mes de inicio de las preventas', path:'cronograma.mesVentas', suffix:'mes'})}
      ${fieldHTML({label:'Duración del periodo de preventas', path:'cronograma.durVentas', suffix:'meses'})}
      ${fieldHTML({label:'% de anticipos sobre PVP', path:'cronograma.pctEntradaVentas', percent:true, suffix:'%', helper:'Entrada del comprador; el resto se cobra en la escritura'})}
      ${fieldHTML({label:'Meses de escrituración', path:'cronograma.mesesEscr', suffix:'meses', helper:'Reparto del saldo. Si lo pones a 0, se escritura el 100% de golpe en el mes de entrega, no se pierde.'})}
      ${fieldHTML({label:'Margen tras fin de obra hasta la entrega', path:'cronograma.mesesMargenEntrega', suffix:'meses', helper:'Licencia de primera ocupación, cédula de habitabilidad, certificado final de obra... 0 = se entrega el mismo mes en que termina la obra'})}
      <div class="field computed"><label>Mes de entrega / inicio de escrituración</label><input readonly value="" id="calcMesEntrega"><div class="helper">Calculado: mes de inicio de obra + duración de obra + margen de arriba</div></div>
      <div class="field computed"><label>Duración total del proyecto</label><input readonly value="" id="calcDurProyecto"><div class="helper">Calculado: mes de entrega + meses de escrituración</div></div>
    </div>
  </div>
  `;

  document.getElementById('mesCalendarioInicioSelect').value = state.cronograma.mesCalendarioInicio;
  document.getElementById('regimenPermutaSelect').value = state.suelo.regimenPermuta;
  document.getElementById('momentoPermutaSelect').value = state.suelo.momentoPermutaIva;
  document.getElementById('formaPagoSelect').value = state.suelo.formaPago;
  syncFormaPagoSegmented();
  bindFormaPagoSegmented();
  renderPropietariosTable();
  renderVentasTable();
  renderPartidasTable();
  renderOfertasList();
  bindGenericInputs();
  bindOfertasUI();
  updateInputHints();
  setupInputsScrollSpy();
  updatePlantillaHint();
}

// Control segmentado de "Forma de pago del suelo": es una capa visual sobre el <select>
// original (que sigue oculto en el DOM) — nunca duplica su lógica, solo fija su valor y
// dispara el mismo evento "change" que ya procesaba todo (recalcular, refrescar tabla de
// ventas, limpiar unidades en permuta si vuelve a efectivo, etc.). Cero riesgo de que el
// control visual y el estado real de la app se desincronicen.
function syncFormaPagoSegmented(){
  const val = state.suelo.formaPago;
  document.querySelectorAll('#formaPagoSegmented .segmented-opt').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.value===val);
  });
}
function bindFormaPagoSegmented(){
  document.querySelectorAll('#formaPagoSegmented .segmented-opt').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const sel = document.getElementById('formaPagoSelect');
      if(sel.value===btn.dataset.value) return;
      sel.value = btn.dataset.value;
      sel.dispatchEvent(new Event('change'));
      syncFormaPagoSegmented();
    });
  });
}

const CATEGORIAS_VENTA = [
  { value:'vivienda', label:'Vivienda' },
  { value:'local', label:'Local comercial' },
  { value:'garaje', label:'Garaje' },
  { value:'trastero', label:'Trastero' },
  { value:'otro', label:'Otro' }
];
function escapeHtml(s){
  return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
let _ventaIdCounter = 0;
function genVentaId(){ _ventaIdCounter++; return 't_'+Date.now().toString(36)+'_'+_ventaIdCounter; }

function renderVentasTable(){
  const host = document.getElementById('ventasTableHost');
  const permutaOn = state.suelo.formaPago !== 'efectivo';

  const rowsHtml = state.ventas.map(v=>{
    const permutaCell = permutaOn
      ? `<td class="num"><input type="number" step="1" min="0" max="${v.unidades}" data-id="${v.id}" data-vfield="permuta" value="${v.permuta||0}"></td>`
      : '';
    const catOptions = CATEGORIAS_VENTA.map(c=>`<option value="${c.value}" ${v.categoria===c.value?'selected':''}>${c.label}</option>`).join('');
    const regimenOptions = ['Libre','VPOGeneral','VPOEspecial'].map(r=>{
      const labels = { Libre:'Libre', VPOGeneral:'VPO general/concertada', VPOEspecial:'VPO especial/prom. pública' };
      return `<option value="${r}" ${(v.regimen||'Libre')===r?'selected':''}>${labels[r]}</option>`;
    }).join('');
    return `
    <tr data-row-id="${v.id}">
      <td><select data-id="${v.id}" data-vfield="categoria">${catOptions}</select></td>
      <td><input type="text" data-id="${v.id}" data-vfield="label" value="${escapeHtml(v.label)}" style="min-width:170px;"></td>
      <td><select data-id="${v.id}" data-vfield="regimen" title="Libre y VPO general/concertada tributan igual al 10% de IVA — la diferencia real de la VPO general está en que el precio de venta lo tasa la administración, no el mercado. Solo la VPO de régimen especial o promoción pública baja el IVA al 4% (art. 91.Dos.1.6º LIVA).">${regimenOptions}</select></td>
      <td class="num"><input type="number" step="1" min="0" data-id="${v.id}" data-vfield="unidades" value="${v.unidades}"></td>
      ${permutaCell}
      <td class="num"><input type="number" step="0.1" min="0" data-id="${v.id}" data-vfield="m2" value="${v.m2}"></td>
      <td class="num"><input type="number" step="1" min="0" data-id="${v.id}" data-vfield="precio" value="${v.precio}"></td>
      <td class="num"><input type="number" step="0.1" min="0" data-id="${v.id}" data-vfield="ivaPercent" value="${(v.iva*100).toFixed(1)}"></td>
      <td class="num cell-computed" id="vPvp_${v.id}">—</td>
      <td class="num cell-computed" id="vTot_${v.id}">—</td>
      <td class="num"><button type="button" class="row-del-btn" data-id="${v.id}" title="Eliminar esta fila">✕</button></td>
    </tr>`;
  }).join('');

  host.innerHTML = `
    <div class="table-wrap">
      <table id="ventasTable">
        <thead><tr>
          <th>Categoría</th><th>Etiqueta</th><th>Régimen</th><th class="num">Unidades</th>${permutaOn?'<th class="num">Uds. permuta</th>':''}
          <th class="num">m²/ud.</th><th class="num">€/m² (o €/ud.)</th><th class="num">Tipo IVA %</th>
          <th class="num">PVP/ud.</th><th class="num">Total sin IVA (cash)</th><th></th>
        </tr></thead>
        <tbody>${rowsHtml}
          <tr class="total">
            <td colspan="2">TOTAL</td><td class="num cell-computed" id="vUnidTotal">—</td>${permutaOn?'<td class="num cell-computed" id="vPermTotal">—</td>':''}
            <td></td><td></td><td></td><td></td><td class="num cell-computed" id="vIngresoTotal">—</td><td></td>
          </tr>
        </tbody>
      </table>
    </div>
    <button type="button" class="btn" id="btnAddVenta" style="margin-top:12px;">+ Añadir tipología</button>
  `;

  host.querySelectorAll('input[data-id], select[data-id]').forEach(inp=>{
    const evt = inp.tagName==='SELECT' ? 'change' : 'input';
    inp.addEventListener(evt, e=>{
      const id = e.target.dataset.id, field = e.target.dataset.vfield;
      const row = state.ventas.find(v=>v.id===id);
      if(!row) return;
      if(field==='categoria'){ row.categoria = e.target.value; }
      else if(field==='label'){ row.label = e.target.value; }
      else if(field==='regimen'){
        row.regimen = e.target.value;
        // El IVA solo cambia de verdad para la vivienda de régimen especial/promoción pública
        // (4%, art. 91.Dos.1.6º LIVA) — la VPO general/concertada tributa igual que la libre
        // (10%), su diferencia real está en el precio tasado, no en el IVA. Solo se autocalcula
        // en filas de categoría 'vivienda': en otras categorías (garaje, local...) el régimen
        // no determina el IVA de esta forma y se deja tal cual esté puesto a mano.
        if(row.categoria==='vivienda'){
          row.iva = row.regimen==='VPOEspecial' ? 0.04 : 0.10;
          const ivaInput = host.querySelector(`input[data-id="${id}"][data-vfield="ivaPercent"]`);
          if(ivaInput) ivaInput.value = (row.iva*100).toFixed(1);
        }
      }
      else if(field==='ivaPercent'){ let val=parseFloat(e.target.value); if(isNaN(val)) val=0; row.iva = val/100; }
      else { let val=parseFloat(e.target.value); if(isNaN(val)) val=0; row[field]=val; }
      recalcAndRenderOutputs();
      updateVentasComputedCells();
    });
  });
  host.querySelectorAll('.row-del-btn').forEach(btn=>{
    btn.addEventListener('click', async e=>{
      if(state.ventas.length<=1){ toast('Debe quedar al menos una tipología en la tabla de precios.','aviso'); return; }
      if(!await confirmar({
        titulo:'¿Quitar esta tipología?',
        texto:'Los ingresos por ventas y todos los ratios se recalculan al instante.',
        aceptar:'Quitar', peligroso:true
      })) return;
      const id = e.target.dataset.id;
      state.ventas = state.ventas.filter(v=>v.id!==id);
      recalcAndRenderOutputs();
      renderVentasTable();
      updateVentasComputedCells();
    });
  });
  document.getElementById('btnAddVenta').addEventListener('click', ()=>{
    state.ventas.push({ id: genVentaId(), categoria:'vivienda', label:'Nueva tipología', unidades:1, m2:70, precio:3500, iva:0.10, permuta:0, regimen:'Libre' });
    recalcAndRenderOutputs();
    renderVentasTable();
    updateVentasComputedCells();
  });
}
function updateVentasComputedCells(){
  R.ventasCalc.forEach(v=>{
    const a = document.getElementById(`vPvp_${v.id}`); if(a) a.textContent = eur(v.pvpUd);
    const b = document.getElementById(`vTot_${v.id}`); if(b) b.textContent = eur(v.totalSinIva);
  });
  const u = document.getElementById('vUnidTotal'); if(u) u.textContent = num(R.unidadesTotal);
  const p = document.getElementById('vPermTotal'); if(p) p.textContent = num(R.unidadesPermutaTotal);
  const t = document.getElementById('vIngresoTotal'); if(t) t.textContent = eur(R.ingresosTotal);
}

let _propietarioIdCounter = 0;
function genPropietarioId(){ _propietarioIdCounter++; return 'prop_'+Date.now().toString(36)+'_'+_propietarioIdCounter; }
function renderPropietariosTable(){
  const host = document.getElementById('propietariosTableHost');
  if(!host) return;

  const rowsHtml = state.suelo.propietarios.map(p=>`
    <tr data-row-id="${p.id}">
      <td><input type="text" data-id="${p.id}" data-pfield="direccion" value="${escapeHtml(p.direccion||'')}" placeholder="Ej. C/ Mayor 12" style="min-width:170px;"></td>
      <td class="num"><input type="number" step="1" min="0" data-id="${p.id}" data-pfield="precio" value="${p.precio}"></td>
      <td><select data-id="${p.id}" data-pfield="regimen">
            <option value="IVA" ${p.regimen==='IVA'?'selected':''}>IVA</option>
            <option value="ITP" ${p.regimen==='ITP'?'selected':''}>ITP</option>
          </select></td>
      <td class="num"><input type="number" step="0.1" min="0" data-id="${p.id}" data-pfield="pctPercent" value="${(p.pct*100).toFixed(1)}" title="${p.regimen==='ITP'?'Si es ITP, se autocalcula con la escala progresiva de Cataluña según el precio (10/11/12/13%). Escribe aquí un valor a mano para fijarlo tú (p.ej. si el valor de referencia catastral es mayor que el precio) y dejará de recalcularse solo.':'% de IVA soportado en la compra'}"></td>
      <td class="num cell-computed" id="pImp_${p.id}">—</td>
      <td class="num"><input type="number" step="1" min="0" max="100" data-id="${p.id}" data-pfield="pagoInicialPctPercent" value="${((p.pagoInicialPct!=null?p.pagoInicialPct:0.10)*100).toFixed(0)}" title="% que cobra este propietario al firmar, mes 0"></td>
      <td class="num"><input type="number" step="1" min="0" max="100" data-id="${p.id}" data-pfield="pagoHito2PctPercent" value="${((p.pagoHito2Pct!=null?p.pagoHito2Pct:0)*100).toFixed(0)}" title="% que cobra en el hito 2"></td>
      <td class="num"><input type="number" step="1" min="0" data-id="${p.id}" data-pfield="mesHito2" value="${p.mesHito2!=null?p.mesHito2:0}" title="Mes del hito 2 de este propietario"></td>
      <td class="num"><input type="number" step="1" min="0" data-id="${p.id}" data-pfield="mesFinal" value="${p.mesFinal!=null?p.mesFinal:12}" title="Mes del pago final (escritura) de este propietario"></td>
      <td class="num cell-computed" id="pFin_${p.id}">—</td>
      <td class="num"><button type="button" class="row-del-btn" data-id="${p.id}" title="Eliminar este propietario">✕</button></td>
    </tr>`).join('');

  host.innerHTML = `
    <div class="table-wrap">
      <table id="propietariosTable">
        <thead><tr>
          <th>Dirección del suelo</th><th class="num">Precio pactado (€)</th><th>Régimen</th>
          <th class="num">% (IVA o ITP)</th><th class="num">Importe impuesto</th>
          <th class="num">% Inicial (mes 0)</th><th class="num">% Hito 2</th><th class="num">Mes hito 2</th><th class="num">Mes final</th><th class="num">% Final</th><th></th>
        </tr></thead>
        <tbody>${rowsHtml}
          <tr class="total">
            <td>TOTAL</td><td class="num cell-computed" id="pPrecioTotal">—</td><td></td><td></td><td class="num cell-computed" id="pImpuestoTotal">—</td><td colspan="5" style="color:var(--ink-soft); font-size:12px;">El calendario de pago es propio de cada propietario, no se suma</td><td></td>
          </tr>
        </tbody>
      </table>
    </div>
    <button type="button" class="btn" id="btnAddPropietario" style="margin-top:12px;">+ Añadir propietario</button>
  `;

  host.querySelectorAll('input[data-id], select[data-id]').forEach(inp=>{
    const evt = inp.tagName==='SELECT' ? 'change' : 'input';
    inp.addEventListener(evt, e=>{
      const id = e.target.dataset.id, field = e.target.dataset.pfield;
      const row = state.suelo.propietarios.find(p=>p.id===id);
      if(!row) return;
      if(field==='direccion'){ row.direccion = e.target.value; }
      else if(field==='regimen'){
        row.regimen = e.target.value;
        // Al pasar a ITP sin que el usuario haya tocado el % a mano todavía, se calcula solo
        // con la escala progresiva catalana vigente — así nunca se queda "colgado" un tipo
        // plano antiguo por olvido. Si ya lo había editado a mano (row.pctManual), se respeta.
        if(row.regimen==='ITP' && !row.pctManual){
          row.pct = itpEfectivoCataluna(row.precio);
          const pctInput = host.querySelector(`input[data-id="${id}"][data-pfield="pctPercent"]`);
          if(pctInput) pctInput.value = (row.pct*100).toFixed(1);
        }
      }
      else if(field==='pctPercent'){
        let val=parseFloat(e.target.value); if(isNaN(val)) val=0; row.pct = val/100;
        // El usuario ha escrito el % a mano: a partir de ahora deja de autocalcularse con
        // cada cambio de precio, para no pisar un valor puesto a propósito (p.ej. un tipo
        // reducido, o el % correcto si el valor de referencia catastral supera al precio).
        row.pctManual = true;
      }
      else if(field==='pagoInicialPctPercent'){ let val=parseFloat(e.target.value); if(isNaN(val)) val=0; row.pagoInicialPct = val/100; }
      else if(field==='pagoHito2PctPercent'){ let val=parseFloat(e.target.value); if(isNaN(val)) val=0; row.pagoHito2Pct = val/100; }
      else {
        let val=parseFloat(e.target.value); if(isNaN(val)) val=0; row[field]=val;
        if(field==='precio' && row.regimen==='ITP' && !row.pctManual){
          row.pct = itpEfectivoCataluna(row.precio);
          const pctInput = host.querySelector(`input[data-id="${id}"][data-pfield="pctPercent"]`);
          if(pctInput) pctInput.value = (row.pct*100).toFixed(1);
        }
      }
      recalcAndRenderOutputs();
      updatePropietariosComputedCells();
    });
  });
  host.querySelectorAll('.row-del-btn').forEach(btn=>{
    btn.addEventListener('click', async e=>{
      if(state.suelo.propietarios.length<=1){ toast('Debe quedar al menos un propietario del suelo.','aviso'); return; }
      if(!await confirmar({
        titulo:'¿Quitar este propietario?',
        texto:'El precio del suelo y su reparto fiscal se recalculan al instante.',
        aceptar:'Quitar', peligroso:true
      })) return;
      const id = e.target.dataset.id;
      state.suelo.propietarios = state.suelo.propietarios.filter(p=>p.id!==id);
      recalcAndRenderOutputs();
      renderPropietariosTable();
      updatePropietariosComputedCells();
    });
  });
  document.getElementById('btnAddPropietario').addEventListener('click', ()=>{
    // El régimen por defecto lo fija Dirección en Configuración maestra
    // (CONFIG.regimenFiscalDefecto); sin panel conectado sigue siendo 'ITP'.
    state.suelo.propietarios.push({ id: genPropietarioId(), direccion:'', precio:0, regimen:(CONFIG.regimenFiscalDefecto||'ITP'), pct:itpEfectivoCataluna(0), pagoInicialPct:0.10, pagoHito2Pct:0, mesHito2:0, mesFinal:12 });
    recalcAndRenderOutputs();
    renderPropietariosTable();
    updatePropietariosComputedCells();
  });
}
function updatePropietariosComputedCells(){
  R.propietariosCalc.forEach(p=>{
    const el = document.getElementById(`pImp_${p.id}`);
    if(el) el.textContent = eur(p.regimen==='IVA'?p.ivaSoportadoFila:p.itpFila);
    const fin = document.getElementById(`pFin_${p.id}`);
    if(fin) fin.textContent = fmtPct(p.pagoFinalPct,0);
  });
  const pt = document.getElementById('pPrecioTotal'); if(pt) pt.textContent = eur(R.precioCashSolar);
  const it = document.getElementById('pImpuestoTotal'); if(it) it.textContent = eur(R.ivaCompraSoportadoPropietarios+R.itpCompraCostePropietarios);
}

let _partidaIdCounter = 0;
function genPartidaId(){ _partidaIdCounter++; return 'pc_'+Date.now().toString(36)+'_'+_partidaIdCounter; }

function renderPartidasTable(){
  const host = document.getElementById('partidasTableHost');
  const rowsHtml = state.construccion.partidas.map(p=>`
    <tr data-row-id="${p.id}">
      <td><input type="text" data-id="${p.id}" data-pfield="label" value="${escapeHtml(p.label)}" style="min-width:190px;"></td>
      <td class="num"><input type="number" step="1" min="0" data-id="${p.id}" data-pfield="m2" value="${p.m2}"></td>
      <td class="num"><input type="number" step="1" min="0" data-id="${p.id}" data-pfield="eurM2" data-tipo="euro" value="${p.eurM2}"></td>
      <td class="num" id="pBase_${p.id}">—</td>
      <td class="num"><button type="button" class="row-del-btn" data-id="${p.id}" title="Eliminar esta partida">✕</button></td>
    </tr>`).join('');

  host.innerHTML = `
    <div class="table-wrap">
      <table id="partidasTable">
        <thead><tr><th>Partida</th><th class="num">m²</th><th class="num">€/m²</th><th class="num">Base (€)</th><th></th></tr></thead>
        <tbody>${rowsHtml}
          <tr class="total"><td>PEM (Presupuesto de Ejecución Material)</td><td></td><td></td><td class="num" id="pPemTotal">—</td><td></td></tr>
        </tbody>
      </table>
    </div>
    <button type="button" class="btn" id="btnAddPartida" style="margin-top:12px;">+ Añadir partida</button>
  `;

  host.querySelectorAll('input[data-id]').forEach(inp=>{
    inp.addEventListener('input', e=>{
      const id = e.target.dataset.id, field = e.target.dataset.pfield;
      const row = state.construccion.partidas.find(p=>p.id===id);
      if(!row) return;
      if(field==='label'){ row.label = e.target.value; }
      else { let val=parseFloat(e.target.value); if(isNaN(val)) val=0; row[field]=val; }
      recalcAndRenderOutputs();
      updatePartidasComputedCells();
    });
  });
  host.querySelectorAll('.row-del-btn').forEach(btn=>{
    btn.addEventListener('click', async e=>{
      if(state.construccion.partidas.length<=1){ toast('Debe quedar al menos una partida de construcción.','aviso'); return; }
      if(!await confirmar({
        titulo:'¿Quitar esta partida de obra?',
        texto:'El presupuesto de ejecución material y todo lo que depende de él se recalculan al instante.',
        aceptar:'Quitar', peligroso:true
      })) return;
      const id = e.target.dataset.id;
      state.construccion.partidas = state.construccion.partidas.filter(p=>p.id!==id);
      recalcAndRenderOutputs();
      renderPartidasTable();
      updatePartidasComputedCells();
    });
  });
  document.getElementById('btnAddPartida').addEventListener('click', ()=>{
    state.construccion.partidas.push({ id: genPartidaId(), label:'Nueva partida', m2:0, eurM2:0 });
    recalcAndRenderOutputs();
    renderPartidasTable();
    updatePartidasComputedCells();
  });
}
function updatePartidasComputedCells(){
  R.partidasCalc.forEach(p=>{ const c = document.getElementById(`pBase_${p.id}`); if(c) c.textContent = eur(p.base); });
  const t = document.getElementById('pPemTotal'); if(t) t.textContent = eur(R.pem);
}
