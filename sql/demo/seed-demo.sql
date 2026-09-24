-- ============================================================================
--  VIABLE — ENTORNO DE DEMOSTRACIÓN
-- ----------------------------------------------------------------------------
--  Para enseñar el producto sin abrir los datos de un cliente real. Crea
--  cuatro estudios de ejemplo, variados en nombre, municipio, estado y
--  métricas, dentro de una empresa de mentira.
--
--  UN PASO TUYO ANTES DE EJECUTAR ESTO
--  No crea ninguna cuenta ni contraseña — eso hay que hacerlo por el camino
--  normal, para no fabricar contraseñas a mano en SQL:
--
--    1. Entra en Dashboard_v4.html (en un navegador en privado, o cerrando
--       sesión antes) y regístrate con un correo tipo demo@tudominio.com,
--       como si fueras un cliente nuevo. Se te crea tu propia empresa sola.
--    2. Ejecuta este script. Busca esa cuenta por correo, y le mete los
--       cuatro estudios de ejemplo dentro de SU empresa.
--    3. Vuelve a entrar con esa cuenta cuando quieras enseñar la app.
--
--  Cambia el correo de la constante de abajo por el que hayas usado.
--
--  IMPORTANTE: cada uno de los cuatro estudios abre, por dentro, el MISMO
--  caso de ejemplo trabajado ("La Morera de Badalona", el que trae la app de
--  fábrica) — lo que varía es el nombre, el municipio, el estado y las
--  métricas con las que aparecen listados en el panel. Es suficiente para
--  enseñar cómo se organiza y se filtra la cartera; no son cuatro cálculos
--  distintos por dentro. Si en algún momento quieres que cada uno tenga
--  números de verdad distintos también al abrirlo, dímelo: hay que mapear
--  cada campo del motor con cuidado, y preferí no apresurarlo aquí.
--
--  Se puede volver a ejecutar sin duplicar nada: cada inserción comprueba
--  antes si ya existe un estudio con ese nombre en esa empresa.
-- ============================================================================

do $$
declare
  v_correo_demo text := 'demo@tudominio.com';   -- <-- cambia esto por el correo que hayas usado
  v_org  uuid;
  v_yo   uuid;
begin
  select p.id, p.organizacion_id into v_yo, v_org
  from public.perfiles p join auth.users u on u.id = p.id
  where lower(u.email) = lower(v_correo_demo);

  if v_org is null then
    raise exception using message = format(
      'No encuentro ninguna cuenta con el correo %s. Créala primero registrándote normalmente en Dashboard_v4.html, y vuelve a ejecutar esto.',
      v_correo_demo
    );
  end if;

  update public.organizaciones set nombre = 'Promotora de Demostración' where id = v_org;

  -- 1. El caso base, aprobado y con buenos números — el que enseñarías primero.
  insert into public.estudios (organizacion_id, creado_por, nombre, ubicacion, municipio_id, estado, datos, tir, margen, riesgo, resumen)
  select v_org, v_yo, 'Vivienda libre — Los Almendros', 'Alcalá de Henares (Madrid)',
    (select id from public.municipios_ine where nombre='Alcalá de Henares' and organizacion_id is null limit 1),
    'aprobado', '{}'::jsonb, 0.242, 0.198, 'ok',
    jsonb_build_object('viviendas',16,'densidadMax',16,'supSolar',2100,'techoSR',1430,
                        'precioVentaMedio',3450,'costeObraM2',1180,'pctVPO',0,'van',714219)
  where not exists (select 1 from public.estudios where organizacion_id=v_org and nombre='Vivienda libre — Los Almendros');

  -- 2. Con permuta de solar — para enseñar esa sección concreta.
  insert into public.estudios (organizacion_id, creado_por, nombre, ubicacion, municipio_id, estado, datos, tir, margen, riesgo, resumen)
  select v_org, v_yo, 'Permuta de solar — Can Roure', 'Sabadell (Barcelona)',
    (select id from public.municipios_ine where nombre='Sabadell' and organizacion_id is null limit 1),
    'construccion', '{}'::jsonb, 0.187, 0.165, 'mid',
    jsonb_build_object('viviendas',22,'densidadMax',24,'supSolar',2800,'techoSR',1980,
                        'precioVentaMedio',3200,'costeObraM2',1210,'pctVPO',0,'van',548300)
  where not exists (select 1 from public.estudios where organizacion_id=v_org and nombre='Permuta de solar — Can Roure');

  -- 3. Con reserva de VPO — para enseñar ese check y esa sección.
  insert into public.estudios (organizacion_id, creado_por, nombre, ubicacion, municipio_id, estado, datos, tir, margen, riesgo, resumen)
  select v_org, v_yo, '30% VPO — Torre Levante', 'Getafe (Madrid)',
    (select id from public.municipios_ine where nombre='Getafe' and organizacion_id is null limit 1),
    'revision', '{}'::jsonb, 0.146, 0.128, 'mid',
    jsonb_build_object('viviendas',40,'densidadMax',42,'supSolar',4600,'techoSR',3400,
                        'precioVentaMedio',2900,'costeObraM2',1150,'pctVPO',0.30,'van',392100)
  where not exists (select 1 from public.estudios where organizacion_id=v_org and nombre='30% VPO — Torre Levante');

  -- 4. Con margen ajustado y riesgo alto — para enseñar el semáforo de riesgo
  --    y el ranking de la Vista de equipo funcionando de verdad.
  insert into public.estudios (organizacion_id, creado_por, nombre, ubicacion, municipio_id, estado, datos, tir, margen, riesgo, resumen)
  select v_org, v_yo, 'Estudio en revisión — margen ajustado', 'Parla (Madrid)',
    (select id from public.municipios_ine where nombre='Parla' and organizacion_id is null limit 1),
    'borrador', '{}'::jsonb, 0.081, 0.071, 'high',
    jsonb_build_object('viviendas',18,'densidadMax',20,'supSolar',2200,'techoSR',1520,
                        'precioVentaMedio',2400,'costeObraM2',1290,'pctVPO',0,'van',-42800)
  where not exists (select 1 from public.estudios where organizacion_id=v_org and nombre='Estudio en revisión — margen ajustado');

  raise notice 'Entorno de demostración listo en la empresa % (%).', v_org, v_correo_demo;
end $$;

-- Compruébalo con:
--   select nombre, ubicacion, estado, tir, margen, riesgo from public.estudios
--   where organizacion_id = (select organizacion_id from public.perfiles p
--     join auth.users u on u.id=p.id where u.email='demo@tudominio.com');

-- Para quitarlo todo cuando ya no lo necesites:
--   delete from public.estudios where organizacion_id = (select organizacion_id from public.perfiles p
--     join auth.users u on u.id=p.id where u.email='demo@tudominio.com');
