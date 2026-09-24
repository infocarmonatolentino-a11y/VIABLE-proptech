/* =========================================================================
   RENDER: INGRESOS
   ========================================================================= */
function categoriaLabel(cat){
  const found = CATEGORIAS_VENTA.find(c=>c.value===cat);
  return found ? found.label : 'Otro';
}

function renderIngresos(){
  const host = document.getElementById('ingresosHost');
  const permutaOn = R.permutaActiva;
  const rows = R.ventasCalc.map(v=>`
    <tr>
      <td>${escapeHtml(v.label)}</td>
      <td>${categoriaLabel(v.categoria)}</td>
      <td class="num">${num(v.unidades)}</td>
      ${permutaOn?`<td class="num ${v.permuta>0?'neg':''}">${num(v.permuta)}</td><td class="num">${num(v.unidadesVenta)}</td>`:''}
      <td class="num">${num(v.m2)}</td>
      <td class="num">${eur(v.precio)}</td>
      <td class="num">${eur2(v.pvpUd)}</td>
      <td class="num">${eur(v.totalSinIva)}</td>
      <td class="num">${fmtPct(v.iva,0)}</td>
      <td class="num">${eur(v.ivaRepercutido)}</td>
    </tr>`).join('');

  host.innerHTML = `
  ${permutaOn ? `
  <div class="card" style="border-color:var(--steel);">
    <h3>Permuta de suelo activa</h3>
    <div class="card-hint">Las unidades marcadas como "permuta" en Inputs se construyen igual, pero no generan cobro en efectivo ni entran en el Cash-Flow: se entregan directamente al propietario del solar. Su valor de mercado se ha sumado al coste del suelo (ver hoja Costes) y también se reconoce como ingreso económico a esos mismos efectos, para que el Beneficio Bruto y el margen (hoja Resumen) no se vean penalizados por el simple hecho de pagar el suelo con unidades en vez de con dinero.</div>
    <div class="stat-row">
      <div class="stat"><div class="stat-label">Unidades entregadas en permuta</div><div class="stat-value">${num(R.unidadesPermutaTotal)}</div></div>
      <div class="stat"><div class="stat-label">Valor de mercado permutado</div><div class="stat-value">${eur(R.valorPermutaTotal)}</div></div>
      <div class="stat"><div class="stat-label">Ingresos en efectivo (ventas)</div><div class="stat-value">${eur(R.ingresosTotal)}</div></div>
      <div class="stat"><div class="stat-label">Valor total de la promoción</div><div class="stat-value">${eur(R.valorTotalPromocion)}</div><div class="stat-note">Efectivo + permuta — base del AJD</div></div>
    </div>
    <div class="stat-row" style="margin-top:10px;">
      <div class="stat"><div class="stat-label">IVA repercutido por la permuta</div><div class="stat-value">${eur(R.ivaRepercutidoPermutaTotal)}</div><div class="stat-note">Devengo anticipado, art. 75.Dos LIVA</div></div>
      <div class="stat"><div class="stat-label">Aportación en efectivo del permutante</div><div class="stat-value">${eur(R.ivaPermutaCubierto)}</div><div class="stat-note">${fmtPct(R.pctIvaPermutaCubierto,0)} del IVA de la permuta</div></div>
      <div class="stat"><div class="stat-label">A cargo de la promotora</div><div class="stat-value ${R.ivaPermutaACargoPromotora>0?'neg':''}">${eur(R.ivaPermutaACargoPromotora)}</div><div class="stat-note">Necesidad de caja, entra en el Cash-Flow</div></div>
    </div>
  </div>` : ''}

  <div class="card">
    <h3>Ingresos por tipología</h3>
    <div class="card-hint">La columna "Categoría" determina qué filas cuentan como vivienda a efectos de densidad, superficie vendible y precio medio — no la posición de la fila.</div>
    <div class="table-wrap"><table>
      <thead><tr><th>Tipología</th><th>Categoría</th><th class="num">Unidades</th>${permutaOn?'<th class="num">Uds. permuta</th><th class="num">Uds. venta (cash)</th>':''}<th class="num">m²/ud.</th><th class="num">€/m² (o €/ud.)</th><th class="num">PVP/ud.</th><th class="num">Total sin IVA (cash)</th><th class="num">Tipo IVA</th><th class="num">IVA repercutido</th></tr></thead>
      <tbody>${rows}
        <tr class="total"><td>TOTAL</td><td></td><td class="num">${num(R.unidadesTotal)}</td>${permutaOn?`<td class="num">${num(R.unidadesPermutaTotal)}</td><td class="num">${num(R.unidadesTotal-R.unidadesPermutaTotal)}</td>`:''}<td></td><td></td><td></td><td class="num">${eur(R.ingresosTotal)}</td><td></td><td class="num">${eur(R.ivaRepercutidoTotal)}</td></tr>
      </tbody>
    </table></div>
  </div>

  <div class="card">
    <h3>Comprobaciones y ratios de producto</h3>
    <div class="stat-row">
      <div class="stat"><div class="stat-label">Superficie vendible sobre rasante</div><div class="stat-value">${num(R.supVendibleSR)} m²</div></div>
      <div class="stat"><div class="stat-label">Sup. construida sobre rasante (Inputs)</div><div class="stat-value">${num(state.urban.supSR)} m²</div></div>
      <div class="stat"><div class="stat-label">Ratio sup. útil vendida / construida s. rasante</div><div class="stat-value">${fmtPct(R.ratioSupVendidaConstruida,1)}</div></div>
      <div class="stat"><div class="stat-label">Unidades residenciales vs. densidad máxima</div><div class="stat-value">${R.unidadesResidenciales} / ${state.urban.densidadMax}</div></div>
      <div class="stat"><div class="stat-label">Precio medio de venta (€/m² construido)</div><div class="stat-value">${eur2(R.precioMedioM2Construido)}</div></div>
      <div class="stat"><div class="stat-label">Precio medio de vivienda</div><div class="stat-value">${eur(R.precioMedioVivienda)}</div></div>
    </div>
  </div>`;
}

/* =========================================================================
   RENDER: COSTES
   ========================================================================= */
