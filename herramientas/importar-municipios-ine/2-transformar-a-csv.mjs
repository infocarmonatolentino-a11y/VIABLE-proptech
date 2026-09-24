#!/usr/bin/env node
/* =============================================================================
   2-transformar-a-csv.mjs
   -----------------------------------------------------------------------------
   Lee municipios-ine-raw.json (generado por el paso 1) y escribe
   municipios-ine.csv, listo para "Table Editor → municipios_ine → Insert →
   Import data from CSV" en Supabase.

   Uso:
     node 2-transformar-a-csv.mjs

   CÓMO DETECTA LOS CAMPOS
   No conozco con certeza los nombres exactos de las claves que devuelve la
   API del INE para esta variable (no he podido probarla desde mi entorno).
   Este script prueba varios nombres habituales en las respuestas de Tempus3
   ("Nombre" / "nombre", "Id" / "Codigo" / "codigo") y avisa con claridad si
   no encuentra ninguno, en vez de escribir un CSV con columnas vacías sin
   decir nada. Si avisa, abre municipios-ine-raw.json, mira las claves reales
   de un elemento y dímelas — lo ajusto en un minuto.
   ============================================================================= */

import fs from 'node:fs/promises';

const ENTRADA = new URL('./municipios-ine-raw.json', import.meta.url);
const SALIDA = new URL('./municipios-ine.csv', import.meta.url);

const CANDIDATOS_NOMBRE = ['Nombre', 'nombre', 'Denominacion', 'denominacion', 'Literal', 'literal'];
const CANDIDATOS_CODIGO = ['Codigo', 'codigo', 'Cod', 'cod', 'Id', 'id'];

function primerCampoQueExiste(obj, candidatos) {
  return candidatos.find(c => obj[c] !== undefined);
}

function csvEscape(valor) {
  const texto = String(valor ?? '');
  return /[",\n;]/.test(texto) ? '"' + texto.replace(/"/g, '""') + '"' : texto;
}

let crudo;
try {
  crudo = JSON.parse(await fs.readFile(ENTRADA, 'utf-8'));
} catch (e) {
  console.error(`No se pudo leer ${ENTRADA.pathname}.`);
  console.error('Ejecuta antes 1-descargar-municipios-ine.mjs desde esta misma carpeta.');
  process.exit(1);
}

if (!Array.isArray(crudo) || !crudo.length) {
  console.error('El archivo de entrada está vacío o no es una lista. Nada que transformar.');
  process.exit(1);
}

const muestra = crudo[0];
const campoNombre = primerCampoQueExiste(muestra, CANDIDATOS_NOMBRE);
const campoCodigo = primerCampoQueExiste(muestra, CANDIDATOS_CODIGO);

if (!campoNombre) {
  console.error('No he encontrado un campo de nombre reconocible en el primer registro.');
  console.error('Claves disponibles:', Object.keys(muestra).join(', '));
  console.error('\nDime cuál de esas claves es el nombre del municipio y ajusto el script.');
  process.exit(1);
}

console.log(`Campo de nombre detectado: "${campoNombre}"`);
console.log(campoCodigo ? `Campo de código detectado: "${campoCodigo}"` : 'Sin campo de código reconocible — el CSV saldrá sin codigo_ine (no pasa nada, se puede añadir después).');

// El nombre del municipio en Tempus3 suele venir con la provincia detrás,
// entre paréntesis o tras una coma, tipo "Alcalá de Henares" o a veces con
// el código delante ("28005 Alcalá de Henares"). Se limpia lo obvio; una
// revisión manual del CSV antes de importar sigue siendo buena idea.
function limpiarNombre(bruto) {
  return String(bruto)
    .replace(/^\d{2,5}\s+/, '')   // un código numérico pegado delante
    .trim();
}

const filas = crudo.map(r => ({
  nombre: limpiarNombre(r[campoNombre]),
  codigo_ine: campoCodigo ? String(r[campoCodigo]).trim() : '',
}));

const cabecera = 'nombre,provincia,comunidad_autonoma,codigo_ine,organizacion_id';
const lineas = filas.map(f =>
  [csvEscape(f.nombre), '', '', csvEscape(f.codigo_ine), ''].join(',')
);

await fs.writeFile(SALIDA, [cabecera, ...lineas].join('\n') + '\n', 'utf-8');

console.log(`\n${filas.length} filas escritas en ${SALIDA.pathname}`);
console.log('\nLas columnas "provincia" y "comunidad_autonoma" salen vacías: la API de');
console.log('esta variable normalmente no las trae en el mismo listado. Se pueden');
console.log('rellenar más adelante, o dejarlas así — el resto de la app funciona igual.');
console.log('\nAntes de importar en Supabase, échale un vistazo rápido al CSV: con 8.100');
console.log('filas conviene comprobar dos o tres nombres al azar contra el INEbase real.');
