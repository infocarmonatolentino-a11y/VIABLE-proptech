-- ============================================================================
--  VIABLE — 02. CONFIGURACIÓN MAESTRA POR MUNICIPIO
-- ----------------------------------------------------------------------------
--  Tercera migración. Se ejecuta DESPUÉS de 00-esquema-completo.sql y
--  01-notificaciones.sql. Idempotente, como las anteriores.
--
--  EL PROBLEMA QUE RESUELVE
--  Hasta ahora, "Configuración maestra" tenía cuatro campos fijos y el mismo
--  valor para toda la empresa, en cualquier municipio. Pero el precio de
--  venta, el coste de obra, el ITP, el ICIO... no son el mismo número en
--  Badalona que en Mataró, y un director necesita fijar referencias por
--  municipio, no un valor único para todos los estudios que le lleguen.
--
--  EL MODELO, EN TRES PIEZAS
--    1. municipios_ine    — catálogo de municipios (uno global compartido +
--                            los que cada empresa añada a mano).
--    2. parametros_definicion + parametros_seguidos — el catálogo de
--       parámetros de referencia (precio de venta, coste de obra, ITP...) y
--       cuáles de ellos ha elegido gestionar cada empresa. Esto es el
--       "desplegable para elegir qué parámetro configurar" que pedías, en
--       vez de los cuatro campos fijos de antes.
--    3. parametros_valores — los valores en sí, en cascada: si un municipio
--       tiene su propio valor, se usa ese; si no, se usa el valor de empresa
--       (una fila especial con municipio = "valor de empresa"); si tampoco
--       hay valor de empresa, no hay valor y la app lo dice claramente en
--       vez de inventar un cero.
--
--  QUÉ SE MANTIENE TAL CUAL
--  Los cuatro campos de "Configuración maestra" que ya existían (margen
--  mínimo, tipo de interés, régimen fiscal, y los dos umbrales de coste y
--  precio) NO se tocan ni se migran. Siguen siendo reglas de empresa, con el
--  mismo significado que tenían: umbrales de alerta iguales para toda la
--  empresa. Lo de aquí es un sistema NUEVO y adicional, para las referencias
--  que sí varían por municipio.
--
--  QUÉ QUEDA FUERA DE ESTA ENTREGA, A PROPÓSITO
--  Que al elegir un municipio al crear un estudio, sus valores de referencia
--  se precarguen automáticamente en los campos correspondientes de la
--  sección 4 (con el resaltado verde/naranja que ya usa la app) requiere
--  decidir, campo a campo, a qué campo exacto del motor corresponde cada
--  parámetro — y con qué unidades. Es la siguiente pieza natural, pero
--  mapear eso mal sería peor que no mapearlo. Por ahora, la app muestra las
--  referencias del municipio para que el delegado las consulte y las
--  traslade él mismo a la sección 4. Ver README.md para el detalle.
-- ============================================================================


-- ============================================================================
--  SECCIÓN 1 — MUNICIPIOS
-- ============================================================================

create table if not exists public.municipios_ine(
  id                  uuid primary key default gen_random_uuid(),
  -- null = catálogo oficial, visible para todas las empresas. Si no es null,
  -- es un municipio que una empresa ha añadido a mano porque no lo encontró
  -- en el catálogo, y solo lo ve ella (evita que el typo de una empresa
  -- ensucie el desplegable de las demás).
  organizacion_id     uuid references public.organizaciones(id) on delete cascade,
  nombre              text not null,
  provincia           text,
  comunidad_autonoma  text,
  -- Código INE de 5 dígitos. Se deja SIN RELLENAR en el catálogo de partida
  -- (ver sección 6): son datos oficiales y toca importarlos del INE, no
  -- inventarlos. Mientras tanto, el municipio funciona igual, solo que sin
  -- el código.
  codigo_ine          text,
  created_at          timestamptz not null default now()
);

-- Entre los oficiales (organizacion_id null), un código INE no se repite...
create unique index if not exists ux_municipios_codigo_ine
  on public.municipios_ine(codigo_ine) where organizacion_id is null and codigo_ine is not null;