function renderCostes(){
  const host = document.getElementById('costesHost');
  const permutaOn = R.permutaActiva;
  const filaPermuta = permutaOn ? `<tr><td>Valor de mercado entregado en permuta <span style="color:var(--ink-soft); font-weight:400;">(no supone salida de caja)</span></td><td class="num">—</td><td></td><td class="num">${eur(R.valorPermutaTotal)}</td><td class="num">${eur(0)}</td></tr>` : '';
  host.innerHTML = `
  <div class="card">
    <h3><span class="n">A.1</span> Adquisición del suelo</h3>
    ${permutaOn ? `<div class="card-hint">Forma de pago: <b>${state.suelo.formaPago==='permuta'?'Permuta':'Mixta (permuta + efectivo)'}</b>. ITP/IVA, comisión y notaría se calculan sobre la base total de la operación (efectivo + valor de las unidades entregadas), no solo sobre el efectivo.</div>` : ''}
    <div class="table-wrap"><table>
      <thead><tr><th>Concepto</th><th class="num">Base</th><th class="num">%/tipo</th><th class="num">Coste sin IVA</th><th class="num">IVA soportado deducible</th></tr></thead>
      <tbody>
        ${R.propietariosCalc.map(p=>`<tr><td>${escapeHtml(p.direccion)||'Propietario'} <span style="color:var(--ink-soft);">(${p.regimen})</span></td><td class="num">${eur(p.precio)}</td><td class="num">${fmtPct(p.pct,1)}</td><td class="num">${eur(p.regimen==='ITP'?p.precio+p.itpFila:p.precio)}</td><td class="num">${eur(p.ivaSoportadoFila)}</td></tr>`).join('')}
        <tr class="subtotal"><td>Efectivo pagado por el solar (todos los propietarios)</td><td class="num">${eur(R.precioCashSolar)}</td><td></td><td class="num">${eur(R.precioCashSolar+R.itpCompraCostePropietarios)}</td><td class="num">${eur(R.ivaCompraSoportadoPropietarios)}</td></tr>
        ${filaPermuta}
        ${permutaOn?`<tr class="subtotal"><td>Base total de la operación (efectivo + permuta)</td><td></td><td></td><td class="num">${eur(R.precioBaseTotal)}</td><td></td></tr>`:''}
        <tr><td>Total base sujeta a IVA (deducible → no coste)</td><td class="num">${eur(R.baseIvaTotal)}</td><td></td><td class="num">${eur(0)}</td><td class="num">${eur(R.ivaSoportadoSuelo - R.comisionInmoCoste*state.suelo.ivaGeneral - R.notariaCoste*state.suelo.ivaGeneral)}</td></tr>
        <tr><td>Total base sujeta a ITP (no deducible → coste)</td><td class="num">${eur(R.baseItpTotal)}</td><td></td><td class="num">${eur(R.itpCompraCoste)}</td><td class="num">${eur(0)}</td></tr>
        <tr><td>Comisión inmobiliaria</td><td class="num">${eur(R.precioBaseTotal)}</td><td class="num">${fmtPct(state.suelo.comisionPct,1)}</td><td class="num">${eur(R.comisionInmoCoste)}</td><td class="num">${eur(R.comisionInmoCoste*state.suelo.ivaGeneral)}</td></tr>
        <tr><td>Notaría, registro y gestoría</td><td class="num">${eur(R.precioBaseTotal)}</td><td class="num">${fmtPct(state.suelo.notariaPct,1)}</td><td class="num">${eur(R.notariaCoste)}</td><td class="num">${eur(R.notariaCoste*state.suelo.ivaGeneral)}</td></tr>
        <tr class="total"><td>SUBTOTAL ADQUISICIÓN DEL SUELO (coste económico)</td><td></td><td></td><td class="num">${eur(R.costeSuelo)}</td><td class="num">${eur(R.ivaSoportadoSuelo)}</td></tr>
        ${permutaOn?`<tr><td>&nbsp;&nbsp;↳ de los cuales, en efectivo (afecta al cash-flow y al préstamo)</td><td></td><td></td><td class="num">${eur(R.costeSueloCash)}</td><td></td></tr>`:''}
      </tbody>
    </table></div>
  </div>

  <div class="card">
    <h3><span class="n">A.2</span> Costes de construcción</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>Concepto</th><th class="num">m²</th><th class="num">€/m²</th><th class="num">Base</th></tr></thead>
      <tbody>
        ${R.partidasCalc.map(p=>`<tr><td>${escapeHtml(p.label)}</td><td class="num">${num(p.m2)}</td><td class="num">${eur(p.eurM2)}</td><td class="num">${eur(p.base)}</td></tr>`).join('')}
        <tr class="total"><td>PRESUPUESTO DE EJECUCIÓN MATERIAL (PEM)</td><td></td><td></td><td class="num">${eur(R.pem)}</td></tr>
        <tr><td>Gastos generales + beneficio industrial</td><td></td><td class="num">${fmtPct(state.construccion.ggbiPct,0)}</td><td class="num">${eur(R.ggbi)}</td></tr>
        <tr class="total"><td>PRESUPUESTO DE CONTRATA (PC)</td><td></td><td></td><td class="num">${eur(R.pc)}</td></tr>
        <tr><td colspan="3">IVA de la obra (deducible, no forma parte del coste)</td><td class="num">${eur(R.ivaObraSoportado)}</td></tr>
      </tbody>
    </table></div>
  </div>

  <div class="card">
    <h3><span class="n">A.3</span> Honorarios técnicos</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>Concepto</th><th class="num">Base (PC)</th><th class="num">%</th><th class="num">Coste sin IVA</th><th class="num">IVA soportado</th></tr></thead>
      <tbody>
        <tr><td>Proyecto básico y de ejecución</td><td class="num">${eur(R.pc)}</td><td class="num">${fmtPct(state.honorarios.proyectoPct,1)}</td><td class="num">${eur(R.honProyecto)}</td><td class="num">${eur(R.honProyecto*state.suelo.ivaGeneral)}</td></tr>
        <tr><td>Dirección de obra</td><td class="num">${eur(R.pc)}</td><td class="num">${fmtPct(state.honorarios.direccionPct,1)}</td><td class="num">${eur(R.honDireccion)}</td><td class="num">${eur(R.honDireccion*state.suelo.ivaGeneral)}</td></tr>
        <tr><td>Coordinación de seguridad y salud</td><td class="num">${eur(R.pc)}</td><td class="num">${fmtPct(state.honorarios.sysPct,2)}</td><td class="num">${eur(R.honSyS)}</td><td class="num">${eur(R.honSyS*state.suelo.ivaGeneral)}</td></tr>
        <tr><td>Control de calidad y OCT</td><td class="num">${eur(R.pc)}</td><td class="num">${fmtPct(state.honorarios.octPct,1)}</td><td class="num">${eur(R.honOct)}</td><td class="num">${eur(R.honOct*state.suelo.ivaGeneral)}</td></tr>
        <tr class="total"><td>SUBTOTAL HONORARIOS TÉCNICOS</td><td></td><td></td><td class="num">${eur(R.costeHonorarios)}</td><td class="num">${eur(R.ivaSoportadoHonorarios)}</td></tr>
      </tbody>
    </table></div>
  </div>

  <div class="card">
    <h3><span class="n">A.4</span> Licencias, tasas e impuestos</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>Concepto</th><th class="num">Base</th><th class="num">%</th><th class="num">Coste</th></tr></thead>
      <tbody>
        <tr><td>Tasa de licencia de obras</td><td class="num">${eur(R.pc)}</td><td class="num">${fmtPct(state.licencias.tasaPct,1)}</td><td class="num">${eur(R.tasaLicenciaCoste)}</td></tr>
        <tr><td>ICIO</td><td class="num">${eur(R.pc)}</td><td class="num">${fmtPct(state.licencias.icioPct,0)}</td><td class="num">${eur(R.icioCoste)}</td></tr>
        <tr><td>Licencia de primera ocupación</td><td class="num">${eur(R.pc)}</td><td class="num">${fmtPct(state.licencias.ocupacionPct,1)}</td><td class="num">${eur(R.licOcupacionCoste)}</td></tr>
        <tr><td>AJD obra nueva y división horizontal</td><td class="num">${eur(R.valorTotalPromocion)}</td><td class="num">${fmtPct(state.licencias.ajdPct,1)}</td><td class="num">${eur(R.ajdCoste)}</td></tr>
        ${R.permutaActiva?`<tr><td colspan="4" style="color:var(--ink-soft); font-size:12px;">Base = ventas en efectivo (${eur(R.ingresosTotal)}) + valor permutado (${eur(R.valorPermutaTotal)}), porque el AJD grava el valor total declarado.</td></tr>`:''}
        <tr class="total"><td>SUBTOTAL LICENCIAS, TASAS E IMPUESTOS</td><td></td><td></td><td class="num">${eur(R.costeLicencias)}</td></tr>
      </tbody>
    </table></div>
  </div>

  <div class="card">
    <h3><span class="n">A.5</span> Comercialización y escrituras</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>Concepto</th><th class="num">Base (ventas)</th><th class="num">%</th><th class="num">Coste sin IVA</th><th class="num">IVA soportado</th></tr></thead>
      <tbody>
        <tr><td>Marketing y publicidad</td><td class="num">${eur(R.ingresosTotal)}</td><td class="num">${fmtPct(state.comercial.mktPct,1)}</td><td class="num">${eur(R.mktCoste)}</td><td class="num">${eur(R.mktCoste*state.suelo.ivaGeneral)}</td></tr>
        <tr><td>Comisión de ventas</td><td class="num">${eur(R.ingresosTotal)}</td><td class="num">${fmtPct(state.comercial.comVtaPct,1)}</td><td class="num">${eur(R.comVtaCoste)}</td><td class="num">${eur(R.comVtaCoste*state.suelo.ivaGeneral)}</td></tr>
        <tr class="total"><td>SUBTOTAL COMERCIALIZACIÓN Y ESCRITURAS</td><td></td><td></td><td class="num">${eur(R.costeComercial)}</td><td class="num">${eur(R.ivaSoportadoComercial)}</td></tr>
      </tbody>
    </table></div>
  </div>

  <div class="card">
    <h3><span class="n">A.6</span> Otros gastos</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>Concepto</th><th class="num">Base</th><th class="num">%</th><th class="num">Coste sin IVA</th><th class="num">IVA soportado</th></tr></thead>
      <tbody>
        <tr><td>Conexiones a suministros</td><td class="num">${eur(R.pc)}</td><td class="num">${fmtPct(state.otros.conexPct,1)}</td><td class="num">${eur(R.conexCoste)}</td><td class="num">${eur(R.conexCoste*state.suelo.ivaGeneral)}</td></tr>
        <tr><td>Seguro decenal y todo riesgo construcción</td><td class="num">${eur(R.pc)}</td><td class="num">${fmtPct(state.otros.segurosPct,1)}</td><td class="num">${eur(R.segurosCoste)}</td><td class="num">${eur(0)}</td></tr>
        <tr><td>Estructura de la sociedad promotora</td><td class="num">${eur(R.ingresosTotal)}</td><td class="num">${fmtPct(state.otros.estructuraPct,1)}</td><td class="num">${eur(R.estructuraCoste)}</td><td class="num">${eur(R.estructuraCoste*state.suelo.ivaGeneral)}</td></tr>
        <tr><td>IBI y mantenimiento del solar</td><td class="num">${eur(state.otros.ibiAnual)}/año</td><td class="num">${num(R.durProyecto/12,1)} años</td><td class="num">${eur(R.ibiCoste)}</td><td class="num">${eur(0)}</td></tr>
        <tr><td>Posventa y garantías</td><td class="num">${eur(R.pc)}</td><td class="num">${fmtPct(state.otros.posventaPct,1)}</td><td class="num">${eur(R.posventaCoste)}</td><td class="num">${eur(R.posventaCoste*state.suelo.ivaGeneral)}</td></tr>
        <tr><td>Aval de cantidades a cuenta</td><td class="num">${eur(R.ingresosTotal*state.cronograma.pctEntradaVentas)}</td><td class="num">${fmtPct(state.otros.avalPct,1)}</td><td class="num">${eur(R.avalCoste)}</td><td class="num">${eur(R.avalCoste*state.suelo.ivaGeneral)}</td></tr>
        ${R.permutaActiva?`<tr><td>Aval bancario de la permuta (${R.mesesAvalPermuta} meses de garantía)</td><td class="num">${eur(R.valorPermutaTotal)}</td><td class="num">${fmtPct(state.suelo.avalPermutaPctAnual,2)}/año</td><td class="num">${eur(R.avalPermutaCoste)}</td><td class="num">${eur(R.ivaAvalPermuta)}</td></tr>`:''}
        <tr><td>Imprevistos</td><td class="num">${eur(R.costeSuelo+R.pc+R.costeHonorarios+R.costeLicencias)}</td><td class="num">${fmtPct(state.otros.imprevPct,0)}</td><td class="num">${eur(R.imprevistosCoste)}</td><td class="num">${eur(0)}</td></tr>
        <tr class="total"><td>SUBTOTAL OTROS GASTOS</td><td></td><td></td><td class="num">${eur(R.costeOtros)}</td><td class="num">${eur(R.ivaSoportadoOtros)}</td></tr>
      </tbody>
    </table></div>
  </div>

  <div class="card">
    <h3>Coste de la promoción sin gastos financieros</h3>
    <div class="stat-row">
      <div class="stat"><div class="stat-label">Coste económico (afecta al margen)</div><div class="stat-value">${eur(R.costeSinFin)}</div></div>
      ${R.permutaActiva?`<div class="stat"><div class="stat-label">Coste en caja (dimensiona préstamo)</div><div class="stat-value">${eur(R.costeSinFinCash)}</div></div>`:''}
      <div class="stat"><div class="stat-label">IVA soportado total (deducible)</div><div class="stat-value">${eur(R.ivaSoportadoTotal)}</div></div>
    </div>
  </div>

  <div class="card">
    <h3><span class="n">A.7</span> Gastos financieros</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>Concepto</th><th class="num">Base (principal)</th><th class="num">%</th><th class="num">Coste</th></tr></thead>
      <tbody>
        <tr><td>Comisión de apertura</td><td class="num">${eur(R.principal)}</td><td class="num">${fmtPct(state.financiacion.comApertura,1)}</td><td class="num">${eur(R.comisionApertura)}</td></tr>
        <tr><td>Tasación y notaría de la hipoteca</td><td class="num">${eur(R.principal)}</td><td class="num">${fmtPct(state.financiacion.gastosHipoteca,1)}</td><td class="num">${eur(R.tasacionNotaria)}</td></tr>
        <tr><td>Intereses del préstamo promotor</td><td class="num">${eur(R.principal)}</td><td></td><td class="num">${eur(R.interesesTotales)}</td></tr>
        <tr class="total"><td>SUBTOTAL GASTOS FINANCIEROS</td><td></td><td></td><td class="num">${eur(R.costeFinanciero)}</td></tr>
      </tbody>
    </table></div>
  </div>

  <div class="card">
    <h3>Coste total de la promoción</h3>
    <div class="stat-row">
      <div class="stat"><div class="stat-label">Coste total económico (para el margen)</div><div class="stat-value">${eur(R.costeTotal)}</div></div>
      ${R.permutaActiva?`<div class="stat"><div class="stat-label">Coste total en caja (préstamo + equity)</div><div class="stat-value">${eur(R.costeTotalCash)}</div></div>
      <div class="stat"><div class="stat-label">Diferencia = valor entregado en permuta</div><div class="stat-value">${eur(R.costeTotal-R.costeTotalCash)}</div></div>`:''}
    </div>
  </div>`;
}

