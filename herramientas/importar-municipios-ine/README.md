# Importar el catálogo completo de municipios

Dos scripts de Node.js, sin dependencias que instalar (usan `fetch`, ya
incluido desde Node 18). Se ejecutan en este orden:

```bash
cd herramientas/importar-municipios-ine
node 1-descargar-municipios-ine.mjs
node 2-transformar-a-csv.mjs
```

El primero descarga el catálogo de la API del INE
(`servicios.ine.es/wstempus/js/ES/VALORES_VARIABLE/19`, paginado de 500 en
500) y lo guarda tal cual en `municipios-ine-raw.json`. El segundo lo
convierte en `municipios-ine.csv`, con las columnas que espera la tabla
`municipios_ine`.

**Aviso honesto:** no he podido ejecutar el primer script contra la API real
— mi entorno de trabajo no tiene salida a internet hacia `ine.es`, así que no
he podido comprobar ni que el endpoint responda como espero, ni que la
variable 19 sea de verdad "Municipios" (viene de una respuesta de la
comunidad en datos.gob.es, no de la documentación oficial del INE que tú
mismo enlazaste, que no detalla los ids de cada variable). El segundo script
está escrito para avisar con claridad si algo no encaja, en vez de generar un
CSV con columnas vacías sin decírtelo.

## Si el paso 1 falla o la variable no es la correcta

Prueba a mano en el navegador, antes de nada:

```
https://servicios.ine.es/wstempus/js/ES/VARIABLES
```

Esa lista trae todas las variables del INE con su id y su nombre — busca
"Municipios" y comprueba el id. Si es distinto de 19, cambia la constante
`BASE` al principio de `1-descargar-municipios-ine.mjs`.

## Si el paso 2 avisa de que no encuentra el campo de nombre

Abre `municipios-ine-raw.json`, mira las claves del primer elemento, y
dímelas — es un ajuste de un minuto en el script.

## El camino sin ningún script

Sigue siendo válido, y es el que documenté dentro de
`sql/02-configuracion-por-municipio.sql`: INEbase → Demografía → "Padrón.
Población por municipios" → "Relación de municipios y sus códigos", que se
descarga como Excel y se importa igual, a mano, desde el Table Editor de
Supabase. Si el camino de la API te da guerra, no lo fuerces — este es
igual de bueno y no depende de adivinar el formato de una respuesta que no
he podido ver.

## Importar el CSV en Supabase

Table Editor → `municipios_ine` → botón **Insert** → **Import data from
CSV** → selecciona `municipios-ine.csv`. Dejas `organizacion_id` vacío en
todas las filas para que queden como catálogo oficial, compartido por todas
las empresas — es justo lo que hace este CSV por defecto.

Con 8.100 filas, antes de importar conviene abrir el CSV y comprobar dos o
tres nombres al azar contra el INEbase real: si el paso 2 tuvo que adivinar
el campo, es la forma más rápida de confirmar que adivinó bien.