-- ...y TAMPOCO se repite el nombre. Hace falta este índice, y no solo el de
-- arriba, porque el catálogo de arranque de la sección 6 todavía no trae
-- código INE (ver el porqué allí): sin este índice, "ON CONFLICT DO NOTHING"
-- no tendría nada contra lo que comparar y volver a ejecutar esta migración
-- duplicaría las 59 ciudades de arranque cada vez.
create unique index if not exists ux_municipios_oficial_nombre
  on public.municipios_ine(lower(nombre)) where organizacion_id is null;

-- Dentro de los añadidos a mano por una empresa, tampoco se repite el nombre
-- (para que no aparezca "Badalona" tres veces en su propio desplegable).
create unique index if not exists ux_municipios_custom_nombre
  on public.municipios_ine(organizacion_id, lower(nombre)) where organizacion_id is not null;

create index if not exists ix_municipios_nombre on public.municipios_ine(lower(nombre));

alter table public.municipios_ine enable row level security;

drop policy if exists municipios_select on public.municipios_ine;
create policy municipios_select on public.municipios_ine for select
  using (organizacion_id is null or organizacion_id = public.mi_org());

-- No hay política de inserción directa para "authenticated": los municipios
-- nuevos se crean a través de crear_municipio() (sección 4), que valida y
-- evita duplicados exactos antes de insertar.