/* =========================================================================
   RENDER: FINANCIACION
   ========================================================================= */
function renderFinanciacion(){
  const host = document.getElementById('financiacionHost');
  const permutaOn = R.permutaActiva;
  host.innerHTML = `
  <div class="card" style="border-color:var(--steel);">
    <h3>El suelo se financia siempre con capital propio</h3>
    <div class="card-hint">El préstamo promotor solo se concede sobre el suelo ya adquirido (para construir encima), no para comprarlo: por eso su pago (${eur(R.costeSueloCash)} en caja) queda fuera de la base del LTC y nunca compite por el límite del préstamo, sea cual sea su calendario de pago. El banco concede además el <b>menor</b> de dos topes:</div>
    <div class="stat-row">
      <div class="stat"><div class="stat-label">Límite por LTC (${fmtPct(state.financiacion.ltc,0)} s/construcción+resto)</div><div class="stat-value">${eur(R.limiteLtc)}</div></div>
      <div class="stat"><div class="stat-label">Límite por LTV (${fmtPct(R.ltvMaxUsado,0)} s/valor de venta)</div><div class="stat-value">${eur(R.limiteLtv)}</div></div>
      <div class="stat"><div class="stat-label">Principal concedido (el menor de los dos)</div><div class="stat-value">${eur(R.principal)}</div><div class="stat-note">Tope vinculante: ${R.limiteVinculante}</div></div>
    </div>
  </div>
  ${permutaOn ? `
  <div class="card" style="border-color:var(--steel);">
    <h3>Permuta activa: cómo afecta a la financiación</h3>
    <div class="card-hint">El préstamo y el capital propio solo se dimensionan sobre las necesidades reales de tesorería. El valor entregado en permuta (${eur(R.valorPermutaTotal)}) no requiere financiación bancaria ni aportación de caja: se "paga" con la entrega de las propias unidades construidas.</div>
  </div>` : ''}
  <div class="grid-2">
    <div class="card">
      <h3>Estructura de financiación (caja)</h3>
      <div class="stat-row">
        <div class="stat"><div class="stat-label">Coste en caja sin gastos financieros</div><div class="stat-value">${eur(R.costeSinFinCash)}</div></div>
        <div class="stat"><div class="stat-label">&nbsp;&nbsp;↳ de los cuales, suelo (100% capital propio)</div><div class="stat-value">${eur(R.costeSueloCash)}</div></div>
        <div class="stat"><div class="stat-label">&nbsp;&nbsp;↳ de los cuales, construcción+resto (base del LTC)</div><div class="stat-value">${eur(R.baseLtcConstruccion)}</div></div>
        <div class="stat"><div class="stat-label">Préstamo promotor (principal)</div><div class="stat-value">${eur(R.principal)}</div><div class="stat-note">Menor de LTC (sin suelo) y LTV — ver tarjeta de arriba</div></div>
        <div class="stat"><div class="stat-label">Gastos financieros</div><div class="stat-value">${eur(R.costeFinanciero)}</div></div>
        <div class="stat"><div class="stat-label">Coste total en caja</div><div class="stat-value">${eur(R.costeTotalCash)}</div></div>
        <div class="stat"><div class="stat-label">Capital propio (equity)</div><div class="stat-value">${eur(R.equity)}</div><div class="stat-note">= coste total en caja − préstamo</div></div>
        ${permutaOn?`<div class="stat"><div class="stat-label">Coste económico total (referencia, para el margen)</div><div class="stat-value">${eur(R.costeTotal)}</div></div>`:''}
      </div>
    </div>
    <div class="card">
      <h3>Ratios de apalancamiento</h3>
      <div class="stat-row">
        <div class="stat"><div class="stat-label">% préstamo sobre coste en caja</div><div class="stat-value">${fmtPct(R.principal/R.costeTotalCash,1)}</div></div>
        <div class="stat"><div class="stat-label">% equity sobre coste en caja</div><div class="stat-value">${fmtPct(1-R.principal/R.costeTotalCash,1)}</div></div>
        <div class="stat"><div class="stat-label">Loan to Value (préstamo / valor total promoción)</div><div class="stat-value">${fmtPct(R.principal/R.valorTotalPromocion,1)}</div><div class="stat-note">Tope configurado: ${fmtPct(R.ltvMaxUsado,0)}</div></div>
        <div class="stat"><div class="stat-label">Equity máximo necesario (punta de tesorería)</div><div class="stat-value">${eur(R.equityPunta)}</div></div>
        <div class="stat"><div class="stat-label">Préstamo realmente dispuesto (máximo)</div><div class="stat-value">${eur(R.dispuestoMax)}</div></div>
        <div class="stat"><div class="stat-label">% del límite del préstamo utilizado</div><div class="stat-value">${fmtPct(R.dispuestoMax/R.principal,1)}</div></div>
        <div class="stat"><div class="stat-label">Intereses totales devengados</div><div class="stat-value">${eur(R.interesesTotales)}</div></div>
        <div class="stat"><div class="stat-label">Coste financiero efectivo s/principal</div><div class="stat-value">${fmtPct(R.costeFinanciero/R.principal,1)}</div></div>
      </div>
    </div>
  </div>`;
}

/* =========================================================================
   RENDER: CASH-FLOW
   ========================================================================= */
function renderCashflow(){
  const host = document.getElementById('cashflowHost');
  const n = R.nMonths;
  const months = Array.from({length:n}, (_,i)=>i);
  const headerCols = months.map(m=>`<th class="num month">${m}</th>`).join('');

  function row(label, arr, opts={}){
    // Las filas de SALDO (fotografía de un balance en cada mes: saldo inicial/final del
    // préstamo, límite disponible, dispuesto acumulado, flujo acumulado) no se suman en
    // la columna TOTAL, igual que en el Excel de origen: sumar un saldo mes a mes no
    // tiene significado económico (como sumar el saldo bancario de cada mes del año).
    const cls = opts.subtotal?'subtotal':'';
    const totalCell = opts.noTotal ? `<td class="num" style="color:#B7C0C5;">—</td>` : `<td class="num">${eur(arr.reduce((a,b)=>a+b,0))}</td>`;
    return `<tr class="${cls}"><td class="label">${label}</td>${totalCell}${arr.map(v=>`<td class="num ${v<0?'neg':''}">${eur(v)}</td>`).join('')}</tr>`;
  }
  function section(label){ return `<tr class="section-row"><td class="label">${label}</td><td colspan="${n+1}"></td></tr>`; }

  host.innerHTML = `
  <div class="card">
    <h3>Indicadores del cash-flow del equity</h3>
    <div class="card-hint">TIR, VAN, Payback y la punta de equity ya incluyen el pago real del Impuesto de Sociedades (ver fila "Pago del IS" más abajo) — no son cifras antes de impuestos.</div>
    <div class="stat-row">
      <div class="stat"><div class="stat-label">Suma de flujos de equity (neto de IS)</div><div class="stat-value">${eur(R.cf.flujoEquity.reduce((a,b)=>a+b,0))}</div></div>
      <div class="stat"><div class="stat-label">Equity máximo necesario (punta)</div><div class="stat-value">${eur(R.equityPunta)}</div></div>
      <div class="stat"><div class="stat-label">TIR mensual del equity</div><div class="stat-value">${fmtPct(R.tirMensual,2)}</div></div>
      <div class="stat"><div class="stat-label">TIR anual del equity</div><div class="stat-value">${fmtPct(R.tirAnual,1)}</div></div>
      <div class="stat"><div class="stat-label">TIR modificada (MIRR) anual</div><div class="stat-value">${fmtPct(R.mirrAnual,1)}</div></div>
      <div class="stat"><div class="stat-label">VAN del equity (mes 0)</div><div class="stat-value">${eur(R.van)}</div></div>
      <div class="stat"><div class="stat-label">Payback del equity</div><div class="stat-value">${R.payback===''?'No recupera':'Mes '+R.payback}</div></div>
      <div class="stat"><div class="stat-label">Saldo final del préstamo (comprobación)</div><div class="stat-value">${eur(R.cf.saldoFinal[n-1])}</div></div>
    </div>
  </div>

  <div class="card">
    <h3>Detalle mensual</h3>
    <div class="card-hint">Desliza horizontalmente para ver todos los meses. Columna "TOTAL" = suma de todo el horizonte. Las filas de saldo (—) no se suman: son una fotografía del balance en cada mes, no un flujo acumulable.</div>
    <div class="card-hint">El IVA repercutido en ventas y el IVA soportado en costes ya son cobros y pagos de caja reales, cada uno en su propio mes (el cliente paga el IVA junto al precio, y tú lo pagas junto a cada factura). La "Liquidación trimestral de IVA" es lo que de verdad se mueve con Hacienda cada 3 meses (Modelo 303), alineada con los trimestres fiscales reales según el "mes de inicio real" indicado en el Cronograma (sección 11): si el trimestre sale a pagar, se paga de golpe; si sale a tu favor (crédito, típico antes de empezar a vender), no se cobra ese mismo trimestre — se arrastra y descuenta del siguiente en que sí toque pagar, salvo que ese trimestre cierre en diciembre real (ahí sí hay derecho a devolución en la declaración-resumen anual, así que se cobra en efectivo) o sea la liquidación final del proyecto. A lo largo de todo el proyecto se cancela exactamente con lo anterior (el IVA es neutro para un sujeto pasivo), pero mes a mes sí genera tensión de caja real. La única excepción distinta es el IVA de la permuta, porque esas unidades nunca generan ningún cobro que lo financie.</div>
    <div class="table-wrap">
    <table class="cf-table">
      <thead><tr><th class="label">Concepto</th><th class="num">TOTAL</th>${headerCols}</tr></thead>
      <tbody>
        ${section('COBROS')}
        ${row('Anticipos de preventas (sin IVA)', R.cf.anticipos)}
        ${row('Escrituración: saldo del PVP (sin IVA)', R.cf.escrituracion)}
        ${row('TOTAL COBROS (sin IVA)', R.cf.totalCobros, {subtotal:true})}
        ${row('IVA repercutido en ventas (cobro real: el cliente lo paga junto al precio)', R.cf.ivaRepercutido)}
        ${R.permutaActiva ? row('IVA repercutido por la permuta (esto sí es un coste real de caja)', R.cf.ivaRepercutidoPermuta) : ''}
        ${R.permutaActiva ? row('Aportación en efectivo del permutante (cubre parte del IVA anterior)', R.cf.ivaPermutaCobro) : ''}
        ${section('PAGOS')}
        ${row(R.permutaActiva ? 'Suelo — solo parte en efectivo (impuestos y gastos incl.)' : 'Suelo (precio, no deducibles y gastos)', R.cf.suelo)}
        ${row('Obra: certificaciones (PC)', R.cf.obra)}
        ${row('Honorarios técnicos', R.cf.honorarios)}
        ${row('Licencias, tasas e impuestos de obra', R.cf.licencias)}
        ${row('Comercialización y escrituras', R.cf.comercial)}
        ${row('Otros gastos (incl. imprevistos)', R.cf.otros)}
        ${row('Aval de cantidades a cuenta (compradores)', R.cf.aval)}
        ${R.permutaActiva ? row('Aval bancario de la permuta (propietario del suelo)', R.cf.avalPermuta) : ''}
        ${row('TOTAL PAGOS (sin IVA)', R.cf.totalPagos, {subtotal:true})}
        ${row('IVA soportado en costes (pago real: se paga junto a cada factura)', R.cf.ivaSoportado)}
        ${row('Liquidación trimestral de IVA (Modelo 303 — de golpe cada 3 meses)', R.cf.liquidacionIvaTrimestral)}
        ${row('Coste de caja real del IVA de la permuta (a cargo de la promotora)', R.cf.saldoIva)}
        ${row('FLUJO ANTES DE FINANCIACIÓN', R.cf.flujoAntesFin, {subtotal:true})}
        ${section('FINANCIACIÓN')}
        ${row('Saldo inicial del préstamo', R.cf.saldoInicial, {noTotal:true})}
        ${row('Límite disponible del préstamo', R.cf.limiteDisponible, {noTotal:true})}
        ${row('Necesidad de tesorería del mes', R.cf.necesidad)}
        ${row('Disposición del préstamo', R.cf.disposicion)}
        ${row('Amortización', R.cf.amortizacion)}
        ${row('Intereses del periodo', R.cf.intereses)}
        ${row('Comisiones de apertura y tasación', R.cf.comisiones)}
        ${row('Préstamo dispuesto acumulado', R.cf.dispuestoAcum, {noTotal:true})}
        ${row('Saldo final del préstamo', R.cf.saldoFinal, {noTotal:true})}
        ${section('IMPUESTO DE SOCIEDADES')}
        ${row(`Pago del IS (mes ${R.mesPagoIS} = cierre de diciembre + 7 meses)`, R.cf.impuestoSociedades)}
        ${section('FLUJO DE CAJA DEL CAPITAL PROPIO')}
        ${row('Flujo de caja del equity (neto del IS)', R.cf.flujoEquity, {subtotal:true})}
        ${row('Flujo acumulado', R.cf.flujoAcumulado, {noTotal:true})}
      </tbody>
    </table>
    </div>
  </div>`;
}

