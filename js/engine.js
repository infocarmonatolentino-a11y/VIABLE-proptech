/* =========================================================================
   MOTOR DE CÁLCULO — replica exacta de las fórmulas del Excel de origen
   ========================================================================= */

// Aviso legal fijo de la portada de impresión — no es editable desde Inputs a propósito (no
// tiene que ver con rellenar el estudio), se imprime siempre igual, sin que haya que configurar
// nada.
const AVISO_LEGAL_FIJO = 'Este documento es una herramienta de apoyo a la decisión y no sustituye el asesoramiento profesional, legal, fiscal o financiero. Los cálculos se basan en los datos y supuestos introducidos por el usuario; no se garantiza la exactitud de las proyecciones ni se asume responsabilidad por decisiones de inversión adoptadas a partir de este informe.';

function defaultState(){
  return {
    project:{
      name:'Promoción Residencial "La Morera de Badalona"',
      address:'Avenida Morera 37, Badalona (PROYECTO 16 VIVIENDAS)',
      date:'2026-08-22',
      promoter:'Proyectos e Inversiones Carmona & Tolentino',
      typology:'Edificio plurifamiliar libre de 16 viviendas',
      // logoDataUrl: imagen en base64, se sube desde el botón "Logo PDF" junto a "Imprimir/PDF"
      // (no desde Inputs — no tiene que ver con rellenar el estudio). Se guarda dentro del
      // propio estudio (localStorage/JSON), sin depender de ningún archivo externo.
      logoDataUrl:''
    },
    urban:{ supSolar:365, edifMax:1430, densidadMax:16, supSR:1430, supBR:408, supTerrazas:154, plazasExigidas:0, reservaVPOPct:0, notasAdicionales:'' },
    // Snapshots con nombre de la sección 4 (suelo) completa, para comparar varias estructuras
    // de oferta de compra con el mismo resto del estudio — ver sección 4 y pestaña Comparador.
    ofertasComparativas:[],
    ventas:[
      { id:'v1', categoria:'vivienda', label:'Vivienda Tipo A (Bajos)', unidades:4, m2:91, precio:4000, iva:0.10, permuta:0, regimen:'Libre' },
      { id:'v2', categoria:'vivienda', label:'Vivienda Tipo B (Primeros)', unidades:4, m2:92, precio:4100, iva:0.10, permuta:0, regimen:'Libre' },
      { id:'v3', categoria:'vivienda', label:'Vivienda Tipo C (Segundos)', unidades:4, m2:105, precio:4100, iva:0.10, permuta:0, regimen:'Libre' },
      { id:'v4', categoria:'vivienda', label:'Vivienda Tipo D (Áticos)', unidades:4, m2:90, precio:5200, iva:0.10, permuta:0, regimen:'Libre' },
      { id:'v5', categoria:'local', label:'Local comercial', unidades:0, m2:0, precio:1500, iva:0.21, permuta:0, regimen:'Libre' },
      { id:'v6', categoria:'garaje', label:'Plaza de garaje (m²/ud.=1 → €/ud.)', unidades:16, m2:1, precio:25000, iva:0.10, permuta:0, regimen:'Libre' },
      { id:'v7', categoria:'trastero', label:'Trastero (m²/ud.=1 → €/ud.)', unidades:0, m2:1, precio:8000, iva:0.10, permuta:0, regimen:'Libre' }
    ],
    suelo:{
      // Un suelo en desarrollo suele tener varios propietarios, cada uno con su propio precio
      // pactado y su propio régimen fiscal (IVA si el vendedor actúa como empresario, ITP si
      // es un particular) — se modelan como filas independientes, no como un precio único.
      propietarios: [ { id:'prop_1', direccion:'', precio:1030000, regimen:'IVA', pct:0.21, pagoInicialPct:0.10, pagoHito2Pct:0, mesHito2:0, mesFinal:12 } ],
      // El propietario que recibe unidades en permuta puede tributar distinto al resto — se
      // mantiene aparte porque afecta solo al valor permutado, no al efectivo pagado a otros.
      regimenPermuta:'IVA', pctRegimenPermuta:0.21,
      // Momento en que se formaliza la permuta (para el devengo del IVA y el inicio del aval
      // que protege al propietario): en la firma (un único mes, lo habitual) o repartido
      // durante la escrituración de las ventas (menos habitual, pero posible si así se pacta).
      momentoPermutaIva:'firma', mesFirmaPermuta:0, avalPermutaPctAnual:0.005,
      comisionPct:0.03, notariaPct:0.015,
      ivaGeneral:0.21,
      formaPago:'efectivo', pctIvaPermutaCubierto:0 },
    construccion:{
      partidas:[
        { id:'pc1', label:'Demoliciones y movimiento de tierras', m2:0, eurM2:0 },
        { id:'pc2', label:'Urbanización — vial', m2:0, eurM2:300 },
        { id:'pc3', label:'Urbanización — zona verde', m2:0, eurM2:200 },
        { id:'pc4', label:'Construcción bajo rasante (garajes)', m2:408, eurM2:700 },
        { id:'pc5', label:'Construcción sobre rasante (viviendas y z. comunes)', m2:1430, eurM2:1500 }
      ],
      ggbiPct:0.19, ivaObraPct:0.10
    },
    honorarios:{ proyectoPct:0.04, direccionPct:0.03, sysPct:0.0075, octPct:0.005 },
    licencias:{ tasaPct:0.015, icioPct:0.04, ocupacionPct:0.005, ajdPct:0.015 },
    comercial:{ mktPct:0.015, comVtaPct:0.03 },
    otros:{ conexPct:0.015, segurosPct:0.01, estructuraPct:0.01, ibiAnual:1500, posventaPct:0.005, avalPct:0.01, imprevPct:0.05 },
    // ltc: % sobre el coste de construir + resto (honorarios, licencias, comercial, otros),
    // SIN el suelo — el préstamo promotor no financia la compra del suelo, que se paga
    // siempre con capital propio (ver compute(): principal excluye costeSueloCash de su base),
    // salvo por la parte que se marque como financiable en pctSueloFinanciable (ver abajo).
    // ltvMax: segundo tope real (no solo informativo) sobre el valor de venta de la
    // promoción — el banco concede el MENOR de los dos (LTC, LTV), como en la práctica real.
    // preventasMinPct: % mínimo de preventas acumuladas (contratos/arras firmados con
    // anticipo cobrado, sobre el total de anticipos previstos) que el banco exige alcanzar
    // antes de liberar CUALQUIER disposición del préstamo — condición binaria muy habitual
    // ("no se dispone crédito hasta no llevar vendido el X% de la promoción"), no una regla
    // proporcional. Con 0 no hay condicionante (se dispone según necesidad desde mesObra).
    // pctSueloFinanciable: qué parte del coste del suelo acepta financiar también el préstamo
    // promotor, además de la construcción. 0% (por defecto) = el escenario más habitual y
    // conservador, el suelo siempre va con capital propio. 100% = el otro extremo real: una
    // facilidad combinada suelo+construcción que financia el solar igual que cualquier otro
    // coste. Cualquier valor intermedio modela un banco que solo acepta financiar parte del
    // suelo — los tres casos son reales según la operación y el promotor.
    financiacion:{ ltc:0.80, ltvMax:0.60, preventasMinPct:0, pctSueloFinanciable:0, tipoInteres:CONFIG.tipoInteresDefecto, comApertura:0.005, gastosHipoteca:0.01, tasaDescuento:0.10, isPct:0.25, mirrTasaReinversion:0.02 },
    cronograma:{ mesCalendarioInicio:0, mesObra:12, durObra:21, mesVentas:12, durVentas:16, pctEntradaVentas:0.20, mesesEscr:3, mesesMargenEntrega:0 },
    // Preferencia de la sección "Valorador de suelo". No participa en ningún cálculo del
    // motor — solo recuerda qué margen objetivo tenías puesto la última vez.
    residual:{ margenObjetivo:0.20 }
  };
}

