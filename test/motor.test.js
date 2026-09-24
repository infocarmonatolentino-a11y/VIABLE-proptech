/* =========================================================================
   PRUEBAS DE REGRESIÓN DEL MOTOR DE CÁLCULO
   -------------------------------------------------------------------------
   Se ejecuta con:   node test/motor.test.js
   Sin dependencias, sin framework, sin instalar nada. Devuelve código de
   salida 1 si algo falla, para poder engancharlo a un hook de git o a CI.

   Carga js/config.js y js/engine.js en un contexto de Node (vm) tal cual
   están, sin modificarlos: si el motor deja de poder ejecutarse fuera del
   navegador, estas pruebas lo detectan por sí solas.

   Dos tipos de comprobación, y los dos hacen falta:

   1. VALORES CONGELADOS del escenario de ejemplo. Protegen contra cambios
      accidentales: si tocas compute() y la TIR del ejemplo se mueve, o fue
      a propósito (y entonces actualizas el número de aquí, a conciencia) o
      acabas de romper algo.

   2. INVARIANTES que deben cumplirse en CUALQUIER escenario, no solo en el
      de ejemplo. Son las más valiosas: siguen protegiendo aunque mañana
      cambies los valores por defecto. Se comprueban sobre los ocho
      escenarios a la vez.
   ========================================================================= */

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const RAIZ = path.join(__dirname, '..');

/* ---------- Carga del motor ---------- */
const ctx = vm.createContext({ console, Math, JSON, Date, Number, isNaN, parseFloat, parseInt, Array, Object, String });
for (const archivo of ['js/config.js', 'js/engine.js']) {
  const ruta = path.join(RAIZ, archivo);
  vm.runInContext(fs.readFileSync(ruta, 'utf8'), ctx, { filename: archivo });
}
const defaultState = vm.runInContext('defaultState', ctx);
const compute       = vm.runInContext('compute', ctx);
const setConfigMaestra = vm.runInContext('setConfigMaestra', ctx);
const getConfigMaestra = vm.runInContext('getConfigMaestra', ctx);
const irr              = vm.runInContext('irr', ctx);

/* ---------- Mini-arnés de pruebas ---------- */
let pasadas = 0, fallos = [];
let grupoActual = '';

function grupo(nombre, fn) {
  grupoActual = nombre;
  console.log('\n\x1b[1m' + nombre + '\x1b[0m');
  fn();
}
function ok(condicion, descripcion, detalle) {
  if (condicion) { pasadas++; console.log('  \x1b[32m✓\x1b[0m ' + descripcion); }
  else {
    fallos.push({ grupo: grupoActual, descripcion, detalle });
    console.log('  \x1b[31m✗\x1b[0m ' + descripcion + (detalle ? '\n      ' + detalle : ''));
  }
}
// Comparación con tolerancia relativa: los importes son de cientos de miles,
// así que comparar por igualdad exacta de coma flotante no tiene sentido.
function casi(real, esperado, descripcion, tolerancia) {
  const tol = tolerancia === undefined ? 1e-6 : tolerancia;
  const escala = Math.max(1, Math.abs(esperado));
  const desvio = Math.abs(real - esperado) / escala;
  ok(desvio <= tol, descripcion,
     desvio > tol ? `esperado ${esperado}, obtenido ${real} (desvío relativo ${(desvio * 100).toFixed(4)}%)` : null);
}
function clon(o) { return JSON.parse(JSON.stringify(o)); }
// Hallazgo pendiente de decision: se imprime y se documenta, pero NO tumba la
// suite, porque arreglarlo cambia cifras que el usuario ve y eso es una
// decision de producto, no un fallo de programacion.
let notas = [];
function nota(titulo, texto) {
  notas.push({ titulo, texto });
  console.log('  \x1b[33m!\x1b[0m ' + titulo + '\n      ' + texto.replace(/\n/g, '\n      '));
}

/* =========================================================================
   ESCENARIOS
   Cada uno parte del estado de ejemplo y cambia lo mínimo para ejercitar
   una rama concreta del motor.
   ========================================================================= */

function baseState() { return clon(defaultState()); }