-- Añade un municipio propio cuando no está en el catálogo. Cualquier persona
-- activa de la empresa puede proponerlo (no hace falta ser Dirección): quien
-- se topa con el municipio que falta suele ser el delegado, al crear el
-- estudio, no el director.
create or replace function public.crear_municipio(p_nombre text, p_provincia text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.mi_org();
  v_id  uuid;
begin
  if not public.estoy_activo() then
    raise exception 'Tu cuenta no está activa.';
  end if;
  if trim(coalesce(p_nombre,'')) = '' then
    raise exception 'El municipio necesita un nombre.';
  end if;

  -- Si ya existe (oficial o propio de esta empresa) con ese nombre, se
  -- reutiliza en vez de crear un duplicado.
  select id into v_id from public.municipios_ine
  where lower(nombre) = lower(trim(p_nombre))
    and (organizacion_id is null or organizacion_id = v_org)
  limit 1;
  if v_id is not null then return v_id; end if;

  insert into public.municipios_ine (organizacion_id, nombre, provincia)
  values (v_org, trim(p_nombre), nullif(trim(coalesce(p_provincia,'')), ''))
  returning id into v_id;
  return v_id;
end $$;

grant execute on function public.crear_municipio(text, text) to authenticated;


-- ============================================================================
--  SECCIÓN 2 — CATÁLOGO DE PARÁMETROS DE REFERENCIA
-- ============================================================================

create table if not exists public.parametros_definicion(
  id              uuid primary key default gen_random_uuid(),
  -- null = catálogo base, el mismo para todas las empresas. Si no es null,
  -- es un parámetro que una empresa se ha inventado porque el catálogo base
  -- no traía lo que necesitaba ("añadir muchos más parámetros").
  organizacion_id uuid references public.organizaciones(id) on delete cascade,
  clave           text not null,
  nombre          text not null,
  descripcion     text,
  unidad          text,                  -- '€/m²', '%', 'meses', '€'…, solo para mostrar
  tipo            text not null default 'number' check (tipo in ('number','percent')),
  orden           int not null default 0,
  activo          boolean not null default true,
  creado_por      uuid references public.perfiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

create unique index if not exists ux_parametros_clave_base
  on public.parametros_definicion(clave) where organizacion_id is null;
create unique index if not exists ux_parametros_clave_propia
  on public.parametros_definicion(organizacion_id, clave) where organizacion_id is not null;

alter table public.parametros_definicion enable row level security;

drop policy if exists parametros_def_select on public.parametros_definicion;
create policy parametros_def_select on public.parametros_definicion for select
  using (organizacion_id is null or organizacion_id = public.mi_org());

-- Solo Dirección crea parámetros propios, y solo dentro de su empresa — el
-- "= public.mi_org()" descarta cualquier intento de escribir sobre el
-- catálogo base (donde organizacion_id es null).
drop policy if exists parametros_def_write on public.parametros_definicion;
create policy parametros_def_write on public.parametros_definicion for all
  using (organizacion_id = public.mi_org() and public.soy_admin())
  with check (organizacion_id = public.mi_org() and public.soy_admin());

-- El catálogo base va AQUÍ, justo al crear la tabla, y no más abajo con el
-- resto de datos de arranque (sección 6). Fallo real de la primera versión
-- de este archivo, que un diagnóstico en producción destapó: la Sección 5
-- siembra automáticamente dos parámetros por cada empresa ya existente, pero
-- si el catálogo todavía no tiene filas cuando esa siembra se ejecuta, la
-- siembra no encuentra nada que copiar y ninguna empresa queda con parámetros
-- seguidos. Poniéndolo aquí, antes de la Sección 5, ese problema no puede
-- volver a pasar en una instalación nueva.
insert into public.parametros_definicion (clave, nombre, descripcion, unidad, tipo, orden) values
  ('precio_venta_vivienda',     'Precio de venta de vivienda libre',       'Precio medio de venta a aplicar como referencia de mercado', '€/m²', 'number', 10),
  ('coste_construccion_m2',     'Coste de construcción (PEM)',             'Presupuesto de ejecución material por m² construido',        '€/m²', 'number', 20),
  ('repercusion_suelo_vivienda','Repercusión de suelo por vivienda',       'Coste de suelo habitual repercutido por vivienda',            '€',    'number', 30),
  ('itp',                       'ITP aplicable a compraventas',            'Impuesto de Transmisiones Patrimoniales de la zona',          '%',    'percent', 40),
  ('icio',                      'ICIO',                                    'Impuesto sobre Construcciones, Instalaciones y Obras',        '%',    'percent', 50),
  ('tasa_licencia',             'Tasa de licencia de obras',               'Tasa municipal sobre el presupuesto de ejecución',            '%',    'percent', 60),
  ('plazo_licencia_meses',      'Plazo medio de licencia',                 'Meses habituales desde la solicitud hasta la concesión',      'meses','number', 70),
  ('precio_alquiler_m2',        'Precio de alquiler (build-to-rent)',      'Renta media mensual de referencia, para promoción en alquiler','€/m²/mes','number', 80)
on conflict do nothing;

-- Qué parámetros ha elegido GESTIONAR cada empresa. Los que no están aquí no
-- aparecen en su rejilla, aunque existan en el catálogo — es justo el
-- desplegable de "añadir parámetro a seguir" que pedías, en vez de tener los
-- cuatro (ahora podrían ser veinte) siempre fijos y a la vista.
create table if not exists public.parametros_seguidos(
  organizacion_id uuid not null references public.organizaciones(id) on delete cascade,
  parametro_id    uuid not null references public.parametros_definicion(id) on delete cascade,
  anadido_por     uuid references public.perfiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  primary key (organizacion_id, parametro_id)
);

alter table public.parametros_seguidos enable row level security;

drop policy if exists parametros_seg_select on public.parametros_seguidos;
create policy parametros_seg_select on public.parametros_seguidos for select
  using (organizacion_id = public.mi_org());

drop policy if exists parametros_seg_write on public.parametros_seguidos;
create policy parametros_seg_write on public.parametros_seguidos for all
  using (organizacion_id = public.mi_org() and public.soy_admin())
  with check (organizacion_id = public.mi_org() and public.soy_admin());


-- ============================================================================
--  SECCIÓN 3 — LOS VALORES, EN CASCADA
-- ============================================================================

-- El "municipio" que representa el valor de empresa (el que se usa cuando el
-- municipio del estudio no tiene uno propio). Un uuid fijo en vez de NULL:
-- así una sola restricción UNIQUE normal basta para evitar valores
-- duplicados, sin depender de si el motor de Postgres del proyecto admite
-- NULLS NOT DISTINCT.
create or replace function public.ambito_empresa() returns uuid
  language sql immutable as
  $$ select '00000000-0000-0000-0000-000000000000'::uuid $$;

create table if not exists public.parametros_valores(
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones(id) on delete cascade,
  parametro_id    uuid not null references public.parametros_definicion(id) on delete cascade,
  municipio_id    uuid not null default public.ambito_empresa(),
  valor           numeric not null,
  actualizado_por uuid references public.perfiles(id) on delete set null,
  updated_at      timestamptz not null default now(),
  unique (organizacion_id, parametro_id, municipio_id)
);

create index if not exists ix_parametros_valores_org on public.parametros_valores(organizacion_id, parametro_id);

alter table public.parametros_valores enable row level security;

-- Toda la empresa puede LEER las referencias (las necesita cualquier
-- delegado al crear un estudio). Solo se ESCRIBE a través de
-- set_parametro_valor() (más abajo): por eso no hay política de insert ni de
-- update para "authenticated" — la función corre como security definer y no
-- las necesita, y así ningún cliente puede escribir aquí sin pasar por las
-- validaciones de la función.
drop policy if exists parametros_val_select on public.parametros_valores;
create policy parametros_val_select on public.parametros_valores for select
  using (organizacion_id = public.mi_org());

-- Fija (o cambia) el valor de un parámetro para un municipio concreto, o para
-- toda la empresa si se pasa ambito_empresa(). Todas las comprobaciones viven
-- aquí para que no haya dos caminos distintos de escribir el mismo dato.
create or replace function public.set_parametro_valor(
  p_parametro uuid,
  p_municipio uuid,
  p_valor     numeric
) returns void
language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.mi_org();
begin
  if not public.soy_admin() then
    raise exception 'Solo Dirección puede fijar valores de referencia.';
  end if;
  if not exists (
    select 1 from public.parametros_definicion
    where id = p_parametro and activo and (organizacion_id is null or organizacion_id = v_org)
  ) then
    raise exception 'Ese parámetro no está disponible para tu empresa.';
  end if;
  if p_municipio <> public.ambito_empresa() and not exists (
    select 1 from public.municipios_ine
    where id = p_municipio and (organizacion_id is null or organizacion_id = v_org)
  ) then
    raise exception 'Ese municipio no está disponible para tu empresa.';
  end if;

  insert into public.parametros_valores (organizacion_id, parametro_id, municipio_id, valor, actualizado_por)
  values (v_org, p_parametro, p_municipio, p_valor, auth.uid())
  on conflict (organizacion_id, parametro_id, municipio_id)
  do update set valor = excluded.valor, actualizado_por = excluded.actualizado_por, updated_at = now();

  -- Si Dirección fija un valor de un parámetro que todavía no seguía
  -- formalmente, se da por hecho que ahora sí lo sigue — no tendría sentido
  -- guardarle un valor a algo que la rejilla ni siquiera le enseña.
  insert into public.parametros_seguidos (organizacion_id, parametro_id, anadido_por)
  values (v_org, p_parametro, auth.uid())
  on conflict (organizacion_id, parametro_id) do nothing;
end $$;

grant execute on function public.set_parametro_valor(uuid, uuid, numeric) to authenticated;

-- Borra el valor de una celda (volver a "sin definir" / "heredado").
create or replace function public.borrar_parametro_valor(p_parametro uuid, p_municipio uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.soy_admin() then
    raise exception 'Solo Dirección puede quitar un valor de referencia.';
  end if;
  delete from public.parametros_valores
  where organizacion_id = public.mi_org() and parametro_id = p_parametro and municipio_id = p_municipio;
end $$;

grant execute on function public.borrar_parametro_valor(uuid, uuid) to authenticated;

-- La cascada resuelta para UN municipio: para cada parámetro que la empresa
-- sigue, el valor del municipio si lo tiene, si no el de empresa, y si
-- tampoco hay ninguno, null — nunca un cero inventado. `origen` dice de dónde
-- sale cada valor, para que la pantalla pueda pintarlo en gris (heredado) o
-- en negro (propio de este municipio).
create or replace function public.parametros_resueltos(p_municipio uuid default public.ambito_empresa())
returns table(parametro_id uuid, clave text, nombre text, unidad text, tipo text, valor numeric, origen text)
language sql stable security definer set search_path = public as
$$
  with seguidos as (
    select pd.id, pd.clave, pd.nombre, pd.unidad, pd.tipo, pd.orden
    from public.parametros_seguidos ps
    join public.parametros_definicion pd on pd.id = ps.parametro_id and pd.activo
    where ps.organizacion_id = public.mi_org()
  ),
  v_municipio as (
    select parametro_id, valor from public.parametros_valores
    where organizacion_id = public.mi_org() and municipio_id = p_municipio
  ),
  v_empresa as (
    select parametro_id, valor from public.parametros_valores
    where organizacion_id = public.mi_org() and municipio_id = public.ambito_empresa()
  )
  select s.id, s.clave, s.nombre, s.unidad, s.tipo,
         coalesce(vm.valor, ve.valor) as valor,
         case when vm.valor is not null then 'municipio'
              when ve.valor is not null then 'empresa'
              else null end as origen
  from seguidos s
  left join v_municipio vm on vm.parametro_id = s.id
  left join v_empresa  ve on ve.parametro_id = s.id
  order by s.orden, s.nombre
$$;

grant execute on function public.parametros_resueltos(uuid) to authenticated;


-- ============================================================================
--  SECCIÓN 4 — EL ESTUDIO SABE DE QUÉ MUNICIPIO ES
-- ============================================================================

alter table public.estudios add column if not exists municipio_id uuid references public.municipios_ine(id) on delete set null;
create index if not exists ix_estudios_municipio on public.estudios(municipio_id) where municipio_id is not null;


-- ============================================================================
--  SECCIÓN 5 — CADA EMPRESA NUEVA ARRANCA SIGUIENDO DOS PARÁMETROS
--  Sin esto, una empresa recién creada abriría la rejilla completamente
--  vacía y tendría que saber que existe el botón de añadir antes de ver nada
--  útil. Se sigue pudiendo quitar cualquiera de los dos, o añadir más.
-- ============================================================================

create or replace function public.crear_perfil_nuevo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_rol text;
  v_es_primero boolean;
begin
  v_org := (new.raw_user_meta_data->>'organizacion_id')::uuid;

  if v_org is null or not exists (select 1 from public.organizaciones where id = v_org) then
    insert into public.organizaciones(nombre, codigo)
    values (
      coalesce(nullif(trim(new.raw_user_meta_data->>'empresa_nombre'), ''), 'Mi empresa'),
      public.generar_codigo_organizacion()
    )
    returning id into v_org;
    v_rol := 'admin';
  else
    select not exists(select 1 from public.perfiles where organizacion_id = v_org) into v_es_primero;
    v_rol := case when v_es_primero then 'admin' else 'editor' end;
  end if;

  insert into public.perfiles (id, nombre, rol, organizacion_id)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', 'Usuario'), v_rol, v_org)
  on conflict (id) do nothing;

  insert into public.configuracion_maestra (organizacion_id)
  values (v_org)
  on conflict (organizacion_id) do nothing;

  -- Arranque razonable: precio de venta y coste de obra son los dos
  -- parámetros que ya existían de facto (aunque como umbral, no como
  -- referencia). El resto del catálogo lo añade Dirección si lo necesita.
  insert into public.parametros_seguidos (organizacion_id, parametro_id)
  select v_org, id from public.parametros_definicion
  where organizacion_id is null and clave in ('precio_venta_vivienda','coste_construccion_m2')
  on conflict (organizacion_id, parametro_id) do nothing;

  return new;
end $$;

drop trigger if exists trg_crear_perfil on auth.users;
create trigger trg_crear_perfil
  after insert on auth.users
  for each row execute function public.crear_perfil_nuevo_usuario();

-- Y las empresas que ya existían antes de esta migración también arrancan
-- siguiendo esos dos, para no dejarlas con la rejilla vacía.
insert into public.parametros_seguidos (organizacion_id, parametro_id)
select o.id, pd.id
from public.organizaciones o
cross join public.parametros_definicion pd
where pd.organizacion_id is null and pd.clave in ('precio_venta_vivienda','coste_construccion_m2')
on conflict (organizacion_id, parametro_id) do nothing;


-- ============================================================================
--  SECCIÓN 6 — ARRANQUE DE MUNICIPIOS
-- ----------------------------------------------------------------------------
--  El catálogo base de parámetros ya se sembró en la Sección 2. Esto de aquí
--  es solo el arranque de municipios, para no empezar de cero.
--
--  IMPORTANTE sobre los municipios: son solo un arranque — las 59 ciudades
--  más grandes de España, con su provincia, para que la app sea usable desde
--  el primer día. Van SIN código INE a propósito: es un dato oficial y
--  hay que importarlo del catálogo real, no inventarlo. El sitio para
--  conseguirlo es el propio INE — INEbase → Demografía → "Padrón. Población
--  por municipios" → "Relación de municipios y sus códigos", que se
--  descarga como Excel con los cerca de 8.100 municipios y su código. Se
--  importa con el editor de tablas de Supabase (botón "Import data from
--  CSV") sobre esta misma tabla, o con COPY desde psql. Mientras tanto,
--  cualquier municipio que falte se añade solo, sin código, en cuanto
--  alguien lo escribe al crear un estudio.
-- ============================================================================

insert into public.municipios_ine (nombre, provincia) values
  ('Madrid','Madrid'), ('Barcelona','Barcelona'), ('Valencia','Valencia'), ('Sevilla','Sevilla'),
  ('Zaragoza','Zaragoza'), ('Málaga','Málaga'), ('Murcia','Murcia'), ('Palma','Illes Balears'),
  ('Las Palmas de Gran Canaria','Las Palmas'), ('Bilbao','Vizcaya'), ('Alicante','Alicante'),
  ('Córdoba','Córdoba'), ('Valladolid','Valladolid'), ('Vigo','Pontevedra'), ('Gijón','Asturias'),
  ('L''Hospitalet de Llobregat','Barcelona'), ('Vitoria-Gasteiz','Álava'), ('A Coruña','A Coruña'),
  ('Granada','Granada'), ('Elche','Alicante'), ('Oviedo','Asturias'), ('Badalona','Barcelona'),
  ('Cartagena','Murcia'), ('Terrassa','Barcelona'), ('Jerez de la Frontera','Cádiz'),
  ('Sabadell','Barcelona'), ('Móstoles','Madrid'), ('Alcalá de Henares','Madrid'),
  ('Pamplona','Navarra'), ('Fuenlabrada','Madrid'), ('Almería','Almería'), ('Leganés','Madrid'),
  ('Donostia-San Sebastián','Guipúzcoa'), ('Santander','Cantabria'),
  ('Castellón de la Plana','Castellón'), ('Burgos','Burgos'), ('Albacete','Albacete'),
  ('Getafe','Madrid'), ('Alcorcón','Madrid'), ('San Cristóbal de La Laguna','Santa Cruz de Tenerife'),
  ('Logroño','La Rioja'), ('Badajoz','Badajoz'), ('Salamanca','Salamanca'), ('Huelva','Huelva'),
  ('Marbella','Málaga'), ('Lleida','Lleida'), ('Tarragona','Tarragona'), ('León','León'),
  ('Cádiz','Cádiz'), ('Dos Hermanas','Sevilla'), ('Mataró','Barcelona'),
  ('Santa Coloma de Gramenet','Barcelona'), ('Torrejón de Ardoz','Madrid'), ('Parla','Madrid'),
  ('Algeciras','Cádiz'), ('Jaén','Jaén'), ('Ourense','Ourense'), ('Reus','Tarragona'), ('Girona','Girona')
on conflict do nothing;


-- ============================================================================
--  SECCIÓN 7 — TIEMPO REAL
-- ============================================================================

do $$
begin
  begin
    alter publication supabase_realtime add table public.parametros_valores;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.parametros_seguidos;
  exception when duplicate_object then null;
  end;
end $$;


-- ============================================================================
--  SECCIÓN 8 — DESPUÉS DE EJECUTAR ESTO
-- ----------------------------------------------------------------------------
--  1) Nada que dar de alta a mano esta vez: en cuanto subas el código nuevo,
--     "Configuración maestra" tiene una sección nueva, "Referencias de
--     mercado por municipio", con los dos parámetros de partida ya
--     siguiéndose y las 59 ciudades del arranque disponibles.
--
--  2) Para importar el catálogo oficial completo de municipios más adelante:
--     Table Editor → municipios_ine → Insert → Import data from CSV, con las
--     columnas nombre, provincia, comunidad_autonoma, codigo_ine y
--     organizacion_id en blanco (para que queden como catálogo compartido).
--
--  3) Para probar la cascada sin usar la pantalla:
--
--     select * from public.parametros_resueltos(public.ambito_empresa());
--
--     select m.id from public.municipios_ine m where m.nombre = 'Badalona';
--     select public.set_parametro_valor(
--       (select id from public.parametros_definicion where clave='precio_venta_vivienda'),
--       (select id from public.municipios_ine where nombre='Badalona'),
--       4200
--     );
--     select * from public.parametros_resueltos(
--       (select id from public.municipios_ine where nombre='Badalona')
--     );
-- ============================================================================