/* =========================================================================
   RENDER: RESUMEN
   ========================================================================= */
function renderResumen(){
  const host = document.getElementById('resumenHost');
  function checkRow(label, ok, warnText, badText){
    const cls = ok===true?'ok':(ok==='warn'?'warn':'bad');
    const txt = ok===true?'OK':(ok==='warn'?warnText:badText);
    return `<tr><td>${label}</td><td><span class="tag ${cls}">${txt}</span></td></tr>`;
  }
  const edifStatus = !R.checks.edificabilidad ? 'bad' : (!R.checks.edificabilidadAvisoLibre ? true : 'warn');

  host.innerHTML = `
  <div class="grid-2">
    <div class="card">
      <h3>Cuenta de resultados del proyecto</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Concepto</th><th class="num">Importe</th><th class="num">% s/ingresos</th></tr></thead>
        <tbody>
          <tr><td>Ingresos por ventas en efectivo (sin IVA)</td><td class="num">${eur(R.ingresosTotal)}</td><td class="num">${fmtPct(R.valorTotalPromocion!==0?R.ingresosTotal/R.valorTotalPromocion:0,1)}</td></tr>
          ${R.permutaActiva?`<tr><td>+ Valor de mercado de lo entregado en permuta</td><td class="num">${eur(R.valorPermutaTotal)}</td><td class="num">${fmtPct(R.valorTotalPromocion!==0?R.valorPermutaTotal/R.valorTotalPromocion:0,1)}</td></tr>
          <tr class="total"><td>= Ingresos económicos totales</td><td class="num">${eur(R.valorTotalPromocion)}</td><td class="num">100,0%</td></tr>`:''}
          <tr><td>1. Adquisición del suelo</td><td class="num neg">${eur(-R.costeSuelo)}</td><td class="num">${fmtPct(R.valorTotalPromocion!==0?-R.costeSuelo/R.valorTotalPromocion:0,1)}</td></tr>
          <tr><td>2. Costes de construcción (PC)</td><td class="num neg">${eur(-R.pc)}</td><td class="num">${fmtPct(R.valorTotalPromocion!==0?-R.pc/R.valorTotalPromocion:0,1)}</td></tr>
          <tr><td>3. Honorarios técnicos</td><td class="num neg">${eur(-R.costeHonorarios)}</td><td class="num">${fmtPct(R.valorTotalPromocion!==0?-R.costeHonorarios/R.valorTotalPromocion:0,1)}</td></tr>
          <tr><td>4. Licencias, tasas e impuestos</td><td class="num neg">${eur(-R.costeLicencias)}</td><td class="num">${fmtPct(R.valorTotalPromocion!==0?-R.costeLicencias/R.valorTotalPromocion:0,1)}</td></tr>
          <tr><td>5. Comercialización y escrituras</td><td class="num neg">${eur(-R.costeComercial)}</td><td class="num">${fmtPct(R.valorTotalPromocion!==0?-R.costeComercial/R.valorTotalPromocion:0,1)}</td></tr>
          <tr><td>6. Otros gastos (incl. imprevistos)</td><td class="num neg">${eur(-R.costeOtros)}</td><td class="num">${fmtPct(R.valorTotalPromocion!==0?-R.costeOtros/R.valorTotalPromocion:0,1)}</td></tr>
          <tr><td>7. Aval de cantidades a cuenta (protege a los compradores)</td><td class="num neg">${eur(-R.avalCoste)}</td><td class="num">${fmtPct(R.valorTotalPromocion!==0?-R.avalCoste/R.valorTotalPromocion:0,1)}</td></tr>
          ${R.permutaActiva?`<tr><td>8. Aval bancario de la permuta (protege al propietario del suelo)</td><td class="num neg">${eur(-R.avalPermutaCoste)}</td><td class="num">${fmtPct(R.valorTotalPromocion!==0?-R.avalPermutaCoste/R.valorTotalPromocion:0,1)}</td></tr>`:''}
          <tr><td>9. Gastos financieros</td><td class="num neg">${eur(-R.costeFinanciero)}</td><td class="num">${fmtPct(R.valorTotalPromocion!==0?-R.costeFinanciero/R.valorTotalPromocion:0,1)}</td></tr>
          <tr class="total"><td>BENEFICIO BRUTO (antes de impuestos)</td><td class="num">${eur(R.beneficioBruto)}</td><td class="num">${fmtPct(R.margenVentas,1)}</td></tr>
          <tr><td>Impuesto de sociedades</td><td class="num neg">${eur(R.impuestoSociedades)}</td><td></td></tr>
          <tr class="total"><td>BENEFICIO NETO</td><td class="num">${eur(R.beneficioNeto)}</td><td></td></tr>
          ${R.permutaActiva?`<tr><td colspan="3" style="color:var(--ink-soft); font-size:12px; padding-top:10px;">La partida "1. Adquisición del suelo" incluye ${eur(R.valorPermutaTotal)} en unidades entregadas en permuta (sin salida de caja) + ${eur(R.precioCashSolar)} en efectivo, más impuestos y gastos sobre el total.</td></tr>`:''}
        </tbody>
      </table></div>
    </div>

    <div class="card">
      <h3>Ratios de rentabilidad</h3>
      <div class="stat-row">
        <div class="stat"><div class="stat-label">Margen sobre ventas</div><div class="stat-value">${fmtPct(R.margenVentas,1)}</div><div class="stat-note">Umbral habitual banca: ≥18-20%</div></div>
        <div class="stat"><div class="stat-label">Margen sobre costes</div><div class="stat-value">${fmtPct(R.margenCostes,1)}</div></div>
        <div class="stat"><div class="stat-label">ROE anualizado, equity punta, después de IS</div><div class="stat-value">${fmtPct(R.roeNetoAnualizado,1)}</div><div class="stat-note">${R.equityPunta===0?'Autofinanciado: los cobros de clientes cubren los pagos en todo momento — no ha hecho falta capital propio, por eso el ROE no está definido':'LA cifra de referencia: sobre el pico real de tesorería, anualizada, con el beneficio que realmente queda tras el 25% de IS'}</div></div>
        <div class="stat"><div class="stat-label">ROE anualizado, equity total, después de IS</div><div class="stat-value">${fmtPct(R.roeNetoEquityTotalAnualizado,1)}</div><div class="stat-note">Complementaria, más conservadora: sin descontar el capital que se recicla con los cobros</div></div>
      </div>
      <details class="roe-more">
        <summary>Ver las demás variantes de ROE (8 en total: punta/total × neto/bruto × anual/no)</summary>
        <div class="stat-row">
          <div class="stat"><div class="stat-label">ROE sobre equity punta, después de IS</div><div class="stat-value">${fmtPct(R.roeNeto,1)}</div><div class="stat-note">Sin anualizar, sobre el pico real de tesorería</div></div>
          <div class="stat"><div class="stat-label">ROE sobre equity total, después de IS</div><div class="stat-value">${fmtPct(R.roeNetoEquityTotal,1)}</div><div class="stat-note">Sin anualizar, más conservador</div></div>
          <div class="stat"><div class="stat-label">ROE sobre equity punta, antes de impuestos</div><div class="stat-value">${fmtPct(R.roe,1)}</div><div class="stat-note">Para comparar directamente con el margen bruto</div></div>
          <div class="stat"><div class="stat-label">ROE sobre equity total, antes de impuestos</div><div class="stat-value">${fmtPct(R.roeEquityTotal,1)}</div></div>
          <div class="stat"><div class="stat-label">ROE anualizado sobre equity punta, antes de impuestos</div><div class="stat-value">${fmtPct(R.roeAnualizado,1)}</div></div>
          <div class="stat"><div class="stat-label">ROE anualizado sobre equity total, antes de impuestos</div><div class="stat-value">${fmtPct(R.roeEquityTotalAnualizado,1)}</div></div>
        </div>
      </details>
      <div class="stat-row" style="margin-top:14px;">
        <div class="stat"><div class="stat-label">TIR anual del equity</div><div class="stat-value">${fmtPct(R.tirAnual,1)}</div></div>
        <div class="stat"><div class="stat-label">TIR modificada (MIRR) anual</div><div class="stat-value">${fmtPct(R.mirrAnual,1)}</div><div class="stat-note">Financia lo negativo al tipo del préstamo y reinvierte lo positivo a una tasa conservadora (sección Financiación), en vez de a la propia TIR</div></div>
        <div class="stat"><div class="stat-label">VAN del equity</div><div class="stat-value">${eur(R.van)}</div></div>
        <div class="stat"><div class="stat-label">Payback del equity</div><div class="stat-value">${R.payback===''?'—':'Mes '+R.payback}</div></div>
        <div class="stat"><div class="stat-label">Duración total del proyecto</div><div class="stat-value">${R.durProyecto} meses</div></div>
      </div>
    </div>
  </div>

  <div class="card">
    <h3>Ratios de estructura y contraste de mercado</h3>
    <div class="stat-row">
      <div class="stat"><div class="stat-label">Precio medio de venta (€/m² construido)</div><div class="stat-value">${eur2(R.precioMedioM2Construido)}</div></div>
      <div class="stat"><div class="stat-label">Coste del suelo / ingresos</div><div class="stat-value">${fmtPct(R.valorTotalPromocion!==0?R.costeSuelo/R.valorTotalPromocion:0,1)}</div><div class="stat-note">Referencia habitual: 15-25%</div></div>
      <div class="stat"><div class="stat-label">Coste de construcción (PC) / ingresos</div><div class="stat-value">${fmtPct(R.valorTotalPromocion!==0?R.pc/R.valorTotalPromocion:0,1)}</div><div class="stat-note">Referencia habitual: 40-50%</div></div>
      <div class="stat"><div class="stat-label">Coste total / ingresos</div><div class="stat-value">${fmtPct(R.valorTotalPromocion!==0?R.costeTotal/R.valorTotalPromocion:0,1)}</div></div>
      <div class="stat"><div class="stat-label">Coste de construcción por m²</div><div class="stat-value">${eur2(R.costeConstruccionM2)}</div></div>
      <div class="stat"><div class="stat-label">Coste total por vivienda</div><div class="stat-value">${eur(R.costeTotalPorVivienda)}</div></div>
      <div class="stat"><div class="stat-label">Repercusión del suelo por vivienda</div><div class="stat-value">${eur(R.repercusionSueloPorVivienda)}</div></div>
    </div>
  </div>

  <div class="card">
    <h3>Comprobaciones automáticas</h3>
    <div class="table-wrap"><table><tbody>
      ${checkRow('Unidades proyectadas ≤ densidad máxima', R.checks.densidad?true:'bad','', 'REVISAR: supera la densidad máxima')}
      ${checkRow('Edificabilidad sobre rasante ≤ máxima', edifStatus, `AVISO: queda edificabilidad sin agotar (${num(R.edifLibre)} m²)`, 'REVISAR: excede la edificabilidad')}
      ${checkRow('Préstamo repagado al final del proyecto', R.checks.prestamoRepagado?true:'bad','', 'REVISAR: queda saldo vivo')}
      ${checkRow(R.permutaActiva ? 'Coherencia préstamo + equity = coste total en caja' : 'Coherencia préstamo + equity = coste total', R.checks.coherencia?true:'bad','', 'REVISAR')}
      ${checkRow('Margen sobre ventas ≥ 18% (umbral de financiación)', R.checks.margenMinimo?true:'warn','AVISO: margen por debajo del umbral bancario','')}
      ${checkRow('Loan to Value ≤ '+fmtPct(state.financiacion.ltvMax,0), R.checks.ltv?true:'warn','AVISO: LTV elevado','')}
      ${checkRow('Margen de entrega tras fin de obra ≥ 0', R.checks.margenEntregaValido?true:'bad', '', `REVISAR: el margen de gestión de entrega está en negativo — la entrega no puede caer antes de que termine la obra`)}
      ${R.preventasMinPct>0 ? checkRow('El préstamo pudo disponerse siempre que hizo falta (gate de preventas)', R.checks.preventasGateSinBloqueos?true:'bad', '', `REVISAR: hubo meses con necesidad de caja en que el % de preventas (mínimo exigido ${fmtPct(R.preventasMinPct,0)}) aún no se había alcanzado — ese hueco lo tuvo que cubrir capital propio adicional`) : ''}
      ${state.urban.plazasExigidas>0 ? checkRow('Plazas de garaje planificadas ≥ exigidas por normativa', R.checks.plazasAparcamiento?true:'bad', '', `REVISAR: planificadas ${R.plazasPlanificadas} ud. frente a ${state.urban.plazasExigidas} ud. exigidas — faltan ${state.urban.plazasExigidas-R.plazasPlanificadas} plazas por cubrir de algún modo`) : ''}
      ${state.urban.reservaVPOPct>0 ? checkRow('% de techo en VPO ≥ reserva mínima exigida', R.checks.reservaVPO?true:'bad', '', `REVISAR: planificado ${fmtPct(R.pctVPOActual,1)} frente al ${fmtPct(state.urban.reservaVPOPct,0)} mínimo exigido — cambia el régimen de más unidades de vivienda a VPO en la sección 3 (Ventas)`) : ''}
      ${R.permutaActiva ? checkRow('IVA de la permuta cubierto ≥ 50% por el permutante', R.checks.ivaPermutaCubierto?true:'warn','AVISO: la promotora adelanta la mayor parte del IVA de la permuta de su propio bolsillo','') : ''}
      ${R.mesesISTrasFinProyecto>0 ? `<div class="card-hint">El pago del IS (mes ${R.mesPagoIS}) cae ${R.mesesISTrasFinProyecto} meses después de que la promoción esté terminada y escriturada (mes ${R.durProyecto}) — es normal, es un plazo fiscal, no una fase de la obra. El Cash-Flow ya lo refleja en su mes exacto sin alargar la duración del proyecto ni cobrar IBI de más.</div>` : ''}
    </tbody></table></div>
  </div>`;
}