function conPermuta() {
  const s = baseState();
  s.suelo.formaPago = 'mixta';
  s.suelo.propietarios[0].precio = 500000;      // parte en metálico
  s.ventas[0].permuta = 2;                      // 2 viviendas Tipo A en especie
  s.ventas[3].permuta = 1;                      // 1 ático en especie
  s.suelo.regimenPermuta = 'IVA';
  s.suelo.pctRegimenPermuta = 0.21;
  s.suelo.pctIvaPermutaCubierto = 0;
  return s;
}

function conVPO() {
  const s = baseState();
  s.urban.reservaVPOPct = 0.30;
  s.ventas[0].regimen = 'VPOGeneral';           // 4 uds × 91 m² = 364 m²
  s.ventas[0].precio  = 2600;
  s.ventas[1].regimen = 'VPOGeneral';           // 4 uds × 92 m² = 368 m²
  s.ventas[1].precio  = 2600;
  return s;
}

function mandaElLtv() {
  const s = baseState();
  s.financiacion.ltc = 0.95;                    // LTC generoso…
  s.financiacion.ltvMax = 0.20;                 // …pero LTV muy restrictivo
  return s;
}

function conGatePreventas() {
  const s = baseState();
  s.financiacion.preventasMinPct = 0.95;        // exigencia casi imposible
  return s;
}

function sueloFinanciado() {
  const s = baseState();
  s.financiacion.pctSueloFinanciable = 1;       // facilidad combinada suelo+obra
  return s;
}

function sinIngresos() {
  const s = baseState();
  s.ventas.forEach(v => { v.unidades = 0; });
  return s;
}

const ESCENARIOS = [
  { nombre: 'Base (ejemplo)',        state: baseState() },
  { nombre: 'Permuta mixta',         state: conPermuta() },
  { nombre: 'Con reserva de VPO',    state: conVPO() },
  { nombre: 'Manda el LTV',          state: mandaElLtv() },
  { nombre: 'Gate de preventas',     state: conGatePreventas() },
  { nombre: 'Suelo 100% financiado', state: sueloFinanciado() },
];

/* =========================================================================
   1. VALORES CONGELADOS DEL ESCENARIO DE EJEMPLO
   Si cambias compute() a propósito y estos números se mueven, actualízalos
   aquí MIRANDO cada uno: el objetivo es que el cambio sea consciente.
   ========================================================================= */

grupo('1. Escenario de ejemplo — valores congelados', () => {
  const R = compute(baseState());

  casi(R.ingresosTotal,   6958800,            'Ingresos por ventas (sin IVA)');
  casi(R.costeTotal,      5370808.542745156,  'Coste total de la promoción');
  casi(R.beneficioBruto,  1587991.4572548445, 'Beneficio bruto');
  casi(R.beneficioNeto,   1190993.5929411333, 'Beneficio neto (tras Sociedades)');
  casi(R.margenVentas,    0.22819903679583325,'Margen sobre ventas');
  casi(R.tirAnual,        0.39242200399468485,'TIR anual del equity');
  casi(R.mirrAnual,       0.16573088749553722,'MIRR anual');
  casi(R.van,             714218.9214548201,  'VAN del equity');
  casi(R.principal,       3296923.8118000003, 'Principal del préstamo');
  casi(R.equity,          2073884.730945156,  'Capital propio necesario');
  ok(R.payback === 35,  'Payback en el mes 35', 'obtenido: ' + R.payback);
  ok(R.nMonths === 43,  'Horizonte de 43 meses', 'obtenido: ' + R.nMonths);

  const esperados = {
    densidad: true, edificabilidad: true, plazasAparcamiento: true, reservaVPO: true,
    margenEntregaValido: true, prestamoRepagado: true, coherencia: true,
    margenMinimo: true, ltv: true, preventasGateSinBloqueos: true,
  };
  Object.keys(esperados).forEach(k => {
    ok(R.checks[k] === esperados[k], `check "${k}" = ${esperados[k]}`, 'obtenido: ' + R.checks[k]);
  });
});

/* =========================================================================
   2. INVARIANTES — se cumplen en cualquier escenario
   ========================================================================= */

