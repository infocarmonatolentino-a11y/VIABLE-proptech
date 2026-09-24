-- ============================================================================
--  VIABLE — DIAGNÓSTICO
-- ----------------------------------------------------------------------------
--  Pega esto entero en el SQL Editor de Supabase y dale a Run. Al final sale
--  UNA tabla con todas las comprobaciones y si están OK, FALTA o AVISO —
--  cómodo de capturar en una sola pantalla.
--
--  Es de solo lectura: no cambia nada en tu base de datos, así que se puede
--  ejecutar las veces que haga falta, en cualquier momento, sin riesgo.
--
--  QUÉ NO PUEDE COMPROBAR ESTO
--  Solo ve dentro de Postgres. No puede saber si el dominio de Resend está
--  verificado, ni si las Edge Functions están desplegadas: eso vive fuera de
--  la base de datos. Lo que sí confirma es que el lado de aquí — las tablas,
--  las políticas, los disparadores — está listo para cuando lo otro lo esté.
--  Para lo de fuera, la comprobación es compartir un estudio de prueba y
--  mirar Edge Functions → notificar-por-email → Logs en el panel de Supabase.
-- ============================================================================

do $$
declare
  v_bool   boolean;
  v_count  bigint;
  v_texto  text;
begin
  drop table if exists _diagnostico_viable;
  create temporary table _diagnostico_viable(
    orden int, bloque text, comprobacion text, estado text, detalle text
  );

  -- ==========================================================================
  -- 00 — ESQUEMA BASE
  -- ==========================================================================

  v_bool := to_regprocedure('public.mi_org()') is not null;
  insert into _diagnostico_viable values (100, '00 · Esquema', 'Función mi_org()',
    case when v_bool then 'OK' else 'FALTA' end,
    case when v_bool then 'existe' else 'ejecuta sql/00-esquema-completo.sql' end);

  v_bool := to_regprocedure('public.soy_admin()') is not null;
  insert into _diagnostico_viable values (101, '00 · Esquema', 'Función soy_admin()',
    case when v_bool then 'OK' else 'FALTA' end, case when v_bool then 'existe' else 'falta' end);

  v_bool := to_regprocedure('public.soy_plataforma()') is not null;
  insert into _diagnostico_viable values (102, '00 · Esquema', 'Función soy_plataforma()',
    case when v_bool then 'OK' else 'FALTA' end, case when v_bool then 'existe' else 'falta' end);

  -- Tablas base, una fila por tabla
  for v_texto in select unnest(array[
    'organizaciones','perfiles','plataforma_admins','estudios',
    'historial_versiones','estudios_compartidos','plantillas',
    'configuracion_maestra','logs_errores'
  ])
  loop
    v_bool := to_regclass('public.'||v_texto) is not null;
    insert into _diagnostico_viable values (110, '00 · Esquema', 'Tabla '||v_texto,
      case when v_bool then 'OK' else 'FALTA' end,
      case when v_bool then 'existe' else 'no está creada' end);
    if v_bool then
      execute format('select relrowsecurity from pg_class where oid = %L::regclass', 'public.'||v_texto) into v_bool;
      insert into _diagnostico_viable values (111, '00 · Esquema', 'RLS activa en '||v_texto,
        case when v_bool then 'OK' else 'AVISO' end,
        case when v_bool then 'activada' else 'SIN RLS — cualquiera con la clave pública leería esta tabla entera' end);
    end if;
  end loop;

  -- Trigger de alta de usuarios
  v_bool := exists(select 1 from pg_trigger where tgname = 'trg_crear_perfil');
  insert into _diagnostico_viable values (120, '00 · Esquema', 'Disparador trg_crear_perfil (auth.users)',
    case when v_bool then 'OK' else 'FALTA' end, case when v_bool then 'existe' else 'falta' end);

  -- Quién es dueño de la plataforma — la comprobación más importante de esta
  -- sección: sin al menos una fila aquí, la pantalla de Errores no la ve nadie.
  if to_regclass('public.plataforma_admins') is not null then
    select count(*) into v_count from public.plataforma_admins;
    if v_count = 0 then
      insert into _diagnostico_viable values (130, '00 · Esquema', 'Dueños de la plataforma dados de alta',
        'AVISO', 'Ninguno todavía. Sin esto, la vista "Errores" del panel no la ve nadie — instrucciones al final de sql/00-esquema-completo.sql.');
    else
      select string_agg(u.email, ', ') into v_texto
      from public.plataforma_admins pa join auth.users u on u.id = pa.perfil_id;
      insert into _diagnostico_viable values (130, '00 · Esquema', 'Dueños de la plataforma dados de alta',
        'OK', v_count||' cuenta(s): '||coalesce(v_texto,'—'));
    end if;
  end if;

  -- ==========================================================================
  -- 01 — NOTIFICACIONES Y ERRORES AGRUPADOS
  -- ==========================================================================

  for v_texto in select unnest(array['notificaciones','preferencias_notificacion'])
  loop
    v_bool := to_regclass('public.'||v_texto) is not null;
    insert into _diagnostico_viable values (200, '01 · Notificaciones', 'Tabla '||v_texto,
      case when v_bool then 'OK' else 'FALTA' end,
      case when v_bool then 'existe' else 'ejecuta sql/01-notificaciones.sql' end);
    if v_bool then
      execute format('select relrowsecurity from pg_class where oid = %L::regclass', 'public.'||v_texto) into v_bool;
      insert into _diagnostico_viable values (201, '01 · Notificaciones', 'RLS activa en '||v_texto,
        case when v_bool then 'OK' else 'AVISO' end, case when v_bool then 'activada' else 'SIN RLS' end);
    end if;
  end loop;

  for v_texto in select unnest(array[
    'preferencia_notificacion','notificar_estudio_compartido','notificar_estudio_visto',
    'logs_agrupados','logs_detalle','limpiar_notificaciones'
  ])
  loop
    v_bool := to_regprocedure('public.'||v_texto||
      case v_texto
        when 'preferencia_notificacion' then '(uuid,text)'
        when 'logs_agrupados' then '(text,text,int)'
        when 'logs_detalle' then '(text,int)'
        else '()'
      end) is not null;
    insert into _diagnostico_viable values (210, '01 · Notificaciones', 'Función '||v_texto||'()',
      case when v_bool then 'OK' else 'FALTA' end, case when v_bool then 'existe' else 'falta' end);
  end loop;

  v_bool := exists(select 1 from pg_trigger where tgname = 'trg_notificar_estudio_compartido');
  insert into _diagnostico_viable values (220, '01 · Notificaciones', 'Disparador al compartir un estudio',
    case when v_bool then 'OK' else 'FALTA' end, case when v_bool then 'existe' else 'falta' end);

  v_bool := exists(select 1 from pg_trigger where tgname = 'trg_notificar_estudio_visto');
  insert into _diagnostico_viable values (221, '01 · Notificaciones', 'Disparador al ver un estudio compartido',
    case when v_bool then 'OK' else 'FALTA' end, case when v_bool then 'existe' else 'falta' end);

  -- Tiempo real: sin esto, la campanita no se enciende sola.
  v_bool := exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='notificaciones');
  insert into _diagnostico_viable values (222, '01 · Notificaciones', 'Tiempo real en notificaciones',
    case when v_bool then 'OK' else 'AVISO' end,
    case when v_bool then 'activado' else 'sin activar — la campanita solo se actualizará al recargar la página' end);

  -- ==========================================================================
  -- 02 — CONFIGURACIÓN POR MUNICIPIO
  -- ==========================================================================

  for v_texto in select unnest(array['municipios_ine','parametros_definicion','parametros_seguidos','parametros_valores'])
  loop
    v_bool := to_regclass('public.'||v_texto) is not null;
    insert into _diagnostico_viable values (300, '02 · Municipios', 'Tabla '||v_texto,
      case when v_bool then 'OK' else 'FALTA' end,
      case when v_bool then 'existe' else 'ejecuta sql/02-configuracion-por-municipio.sql' end);
    if v_bool then
      execute format('select relrowsecurity from pg_class where oid = %L::regclass', 'public.'||v_texto) into v_bool;
      insert into _diagnostico_viable values (301, '02 · Municipios', 'RLS activa en '||v_texto,
        case when v_bool then 'OK' else 'AVISO' end, case when v_bool then 'activada' else 'SIN RLS' end);
    end if;
  end loop;

  for v_texto in select unnest(array['crear_municipio','ambito_empresa','set_parametro_valor','borrar_parametro_valor','parametros_resueltos'])
  loop
    v_bool := exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                      where n.nspname='public' and p.proname=v_texto);
    insert into _diagnostico_viable values (310, '02 · Municipios', 'Función '||v_texto||'()',
      case when v_bool then 'OK' else 'FALTA' end, case when v_bool then 'existe' else 'falta' end);
  end loop;

  if to_regclass('public.estudios') is not null then
    v_bool := exists(select 1 from information_schema.columns
                      where table_schema='public' and table_name='estudios' and column_name='municipio_id');
    insert into _diagnostico_viable values (320, '02 · Municipios', 'Columna estudios.municipio_id',
      case when v_bool then 'OK' else 'FALTA' end, case when v_bool then 'existe' else 'falta' end);
  end if;

  -- El catálogo de arranque: cuántos municipios y parámetros hay, y si el
  -- arreglo de idempotencia (índice único por nombre) dejó algún duplicado.
  if to_regclass('public.municipios_ine') is not null then
    select count(*) filter (where organizacion_id is null) into v_count from public.municipios_ine;
    insert into _diagnostico_viable values (330, '02 · Municipios', 'Municipios en el catálogo oficial',
      case when v_count >= 1 then 'OK' else 'AVISO' end, v_count||' (el arranque trae 59)');

    select count(*) into v_count from (
      select lower(nombre) from public.municipios_ine where organizacion_id is null
      group by lower(nombre) having count(*) > 1
    ) d;
    insert into _diagnostico_viable values (331, '02 · Municipios', 'Municipios oficiales duplicados',
      case when v_count = 0 then 'OK' else 'AVISO' end,
      case when v_count = 0 then 'ninguno' else v_count||' nombres repetidos — revísalo a mano' end);
  end if;

  if to_regclass('public.parametros_definicion') is not null then
    select count(*) filter (where organizacion_id is null) into v_count from public.parametros_definicion;
    insert into _diagnostico_viable values (332, '02 · Municipios', 'Parámetros del catálogo base',
      case when v_count = 8 then 'OK' else 'AVISO' end, v_count||' (se esperan 8)');
  end if;

  if to_regclass('public.parametros_seguidos') is not null and to_regclass('public.organizaciones') is not null then
    select count(distinct o.id) into v_count
    from public.organizaciones o
    left join public.parametros_seguidos ps on ps.organizacion_id = o.id
    where ps.organizacion_id is null;
    insert into _diagnostico_viable values (333, '02 · Municipios', 'Empresas sin ningún parámetro seguido',
      case when v_count = 0 then 'OK' else 'AVISO' end,
      case when v_count = 0 then 'todas siguen al menos uno' else v_count||' empresa(s) con la rejilla vacía' end);
  end if;

  -- ==========================================================================
  -- LIMPIEZA PROGRAMADA (pg_cron)
  -- ==========================================================================

  v_bool := exists(select 1 from pg_extension where extname = 'pg_cron');
  insert into _diagnostico_viable values (400, 'Limpieza automática', 'Extensión pg_cron',
    case when v_bool then 'OK' else 'AVISO' end,
    case when v_bool then 'activada' else 'no activada — las tablas de historial, errores, papelera y notificaciones no se limpiarán solas (ver herramientas/produccion.md)' end);

  if v_bool then
    for v_texto in select unnest(array['limpiar-historial','limpiar-logs','vaciar-papelera','limpiar-notificaciones'])
    loop
      v_bool := exists(select 1 from cron.job where jobname = v_texto);
      insert into _diagnostico_viable values (401, 'Limpieza automática', 'Tarea programada "'||v_texto||'"',
        case when v_bool then 'OK' else 'AVISO' end,
        case when v_bool then 'programada' else 'no programada' end);
    end loop;
  end if;

  raise notice 'Diagnóstico completo: % comprobaciones.', (select count(*) from _diagnostico_viable);
end $$;

select
  bloque as "Bloque",
  comprobacion as "Comprobación",
  estado as "Estado",
  detalle as "Detalle"
from _diagnostico_viable
order by orden;