/* =========================================================================
   RENDER: SENSIBILIDAD
   ========================================================================= */
function heatColor(v){
  // v: margen sobre ventas, roughly -0.1 .. 0.4 -> red..green
  const clamped = Math.max(-0.10, Math.min(0.40, v));
  const t = (clamped+0.10)/0.50; // 0..1
  const r1=[163,78,44], r2=[46,107,82]; // brick -> moss
  const r = Math.round(r1[0]+(r2[0]-r1[0])*t);
  const g = Math.round(r1[1]+(r2[1]-r1[1])*t);
  const b = Math.round(r1[2]+(r2[2]-r1[2])*t);
  return `rgb(${r},${g},${b})`;
}

function renderSensibilidad(){
  const host = document.getElementById('sensibilidadHost');

  const escRows = R.escenarios.map(e=>`
    <tr>
      <td>${e.nombre}</td>
      <td class="num">${num(e.factorPrecio*100,0)}%</td>
      <td class="num">${num(e.factorCosteObra*100,0)}%</td>
      <td class="num">${e.mesesExtra}</td>
      <td class="num">${eur(e.ingresos)}</td>
      <td class="num">${eur(e.costeTotal)}</td>
      <td class="num ${e.beneficioBruto<0?'neg':''}">${eur(e.beneficioBruto)}</td>
      <td class="num">${fmtPct(e.margenVentas,1)}</td>
      <td class="num">${fmtPct(e.margenCostes,1)}</td>
      <td class="num">${fmtPct(e.tirAprox,1)}</td>
    </tr>`).join('');

  const matrixHeader = R.costeFactor.map(c=>`<th class="num">${num(c*100,0)}%</th>`).join('');
  const matrixRows = R.matriz.map((row,ri)=>{
    const isBaseRow = row.precioFactor===1;
    const cells = row.valores.map((v,ci)=>{
      const isBaseCell = isBaseRow && R.costeFactor[ci]===1;
      return `<td class="heat ${isBaseCell?'base':''}" style="background:${heatColor(v)}">${fmtPct(v,1)}</td>`;
    }).join('');
    return `<tr><td class="center">${num(row.precioFactor*100,0)}%</td>${cells}</tr>`;
  }).join('');

  host.innerHTML = `
  <div class="card">
    <h3>Escenarios</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>Escenario</th><th class="num">Factor precio</th><th class="num">Factor coste obra</th><th class="num">Meses extra</th><th class="num">Ingresos</th><th class="num">Coste total</th><th class="num">Beneficio bruto</th><th class="num">Margen s/ventas</th><th class="num">Margen s/costes</th><th class="num">TIR anual</th></tr></thead>
      <tbody>${escRows}</tbody>
    </table></div>
  </div>

  <div class="card">
    <h3>Matriz de sensibilidad — margen sobre ventas</h3>
    <div class="card-hint">Filas: factor de precio de venta · Columnas: factor de coste de obra</div>
    <div class="table-wrap"><table class="matrix-table">
      <thead><tr><th>Precio \\ Coste obra</th>${matrixHeader}</tr></thead>
      <tbody>${matrixRows}</tbody>
    </table></div>
  </div>

  <div class="card">
    <h3>Puntos de equilibrio (break-even)</h3>
    <div class="stat-row">
      <div class="stat"><div class="stat-label">Factor de precio que anula el beneficio</div><div class="stat-value">${fmtPct(R.factorPrecioBE,1)}</div></div>
      <div class="stat"><div class="stat-label">Precio medio de venta de equilibrio</div><div class="stat-value">${eur2(R.precioMedioBE)}/m²</div></div>
      <div class="stat"><div class="stat-label">Caída de precios soportable</div><div class="stat-value">${fmtPct(R.caidaPrecioSoportable,1)}</div></div>
      <div class="stat"><div class="stat-label">Factor de coste de obra que anula el beneficio</div><div class="stat-value">${fmtPct(R.factorCosteBE,1)}</div></div>
      <div class="stat"><div class="stat-label">Sobrecoste de obra soportable</div><div class="stat-value">${fmtPct(R.sobrecosteSoportable,1)}</div></div>
    </div>
  </div>`;
}

/* =========================================================================
   RENDER: COMPARADOR DE OFERTAS
   ========================================================================= */