grupo('2. Invariantes estructurales (todos los escenarios)', () => {
  ESCENARIOS.forEach(({ nombre, state }) => {
    const R = compute(state);

    // El dinero tiene que cuadrar: lo que entra por préstamo más lo que pone
    // el promotor es exactamente lo que cuesta la promoción en caja.
    casi(R.principal + R.equity, R.costeTotalCash,
         `[${nombre}] principal + equity = coste total en caja`, 1e-7);

    // El préstamo se devuelve entero antes de que acabe el proyecto.
    ok(Math.abs(R.cf.saldoFinal[R.nMonths - 1]) < 1,
       `[${nombre}] el préstamo queda a cero al final`,
       'saldo final: ' + R.cf.saldoFinal[R.nMonths - 1]);

    // El margen sobre ventas se mide contra el valor TOTAL de la promoción
    // (incluida la parte permutada), no contra los ingresos en efectivo.
    if (R.valorTotalPromocion !== 0) {
      casi(R.margenVentas, R.beneficioBruto / R.valorTotalPromocion,
           `[${nombre}] margen = beneficio bruto / valor total`, 1e-9);
    }

    // El principal nunca puede superar el menor de los dos límites del banco.
    ok(R.principal <= Math.min(R.limiteLtc, R.limiteLtv) + 1,
       `[${nombre}] el principal respeta el menor de LTC y LTV`,
       `principal ${R.principal} vs min(${R.limiteLtc}, ${R.limiteLtv})`);

    // Coherencia interna que el propio motor ya declara.
    ok(R.checks.coherencia === true, `[${nombre}] check de coherencia financiera`);

    // El coste total es el coste sin financiar más el coste financiero.
    casi(R.costeTotal, R.costeSinFin + R.costeFinanciero,
         `[${nombre}] coste total = coste sin financiar + coste financiero`, 1e-9);

    // Sociedades se guarda con signo NEGATIVO (es una salida de caja), de modo
    // que el neto es la suma, no la resta. Congelar aqui la convencion evita
    // que alguien la invierta por error al tocar el motor.
    ok(R.impuestoSociedades <= 0,
       `[${nombre}] el impuesto de sociedades se guarda como importe negativo`,
       'obtenido: ' + R.impuestoSociedades);
    casi(R.beneficioNeto, R.beneficioBruto + R.impuestoSociedades,
         `[${nombre}] beneficio neto = bruto + impuesto (que ya es negativo)`, 1e-9);
  });
});

/* =========================================================================
   3. RAMAS CONCRETAS DEL MOTOR
   ========================================================================= */

grupo('3. Permuta', () => {
  const R = compute(conPermuta());

  ok(R.permutaActiva === true, 'la permuta se reconoce como activa');
  ok(R.unidadesPermutaTotal === 3, 'se entregan 3 unidades en especie', 'obtenido: ' + R.unidadesPermutaTotal);
  ok(R.valorPermutaTotal > 0, 'el valor de la permuta es positivo');

  // La clave del modelo: el valor permutado cuenta como ingreso económico
  // (valorTotalPromocion) pero NO como cobro (ingresosTotal).
  casi(R.valorTotalPromocion, R.ingresosTotal + R.valorPermutaTotal,
       'valor total = ingresos en efectivo + valor permutado', 1e-9);
  ok(R.ingresosTotal < R.valorTotalPromocion, 'la permuta no genera cobro real');

  // Con el IVA de la permuta sin cubrir por el propietario, lo adelanta la promotora.
  ok(R.ivaRepercutidoPermutaTotal > 0, 'hay IVA repercutido por la permuta');
  ok(R.ivaPermutaACargoPromotora > 0, 'ese IVA lo adelanta la promotora si no está cubierto');

  // Y el check correspondiente avisa.
  ok(R.checks.ivaPermutaCubierto === false,
     'el check de IVA de permuta avisa cuando no está cubierto');

  const cubierto = conPermuta();
  cubierto.suelo.pctIvaPermutaCubierto = 0.6;
  ok(compute(cubierto).checks.ivaPermutaCubierto === true,
     'y deja de avisar cuando el propietario cubre más de la mitad');
});

