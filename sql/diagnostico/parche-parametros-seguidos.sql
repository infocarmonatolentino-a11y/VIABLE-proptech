-- ============================================================================
--  PARCHE — rellenar los parámetros seguidos que faltaron
-- ----------------------------------------------------------------------------
--  Esto es EXCLUSIVAMENTE para tu base de datos actual. La primera versión de
--  sql/02-configuracion-por-municipio.sql sembraba el catálogo de parámetros
--  DESPUÉS de intentar copiárselo a las empresas que ya existían, así que esa
--  copia no encontró nada y esas empresas se quedaron con la rejilla vacía —
--  justo lo que tu diagnóstico señaló como "4 empresa(s) con la rejilla
--  vacía". El archivo ya está corregido para instalaciones nuevas; esto es
--  el empujón de una vez para la tuya, que ya está en marcha.
--
--  Seguro de ejecutar las veces que haga falta: "on conflict do nothing"
--  significa que a una empresa que ya sigue algún parámetro no le hace nada.
-- ============================================================================

insert into public.parametros_seguidos (organizacion_id, parametro_id)
select o.id, pd.id
from public.organizaciones o
cross join public.parametros_definicion pd
where pd.organizacion_id is null
  and pd.clave in ('precio_venta_vivienda','coste_construccion_m2')
on conflict (organizacion_id, parametro_id) do nothing;

-- Compruébalo con esto, o simplemente vuelve a lanzar
-- sql/diagnostico/verificar-instalacion.sql: "Empresas sin ningún parámetro
-- seguido" debería salir en 0 ahora.
select count(distinct o.id) as empresas_sin_parametros
from public.organizaciones o
left join public.parametros_seguidos ps on ps.organizacion_id = o.id
where ps.organizacion_id is null;