function irr(cashflows, guess){
  function npvAt(r){ let s=0; for(let t=0;t<cashflows.length;t++) s+=cashflows[t]/Math.pow(1+r,t); return s; }
  function dnpvAt(r){ let s=0; for(let t=1;t<cashflows.length;t++) s+=-t*cashflows[t]/Math.pow(1+r,t+1); return s; }
  // Si no hay al menos un flujo positivo y uno negativo, la TIR no está matemáticamente
  // definida (nunca se recupera nada, o nunca se aporta nada) — devolvemos null explícito
  // en vez de dejar que el solver invente un número sin sentido.
  const hasPos = cashflows.some(v=>v>1e-9), hasNeg = cashflows.some(v=>v<-1e-9);
  if(!hasPos || !hasNeg) return null;

  // Tolerancia relativa a la escala real de los flujos (en vez de un umbral absoluto fijo):
  // con proyectos de decenas de meses, evaluar el VAN cerca de r=-1 genera términos de
  // magnitud 10^40-10^70 por la potencia (1+r)^-t; ahí cualquier resta de dos números así
  // de grandes "parece" dar ~0 por pura cancelación de coma flotante, no porque sea una raíz
  // real. Un umbral absoluto tipo 1e-6 se cuela con esa basura numérica; uno relativo al
  // tamaño real de los flujos (unos pocos euros de margen sobre importes de miles/millones) no.
  const scale = Math.max(1, cashflows.reduce((a,v)=>a+Math.abs(v),0));
  const tol = scale*1e-9;

  let r = guess===undefined?0.1:guess;
  for(let i=0;i<100;i++){
    const f=npvAt(r), df=dnpvAt(r);
    if(Math.abs(df)<1e-12) break;
    const rNew=r-f/df;
    // Se descartan candidatos fuera de un rango mensual numéricamente sano: por debajo de
    // -50% mensual (ya es una pérdida devastadora, y más allá el cálculo se vuelve inestable
    // con proyectos largos) o por encima de +500% mensual (sin sentido económico real).
    if(!isFinite(rNew) || rNew<=-0.5 || rNew>5) break;
    if(Math.abs(rNew-r)<1e-12){ r=rNew; break; }
    r=rNew;
  }
  if(isFinite(r) && r>-0.5 && r<=5 && Math.abs(npvAt(r))<tol) return r;

  // Fallback: barrido de bisección en el mismo rango numéricamente sano, buscando el
  // PRIMER cambio de signo real del VAN. Evita que el solver devuelva una raíz espuria
  // cuando el flujo de caja tiene más de un cambio de signo (posible en escenarios extremos).
  let prevR = -0.5, prevF = npvAt(prevR);
  for(let r2=-0.49; r2<=5.001; r2+=0.01){
    const f2 = npvAt(r2);
    if(Math.abs(prevF)<tol) return prevR;
    if(isFinite(prevF) && isFinite(f2) && prevF*f2<0){
      let a=prevR, b=r2, fa=prevF;
      for(let k=0;k<100;k++){
        const mid=(a+b)/2, fmid=npvAt(mid);
        if(Math.abs(fmid)<tol) return mid;
        if(fa*fmid<0){ b=mid; } else { a=mid; fa=fmid; }
      }
      return (a+b)/2;
    }
    prevR=r2; prevF=f2;
  }
  // No se encontró ningún cambio de signo del VAN en el rango sano: no hay una TIR con
  // sentido económico y numéricamente fiable. Mejor devolver "no disponible" que un número
  // fabricado por ruido de coma flotante — el beneficio/ROE ya muestran la magnitud real.
  return null;
}

// TIR Modificada (MIRR): a diferencia de la TIR pura (que asume que cada euro que se recupera
// se reinvierte a la propia TIR, una hipótesis poco realista cuando la TIR sale muy alta), la
// MIRR separa dos tasas: la financiación de los flujos NEGATIVOS a una tasa de financiación
// (financeRate) y la reinversión de los flujos POSITIVOS a una tasa de reinversión conservadora
// (reinvestRate) — normalmente bastante más baja que la TIR. Es el mismo algoritmo que usa la
// función MIRR() de Excel/Sheets. Devuelve una tasa MENSUAL (igual que irr()); se anualiza igual.
function mirr(cashflows, financeRate, reinvestRate){
  const n = cashflows.length-1;
  if(n<=0) return null;
  let pvNegative=0, fvPositive=0;
  for(let t=0;t<=n;t++){
    const v = cashflows[t];
    if(v<0) pvNegative += v/Math.pow(1+financeRate,t);
    else if(v>0) fvPositive += v*Math.pow(1+reinvestRate,n-t);
  }
  // Si no hay al menos un flujo negativo y uno positivo, la MIRR tampoco está definida — mismo
  // criterio que ya aplica irr() más arriba.
  if(pvNegative===0 || fvPositive===0) return null;
  const val = fvPositive/(-pvNegative);
  return Math.pow(val, 1/n)-1;
}

// ITP en Cataluña — escala progresiva vigente desde el 27/06/2025 (Decreto-ley 5/2025): cada
// tramo del precio tributa a su propio tipo (como el IRPF), NO se aplica el tipo más alto a
// todo el importe. Devuelve el TIPO EFECTIVO medio (cuota total ÷ precio) para poder seguir
// usando "precio × tipo" en el resto del motor sin reescribir cada sitio que lo multiplica.
// Sustituye al 10% plano que se usaba antes de esta reforma.
// OJO — dos cosas que este cálculo automático NO puede saber, y que siguen exigiendo
// introducir el % a mano en su campo si aplican a tu operación:
//  1) La base imponible real es el MAYOR entre el precio escriturado y el valor de referencia
//     catastral publicado por el Catastro — si ese valor de referencia es mayor que el precio
//     pactado, Hacienda liquidará sobre el valor de referencia, no sobre el precio.
//  2) Tipos especiales (agravado 20% para grandes tenedores en determinadas adquisiciones de
//     vivienda/edificios enteros, reducidos para colectivos concretos) no aplican al perfil
//     habitual de compra de suelo por una promotora, así que no se contemplan aquí.
function itpEfectivoCataluna(precio){
  if(!precio || precio<=0) return 0.10;
  const tramos = [ [0,600000,0.10], [600000,900000,0.11], [900000,1500000,0.12], [1500000,Infinity,0.13] ];
  let cuota = 0;
  for(const [desde,hasta,tipo] of tramos){
    if(precio>desde) cuota += (Math.min(precio,hasta)-desde)*tipo;
  }
  return cuota/precio;
}
function npvExcelStyle(rate, values){ let s=0; for(let i=0;i<values.length;i++) s+=values[i]/Math.pow(1+rate,i+1); return s; }
function annualizeSafe(rate, months){
  // CAGR estándar: (1+rate)^(12/months)-1. Si la pérdida supera el 100% del capital,
  // (1+rate) es ≤0 y esa potencia fraccionaria no está definida en los reales (da NaN en
  // JS). En ese caso, en vez de mostrar NaN, mostramos -100% como suelo informativo — la
  // cifra sin anualizar (rate) ya muestra la magnitud real de la pérdida.
  if(months===0) return 0;
  if(1+rate<=0) return -1;
  return Math.pow(1+rate,12/months)-1;
}