grupo('4. VPO', () => {
  const R = compute(conVPO());

  // 8 viviendas VPO de 91 y 92 m² sobre 1.430 m² de techo sobre rasante.
  casi(R.techoVPO, 4 * 91 + 4 * 92, 'techo destinado a VPO');
  casi(R.pctVPOActual, (4 * 91 + 4 * 92) / 1430, 'porcentaje de VPO sobre techo');

  ok(R.checks.reservaVPO === true, 'con 51% de VPO se cumple una reserva del 30%');

  const insuficiente = conVPO();
  insuficiente.ventas[1].regimen = 'Libre';   // deja solo 364 m² = 25,5%
  ok(compute(insuficiente).checks.reservaVPO === false,
     'con 25% de VPO no se cumple una reserva del 30%');

  // Sin exigencia declarada, el check no debe dar falsas alarmas.
  const sinExigencia = baseState();
  sinExigencia.urban.reservaVPOPct = 0;
  ok(compute(sinExigencia).checks.reservaVPO === true,
     'reservaVPOPct = 0 significa "sin exigencia", no "0% exigido"');
});

grupo('5. Límites del banco: LTC frente a LTV', () => {
  const base = compute(baseState());
  ok(base.limiteVinculante === 'LTC', 'en el ejemplo manda el LTC', 'obtenido: ' + base.limiteVinculante);

  const R = compute(mandaElLtv());
  ok(R.limiteVinculante === 'LTV', 'con LTV al 20% pasa a mandar el LTV', 'obtenido: ' + R.limiteVinculante);
  casi(R.principal, R.limiteLtv, 'el principal se recorta al límite del LTV', 1e-9);
  ok(R.principal < R.limiteLtc, 'y queda por debajo de lo que permitiría el LTC');

  // El check de LTV mide contra el valor TOTAL de la promocion, incluida la
  // permuta. Con permuta, medirlo contra los cobros daria un LTV falsamente
  // bajo, es decir, mas favorable de lo que el banco aplicaria de verdad.
  const P = compute(conPermuta());
  const ltvContraValorTotal = P.principal / P.valorTotalPromocion;
  const ltvContraCobros     = P.principal / P.ingresosTotal;
  ok(ltvContraCobros > ltvContraValorTotal,
     'con permuta, medir el LTV contra los cobros daria un ratio distinto');
  ok(P.checks.ltv === (ltvContraValorTotal <= 0.60),
     'y el check usa el valor total, que es el criterio correcto',
     `ltv real ${ltvContraValorTotal.toFixed(4)}, check ${P.checks.ltv}`);
});

grupo('6. Condicionante de preventas', () => {
  const sinGate = compute(baseState());
  ok(sinGate.preventasMinPct === 0, 'el ejemplo no tiene condicionante de preventas');
  ok(sinGate.checks.preventasGateSinBloqueos === true, 'y por tanto no hay bloqueos');

  const R = compute(conGatePreventas());
  ok(R.gatePreventasBloqueoDetectado === true,
     'con un 95% exigido, el gate llega a bloquear disposiciones');
  ok(R.checks.preventasGateSinBloqueos === false, 'y el check lo refleja');

  // Bloquear el prestamo obliga a poner mas capital propio. Se mide contra
  // equityPunta (la punta real de tesoreria propia), NO contra `equity`: ver
  // el hallazgo del grupo 12.
  ok(R.equityPunta > sinGate.equityPunta,
     'el bloqueo dispara la punta de capital propio',
     `con gate ${Math.round(R.equityPunta)} vs sin gate ${Math.round(sinGate.equityPunta)}`);
  ok(R.dispuestoMax < sinGate.dispuestoMax,
     'y reduce lo que se llega a disponer del prestamo');
});

grupo('7. Financiación del suelo', () => {
  const sinFinanciar = compute(baseState());
  const financiado   = compute(sueloFinanciado());

  ok(sinFinanciar.pctSueloFinanciable === 0, 'por defecto el suelo va con capital propio');
  ok(financiado.principal > sinFinanciar.principal,
     'financiar el suelo aumenta el principal del préstamo',
     `${financiado.principal} vs ${sinFinanciar.principal}`);
  ok(financiado.equity < sinFinanciar.equity,
     'y reduce el capital propio necesario');
  ok(financiado.costeFinanciero > sinFinanciar.costeFinanciero,
     'a cambio de más coste financiero');
});