function renderComparador(){
  const host = document.getElementById('comparadorHost');
  if(!host) return;
  const ofertas = state.ofertasComparativas||[];
  if(ofertas.length===0){
    host.innerHTML = `<div class="card"><div class="card-hint">Todavía no has guardado ninguna oferta para comparar. Ve a la sección 4 (Suelo) de Inputs, configura una estructura de compra y pulsa "Guardar configuración actual como oferta" — repite con 2 o 3 variantes distintas para poder compararlas aquí.</div></div>`;
    return;
  }
  // Recalcula el estudio COMPLETO con cada oferta sustituyendo la sección 4, manteniendo
  // ventas/construcción/financiación/cronograma tal cual están — exactamente el mismo patrón
  // que ya usa Sensibilidad para sus escenarios, aplicado aquí a variantes de compra del suelo.
  const resultados = ofertas.map(o=>({ oferta:o, R: compute({...state, suelo:o.suelo}) }));

  const tablaPromotor = `
    <div class="card">
      <h3>Qué le conviene al promotor</h3>
      <div class="card-hint">Mismo estudio completo (ventas, construcción, financiación, cronograma) recalculado con cada estructura de compra del suelo.</div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Oferta</th><th class="num">Principal préstamo</th><th class="num">Equity punta</th>
            <th class="num">TIR anual</th><th class="num">MIRR anual</th><th class="num">ROE anual (eq. total)</th>
            <th class="num">Beneficio neto</th><th class="num">VAN equity</th>
          </tr></thead>
          <tbody>
            ${resultados.map(({oferta,R:Ro})=>`
              <tr>
                <td>${escapeHtml(oferta.nombre)}</td>
                <td class="num">${eur(Ro.principal)}</td>
                <td class="num">${eur(Ro.equityPunta)}</td>
                <td class="num">${fmtPct(Ro.tirAnual,1)}</td>
                <td class="num">${fmtPct(Ro.mirrAnual,1)}</td>
                <td class="num">${fmtPct(Ro.roeNetoEquityTotalAnualizado,1)}</td>
                <td class="num">${eur(Ro.beneficioNeto)}</td>
                <td class="num">${eur(Ro.van)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  const tarjetasPropietarios = resultados.map(({oferta,R:Ro})=>`
    <div class="card">
      <h3>${escapeHtml(oferta.nombre)} — qué recibe cada copropietario</h3>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Propietario</th><th class="num">Precio total</th>
            <th class="num">Inicial (mes 0)</th><th class="num">Hito 2</th><th class="num">Final</th>
          </tr></thead>
          <tbody>
            ${Ro.propietariosCalc.map(p=>`
              <tr>
                <td>${escapeHtml(p.direccion||'(sin dirección)')}</td>
                <td class="num">${eur(p.precio)}</td>
                <td class="num">${eur(p.importeInicial)} <span style="color:var(--ink-soft);">(mes 0)</span></td>
                <td class="num">${p.pagoHito2Pct>0 ? eur(p.importeHito2)+' (mes '+p.mesHito2+')' : '—'}</td>
                <td class="num">${eur(p.importeFinal)} <span style="color:var(--ink-soft);">(mes ${p.mesFinal})</span></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`).join('');

  host.innerHTML = tablaPromotor + tarjetasPropietarios;
}

/* =========================================================================
   RENDER: VALORADOR DE SUELO POR RESIDUAL
   Método residual DINÁMICO (Orden ECO/805/2003, arts. 36-39): en vez de
   calcular el margen a partir de un precio de suelo dado, recorre el MISMO
   motor de cálculo "al revés" — igual que ya hace findBreakeven() en
   Sensibilidad — buscando por bisección qué precio de suelo deja exactamente
   el margen sobre ventas objetivo. Cero fórmulas nuevas de negocio: solo un
   bucle de búsqueda alrededor de compute(), así que nunca puede
   desincronizarse del resto del estudio.
   ========================================================================= */
function resolverFactorSueloPorMargen(margenObjetivo){
  const evalFn = f => compute(state, { factorPrecioSuelo: f }).margenVentas - margenObjetivo;
  const f0 = evalFn(0);
  if(!Number.isFinite(f0)) return { status:'error' };
  // Ni con el suelo gratis se llega al margen pedido: el problema no es el precio del suelo.
  if(f0 < 0) return { status:'inviable', margenA0: f0 + margenObjetivo };
  // Amplía el rango de búsqueda duplicándolo hasta encontrar un precio que sí quede por
  // debajo del objetivo (o hasta 512x el precio actual, que ya es un escenario absurdo).
  let lo = 0, hi = 2, fhi = evalFn(hi), intentos = 0;
  while(fhi > 0 && intentos < 9){ hi *= 2; fhi = evalFn(hi); intentos++; }
  if(fhi > 0) return { status:'sin_techo' };
  let flo = f0;
  for(let i=0; i<60; i++){
    const mid = (lo+hi)/2, fmid = evalFn(mid);
    if(Math.abs(fmid) < 0.00005) return { status:'ok', factor:mid };
    if(flo*fmid < 0){ hi = mid; fhi = fmid; } else { lo = mid; flo = fmid; }
  }
  return { status:'ok', factor:(lo+hi)/2 };
}

function renderResidual(){
  const host = document.getElementById('residualHost');
  if(!host) return;
  const precioActualTotal = (state.suelo.propietarios||[]).reduce((a,p)=>a+(p.precio||0), 0);
  const margenObjetivo = (state.residual && state.residual.margenObjetivo!=null) ? state.residual.margenObjetivo : 0.20;

  let resultadoHtml;
  if(precioActualTotal <= 0){
    resultadoHtml = `<p class="card-hint" style="color:var(--brick);">Introduce primero un precio de referencia (aunque sea aproximado) en al menos un propietario del suelo, en Inputs → sección 4. Este valorador busca proporcionalmente a partir de ese precio — con todos a 0 no hay nada que escalar.</p>`;
  } else {
    const res = resolverFactorSueloPorMargen(margenObjetivo);
    if(res.status === 'inviable'){
      resultadoHtml = `<p class="card-hint" style="color:var(--brick);">Ni siquiera con el suelo gratis se alcanza un margen del ${fmtPct(margenObjetivo,1)} con el resto de datos actuales (a coste de suelo 0, el margen sería del ${fmtPct(res.margenA0,1)}). El problema no está en el precio del suelo — revisa los costes de construcción, los precios de venta, o el margen objetivo.</p>`;
    } else if(res.status === 'sin_techo'){
      resultadoHtml = `<p class="card-hint" style="color:var(--brick);">Incluso pagando más de 500 veces el precio de referencia actual, el margen seguiría por encima del ${fmtPct(margenObjetivo,1)} objetivo. El margen pedido es muy laxo para este proyecto, o el precio de referencia en Inputs es demasiado bajo para que la búsqueda proporcional tenga sentido — súbelo antes de usar este valorador.</p>`;
    } else {
      const precioMax = precioActualTotal * res.factor;
      const Rmax = compute(state, { factorPrecioSuelo: res.factor });
      const supSolar = (state.urban && state.urban.supSolar) ? state.urban.supSolar : 0;
      const semaforoOk = Rmax.checks.ltv && Rmax.checks.preventasGateSinBloqueos;
      resultadoHtml = `
        <div class="stat-row">
          <div class="stat"><div class="stat-label">Precio máximo del suelo (techo defendible)</div><div class="stat-value">${eur(precioMax)}</div></div>
          <div class="stat"><div class="stat-label">Precio actualmente configurado en Inputs</div><div class="stat-value">${eur(precioActualTotal)}</div></div>
          <div class="stat"><div class="stat-label">Diferencia</div><div class="stat-value ${precioMax>=precioActualTotal?'pos':'neg'}">${eur(precioMax-precioActualTotal)}</div></div>
          ${supSolar>0 ? `<div class="stat"><div class="stat-label">Equivalente por m² de solar</div><div class="stat-value">${eur2(precioMax/supSolar)}/m²</div></div>` : ''}
        </div>
        <p class="card-hint" style="color:${semaforoOk?'var(--moss)':'var(--brick)'}; margin-top:10px;">
          A ese precio máximo: LTV ${Rmax.checks.ltv?'OK':'⚠ por encima del límite configurado'} · Gate de preventas ${Rmax.checks.preventasGateSinBloqueos?'OK':'⚠ hubo algún mes bloqueado'} · margen sobre ventas exacto conseguido: ${fmtPct(Rmax.margenVentas,2)}.
          Resolver este único objetivo no garantiza que el resto de semáforos del estudio (Resumen) sigan en verde a ese precio — revísalos antes de ofertar.
        </p>
        <button type="button" class="btn primary" style="margin-top:12px;" onclick="aplicarPrecioSueloResidual(${precioMax})">Usar este precio en mis Inputs</button>
      `;
    }
  }

  host.innerHTML = `
    <div class="card">
      <h3>¿Cuánto puedo ofrecer por este solar?</h3>
      <p class="card-hint">Fija el margen mínimo que necesitas y calcula el precio máximo de compra que todavía te lo deja — la pregunta contraria a la que responde el resto del estudio.</p>
      <div class="field" style="max-width:280px; margin-bottom:16px;">
        <label>Margen objetivo sobre ventas (%)</label>
        <input type="number" id="residualMargenObjetivo" value="${(margenObjetivo*100).toFixed(1)}" step="0.5" min="0" max="90">
        <div class="helper">Umbral habitual exigido por la banca: 18-20%.</div>
      </div>
      ${resultadoHtml}
    </div>
    <div class="card">
      <h3>Cómo se calcula esto</h3>
      <ul class="notes-list">
        <li>Es el <b>método residual dinámico</b> (Orden ECO/805/2003, arts. 36-39, la norma que regula la tasación de suelo en España): a diferencia del residual estático (un cálculo de un solo golpe, sin calendario, solo válido legalmente para solares que puedan empezar a construirse en menos de un año), el dinámico trabaja con los flujos de caja proyectados en sus fechas reales — que es exactamente lo que ya hace el motor de esta app.</li>
        <li>No es una fórmula nueva ni un motor en paralelo: recorre tu mismo Cash-Flow y Resumen ya validados, cambiando solo el precio del suelo, hasta encontrar el que deja el margen sobre ventas que has pedido — igual que ya hacen los "puntos de equilibrio" de Sensibilidad.</li>
        <li>Si hay varios propietarios del solar con precios distintos, el precio máximo encontrado se reparte entre ellos en la misma proporción en que ya están repartidos ahora — no cambia quién cobra más o menos entre sí, solo escala el total. Si lo que necesitas es comparar estructuras de oferta distintas entre varios copropietarios, usa el "Comparador ofertas" (sección anterior) — son herramientas complementarias, no la misma cosa.</li>
        <li>Este valorador escala el precio en <b>efectivo</b> pactado con los propietarios. Si la forma de pago del suelo es permuta o mixta, la lectura del resultado es menos directa — confírmalo con cuidado en ese caso.</li>
        <li>Esto es el <b>techo defendible</b> para el margen que has pedido, no una recomendación de cuánto ofrecer — una negociación real casi siempre debería arrancar por debajo de esta cifra.</li>
      </ul>
    </div>
  `;

  const inp = document.getElementById('residualMargenObjetivo');
  if(inp) inp.addEventListener('input', e=>{
    const v = parseFloat(e.target.value);
    if(!state.residual) state.residual = {};
    state.residual.margenObjetivo = Number.isFinite(v) ? v/100 : 0.20;
    saveState();
    renderResidual();
  });
}

async function aplicarPrecioSueloResidual(precioMaxTotal){
  const props = state.suelo.propietarios || [];
  const totalActual = props.reduce((a,p)=>a+(p.precio||0), 0);
  if(totalActual <= 0 || !props.length) return;
  if(!await confirmar({
    titulo:`¿Aplicar ${eur(precioMaxTotal)} como precio del suelo?`,
    texto:'Se reparte proporcionalmente entre los propietarios actuales y sustituye el precio que tienes puesto. '+
          'Para deshacerlo habría que volver a escribirlo a mano.',
    aceptar:'Aplicar en Inputs'
  })) return;
  const factor = precioMaxTotal/totalActual;
  props.forEach(p=>{ p.precio = Math.round((p.precio||0)*factor*100)/100; });
  saveState();
  renderInputs();
  recalcAndRenderOutputs();
  switchTab('inputs');
  toast('Precio del suelo actualizado en Inputs, sección 4. Revisa los semáforos de Resumen antes de darlo por bueno.','ok',{duracion:7000});
}

/* =========================================================================
   RENDER: NOTAS
   ========================================================================= */
function renderNotas(){
  const host = document.getElementById('notasHost');
  host.innerHTML = `
  <div class="card">
    <h3>Qué hace esta app, en una frase</h3>
    <ul class="notes-list">
      <li>Calcula el estudio de viabilidad económica completo de una promoción residencial sobre un solar concreto: ingresos por ventas, todos los costes (suelo, construcción, honorarios, licencias, comercialización, financiación e impuestos), el cash-flow mensual real, y la rentabilidad resultante (TIR, MIRR, VAN, ROE, payback) — con el mismo nivel de detalle fiscal y financiero que usa un director de expansión.</li>
      <li>Está organizada en 11 secciones de datos de entrada (este panel de la izquierda) y 6 pestañas de resultados (Ingresos, Costes, Financiación, Cash-Flow, Resumen, Sensibilidad) que se recalculan solas en cuanto cambias cualquier campo.</li>
      <li>Todo lo que ves marcado como "computed" (fondo distinto, no editable) es un resultado — nunca se escribe a mano, siempre sale de los campos editables.</li>
    </ul>
  </div>

  <div class="card">
    <h3>Sección 1 — Identificación</h3>
    <ul class="notes-list">
      <li>Nombre del proyecto, dirección, promotora, fecha y tipología. Es información de referencia para el estudio y la portada de impresión — ningún campo de esta sección entra en ningún cálculo.</li>
      <li>El logo y el aviso legal de la portada del PDF ya no están aquí — el logo se sube desde el botón "🖼 Logo PDF" junto a "Imprimir / PDF" (arriba), y el aviso legal es un texto fijo que se imprime siempre, sin que haya que configurar nada. Así esta sección se queda solo con los datos de identificación del proyecto.</li>
    </ul>
  </div>

  <div class="card">
    <h3>Sección 2 — Parámetros urbanísticos</h3>
    <ul class="notes-list">
      <li><b>Superficie del solar, edificabilidad máxima y densidad máxima</b>: los límites que marca el planeamiento. Alimentan dos comprobaciones automáticas (que la superficie construida sobre rasante no supere la edificabilidad, y que el número de viviendas no supere la densidad máxima) y el cálculo de "edificabilidad consumida / sin consumir".</li>
      <li><b>Sup. construida sobre/bajo rasante y terrazas</b>: sobre rasante (SR) son las viviendas y locales; bajo rasante (BR) son garajes y trasteros. Esta separación es la que usa la sección 5 para repartir el coste de construcción entre ambas partidas con su propio €/m² cada una.</li>
      <li><b>Plazas de aparcamiento exigidas por normativa</b>: se contrasta contra la suma de unidades de categoría "Garaje" en la tabla de Ventas (sección 3), con su propio check en Resumen y en la barra KPI. Con 0 (valor por defecto) se entiende "sin dato todavía" y no se lanza ninguna alarma.</li>
      <li><b>% mínimo de techo destinado a VPO</b>: reserva urbanística obligatoria de vivienda protegida. Se contrasta contra el techo de las filas de vivienda marcadas como VPO (general o especial) en Ventas — celda calculada justo debajo con el % actualmente planificado. Con 0% no hay exigencia.</li>
      <li><b>Notas urbanísticas adicionales</b>: campo de texto libre para altura reguladora, número de plantas, % de ocupación, retranqueos, usos permitidos, clave urbanística, o cualquier otro dato de la ficha urbanística. A propósito NO interviene en ningún cálculo — es solo para tener toda la información del solar en un mismo sitio.</li>
    </ul>
  </div>

  <div class="card">
    <h3>Sección 3 — Precios de venta por tipología</h3>
    <ul class="notes-list">
      <li>Tabla sin límite de filas. Cada fila es una tipología de producto: categoría (vivienda, local, garaje, trastero u otro), régimen, unidades, m²/ud. y €/m².</li>
      <li>La <b>categoría</b> decide qué cuenta como "vivienda" a efectos de densidad, superficie vendible y precio medio, y qué cuenta como "garaje" a efectos del check de plazas de aparcamiento.</li>
      <li>El <b>régimen</b> (Libre / VPO general-concertada / VPO especial-promoción pública) solo actúa sobre filas de categoría "vivienda". Libre y VPO general/concertada tributan igual, al 10% de IVA — la diferencia real de la VPO general está en que el precio de venta lo tasa la administración, no el mercado, así que ajusta el €/m² a mano según el módulo que corresponda. Solo la VPO de régimen especial o promoción pública baja el IVA al 4% (art. 91.Dos.1.6º LIVA), y se autocalcula al cambiar el régimen — editable a mano después si hace falta.</li>
      <li>Para productos con precio cerrado en vez de €/m² (una plaza de garaje, un trastero, un ático con precio a bulto), deja m²/ud.=1 y pon el importe total directamente en la columna de €/m² — la app lo trata como €/ud.</li>
      <li>La columna de <b>IVA</b> alimenta el IVA repercutido del cash-flow — se autocompleta con el régimen para vivienda, pero siempre editable a mano.</li>
      <li>Marcar unidades como <b>permuta</b> las excluye de los cobros en efectivo: su valor de mercado se entrega en unidades al propietario del suelo en vez de cobrarse, y se resta del inventario disponible para la venta normal.</li>
    </ul>
  </div>

  <div class="card">
    <h3>Sección 4 — Adquisición del suelo</h3>
    <ul class="notes-list">
      <li><b>Forma de pago</b>: efectivo, permuta (entrega de unidades en vez de dinero) o mixta (ambas). Con permuta o mixta aparecen los campos de régimen fiscal de la permuta, momento en que se devenga su IVA, aval bancario específico del permutante y % de ese IVA cubierto por él en efectivo.</li>
      <li><b>Tabla de propietarios</b>: un solar puede tener varios vendedores, cada uno con su propio precio, régimen (IVA o ITP) y calendario de pago (% inicial, % en un hito intermedio opcional, % final, cada uno en su mes). El % de IVA/ITP de cada fila se autocalcula solo si el régimen es ITP y no lo has tocado a mano: usa la escala progresiva vigente en Cataluña (10% hasta 600.000€, 11% hasta 900.000€, 12% hasta 1.500.000€, 13% en adelante) según el precio de esa fila. En cuanto editas ese % una vez, deja de autocalcularse para esa fila — útil si el valor de referencia catastral es mayor que el precio pactado (Hacienda liquida sobre el mayor de los dos), que este cálculo automático no puede saber.</li>
      <li><b>Comisión inmobiliaria y notaría/registro/gestoría</b>: % sobre la base total (efectivo + permuta). <b>Tipo de IVA general</b>: el aplicable a estos servicios profesionales.</li>
      <li>El suelo <b>nunca compite por el límite del préstamo promotor</b> salvo que tú lo decidas explícitamente en la sección 10 (ver más abajo) — se paga siempre con capital propio por defecto, sea cual sea su calendario de pago, aunque coincida con el inicio de la obra.</li>
      <li><b>Comparador de ofertas de compra del suelo</b>: guarda la configuración actual de esta sección (forma de pago + propietarios + calendario) como una "oferta" con nombre, guarda 2-3 variantes distintas, y compáralas en la pestaña "Comparador ofertas" — cada una recalcula el estudio completo (mismas ventas, construcción, financiación) sustituyendo solo el suelo, mostrando qué le conviene más al promotor (TIR, equity punta, beneficio) y qué recibe cada copropietario en cada una.</li>
    </ul>
  </div>

  <div class="card">
    <h3>Sección 5 — Costes de construcción</h3>
    <ul class="notes-list">
      <li>Tabla sin límite de filas: una partida por concepto (cimentación, estructura, fachada, instalaciones...), cada una con su superficie y su €/m². Para una partida a precio cerrado, igual que en Ventas, deja m²=1 y el importe total en €/m².</li>
      <li>La suma de todas las partidas es el <b>PEM</b> (Presupuesto de Ejecución Material). <b>Gastos generales + beneficio industrial</b> (19% por defecto) se le añaden para obtener el <b>PC</b> (Presupuesto de Contrata) — la base sobre la que se calculan honorarios, licencias, otros gastos, y el LTC del préstamo.</li>
      <li><b>Tipo de IVA de la construcción</b>: el soportado en la obra, deducible.</li>
    </ul>
  </div>

  <div class="card">
    <h3>Sección 6 — Honorarios técnicos</h3>
    <ul class="notes-list">
      <li>Proyecto básico y de ejecución, dirección de obra, coordinación de seguridad y salud, y control de calidad/OCT — los cuatro, en % sobre el PC (Presupuesto de Contrata) de la sección 5.</li>
    </ul>
  </div>

  <div class="card">
    <h3>Sección 7 — Licencias, tasas e impuestos de la obra</h3>
    <ul class="notes-list">
      <li>Tasa de licencia de obras, ICIO (máximo legal 4%) y licencia de primera ocupación: los tres en % sobre el PC.</li>
      <li>AJD de obra nueva y división horizontal: en % sobre el valor total de venta de la promoción — es un impuesto no deducible, se incorpora directamente como coste. Es un hecho imponible distinto del ITP/AJD de la compra del suelo (sección 4), no un duplicado.</li>
    </ul>
  </div>

  <div class="card">
    <h3>Sección 8 — Comercialización y escrituras</h3>
    <ul class="notes-list">
      <li>Marketing/publicidad y comisión de ventas, ambas en % sobre el total de ventas.</li>
    </ul>
  </div>

  <div class="card">
    <h3>Sección 9 — Otros gastos</h3>
    <ul class="notes-list">
      <li>Conexiones a suministros, seguro decenal y todo riesgo construcción, y posventa/garantías: los tres en % sobre el PC.</li>
      <li>Estructura del promotor: % sobre ventas. IBI y mantenimiento del solar: importe fijo por año de duración del proyecto.</li>
      <li>Aval de cantidades a cuenta: % sobre los anticipos de clientes (garantía legal obligatoria, Ley 57/1968) — distinto del aval de la permuta de la sección 4, que protege al propietario del suelo, no a los compradores.</li>
      <li>Imprevistos: % sobre suelo + PC + honorarios + licencias — el colchón de contingencia de todo el presupuesto "duro".</li>
    </ul>
  </div>

  <div class="card">
    <h3>Sección 10 — Financiación y fiscalidad</h3>
    <ul class="notes-list">
      <li><b>LTC</b>: % del préstamo sobre construcción + honorarios + licencias + comercial + otros — nunca sobre el suelo (salvo el campo de abajo). <b>Tope LTV</b>: % sobre el valor total de venta. El banco concede el <b>menor</b> de los dos, como en la práctica real; en operaciones con mucho margen, suele ganar el LTV.</li>
      <li><b>% mínimo de preventas para disponer</b>: condición de todo o nada — con un valor >0%, el préstamo no se dispone ni un euro (aunque haya obra en marcha y margen dentro del LTC/LTV) hasta que el % acumulado de anticipos cobrados alcance ese mínimo. Con 0% (por defecto) no hay condicionante.</li>
      <li><b>% del suelo que también financia el préstamo</b>: 0% (por defecto, más habitual) = el suelo siempre es capital propio. 100% = una única facilidad combinada suelo+construcción, donde el suelo compite por el LTC/LTV igual que cualquier otro coste. Cualquier valor intermedio financia solo esa parte.</li>
      <li><b>Tipo de interés, comisión de apertura, tasación/notaría de la hipoteca</b>: condiciones del préstamo — el interés se calcula mes a mes sobre el saldo realmente dispuesto, las comisiones sobre el principal concedido.</li>
      <li><b>Tasa de descuento</b>: el coste de oportunidad del capital propio, usado para el VAN. <b>Impuesto de Sociedades</b>: se aplica sobre el beneficio y se paga como salida de caja real en su mes fiscal correcto (cierre de diciembre + 7 meses), no como una simple resta contable.</li>
      <li><b>Tasa de reinversión (MIRR)</b>: a qué tipo conservador se asume que se reinvierte la caja positiva intermedia, en vez de a la propia TIR — es lo que hace más creíble la MIRR frente a una TIR pura inflada.</li>
    </ul>
  </div>

  <div class="card">
    <h3>Sección 11 — Cronograma</h3>
    <ul class="notes-list">
      <li>El mes 0 es siempre el pago inicial del solar. El "mes real del calendario" de ese mes 0 no cambia ningún importe — solo alinea la liquidación trimestral de IVA con los trimestres fiscales reales y determina en qué cierre cae diciembre para el pago del Impuesto de Sociedades.</li>
      <li>Mes de inicio y duración de la obra, mes de inicio y duración de las preventas, % de anticipos sobre el PVP (el resto se cobra en la escritura), meses de escrituración (reparto del saldo; con 0 se escritura todo de golpe en el mes de entrega).</li>
      <li><b>Mes de entrega y duración total del proyecto ya no se escriben a mano — se calculan solos.</b> Mes de entrega = inicio de obra + duración de obra + margen de gestión de entrega (el campo editable: licencia de primera ocupación, cédula de habitabilidad, certificado final de obra...). Duración total = mes de entrega + meses de escrituración. Así es estructuralmente imposible que la entrega quede fijada antes de que la obra termine de verdad, como podía pasar antes con los dos como campos manuales independientes.</li>
    </ul>
  </div>

  <div class="card">
    <h3>Cómo funciona el motor de cálculo, por dentro</h3>
    <ul class="notes-list">
      <li>El préstamo promotor se calcula sobre el coste de la promoción <b>sin</b> gastos financieros, para evitar la referencia circular de calcular intereses sobre un coste que ya los incluye.</li>
      <li>Los intereses se calculan mes a mes sobre el saldo realmente dispuesto: el banco desembolsa contra la necesidad real de tesorería de cada mes, con el límite del principal concedido, desde el inicio de obra hasta el fin de la escrituración — nunca antes, y nunca para pagar el suelo salvo que actives el % de suelo financiable de la sección 10.</li>
      <li>El IVA repercutido en ventas y el soportado en costes son cobros y pagos de caja reales, cada uno en el mes en que se factura. Con Hacienda se liquida el neto trimestral de golpe (aproximación al Modelo 303: trimestres de 3 meses desde el mes 0 del proyecto, con la liquidación final del tramo que quede en el último mes).</li>
      <li>Solo los impuestos no deducibles (ITP del suelo si aplica, y AJD de obra nueva/división horizontal) se incorporan como coste. El IVA soportado deducible en obra, honorarios, comisiones y notaría se recupera vía liquidación, no es coste de la promoción.</li>
      <li>Con permuta activa: el valor de mercado entregado se computa como ingreso económico (para el margen) pero no como cobro de caja; su IVA se devenga por anticipado (art. 75.Dos LIVA) en el momento configurado en la sección 4.</li>
      <li>La TIR y la MIRR se calculan sobre el flujo de caja del capital propio (equity), no sobre el proyecto completo — reflejan la rentabilidad de lo que realmente arriesga el promotor, no la del proyecto financiado al 100%.</li>
    </ul>
  </div>

  <div class="card">
    <h3>Las pestañas de resultados</h3>
    <ul class="notes-list">
      <li><b>Ingresos</b>: desglose de ventas por tipología, con y sin permuta.</li>
      <li><b>Costes</b>: todas las partidas agrupadas (suelo, construcción, honorarios, licencias, comercial, otros, financieros) con su peso sobre el total.</li>
      <li><b>Financiación</b>: principal concedido, qué tope (LTC o LTV) es el vinculante, estructura de capital propio vs. préstamo, y los ratios de apalancamiento (equity punta, % del préstamo dispuesto, coste financiero efectivo).</li>
      <li><b>Cash-Flow</b>: la tabla mensual completa — cobros, pagos, IVA, disposición y amortización del préstamo, flujo de equity.</li>
      <li><b>Resumen</b>: margen, las variantes de ROE (2 a la vista + 6 más en un desplegable), TIR, MIRR, VAN, payback, y todas las comprobaciones automáticas.</li>
      <li><b>Sensibilidad</b>: 8 escenarios con nombre, una matriz de margen cruzando % de precio de venta × % de coste de obra, y los puntos de equilibrio (caída de precio o sobrecoste máximo que el proyecto podría soportar antes de dejar de ser viable).</li>
      <li><b>Comparador ofertas</b>: las variantes de compra del suelo que hayas guardado en la sección 4, cada una con el estudio completo recalculado — tabla comparativa para el promotor (principal, equity punta, TIR, MIRR, ROE, beneficio, VAN) y el desglose de cobro de cada copropietario en cada oferta.</li>
      <li><b>Valorador Suelo</b>: sobre TU estudio completo ya relleno (Inputs), calcula por bisección qué precio de suelo deja exactamente el margen objetivo que le pidas — el "techo defendible" para negociar, método residual dinámico (Orden ECO/805/2003).</li>
      <li><b>Cálculo Express</b>: la misma pregunta que el Valorador Suelo (Modo B) o una viabilidad directa (Modo A), pero sin necesitar tener el estudio completo relleno — arranca de cero con solo 12 datos agregados, para cuando todavía no tienes el anteproyecto. Son complementarios: Valorador Suelo cuando ya trabajas el estudio completo, Express cuando todavía no.</li>
    </ul>
  </div>

  <div class="card">
    <h3>Comprobaciones automáticas incluidas</h3>
    <ul class="notes-list">
      <li>Densidad de viviendas y edificabilidad consumida frente a los máximos urbanísticos.</li>
      <li>Que el margen de gestión de entrega (sección 11) no esté en negativo — la entrega ya se calcula sola a partir del fin de obra, así que solo puede desajustarse si ese margen es negativo.</li>
      <li>Repago completo del préstamo al final del proyecto.</li>
      <li>Coherencia entre préstamo + capital propio y el coste total de la promoción en caja.</li>
      <li>Margen sobre ventas frente al umbral habitual exigido por la banca (≥18%).</li>
      <li>Loan to Value (préstamo / ventas) frente al tope configurado.</li>
      <li>Con permuta activa: que al menos el 50% del IVA de la permuta esté cubierto en efectivo por el permutante.</li>
      <li>Si se configura un % mínimo de preventas: que el préstamo haya podido disponerse siempre que hizo falta caja, sin quedar bloqueado por no llegar aún a ese mínimo.</li>
      <li>Si se indican plazas de aparcamiento exigidas por normativa: que las plazas de garaje planificadas en Ventas las cubran.</li>
      <li>Si se indica un % mínimo de techo en VPO: que las viviendas marcadas como VPO en Ventas lo cubran.</li>
    </ul>
  </div>

  <div class="card">
    <h3>Qué queda pendiente</h3>
    <ul class="notes-list">
      <li>Llevar la MIRR a la matriz de Sensibilidad (hoy solo se calcula el margen en esa matriz) — anotado para una próxima iteración, todavía sin decidir si como una segunda matriz independiente o como una segunda cifra dentro de cada celda.</li>
      <li>El posible AJD de la compra del suelo bajo régimen IVA (tarifa AJ4/AJ5) — pendiente de confirmar con gestoría antes de codificarlo.</li>
    </ul>
  </div>

  <div class="card">
    <h3>Plantilla, estudios guardados e import/export</h3>
    <ul class="notes-list">
      <li>La <b>plantilla de supuestos</b> guarda todo lo que no es específico de un solar concreto (%s de costes, condiciones de financiación...) para arrancar un estudio nuevo con tus valores habituales ya puestos.</li>
      <li>Cada estudio se autoguarda en el navegador (localStorage) y aparece en la <b>biblioteca de estudios guardados</b> de la pantalla de inicio.</li>
      <li><b>Exportar/importar JSON</b> permite sacar un estudio como archivo y volver a cargarlo — útil para compartirlo o para pasarlo a otro ordenador. Al importar un estudio antiguo, los campos que no existían en su momento (LTV máximo, % de suelo financiable, gate de preventas, plazas exigidas, notas urbanísticas...) se completan solos con sus valores por defecto, sin que se pierda nada de lo que ya tenías guardado.</li>
    </ul>
  </div>
  `;
}