function compute(state, scenarioOverrides){
  const U=state.urban, S=state.suelo, C=state.construccion,
        H=state.honorarios, L=state.licencias, M=state.comercial,
        O=state.otros, F=state.financiacion;
  // Overrides para la pestaña Sensibilidad: en vez de mantener una fórmula aproximada en
  // paralelo (que ha ido acumulando fallos de sincronización con el motor real), Sensibilidad
  // ahora llama a este MISMO compute() con estos tres parámetros, garantizando coincidencia
  // exacta con Resumen por construcción, no por ajuste manual de coeficientes.
  const ov = scenarioOverrides || {};
  const factorPrecioVenta = ov.factorPrecioVenta!==undefined ? ov.factorPrecioVenta : 1;
  const factorCosteObra = ov.factorCosteObra!==undefined ? ov.factorCosteObra : 1;
  const mesesExtra = ov.mesesExtra||0;
  // factorPrecioSuelo: multiplicador sobre el precio pactado de CADA propietario del suelo
  // (todos a la vez, proporcionalmente). Por defecto 1 (no toca nada) — solo lo usa el
  // "Valorador de suelo por residual" (sección H.0x) para buscar, por bisección sobre este
  // mismo motor, qué precio de suelo deja el margen objetivo exacto. Mismo patrón que
  // factorPrecioVenta/factorCosteObra de Sensibilidad: nunca un segundo motor en paralelo.
  const factorPrecioSuelo = ov.factorPrecioSuelo!==undefined ? ov.factorPrecioSuelo : 1;
  // El calendario se desplaza con mesesExtra: la obra tarda más y la entrega se retrasa,
  // pero el inicio de obra/preventas y el calendario de pago del suelo no se tocan (son
  // compromisos ya fijados, no dependen de cuánto se alargue la construcción).
  const T0 = mesesExtra ? { ...state.cronograma, durObra: state.cronograma.durObra+mesesExtra } : state.cronograma;
  // "Mes de entrega" y "Duración total del proyecto" ya NO son datos de entrada sueltos — se
  // derivan siempre de mes de inicio de obra + duración de obra + margen de gestión de entrega
  // (licencia de primera ocupación, cédula de habitabilidad...), y de ahí + meses de
  // escrituración. Así es estructuralmente imposible que la fecha de entrega se desincronice
  // de cuándo termina realmente la obra.
  const mesEntregaCalc = T0.mesObra + T0.durObra + (T0.mesesMargenEntrega||0);
  const T = { ...T0, mesEntrega: mesEntregaCalc, durProyecto: mesEntregaCalc + T0.mesesEscr };

  const edifConsumida = U.edifMax!==0 ? U.supSR/U.edifMax : 0;
  const edifLibre = U.edifMax - U.supSR;

  // Forma de pago del suelo: 'efectivo' | 'permuta' | 'mixta'.
  // En permuta/mixta, cada fila de ventas puede tener unidades "entregadas en especie"
  // al propietario del suelo en vez de vendidas en efectivo. Esas unidades se construyen
  // igual (no cambian m² ni PC) y no generan cobro real en el cash-flow (totalSinIva las
  // excluye), pero sí se reconocen como ingreso económico a valor de mercado en
  // valorTotalPromocion, que es la base correcta de beneficioBruto/margenVentas (evita
  // contar el valor permutado dos veces: una en el coste del suelo y otra al no
  // reconocerlo como ingreso).
  const permutaActiva = S.formaPago !== 'efectivo';
  const ventasCalc = state.ventas.map(v=>{
    const pvpUd = v.m2*v.precio;
    const permuta = permutaActiva ? Math.max(0, Math.min(v.permuta||0, v.unidades)) : 0;
    const unidadesVenta = v.unidades - permuta;
    // factorPrecioVenta (Sensibilidad) solo escala lo que se cobra en efectivo a mercado.
    // El valor de las unidades permutadas (valorPermutaFila) usa el PVP pactado sin escalar:
    // un contrato de permuta ya firmado no se renegocia porque el mercado suba o baje.
    const pvpUdVenta = pvpUd*factorPrecioVenta;
    const totalSinIva = unidadesVenta*pvpUdVenta;
    const ivaRepercutido = totalSinIva*v.iva;
    const valorPermutaFila = permuta*pvpUd;
    // IVA devengado por la entrega en especie de esta fila (art. 75.Dos LIVA: pago
    // anticipado en especie de la futura entrega de unidades). Se calcula con el mismo
    // tipo de IVA de la fila — igual que el de las unidades vendidas en efectivo — porque
    // cada tipología puede llevar un tipo distinto (vivienda 10%, garaje no anejo 21%...).
    const ivaRepercutidoPermutaFila = valorPermutaFila*v.iva;
    return { ...v, pvpUd, permuta, unidadesVenta, totalSinIva, ivaRepercutido, valorPermutaFila, ivaRepercutidoPermutaFila };
  });
  const ingresosTotal = ventasCalc.reduce((a,v)=>a+v.totalSinIva,0);
  const ivaRepercutidoTotal = ventasCalc.reduce((a,v)=>a+v.ivaRepercutido,0);
  const unidadesTotal = ventasCalc.reduce((a,v)=>a+v.unidades,0);
  const valorPermutaTotal = ventasCalc.reduce((a,v)=>a+v.valorPermutaFila,0);
  const unidadesPermutaTotal = ventasCalc.reduce((a,v)=>a+v.permuta,0);
  // IVA devengado por la permuta: se produce en el momento de la permuta (adelantado a la
  // entrega de llaves), independientemente de si el propietario del suelo aporta o no el
  // efectivo para cubrirlo. pctIvaPermutaCubierto (0-1) es lo que ese propietario aporta en
  // metálico junto al solar; el resto queda a cargo de la promotora como necesidad de caja.
  const ivaRepercutidoPermutaTotal = ventasCalc.reduce((a,v)=>a+v.ivaRepercutidoPermutaFila,0);
  const pctIvaPermutaCubierto = Math.max(0, Math.min(1, S.pctIvaPermutaCubierto||0));
  const ivaPermutaCubierto = ivaRepercutidoPermutaTotal*pctIvaPermutaCubierto;
  const ivaPermutaACargoPromotora = ivaRepercutidoPermutaTotal-ivaPermutaCubierto;
  // Valor total de la promoción = lo que se cobra en efectivo + el valor de mercado de lo
  // entregado en especie. Es la magnitud correcta para ratios de mercado (€/m²) y para
  // bases fiscales que gravan el valor total declarado, no solo el efectivo cobrado.
  const valorTotalPromocion = ingresosTotal + valorPermutaTotal;

  const viviendas = ventasCalc.filter(v=>v.categoria==='vivienda');
  const supVendibleSR = viviendas.reduce((a,v)=>a+v.unidades*v.m2,0);
  const ratioSupVendidaConstruida = U.supSR!==0 ? supVendibleSR/U.supSR : 0;
  const unidadesResidenciales = viviendas.reduce((a,v)=>a+v.unidades,0);
  const plazasPlanificadas = ventasCalc.filter(v=>v.categoria==='garaje').reduce((a,v)=>a+v.unidades,0);
  // Techo de vivienda en régimen protegido (general o especial), para contrastar contra la
  // reserva mínima urbanística — sobre la superficie sobre rasante total (U.supSR), igual base
  // que usa el check de edificabilidad.
  const techoVPO = viviendas.filter(v=>v.regimen && v.regimen!=='Libre').reduce((a,v)=>a+v.unidades*v.m2,0);
  const pctVPOActual = U.supSR!==0 ? techoVPO/U.supSR : 0;
  const precioMedioM2Construido = (U.supSR+U.supBR)!==0 ? valorTotalPromocion/(U.supSR+U.supBR) : 0;
  const sumUnidViv = viviendas.reduce((a,v)=>a+v.unidades,0);
  const precioMedioVivienda = sumUnidViv!==0 ? viviendas.reduce((a,v)=>a+v.unidades*v.pvpUd,0)/sumUnidViv : 0;

  // === Adquisición del suelo: tabla de propietarios/vendedores ===
  // Es habitual que un suelo en desarrollo pertenezca a varios propietarios distintos, cada
  // uno con su propio precio pactado y su propio régimen fiscal (IVA si el vendedor actúa
  // como empresario, ITP si es un particular). Mezclarlos en un único precio + régimen global
  // calcularía mal el IVA soportado y el ITP de todos menos uno de los propietarios.
  const propietariosCalc = (S.propietarios||[]).map(p=>{
    const precio = (p.precio||0)*factorPrecioSuelo;
    const regimen = p.regimen==='ITP' ? 'ITP' : 'IVA';
    const pct = p.pct!=null ? p.pct : (regimen==='IVA'?S.ivaGeneral:itpEfectivoCataluna(precio));
    const ivaSoportadoFila = regimen==='IVA' ? precio*pct : 0;
    const itpFila = regimen==='ITP' ? precio*pct : 0;
    // Calendario de pago propio de este propietario — cada uno puede cobrar en fechas y
    // porcentajes distintos, algo habitual cuando el suelo tiene varios vendedores.
    const pagoInicialPct = p.pagoInicialPct!=null ? p.pagoInicialPct : (S.pagoInicialPct!=null?S.pagoInicialPct:0.10);
    const pagoHito2Pct = p.pagoHito2Pct!=null ? p.pagoHito2Pct : (S.pagoHito2Pct!=null?S.pagoHito2Pct:0);
    const mesHito2 = p.mesHito2!=null ? p.mesHito2 : (S.mesHito2!=null?S.mesHito2:0);
    const mesFinal = p.mesFinal!=null ? p.mesFinal : (S.mesFinal!=null?S.mesFinal:12);
    const pagoFinalPct = Math.max(0, 1-pagoInicialPct-pagoHito2Pct);
    // Desglose de cobro de ESTE propietario, en bruto — para el comparador de ofertas y para
    // poder enseñarle al propietario en la mesa de negociación cuánto y cuándo cobra.
    const importeInicial = precio*pagoInicialPct;
    const importeHito2 = precio*pagoHito2Pct;
    const importeFinal = precio*pagoFinalPct;
    return { ...p, precio, regimen, pct, ivaSoportadoFila, itpFila, pagoInicialPct, pagoHito2Pct, mesHito2, mesFinal, pagoFinalPct,
      importeInicial, importeHito2, importeFinal };
  });
  const precioCashSolar = propietariosCalc.reduce((a,p)=>a+p.precio,0);
  const ivaCompraSoportadoPropietarios = propietariosCalc.reduce((a,p)=>a+p.ivaSoportadoFila,0);
  const itpCompraCostePropietarios = propietariosCalc.reduce((a,p)=>a+p.itpFila,0);

  // El propietario que recibe unidades en permuta puede tributar distinto al resto (por
  // ejemplo, si es él mismo empresario o particular) — se mantiene como un régimen aparte,
  // aplicado solo sobre el valor de mercado permutado, no sobre el efectivo de los demás.
  const regimenPermuta = S.regimenPermuta==='ITP' ? 'ITP' : 'IVA';
  const pctRegimenPermuta = S.pctRegimenPermuta!=null ? S.pctRegimenPermuta : (regimenPermuta==='IVA'?S.ivaGeneral:itpEfectivoCataluna(valorPermutaTotal));
  const ivaCompraSoportadoPermuta = regimenPermuta==='IVA' ? valorPermutaTotal*pctRegimenPermuta : 0;
  const itpCompraCostePermuta = regimenPermuta==='ITP' ? valorPermutaTotal*pctRegimenPermuta : 0;

  const ivaCompraSoportado = ivaCompraSoportadoPropietarios + ivaCompraSoportadoPermuta;
  const itpCompraCoste = itpCompraCostePropietarios + itpCompraCostePermuta;
  // Para el desglose de Resumen: qué parte de la base total fue por IVA y qué parte por ITP.
  const baseIvaTotal = propietariosCalc.filter(p=>p.regimen==='IVA').reduce((a,p)=>a+p.precio,0) + (regimenPermuta==='IVA'?valorPermutaTotal:0);
  const baseItpTotal = propietariosCalc.filter(p=>p.regimen==='ITP').reduce((a,p)=>a+p.precio,0) + (regimenPermuta==='ITP'?valorPermutaTotal:0);

  const precioBaseTotal = precioCashSolar + valorPermutaTotal;
  const comisionInmoCoste = precioBaseTotal*S.comisionPct;
  const comisionInmoIva = comisionInmoCoste*S.ivaGeneral;
  const notariaCoste = precioBaseTotal*S.notariaPct;
  const notariaIva = notariaCoste*S.ivaGeneral;
  // Coste del suelo "económico" (cuenta de resultados): el coste real, se pague como se pague.
  const costeSuelo = precioBaseTotal + itpCompraCoste + comisionInmoCoste + notariaCoste;
  // Coste del suelo "de caja" (cash-flow y dimensionamiento del préstamo): se resta el valor
  // permutado, porque esa parte nunca sale de la cuenta bancaria — se paga entregando pisos.
  const costeSueloCash = costeSuelo - valorPermutaTotal;
  const ivaSoportadoSuelo = ivaCompraSoportado + comisionInmoIva + notariaIva;

  const partidasCalc = C.partidas.map(p=>({ ...p, base:p.m2*p.eurM2*factorCosteObra }));
  const pem = partidasCalc.reduce((a,p)=>a+p.base,0);
  const ggbi = pem*C.ggbiPct;
  const pc = pem+ggbi;
  const ivaObraSoportado = pc*C.ivaObraPct;

  const honProyecto=pc*H.proyectoPct, honDireccion=pc*H.direccionPct, honSyS=pc*H.sysPct, honOct=pc*H.octPct;
  const costeHonorarios = honProyecto+honDireccion+honSyS+honOct;
  const ivaSoportadoHonorarios = costeHonorarios*S.ivaGeneral;

  const tasaLicenciaCoste=pc*L.tasaPct, icioCoste=pc*L.icioPct, licOcupacionCoste=pc*L.ocupacionPct;
  // AJD de obra nueva y división horizontal: grava el valor total declarado de lo construido,
  // incluidas las unidades entregadas en permuta (no solo lo que se cobra en efectivo).
  const ajdCoste = valorTotalPromocion*L.ajdPct;
  const costeLicencias = tasaLicenciaCoste+icioCoste+licOcupacionCoste+ajdCoste;

  const mktCoste = ingresosTotal*M.mktPct, comVtaCoste = ingresosTotal*M.comVtaPct;
  const costeComercial = mktCoste+comVtaCoste;
  const ivaSoportadoComercial = costeComercial*S.ivaGeneral;

  const conexCoste=pc*O.conexPct, ivaConex=conexCoste*S.ivaGeneral;
  const segurosCoste=pc*O.segurosPct;
  const estructuraCoste=ingresosTotal*O.estructuraPct, ivaEstructura=estructuraCoste*S.ivaGeneral;
  const ibiCoste = O.ibiAnual*(T.durProyecto/12);
  const posventaCoste=pc*O.posventaPct, ivaPosventa=posventaCoste*S.ivaGeneral;
  const anticiposBase = ingresosTotal*T.pctEntradaVentas;
  // Aval de cantidades a cuenta (Ley 57/1968): protege a los COMPRADORES por los anticipos que
  // entregan. Se mantiene fuera de "Otros" y con su propia línea porque su coste real depende
  // de cuándo se cobran esos anticipos (el periodo de preventas), no de toda la duración de la
  // obra — antes se repartía linealmente hasta la entrega, alargándolo más de la cuenta.
  const avalCoste = anticiposBase*O.avalPct, ivaAval=avalCoste*S.ivaGeneral;
  // Aval bancario de la permuta: protege al PROPIETARIO que entrega su suelo a cambio de
  // unidades futuras, por si la promotora quiebra antes de entregárselas — es una garantía
  // distinta de la anterior (protege a la propiedad, no a los compradores) y solo existe si
  // hay permuta activa. Se cobra habitualmente como un % anual sobre el valor garantizado,
  // vigente desde que se firma la permuta hasta que se entregan las unidades.
  const mesesAvalPermuta = permutaActiva ? Math.max(0, T.mesEntrega - S.mesFirmaPermuta) : 0;
  const avalPermutaCoste = permutaActiva ? valorPermutaTotal*(S.avalPermutaPctAnual||0)*(mesesAvalPermuta/12) : 0;
  const ivaAvalPermuta = avalPermutaCoste*S.ivaGeneral;
  const baseImprevistos = costeSuelo+pc+costeHonorarios+costeLicencias;
  const imprevistosCoste = baseImprevistos*O.imprevPct;
  const costeOtros = conexCoste+segurosCoste+estructuraCoste+ibiCoste+posventaCoste+imprevistosCoste;
  const ivaSoportadoOtros = ivaConex+ivaEstructura+ivaPosventa;

  // costeSinFin: coste económico total (para cuenta de resultados, márgenes e imprevistos).
  // costeSinFinCash: coste de caja total (para dimensionar el préstamo y el cash-flow) —
  // excluye el valor permutado del suelo, que no requiere financiación ni sale de caja.
  const costeSinFin = costeSuelo+pc+costeHonorarios+costeLicencias+costeComercial+costeOtros+avalCoste+avalPermutaCoste;
  const costeSinFinCash = costeSueloCash+pc+costeHonorarios+costeLicencias+costeComercial+costeOtros+avalCoste+avalPermutaCoste;
  const ivaSoportadoTotal = ivaSoportadoSuelo+ivaObraSoportado+ivaSoportadoHonorarios+0+ivaSoportadoComercial+ivaSoportadoOtros+ivaAval+ivaAvalPermuta;

  // El préstamo promotor, por defecto, NO financia el suelo (se paga con capital propio) —
  // el LTC se aplica solo sobre construcción + resto de costes en caja, salvo por la parte del
  // suelo que se marque como financiable en F.pctSueloFinanciable (0% = conservador/habitual,
  // 100% = facilidad combinada suelo+construcción, intermedio = financia solo una parte).
  // Además el banco concede el MENOR de dos topes: LTC sobre ese coste, o LTV sobre el
  // valor de venta de la promoción (a menudo el que de verdad ata corto en operaciones con
  // margen alto). Antes esto era un único LTC sobre TODO el coste en caja (suelo incluido)
  // y el LTV solo se comprobaba como aviso informativo a posteriori — infravaloraba mucho el
  // capital propio real necesario en el momento del pago del suelo.
  const pctSueloFinanciable = Math.max(0, Math.min(1, F.pctSueloFinanciable!=null ? F.pctSueloFinanciable : 0));
  const fraccionSueloNoFinanciable = 1 - pctSueloFinanciable;
  const baseLtcConstruccion = costeSinFinCash - costeSueloCash*fraccionSueloNoFinanciable;
  const ltvMaxUsado = F.ltvMax!=null ? F.ltvMax : 0.60;
  const limiteLtc = baseLtcConstruccion*F.ltc;
  const limiteLtv = valorTotalPromocion*ltvMaxUsado;
  const principal = Math.min(limiteLtc, limiteLtv);
  const limiteVinculante = limiteLtc<=limiteLtv ? 'LTC' : 'LTV';

  // Alineación con el calendario fiscal real (mismo "mes de inicio real del proyecto" que se
  // usa para la liquidación trimestral de IVA), necesaria para saber en qué mes de proyecto
  // cae cada diciembre real y cada cierre de ejercicio.
  const mesCalIni = ((T.mesCalendarioInicio||0)%12+12)%12; // 0=enero ... 11=diciembre
  const calMonth = m => (mesCalIni+m)%12; // mes de calendario real (0-11) del mes de proyecto m

  // El calendario de caja debe llegar hasta el mes real del pago del Impuesto de Sociedades,
  // aunque ese mes caiga después de que la promoción como tal ya esté totalmente terminada y
  // escriturada. Es un hecho fiscal, no una fase de la obra: el IS no se paga "X meses tras la
  // entrega" (eso no es lo que dice la ley) — se paga en la declaración del ejercicio en el que
  // cae la entrega, y esa declaración se presenta y paga dentro de los 25 días naturales
  // siguientes a los 6 meses posteriores al cierre de ese ejercicio (para un ejercicio que
  // coincide con el año natural, del 1 al 25 de julio del año siguiente). Se aproxima aquí como
  // "diciembre de cierre + 7 meses", que cae en julio, con precisión de mes.
  // OJO: esto NO debe alargar T.durProyecto en sí — ese campo sigue siendo la duración REAL
  // de la promoción (obra + ventas + escrituración), y de él depende el IBI y otros costes
  // que sí terminan cuando termina la promoción. Solo se alargan los ARRAYS del cash-flow
  // (nMonths), añadiendo al final los meses de "solo esperar a pagar Hacienda" que hagan
  // falta, con flujo cero salvo ese único pago.
  const mesesHastaDiciembreCierre = (11 - calMonth(T.mesEntrega) + 12) % 12;
  const mesDiciembreCierre = T.mesEntrega + mesesHastaDiciembreCierre;
  const mesPagoISRaw = mesDiciembreCierre + 7;
  const nMonths = Math.max(T.durProyecto, mesPagoISRaw)+1;

  // Calendario de liquidaciones de IVA (Modelo 303, trimestral): en vez de suponer que el
  // neto de cada mes se compensa solo o se liquida a mes vencido, se acumulan los tres meses
  // de cada trimestre y se liquida de golpe, como ocurre de verdad (20 de abril, julio,
  // octubre y 30 de enero). Los trimestres se alinean con el calendario fiscal real
  // (ene-mar, abr-jun, jul-sep, oct-dic) usando el mismo "mes de inicio real del proyecto"
  // ya calculado arriba (mesCalIni/calMonth) para el pago del IS.
  // El último tramo, aunque no llegue a 3 meses completos, se liquida igualmente en el último
  // mes del proyecto en vez de perderse fuera del horizonte.
  const liquidacionMonths = {};
  {
    let from = 0;
    for(let m=0; m<nMonths; m++){
      const cierreTrimestreFiscal = (calMonth(m)%3===2); // marzo, junio, septiembre o diciembre reales
      const esUltimoMes = (m===nMonths-1);
      if(cierreTrimestreFiscal || esUltimoMes){
        const settleMonth = Math.min(m+1, nMonths-1);
        const esDiciembre = (calMonth(m)===11) || esUltimoMes;
        if(!liquidacionMonths[settleMonth]) liquidacionMonths[settleMonth] = [];
        liquidacionMonths[settleMonth].push({ from, to:m, esDiciembre });
        from = m+1;
      }
    }
  }

  // Saldo de IVA arrastrado entre trimestres: si un trimestre sale a favor del promotor
  // (más soportado que repercutido, típico en los primeros meses antes de empezar a vender),
  // el régimen general NO lo devuelve en efectivo ese mismo trimestre — se arrastra como
  // crédito para descontarlo del siguiente trimestre en que sí haya que pagar. Solo se
  // recupera en efectivo de verdad en la liquidación final del proyecto (cierre/devolución
  // de la última declaración). Antes este saldo se "cobraba" en efectivo cada trimestre
  // aunque fuese a favor, lo cual era optimista para los meses previos al inicio de ventas.
  let saldoIvaAcumulado = 0; // >0 = pendiente de pagar (no debería quedar así tras liquidar); <0 = crédito a favor, arrastrado
  // Acumulado de anticipos cobrados, para medir qué % de las preventas previstas está ya
  // contratado mes a mes — proxy razonable: como los anticipos se reparten linealmente sobre
  // durVentas, el % acumulado de anticipos cobrados equivale al % de unidades ya comprometidas.
  let anticiposAcum = 0;
  const preventasMinPct = F.preventasMinPct!=null ? F.preventasMinPct : 0;
  let gatePreventasBloqueoDetectado = false; // true si alguna vez hizo falta préstamo y el gate lo impidió
  let mesPreventasMinAlcanzado = null;

  const cf = {
    anticipos:new Array(nMonths).fill(0), escrituracion:new Array(nMonths).fill(0), totalCobros:new Array(nMonths).fill(0),
    preventasAcumPct:new Array(nMonths).fill(0), gatePreventasOK:new Array(nMonths).fill(true),
    ivaRepercutido:new Array(nMonths).fill(0), ivaRepercutidoPermuta:new Array(nMonths).fill(0),
    ivaPermutaCobro:new Array(nMonths).fill(0), suelo:new Array(nMonths).fill(0), obra:new Array(nMonths).fill(0),
    honorarios:new Array(nMonths).fill(0), licencias:new Array(nMonths).fill(0), comercial:new Array(nMonths).fill(0),
    otros:new Array(nMonths).fill(0), aval:new Array(nMonths).fill(0), avalPermuta:new Array(nMonths).fill(0),
    totalPagos:new Array(nMonths).fill(0), ivaSoportado:new Array(nMonths).fill(0), liquidacionIvaTrimestral:new Array(nMonths).fill(0),
    saldoIva:new Array(nMonths).fill(0), flujoAntesFin:new Array(nMonths).fill(0), saldoInicial:new Array(nMonths).fill(0),
    limiteDisponible:new Array(nMonths).fill(0), necesidad:new Array(nMonths).fill(0), disposicion:new Array(nMonths).fill(0),
    amortizacion:new Array(nMonths).fill(0), intereses:new Array(nMonths).fill(0), comisiones:new Array(nMonths).fill(0),
    dispuestoAcum:new Array(nMonths).fill(0), saldoFinal:new Array(nMonths).fill(0), flujoEquity:new Array(nMonths).fill(0),
    flujoAcumulado:new Array(nMonths).fill(0)
  };

  for(let m=0;m<nMonths;m++){
    // Si no hay periodo de preventas (durVentas=0), no existe ventana temporal donde cobrar
    // la "entrada": en vez de perderla sin más, se pliega dentro de la escrituración — se
    // cobra el 100% en el momento de escriturar, no el 80%. Así nunca desaparece dinero por
    // el mero hecho de fijar la duración de preventas a cero.
    const pctEntradaEfectivo = T.durVentas>0 ? T.pctEntradaVentas : 0;
    cf.anticipos[m] = (T.durVentas>0 && m>=T.mesVentas && m<T.mesVentas+T.durVentas) ? ingresosTotal*pctEntradaEfectivo/T.durVentas : 0;
    anticiposAcum += cf.anticipos[m];
    // Si no hay preventas configuradas (anticiposBase=0, p.ej. 100% a escrituración), el gate
    // no puede evaluarse sobre una base nula — se da por cumplido para no bloquear sin sentido.
    cf.preventasAcumPct[m] = anticiposBase>0 ? Math.min(1, anticiposAcum/anticiposBase) : 1;
    if(mesPreventasMinAlcanzado===null && cf.preventasAcumPct[m]>=preventasMinPct) mesPreventasMinAlcanzado = m;
    // Mismo criterio, simétrico, para "Meses de escrituración" = 0: en vez de perder ese
    // dinero (dividir entre 0 meses y no cobrarlo nunca), se escritura todo de golpe en el
    // propio mes de entrega — la interpretación más razonable de "sin ventana de reparto".
    cf.escrituracion[m] = T.mesesEscr>0
      ? ((m>=T.mesEntrega && m<T.mesEntrega+T.mesesEscr) ? ingresosTotal*(1-pctEntradaEfectivo)/T.mesesEscr : 0)
      : (m===T.mesEntrega ? ingresosTotal*(1-pctEntradaEfectivo) : 0);
    cf.totalCobros[m] = cf.anticipos[m]+cf.escrituracion[m];
    cf.ivaRepercutido[m] = ingresosTotal!==0 ? cf.totalCobros[m]*(ivaRepercutidoTotal/ingresosTotal) : 0;

    // Reparto temporal de la PERMUTA (IVA y aportación del permutante): en la práctica, la
    // permuta se formaliza casi siempre en un único momento (la firma de la escritura de
    // permuta) — no se "escritura" en tres tandas como el efectivo. Por eso tiene su propio
    // calendario, seleccionable: de golpe en el mes de la firma, o repartido durante la
    // escrituración de las ventas si así se ha pactado. Mismo resguardo que arriba: si
    // "Meses de escrituración" = 0, se devenga de golpe en el mes de entrega, no se pierde.
    const permutaSched = S.momentoPermutaIva==='escrituracion'
      ? (T.mesesEscr>0 ? ((m>=T.mesEntrega && m<T.mesEntrega+T.mesesEscr) ? 1/T.mesesEscr : 0) : (m===T.mesEntrega ? 1 : 0))
      : (m===S.mesFirmaPermuta ? 1 : 0);
    // IVA devengado por la permuta (se liquida a Hacienda, entre en el saldoIva de abajo).
    cf.ivaRepercutidoPermuta[m] = ivaRepercutidoPermutaTotal*permutaSched;
    // Parte de ese IVA que el propietario del suelo aporta en efectivo (cobro real de caja,
    // no compensa contra Hacienda, es dinero que entra igual que un cobro de cliente).
    cf.ivaPermutaCobro[m] = ivaPermutaCubierto*permutaSched;

    // Reparto temporal del EFECTIVO del suelo: cada propietario tiene su propio calendario
    // de pago (inicial / hito 2 / final) — no un único calendario compartido por todos. La
    // comisión inmobiliaria y la notaría (costes de la operación en su conjunto, no de un
    // propietario en concreto) se reparten a prorrata del peso de cada uno sobre el total en
    // efectivo, siguiendo el calendario propio de cada cual — así el total pagado en caja
    // sigue cuadrando exacto con costeSueloCash, solo cambia CUÁNDO se paga cada parte. Si no
    // hay ningún propietario en efectivo (100% permuta), esa comisión/notaría —que se paga en
    // dinero igualmente— sigue el calendario de la propia permuta, para que no se pierda.
    cf.suelo[m] = propietariosCalc.reduce((a,p)=>{
      const sched = (m===0?p.pagoInicialPct:0)+(m===p.mesHito2?p.pagoHito2Pct:0)+(m===p.mesFinal?p.pagoFinalPct:0);
      const shareOverhead = precioCashSolar>0 ? p.precio/precioCashSolar : 0;
      const overheadFila = (comisionInmoCoste+notariaCoste)*shareOverhead;
      const itpFilaCash = p.regimen==='ITP' ? p.itpFila : 0;
      return a + (p.precio+itpFilaCash+overheadFila)*sched;
    }, 0)
    + (regimenPermuta==='ITP' ? itpCompraCostePermuta*permutaSched : 0)
    + (precioCashSolar===0 ? (comisionInmoCoste+notariaCoste)*permutaSched : 0);
    cf.obra[m] = (m>=T.mesObra && m<T.mesObra+T.durObra && T.durObra>0) ? pc/T.durObra : 0;
    cf.honorarios[m] = (m<=T.mesEntrega) ? costeHonorarios/(T.mesEntrega+1) : 0;
    cf.licencias[m] = (m===T.mesObra ? (tasaLicenciaCoste+icioCoste):0) + (m===T.mesEntrega ? (licOcupacionCoste+ajdCoste):0);
    // Igual que con la "entrada": si no hay ventana de preventas donde repartir el
    // marketing (durVentas=0), se paga proporcional a cuándo entra realmente el dinero, en
    // vez de desaparecer sin más. Con durVentas>0 se mantiene el reparto lineal de siempre.
    cf.comercial[m] = (T.durVentas>0
      ? ((m>=T.mesVentas && m<T.mesVentas+T.durVentas) ? mktCoste/T.durVentas : 0)
      : (ingresosTotal!==0 ? mktCoste*(cf.totalCobros[m]/ingresosTotal) : 0)
    ) + (ingresosTotal!==0 ? comVtaCoste*(cf.totalCobros[m]/ingresosTotal) : 0);
    cf.otros[m] = (m<=T.mesEntrega) ? costeOtros/(T.mesEntrega+1) : 0;
    // Aval de cantidades a cuenta: ligado al mismo calendario en que se cobran los anticipos
    // que protege (el periodo de preventas), no a toda la duración de la obra.
    cf.aval[m] = (T.durVentas>0 && m>=T.mesVentas && m<T.mesVentas+T.durVentas) ? avalCoste/T.durVentas : (T.durVentas===0 && ingresosTotal!==0 ? avalCoste*(cf.totalCobros[m]/ingresosTotal) : 0);
    // Aval bancario de la permuta: vigente desde que se firma la permuta hasta la entrega —
    // el propietario deja de necesitar esta garantía en cuanto recibe sus unidades.
    cf.avalPermuta[m] = (permutaActiva && mesesAvalPermuta>0 && m>=S.mesFirmaPermuta && m<T.mesEntrega) ? avalPermutaCoste/mesesAvalPermuta : 0;
    cf.totalPagos[m] = cf.suelo[m]+cf.obra[m]+cf.honorarios[m]+cf.licencias[m]+cf.comercial[m]+cf.otros[m]+cf.aval[m]+cf.avalPermuta[m];
    cf.ivaSoportado[m] = costeSinFinCash!==0 ? cf.totalPagos[m]*(ivaSoportadoTotal/costeSinFinCash) : 0;
    // El IVA de las ventas en efectivo SÍ es ahora un cobro/pago real de caja, cada uno en su
    // propio mes: el cliente paga el IVA repercutido junto al precio (cf.ivaRepercutido[m], un
    // cobro real), y el promotor paga el IVA soportado junto a cada factura (cf.ivaSoportado[m],
    // un pago real). Verificado que ambos, sumados a lo largo de TODO el proyecto, se cancelan
    // exactamente con la liquidación trimestral de abajo — no hay doble cuenta ni agujero: es
    // la misma neutralidad del IVA de siempre, pero ahora mostrando el efecto de caja real de
    // cada trimestre en vez de darla por compensada mes a mes.
    // Liquidación trimestral (Modelo 303): en el mes de cierre de cada trimestre fiscal real se
    // calcula el neto de ese trimestre y se suma al crédito/deuda arrastrado de trimestres
    // anteriores.
    // - Si el saldo acumulado sale a pagar (>0), se paga de golpe en efectivo ese importe y el
    //   saldo vuelve a cero (así es como funciona de verdad: lo que se debe, se paga).
    // - Si sale a favor (crédito, <0), NO se cobra en efectivo — se arrastra al siguiente
    //   trimestre, tal como exige el régimen general... salvo que el trimestre que se cierra
    //   sea el que termina en diciembre real: ahí sí existe el derecho a pedir la devolución
    //   en la declaración-resumen anual (Modelo 390), así que el crédito pendiente se cobra
    //   en efectivo en ese cierre en vez de seguir arrastrándose al año siguiente.
    // - En la liquidación final del proyecto (si no coincide con un diciembre) también se
    //   recupera en efectivo cualquier crédito pendiente, para que no se pierda ni un céntimo.
    if(liquidacionMonths[m]){
      let netoTrimestre = 0;
      let esCierreFiscal = false;
      for(const seg of liquidacionMonths[m]){
        for(let i=seg.from;i<=seg.to;i++) netoTrimestre += cf.ivaRepercutido[i]-cf.ivaSoportado[i];
        if(seg.esDiciembre) esCierreFiscal = true;
      }
      saldoIvaAcumulado += netoTrimestre;
      if(saldoIvaAcumulado > 0 || esCierreFiscal){
        cf.liquidacionIvaTrimestral[m] = -saldoIvaAcumulado;
        saldoIvaAcumulado = 0;
      } else {
        cf.liquidacionIvaTrimestral[m] = 0; // crédito a favor: se arrastra, no hay movimiento de caja
      }
    }
    // La parte del IVA de la permuta a cargo de la promotora (cf.saldoIva, ver más abajo) NO
    // se refunde en esta liquidación trimestral: ya tiene su propio calendario correcto (el
    // mismo mes en que se devenga, con un mes de desfase), y no depende de las ventas en
    // efectivo del trimestre en curso.
    cf.saldoIva[m] = m===0?0:(-cf.ivaRepercutidoPermuta[m-1]);
    cf.flujoAntesFin[m] = cf.totalCobros[m]+cf.ivaRepercutido[m]-cf.totalPagos[m]-cf.ivaSoportado[m]+cf.liquidacionIvaTrimestral[m]+cf.saldoIva[m]+cf.ivaPermutaCobro[m];

    cf.saldoInicial[m] = m===0?0:cf.saldoFinal[m-1];
    const cumDispuestoPrev = m===0?0:cf.dispuestoAcum[m-1];
    cf.limiteDisponible[m] = principal-cumDispuestoPrev;
    cf.intereses[m] = cf.saldoInicial[m]*F.tipoInteres/12;
    cf.comisiones[m] = m===T.mesObra ? (principal*F.comApertura+principal*F.gastosHipoteca) : 0;
    // Se suma de vuelta la parte NO financiable de cf.suelo[m] (cancela esa fracción de su
    // resta dentro de flujoAntesFin) para que solo esa parte quede excluida del límite del
    // préstamo — sea cual sea el mes en que caiga el pago, incluso coincidiendo con el inicio
    // de obra. Con pctSueloFinanciable=0 (por defecto) se excluye el pago entero, como antes;
    // con 100% no se excluye nada y el suelo compite por el préstamo igual que cualquier otro
    // coste; con un valor intermedio, solo la parte no financiable exige capital propio.
    cf.necesidad[m] = Math.max(0, -(cf.flujoAntesFin[m]+cf.suelo[m]*fraccionSueloNoFinanciable)+cf.intereses[m]+cf.comisiones[m]);
    const gateOK = cf.preventasAcumPct[m] >= preventasMinPct;
    cf.gatePreventasOK[m] = gateOK;
    if(!gateOK && cf.necesidad[m]>1 && m>=T.mesObra && m<=T.mesEntrega+T.mesesEscr) gatePreventasBloqueoDetectado = true;
    cf.disposicion[m] = (m>=T.mesObra && m<=T.mesEntrega+T.mesesEscr && gateOK) ? Math.min(cf.limiteDisponible[m], cf.necesidad[m]) : 0;
    if(m>=T.mesEntrega+T.mesesEscr-1){ cf.amortizacion[m] = cf.saldoInicial[m]+cf.disposicion[m]; }
    else if(m>=T.mesEntrega){ cf.amortizacion[m] = Math.min(cf.saldoInicial[m]+cf.disposicion[m], cf.escrituracion[m]); }
    else { cf.amortizacion[m] = 0; }
    cf.dispuestoAcum[m] = cumDispuestoPrev+cf.disposicion[m];
    cf.saldoFinal[m] = cf.saldoInicial[m]+cf.disposicion[m]-cf.amortizacion[m];

    cf.flujoEquity[m] = cf.flujoAntesFin[m]+cf.disposicion[m]-cf.amortizacion[m]-cf.intereses[m]-cf.comisiones[m];
    cf.flujoAcumulado[m] = m===0?cf.flujoEquity[m]:cf.flujoAcumulado[m-1]+cf.flujoEquity[m];
  }

  const interesesTotales = cf.intereses.reduce((a,b)=>a+b,0);
  const dispuestoMax = Math.max(...cf.dispuestoAcum);

  const comisionApertura = principal*F.comApertura;
  const tasacionNotaria = principal*F.gastosHipoteca;
  const costeFinanciero = comisionApertura+tasacionNotaria+interesesTotales;
  // costeTotal: coste económico total de la promoción (incluye el valor íntegro del suelo,
  // se pague en efectivo o en unidades permutadas) — es la cifra que reduce el beneficio.
  const costeTotal = costeSinFin+costeFinanciero;
  // costeTotalCash: coste que realmente hay que financiar con préstamo + capital propio.
  // Excluye el valor permutado, que se "paga" entregando pisos y no requiere tesorería.
  const costeTotalCash = costeSinFinCash+costeFinanciero;
  const equity = costeTotalCash-principal;

  // Beneficio Bruto: los ingresos que corresponden aquí son los ingresos ECONÓMICOS totales
  // de la promoción (ventas en efectivo + valor de mercado de las unidades entregadas en
  // permuta), no solo el efectivo. Si aquí se usara solo el efectivo, el valor permutado se
  // restaría DOS VECES del beneficio: una vez al no contarlo como ingreso, y otra vez porque
  // ya está incluido íntegro en costeSuelo (que sí es el coste económico total, correcto).
  // valorTotalPromocion = ingresosTotal + valorPermutaTotal ya existe (se usa para el AJD),
  // así que se reutiliza aquí en vez de crear una variable nueva.
  //
  // Además (corregido): se resta "ivaPermutaACargoPromotora" — el IVA de las unidades
  // permutadas que NO cubre el permutante en efectivo. A diferencia del IVA de las ventas en
  // efectivo (que es neutro: el cliente lo paga y financia exactamente su liquidación), este
  // IVA no tiene ningún cobro que lo financie —esas unidades nunca generan ingreso de caja—
  // así que es una pérdida real y permanente para la promotora, no un simple desfase temporal.
  // Ya se venía incluyendo correctamente en el Cash-Flow (cf.saldoIva) desde el diseño
  // original de la permuta, pero faltaba aquí: sin este ajuste, el Beneficio Bruto y la suma
  // del flujo de caja del capital propio dejaban de coincidir exactamente cuando había
  // permuta activa, por culpa de este único término (ivaRepercutidoPermutaTotal menos lo que
  // aporta el permutante).
  const beneficioBruto = valorTotalPromocion-costeSuelo-pc-costeHonorarios-costeLicencias-costeComercial-costeOtros-avalCoste-avalPermutaCoste-costeFinanciero-ivaPermutaACargoPromotora;
  const impuestoSociedades = -beneficioBruto*F.isPct;
  const beneficioNeto = beneficioBruto+impuestoSociedades;

  // === Impuesto de Sociedades como pago REAL de caja ===
  // Se inyecta en su mes real: el cierre de diciembre del ejercicio en que cae la entrega,
  // más 7 meses (aproximación a mes de "6 meses + 25 días naturales", que cae en julio) —
  // calculado arriba (mesPagoISRaw) usando el mes de inicio real del proyecto. El array de
  // cash-flow (nMonths, arriba) ya se ha dimensionado para llegar hasta este mes sin necesidad
  // de tocar T.durProyecto ni aproximar nada: si el pago cae después de que la promoción como
  // tal ya esté terminada, sencillamente se añaden al final los meses que hagan falta con
  // flujo cero salvo este pago — no se le cobra IBI ni ningún otro coste de más por esos meses,
  // porque la promoción real sigue durando lo que dura.
  const mesPagoIS = mesPagoISRaw;
  // Informativo: cuántos meses después de que termine la promoción real cae el pago fiscal.
  // 0 o negativo si cae dentro de la propia promoción.
  const mesesISTrasFinProyecto = Math.max(0, mesPagoISRaw - T.durProyecto);
  cf.impuestoSociedades = new Array(nMonths).fill(0);
  cf.impuestoSociedades[mesPagoIS] += impuestoSociedades;
  for(let m=0;m<nMonths;m++){
    cf.flujoEquity[m] += cf.impuestoSociedades[m];
  }
  // Se recalcula el acumulado desde cero: insertar el pago del IS en un mes concreto cambia
  // todos los acumulados posteriores a ese mes.
  for(let m=0;m<nMonths;m++){
    cf.flujoAcumulado[m] = m===0 ? cf.flujoEquity[0] : cf.flujoAcumulado[m-1]+cf.flujoEquity[m];
  }

  // equityPunta, TIR, VAN y Payback se calculan DESPUÉS de inyectar el IS, para que reflejen
  // la necesidad real de tesorería y la rentabilidad real neta de impuestos — no una cifra
  // que ignora un pago que sabemos con certeza que habrá que hacer.
  // Si el flujo acumulado nunca baja de cero, el proyecto está autofinanciado (los cobros de
  // clientes cubren los pagos en todo momento) y nunca ha hecho falta capital propio real.
  // -Math.min(...) daría entonces un número NEGATIVO (p.ej. si el mínimo es +75.000, saldría
  // -75.000), lo cual no es "capital propio negativo" sino simplemente "cero necesario" — se
  // acota en 0 en vez de dejar pasar ese signo, que si no arrastra un ROE sin sentido más abajo.
  const equityPunta = Math.max(0, -Math.min(...cf.flujoAcumulado));

  const tirMensual = irr(cf.flujoEquity, 0.02);
  const tirAnual = tirMensual===null ? null : Math.pow(1+tirMensual,12)-1;
  const tasaDescMensual = Math.pow(1+F.tasaDescuento,1/12)-1;
  const van = cf.flujoEquity[0]+npvExcelStyle(tasaDescMensual, cf.flujoEquity.slice(1));

  // TIR modificada (MIRR): los flujos negativos (aportaciones de equity) se financian al tipo
  // de interés del propio préstamo promotor (F.tipoInteres) — es la tasa real a la que la
  // promotora podría financiar ese hueco de caja si quisiera. Los flujos positivos se reinvierten
  // a F.mirrTasaReinversion, una tasa deliberadamente conservadora (input propio, sección
  // Financiación) en vez de a la propia TIR como hace irr(). mirr() devuelve una tasa MENSUAL,
  // se anualiza con el mismo criterio que tirMensual->tirAnual arriba.
  const tasaFinMirrMensual = Math.pow(1+F.tipoInteres,1/12)-1;
  const tasaReinvMirrMensual = Math.pow(1+(F.mirrTasaReinversion||0),1/12)-1;
  const mirrMensual = mirr(cf.flujoEquity, tasaFinMirrMensual, tasaReinvMirrMensual);
  const mirrAnual = mirrMensual===null ? null : Math.pow(1+mirrMensual,12)-1;

  let payback='';
  for(let m=0;m<nMonths;m++){
    if(m===0){ if(cf.flujoAcumulado[0]>0) payback=0; }
    else { if(cf.flujoAcumulado[m]>0 && cf.flujoAcumulado[m-1]<=0) payback=m; }
  }

  // margenVentas usa la misma base de ingresos económicos totales que beneficioBruto,
  // para que numerador y denominador sean coherentes entre sí.
  const margenVentas = valorTotalPromocion!==0 ? beneficioBruto/valorTotalPromocion : 0;
  const margenCostes = costeTotal!==0 ? beneficioBruto/costeTotal : 0;
  // ROE: se ofrecen dos versiones porque responden a preguntas distintas para el inversor.
  // "Estándar" (después de Impuesto de Sociedades) es la definición habitual de ROE — es lo
  // que el inversor efectivamente se queda una vez pagado el 25% a Hacienda, y es la que se
  // muestra primero. "Antes de impuestos" se mantiene también porque compara directamente
  // con el margen bruto y es útil para comparar operaciones con distinta fiscalidad societaria.
  // Con equityPunta ya acotado en 0 arriba, "equityPunta>0" es ahora el único caso con capital
  // propio real que dividir. Si es 0 (proyecto autofinanciado), el ROE no está matemáticamente
  // definido (dividir por cero capital no tiene sentido económico) — se devuelve null explícito,
  // igual que ya se hacía con la TIR más arriba, en vez de un 0% o un negativo fabricados que
  // esconderían que en realidad es el mejor escenario posible: beneficio real sin arriesgar nada
  // propio. fmtPct ya sabe pintar null como "—".
  const roeNeto = equityPunta>0 ? beneficioNeto/equityPunta : null;
  const roeNetoAnualizado = roeNeto===null ? null : annualizeSafe(roeNeto, T.durProyecto);
  const roe = equityPunta>0 ? beneficioBruto/equityPunta : null;
  const roeAnualizado = roe===null ? null : annualizeSafe(roe, T.durProyecto);

  // Mismas 4 variantes, pero sobre el "equity total" (costeTotalCash - principal) en vez de
  // sobre la punta de tesorería. Es una cifra distinta a propósito, no un duplicado: el equity
  // total es una foto fija de sources & uses (todo el coste en caja que no cubre el préstamo,
  // sumado sin mirar el calendario), y casi siempre es MAYOR que la punta real de tesorería,
  // porque no tiene en cuenta que parte de ese capital se recicla con los cobros de clientes
  // antes de que termine de pagarse todo el coste. Por eso este ROE saldrá sistemáticamente
  // más bajo que el de la punta — no es un error, es una vara de medir más conservadora.
  // Mismo criterio de null que arriba si no hay equity total que dividir (deuda al 100%).
  const roeNetoEquityTotal = equity>0 ? beneficioNeto/equity : null;
  const roeNetoEquityTotalAnualizado = roeNetoEquityTotal===null ? null : annualizeSafe(roeNetoEquityTotal, T.durProyecto);
  const roeEquityTotal = equity>0 ? beneficioBruto/equity : null;
  const roeEquityTotalAnualizado = roeEquityTotal===null ? null : annualizeSafe(roeEquityTotal, T.durProyecto);

  const costeConstruccionM2 = (U.supSR+U.supBR)!==0 ? pc/(U.supSR+U.supBR) : 0;
  const costeTotalPorVivienda = unidadesResidenciales!==0 ? costeTotal/unidadesResidenciales : 0;
  const repercusionSueloPorVivienda = unidadesResidenciales!==0 ? costeSuelo/unidadesResidenciales : 0;

  // --- Repercusiones medias, para contrastarlas con los suelos de referencia que
  // fija Dirección en Configuración maestra ---
  // Coste de construcción repercutido: PEM entre todo el techo edificado (sobre y
  // bajo rasante). Es la cifra con la que se habla de "a cuánto me sale el m²".
  const techoTotalConstruido = (U.supSR||0) + (U.supBR||0);
  const costeConstruccionRepercutido = techoTotalConstruido>0 ? pem/techoTotalConstruido : null;
  // Precio de venta medio de VIVIENDA (libre y VPO): se dejan fuera locales, garajes
  // y trasteros, que van a otro €/m² y desvirtuarían la media.
  const vivCalc = ventasCalc.filter(v=>v.categoria==='vivienda');
  const m2ViviendaTotal = vivCalc.reduce((a,v)=>a+(v.m2||0)*(v.unidades||0),0);
  const valorViviendaTotal = vivCalc.reduce((a,v)=>a+(v.m2||0)*(v.unidades||0)*(v.precio||0),0);
  const precioVentaMedioVivienda = m2ViviendaTotal>0 ? valorViviendaTotal/m2ViviendaTotal : null;

  const checks = {
    densidad: unidadesResidenciales<=U.densidadMax,
    edificabilidad: U.supSR<=U.edifMax,
    edificabilidadAvisoLibre: edifConsumida<0.98,
    // U.plazasExigidas=0 significa "sin dato / no verificado", no "cero plazas exigidas" —
    // en ese caso el check se da por cumplido para no lanzar una alarma sin fundamento.
    plazasAparcamiento: U.plazasExigidas<=0 ? true : plazasPlanificadas>=U.plazasExigidas,
    // U.reservaVPOPct=0 significa "sin exigencia", no "0% exigido" — igual criterio que el
    // resto de checks opcionales de esta sección (plazas, preventas).
    reservaVPO: U.reservaVPOPct<=0 ? true : pctVPOActual>=U.reservaVPOPct,
    // Con mesEntrega calculado (mesObra+durObra+margen), ya es estructuralmente imposible que
    // la entrega caiga antes del fin de obra salvo que el margen se ponga en negativo a mano.
    margenEntregaValido: (T0.mesesMargenEntrega||0)>=0,
    prestamoRepagado: Math.abs(cf.saldoFinal[nMonths-1])<1,
    coherencia: Math.abs(principal+equity-costeTotalCash)<1,
    margenMinimo: margenVentas>=CONFIG.margenMin,
    // OJO: usa valorTotalPromocion (valor de venta total, incluida la parte en permuta), la
    // MISMA base sobre la que se calculó limiteLtv más arriba — no ingresosTotal (que excluye
    // la permuta). Con ingresosTotal, en una operación con permuta este check mostraría un LTV
    // más bajo (más favorable) del que realmente usó el banco para conceder el principal.
    ltv: (valorTotalPromocion!==0?principal/valorTotalPromocion:0)<=(F.ltvMax!=null?F.ltvMax:0.60),
    // false = en algún momento hizo falta disponer del préstamo y el gate de preventas lo
    // impidió (obligando a capital propio adicional que quizá no se había previsto).
    preventasGateSinBloqueos: !gatePreventasBloqueoDetectado,
    // Aviso si hay IVA de permuta y menos de la mitad está cubierto en efectivo por el
    // propietario del suelo: el resto compite por caja/financiación como cualquier pago.
    ivaPermutaCubierto: ivaRepercutidoPermutaTotal<1 || pctIvaPermutaCubierto>=0.5,
    // --- Umbrales de Configuración maestra (los fija Dirección en el panel) ---
    // Con el umbral a null o 0 ("sin umbral fijado") el check se da por cumplido:
    // mismo criterio que plazasExigidas o reservaVPO.
    costeConstruccionMin: !CONFIG.costeConstruccionMin ? true
      : (costeConstruccionRepercutido===null ? true : costeConstruccionRepercutido>=CONFIG.costeConstruccionMin),
    precioVentaMin: !CONFIG.precioVentaMin ? true
      : (precioVentaMedioVivienda===null ? true : precioVentaMedioVivienda>=CONFIG.precioVentaMin)
  };

  // --- Sensibilidad (Escenarios, Matriz, Puntos de equilibrio) ---
  // En vez de mantener una fórmula lineal aproximada en paralelo al motor real (que ha ido
  // acumulando desajustes cada vez que se toca compute(): doble descuento, comisión sobre
  // el valor permutado, imprevistos, financiación sobre el valor permutado...), Sensibilidad
  // ahora vuelve a llamar a este MISMO compute() con precio/coste/plazo escalados. Así el
  // "escenario Base" coincide con Resumen por construcción, no por que alguien haya
  // sincronizado dos fórmulas a mano — y cualquier futuro cambio en compute() se refleja
  // aquí automáticamente, sin arrastrar un desajuste nuevo.
  //
  // scenarioOverrides evita que esto se dispare en cascada: cada llamada anidada a compute()
  // lleva scenarioOverrides definido, así que esta sección se salta en esas llamadas (si no,
  // cada sub-cálculo intentaría generar sus propios 50 sub-cálculos, y así sucesivamente).
  let escenarios = [], matriz = [], preciosFactor = [], costeFactor = [];
  let factorPrecioBE = 0, precioMedioBE = 0, caidaPrecioSoportable = 0, factorCosteBE = 0, sobrecosteSoportable = 0;

  if(!scenarioOverrides){
    const scenario = (factorPrecio, factorCosteObra, mesesExtra) => {
      const R2 = compute(state, { factorPrecioVenta:factorPrecio, factorCosteObra, mesesExtra });
      return { factorPrecio, factorCosteObra, mesesExtra,
        ingresos:R2.valorTotalPromocion, costeTotal:R2.costeTotal, beneficioBruto:R2.beneficioBruto,
        margenVentas:R2.margenVentas, margenCostes:R2.margenCostes, tirAprox:R2.tirAnual };
    };
    escenarios = [
      { nombre:'Base', fp:1, fc:1, me:0 },
      { nombre:'Precios de venta −5%', fp:0.95, fc:1, me:0 },
      { nombre:'Precios de venta −10%', fp:0.90, fc:1, me:0 },
      { nombre:'Precios de venta +5%', fp:1.05, fc:1, me:0 },
      { nombre:'Coste de obra +10%', fp:1, fc:1.10, me:0 },
      { nombre:'Coste de obra +5% y precios −5%', fp:0.95, fc:1.05, me:0 },
      { nombre:'Retraso de 6 meses', fp:1, fc:1, me:6 },
      { nombre:'Estrés: precios −10%, obra +10%, +6 meses', fp:0.90, fc:1.10, me:6 }
    ].map(s=>({ nombre:s.nombre, ...scenario(s.fp,s.fc,s.me) }));

    preciosFactor = [0.85,0.90,0.95,1,1.05,1.10,1.15];
    costeFactor = [0.90,0.95,1,1.05,1.10,1.15];
    matriz = preciosFactor.map(pf=>({
      precioFactor:pf,
      valores: costeFactor.map(cf_=>compute(state,{ factorPrecioVenta:pf, factorCosteObra:cf_, mesesExtra:0 }).margenVentas)
    }));

    // Puntos de equilibrio: en vez de resolver la ecuación a mano (frágil — cada término
    // nuevo del motor obliga a re-derivar la fórmula), se busca numéricamente el factor que
    // hace beneficioBruto=0 mediante bisección sobre el motor real. Más lento (unas pocas
    // decenas de llamadas), pero exacto por construcción y no se desincroniza nunca.
    const findBreakeven = (evalFn, lo, hi) => {
      let flo = evalFn(lo), fhi = evalFn(hi);
      if(isNaN(flo)||isNaN(fhi)||flo*fhi>0) return null; // no hay cruce por cero en el rango
      for(let i=0;i<60;i++){
        const mid=(lo+hi)/2, fmid=evalFn(mid);
        if(Math.abs(fmid)<1) return mid; // 1€ de tolerancia sobre importes de cientos de miles
        if(flo*fmid<0){ hi=mid; fhi=fmid; } else { lo=mid; flo=fmid; }
      }
      return (lo+hi)/2;
    };
    const bePrecio = findBreakeven(fp=>compute(state,{ factorPrecioVenta:fp, factorCosteObra:1, mesesExtra:0 }).beneficioBruto, 0, 3);
    factorPrecioBE = bePrecio===null ? 0 : bePrecio;
    precioMedioBE = factorPrecioBE*precioMedioM2Construido;
    caidaPrecioSoportable = 1-factorPrecioBE;
    const beCoste = findBreakeven(fc_=>compute(state,{ factorPrecioVenta:1, factorCosteObra:fc_, mesesExtra:0 }).beneficioBruto, 0, 10);
    factorCosteBE = beCoste===null ? 0 : beCoste;
    sobrecosteSoportable = factorCosteBE-1;
  }

  return {
    edifConsumida, edifLibre, ventasCalc, ingresosTotal, ivaRepercutidoTotal, unidadesTotal,
    permutaActiva, valorPermutaTotal, unidadesPermutaTotal, valorTotalPromocion,
    ivaRepercutidoPermutaTotal, pctIvaPermutaCubierto, ivaPermutaCubierto, ivaPermutaACargoPromotora,
    supVendibleSR, ratioSupVendidaConstruida, unidadesResidenciales, plazasPlanificadas, techoVPO, pctVPOActual, precioMedioM2Construido, precioMedioVivienda,
    mesEntrega: T.mesEntrega, durProyecto: T.durProyecto,
    propietariosCalc, precioCashSolar, precioBaseTotal, costeSuelo, costeSueloCash, ivaSoportadoSuelo, itpCompraCoste, ivaCompraSoportado, comisionInmoCoste, notariaCoste,
    baseIvaTotal, baseItpTotal, regimenPermuta, pctRegimenPermuta,
    ivaCompraSoportadoPropietarios, itpCompraCostePropietarios,
    pem, ggbi, pc, ivaObraSoportado, partidasCalc,
    costeConstruccionRepercutido, precioVentaMedioVivienda,
    costeHonorarios, honProyecto, honDireccion, honSyS, honOct, ivaSoportadoHonorarios,
    costeLicencias, tasaLicenciaCoste, icioCoste, licOcupacionCoste, ajdCoste,
    costeComercial, mktCoste, comVtaCoste, ivaSoportadoComercial,
    costeOtros, conexCoste, segurosCoste, estructuraCoste, ibiCoste, posventaCoste, avalCoste, avalPermutaCoste, ivaAvalPermuta, mesesAvalPermuta, imprevistosCoste, ivaSoportadoOtros,
    costeSinFin, costeSinFinCash, ivaSoportadoTotal,
    baseLtcConstruccion, ltvMaxUsado, pctSueloFinanciable, limiteLtc, limiteLtv, limiteVinculante,
    preventasMinPct, mesPreventasMinAlcanzado, gatePreventasBloqueoDetectado,
    principal, comisionApertura, tasacionNotaria, interesesTotales, costeFinanciero, costeTotal, costeTotalCash, equity,
    dispuestoMax, equityPunta, cf, nMonths,
    tirMensual, tirAnual, mirrMensual, mirrAnual, tasaDescMensual, van, payback,
    beneficioBruto, impuestoSociedades, beneficioNeto, mesPagoIS, mesesISTrasFinProyecto,
    margenVentas, margenCostes, roe, roeAnualizado, roeNeto, roeNetoAnualizado,
    roeEquityTotal, roeEquityTotalAnualizado, roeNetoEquityTotal, roeNetoEquityTotalAnualizado,
    costeConstruccionM2, costeTotalPorVivienda, repercusionSueloPorVivienda, checks,
    escenarios, matriz, preciosFactor, costeFactor,
    factorPrecioBE, precioMedioBE, caidaPrecioSoportable, factorCosteBE, sobrecosteSoportable
  };
}