/* =========================================================================
   4. SENSIBILIDAD Y PUNTOS DE EQUILIBRIO
   La propiedad que hay que proteger aquí es que Sensibilidad NO tenga sus
   propias fórmulas: el escenario "Base" debe coincidir con el Resumen por
   construcción, no porque alguien haya sincronizado dos cálculos a mano.
   ========================================================================= */

grupo('8. Sensibilidad', () => {
  const R = compute(baseState());
  const base = R.escenarios.find(e => e.nombre === 'Base');

  ok(!!base, 'existe el escenario "Base"');
  casi(base.margenVentas, R.margenVentas, 'el escenario Base coincide con el Resumen (margen)', 1e-12);
  casi(base.costeTotal,   R.costeTotal,   'el escenario Base coincide con el Resumen (coste)', 1e-12);
  casi(base.tirAprox,     R.tirAnual,     'el escenario Base coincide con el Resumen (TIR)', 1e-12);

  ok(R.escenarios.length === 8, 'se calculan los ocho escenarios', 'obtenido: ' + R.escenarios.length);

  // Monotonías que tienen que cumplirse siempre.
  const bajada = R.escenarios.find(e => e.nombre === 'Precios de venta −10%');
  const subida = R.escenarios.find(e => e.nombre === 'Precios de venta +5%');
  ok(bajada.margenVentas < R.margenVentas, 'bajar precios empeora el margen');
  ok(subida.margenVentas > R.margenVentas, 'subir precios lo mejora');

  const estres = R.escenarios.find(e => e.nombre.startsWith('Estrés'));
  ok(estres.margenVentas < bajada.margenVentas, 'el escenario de estrés es el peor de los de precio');

  // La matriz no debe dispararse en cascada: cada sub-cálculo lleva
  // scenarioOverrides, así que no genera sus propios sub-escenarios.
  ok(R.matriz.length === 7 && R.matriz[0].valores.length === 6,
     'la matriz es de 7 × 6 y no se dispara en cascada');
});

grupo('9. Puntos de equilibrio', () => {
  const R = compute(baseState());

  ok(R.factorPrecioBE > 0 && R.factorPrecioBE < 1,
     'el factor de precio de equilibrio está entre 0 y 1', 'obtenido: ' + R.factorPrecioBE);
  ok(R.factorCosteBE > 1,
     'el factor de coste de equilibrio es mayor que 1', 'obtenido: ' + R.factorCosteBE);

  // La comprobación que de verdad importa: aplicar el factor de equilibrio
  // tiene que dar beneficio cero. Si alguien vuelve a meter una fórmula
  // aproximada en lugar de la bisección, esto se rompe.
  const enBEprecio = compute(baseState(), { factorPrecioVenta: R.factorPrecioBE, factorCosteObra: 1, mesesExtra: 0 });
  ok(Math.abs(enBEprecio.beneficioBruto) < 1,
     'al precio de equilibrio el beneficio bruto es cero',
     'obtenido: ' + enBEprecio.beneficioBruto);

  const enBEcoste = compute(baseState(), { factorPrecioVenta: 1, factorCosteObra: R.factorCosteBE, mesesExtra: 0 });
  ok(Math.abs(enBEcoste.beneficioBruto) < 1,
     'al coste de equilibrio el beneficio bruto es cero',
     'obtenido: ' + enBEcoste.beneficioBruto);

  casi(R.caidaPrecioSoportable, 1 - R.factorPrecioBE, 'caída de precio soportable coherente', 1e-12);
  casi(R.sobrecosteSoportable,  R.factorCosteBE - 1,  'sobrecoste soportable coherente', 1e-12);
});

/* =========================================================================
   5. CASOS LÍMITE
   ========================================================================= */

