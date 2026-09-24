#!/usr/bin/env node
/* =============================================================================
   1-descargar-municipios-ine.mjs
   -----------------------------------------------------------------------------
   Descarga el catálogo de municipios de la API del INE (Tempus3) y lo guarda
   TAL CUAL, sin transformar, en municipios-ine-raw.json.

   Uso:
     node 1-descargar-municipios-ine.mjs

   Endpoint: https://servicios.ine.es/wstempus/js/ES/VALORES_VARIABLE/19
   La variable 19 del INE corresponde a "Municipios" (según la documentación
   comunitaria del portal datos.gob.es que enlazaste). No he podido probar
   este script contra la API real — mi entorno de trabajo no tiene salida a
   internet hacia ine.es — así que ejecútalo tú. Si algo falla o el JSON no
   trae los campos que este script espera, este primer paso te sirve para
   verlo: guarda la respuesta cruda para poder inspeccionarla antes de seguir
   al paso 2.

   Si la variable 19 no fuera la correcta, ese mismo endpoint sin número
   (https://servicios.ine.es/wstempus/js/ES/VARIABLES) lista todas las
   variables con su id y su nombre, para localizar la que corresponda.
   ============================================================================= */

const BASE = 'https://servicios.ine.es/wstempus/js/ES/VALORES_VARIABLE/19';
const SALIDA = new URL('./municipios-ine-raw.json', import.meta.url);

async function descargarTodasLasPaginas() {
  const registros = [];
  let pagina = 1;
  let vacia = false;

  while (!vacia) {
    const url = `${BASE}?page=${pagina}`;
    process.stdout.write(`Descargando página ${pagina}... `);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`La API del INE ha respondido ${res.status} en la página ${pagina}`);
    }
    const datos = await res.json();
    const lote = Array.isArray(datos) ? datos : (datos?.Data ?? []);

    if (!Array.isArray(lote) || lote.length === 0) {
      vacia = true;
      console.log('vacía — fin del catálogo.');
      break;
    }

    registros.push(...lote);
    console.log(`${lote.length} registros (acumulado: ${registros.length})`);

    // Cada página trae hasta 500. Si viene con menos, ya no hay página siguiente.
    if (lote.length < 500) { vacia = true; break; }
    pagina++;

    // Una pausa pequeña para no golpear la API de un servicio público más
    // fuerte de lo necesario.
    await new Promise(r => setTimeout(r, 200));
  }

  return registros;
}

const registros = await descargarTodasLasPaginas();

if (!registros.length) {
  console.error('\nNo se ha descargado ningún registro. Antes de seguir, comprueba a mano en el navegador:');
  console.error(`  ${BASE}?page=1`);
  console.error('y mira si devuelve datos o un error.');
  process.exit(1);
}

await import('node:fs/promises').then(fs =>
  fs.writeFile(SALIDA, JSON.stringify(registros, null, 2), 'utf-8')
);

console.log(`\n${registros.length} registros guardados en ${SALIDA.pathname}`);
console.log('\nAntes de seguir al paso 2, abre ese archivo y mira las claves de un');
console.log('elemento cualquiera — así el segundo script sabe con certeza dónde está');
console.log('el nombre y dónde el código. Un vistazo rápido:');
console.log(JSON.stringify(registros[0], null, 2));
