/* =========================================================================
   CONFIGURACIÓN MAESTRA (inyectable)
   -------------------------------------------------------------------------
   Centraliza los umbrales/valores por defecto que antes estaban repartidos
   y "hardcodeados" en varios archivos (engine.js, app.js, express.js).

   Los valores de aquí abajo son los mismos que ya usaba la app hasta ahora
   (margenMinimo: 0.18, tipoInteresDefecto: 0.05), así que por defecto el
   comportamiento no cambia en absoluto — esto es solo el punto de enganche
   para el futuro: cuando la app de viabilidad se una al dashboard, este
   objeto podrá rellenarse con los valores reales que Dirección configure
   en la tabla `configuracion_maestra` de Supabase, llamando a
   setConfigMaestra({...}) antes de que la app arranque.
   ========================================================================= */
const CONFIG_MAESTRA_DEFECTO = {
  margenMin: 0.18,          // margen sobre ventas mínimo aceptable
  tipoInteresDefecto: 0.05, // tipo de interés por defecto al crear un estudio nuevo
  // Suelos de referencia que fija Dirección. null o 0 = "sin umbral fijado": el
  // check correspondiente se da por cumplido en vez de lanzar una falsa alarma.
  // Los usa compute() en checks.costeConstruccionMin / checks.precioVentaMin.
  costeConstruccionMin: null,  // €/m² de techo (PEM repercutido sobre SR+BR)
  precioVentaMin: null,        // €/m² de venta de vivienda
  // Régimen fiscal por defecto al añadir un propietario de suelo nuevo ('IVA' o 'ITP').
  regimenFiscalDefecto: 'ITP',
};

let CONFIG = { ...CONFIG_MAESTRA_DEFECTO };

// Llamar antes de iniciar la app (por ejemplo, desde el dashboard tras leer
// configuracion_maestra de Supabase) para sobrescribir los valores por defecto.
// Solo pisa las claves que vengan definidas; el resto conserva su valor actual.
function setConfigMaestra(cfg){
  if(!cfg) return;
  CONFIG = { ...CONFIG, ...cfg };
}

function getConfigMaestra(){
  return { ...CONFIG };
}