grupo('10. Casos límite', () => {
  // La TIR no esta definida si no hay al menos un flujo de cada signo. Se
  // prueba irr() directamente, que es donde vive esa garantia.
  ok(irr([-100, -50, -50], 0.1) === null, 'irr() con todo negativo devuelve null');
  ok(irr([100, 50, 50], 0.1) === null,    'irr() con todo positivo devuelve null');
  ok(typeof irr([-100, 60, 60], 0.1) === 'number', 'irr() con signos mixtos devuelve un numero');

  // Sin ventas siguen existiendo cobros (devoluciones de IVA soportado), asi
  // que la TIR SI esta definida, y es muy negativa. Es el resultado correcto.
  const R = compute(sinIngresos());
  ok(R.ingresosTotal === 0, 'sin unidades no hay ingresos por ventas');
  ok(R.tirAnual !== null && R.tirAnual < -0.3,
     'pero la TIR existe y es fuertemente negativa (quedan devoluciones de IVA)',
     'obtenido: ' + R.tirAnual);

  // Un proyecto sin techo construido no debe dividir entre cero.
  const sinTecho = baseState();
  sinTecho.urban.supSR = 0;
  sinTecho.urban.supBR = 0;
  const S = compute(sinTecho);
  ok(S.costeConstruccionRepercutido === null,
     'sin techo construido, la repercusión de obra es null, no infinito');
  ok(S.checks.costeConstruccionMin === true,
     'y el check no lanza una falsa alarma');

  // Densidad: el ejemplo va justo al límite (16 viviendas, densidad máxima 16).
  const D = baseState();
  D.ventas[0].unidades = 5;   // 17 viviendas
  ok(compute(D).checks.densidad === false, 'superar la densidad máxima dispara el check');
});

grupo('11. Configuración maestra inyectada', () => {
  const original = getConfigMaestra();

  // Umbral no fijado = check cumplido, no falsa alarma.
  setConfigMaestra({ costeConstruccionMin: null, precioVentaMin: null });
  let R = compute(baseState());
  ok(R.checks.costeConstruccionMin === true, 'sin umbral de coste de obra, el check se da por cumplido');
  ok(R.checks.precioVentaMin === true,       'sin umbral de precio de venta, tampoco avisa');

  // Umbral por encima de lo real = debe avisar.
  setConfigMaestra({ costeConstruccionMin: 99999, precioVentaMin: 99999 });
  R = compute(baseState());
  ok(R.checks.costeConstruccionMin === false, 'un umbral de obra inalcanzable sí avisa');
  ok(R.checks.precioVentaMin === false,       'un umbral de precio inalcanzable sí avisa');

  // El margen mínimo de Dirección manda sobre el check de margen.
  setConfigMaestra({ costeConstruccionMin: null, precioVentaMin: null, margenMin: 0.90 });
  ok(compute(baseState()).checks.margenMinimo === false,
     'subir el margen mínimo de Dirección hace fallar el check de margen');

  setConfigMaestra(original);   // dejar la configuración como estaba
  ok(getConfigMaestra().margenMin === original.margenMin, 'la configuración se restaura entre pruebas');
});


/* =========================================================================
   12. HALLAZGOS PENDIENTES DE DECISION
   No tumban la suite: son cosas que el motor hace hoy de una forma concreta
   y que cambiarlas movería cifras que el usuario ya ve en pantalla. La
   decisión es de producto. Se dejan aquí documentadas y medidas para que no
   se olviden ni se "descubran" dos veces.
   ========================================================================= */

grupo('12. Hallazgos pendientes de decisión', () => {
  const f = n => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(n) + ' €';

  /* --- 12.1 equity se calcula sobre el préstamo CONCEDIDO, no sobre el DISPUESTO --- */
  const R = compute(baseState());
  const equityReal = R.costeTotalCash - R.dispuestoMax;
  const desvio = equityReal - R.equity;

  ok(Math.abs(R.principal + R.equity - R.costeTotalCash) < 1e-6,
     'equity se define hoy como costeTotalCash − principal (comportamiento actual congelado)');

  if (desvio > 1) {
    nota('equity usa el principal concedido, no lo realmente dispuesto',
      `js/engine.js:648  ->  const equity = costeTotalCash - principal;\n` +
      `El préstamo se concede por ${f(R.principal)} pero solo se llega a disponer\n` +
      `de ${f(R.dispuestoMax)}. Los ${f(R.principal - R.dispuestoMax)} sin disponer los\n` +
      `pone el promotor, así que el capital propio real es ${f(equityReal)},\n` +
      `no ${f(R.equity)}.\n` +
      `Impacto: el KPI "ROE anual (equity total)" de la barra superior sale\n` +
      `${((R.beneficioNeto / R.equity) / (R.beneficioNeto / equityReal) - 1) * 100 > 0
          ? ((R.beneficioNeto / R.equity) / (R.beneficioNeto / equityReal) - 1).toFixed(3) * 100 + '% por encima' : 'igual'} de lo real en el escenario de ejemplo.\n` +
      `Arreglo propuesto: const equity = costeTotalCash - dispuestoMax;\n` +
      `(hay que moverlo después del bucle de cash-flow, donde dispuestoMax ya existe).`);
  }

  // El gate de preventas es donde el desvío se dispara, porque deja mucho
  // préstamo concedido sin disponer.
  const G = compute(conGatePreventas());
  const equityRealG = G.costeTotalCash - G.dispuestoMax;
  const roeDecl = G.beneficioNeto / G.equity;
  const roeReal = G.beneficioNeto / equityRealG;
  nota('el desvío se dispara con el condicionante de preventas activo',
    `Con preventasMinPct al 95%: concedido ${f(G.principal)}, dispuesto ${f(G.dispuestoMax)}.\n` +
    `ROE neto que muestra la app: ${(roeDecl * 100).toFixed(1)}%. ROE neto real: ${(roeReal * 100).toFixed(1)}%.\n` +
    `Sobrestimación: ${((roeDecl / roeReal - 1) * 100).toFixed(0)}%.`);

  /* --- 12.2 el check de coherencia no puede fallar nunca --- */
  const residuo = R.principal + R.equity - R.costeTotalCash;
  ok(residuo === 0, 'el residuo del check de coherencia es exactamente cero, siempre');
  nota('el check "Coherencia financ." de la barra superior es tautológico',
    `js/engine.js  ->  coherencia: Math.abs(principal + equity - costeTotalCash) < 1\n` +
    `Como equity se DEFINE como costeTotalCash − principal, el residuo es\n` +
    `exactamente ${residuo} por construcción. El semáforo está siempre en verde\n` +
    `y no puede detectar nada. O se le da un contenido real (por ejemplo,\n` +
    `comprobar el cuadre contra el cash-flow: suma de disposiciones menos\n` +
    `amortizaciones = 0 al final, aportaciones de equity = equity total), o se\n` +
    `quita de la barra, porque ocupa sitio y transmite una seguridad falsa.`);

  /* --- 12.3 los dos ROE de la app miden cosas distintas --- */
  nota('los dos ROE de la app no son comparables entre sí',
    `roe = beneficioBruto / equityPunta  (punta simultánea de tesorería propia)\n` +
    `roeEquityTotal = beneficioBruto / equity  (capital propio a lo largo de la vida)\n` +
    `En el ejemplo: punta ${f(R.equityPunta)} frente a total ${f(R.equity)}.\n` +
    `Los dos son legítimos, pero la barra los muestra sin decir cuál es cuál.\n` +
    `Conviene que la etiqueta lo aclare o dejar solo uno.`);
});

/* =========================================================================
   RESULTADO
   ========================================================================= */

console.log('\n' + '─'.repeat(64));
if (fallos.length === 0) {
  console.log(`\x1b[32m\x1b[1m${pasadas} comprobaciones, todas correctas.\x1b[0m`);
  if (notas.length) console.log(`\x1b[33m${notas.length} hallazgo(s) pendiente(s) de decisión, arriba en el grupo 12.\x1b[0m`);
  process.exit(0);
} else {
  console.log(`\x1b[31m\x1b[1m${fallos.length} fallo(s) de ${pasadas + fallos.length} comprobaciones:\x1b[0m`);
  fallos.forEach(f => console.log(`  · [${f.grupo}] ${f.descripcion}${f.detalle ? '\n      ' + f.detalle : ''}`));
  process.exit(1);
}
