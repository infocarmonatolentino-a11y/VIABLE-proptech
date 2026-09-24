-- ============================================================================
--  VIABLE — ESQUEMA COMPLETO DESDE CERO
-- ----------------------------------------------------------------------------
--  Este script sustituye a los cuatro anteriores. Levanta la base de datos
--  entera partiendo de un proyecto Supabase vacío, y también se puede ejecutar
--  sobre el proyecto actual sin romper nada: todo va con "if not exists" o con
--  "create or replace", así que se puede lanzar las veces que haga falta.
--
--  QUÉ APORTA RESPECTO A LOS SCRIPTS ANTERIORES
--  Los cuatro SQL que había asumían que las tablas ya existían (se crearon a
--  mano en el panel de Supabase). Eso impide levantar un entorno de pruebas y
--  deja el proyecto sin forma de recuperarse. Aquí están todas.
--
--  Además incorpora:
--    · logs_errores, que no se creaba en ningún sitio aunque el código escriba
--      en ella desde dos archivos distintos.
--    · El rol de "dueño de la plataforma", distinto de "Dirección de una
--      empresa", para poder ver los errores de todos los clientes.
--    · Desactivación de personas en lugar de borrado.
--    · Papelera de estudios.
--    · La columna `resumen` para que el panel liste métricas sin leer el
--      estudio entero.
--    · El arreglo del canal de presencia NO está aquí: es JavaScript.
--      Ver PARCHES.md.
--
--  ORDEN DE EJECUCIÓN
--  Este archivo primero. Los siguientes cambios van en sql/migraciones/,
--  numerados, y cada uno se ejecuta una sola vez.
-- ============================================================================


-- ============================================================================
--  SECCIÓN 1 — TABLAS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1.1 Organizaciones (empresas)
-- ----------------------------------------------------------------------------
create table if not exists public.organizaciones(
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  codigo      text,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 1.2 Perfiles (una fila por usuario de auth.users)
-- ----------------------------------------------------------------------------
create table if not exists public.perfiles(
  id              uuid primary key references auth.users(id) on delete cascade,
  nombre          text not null default 'Usuario',
  rol             text not null default 'editor',
  organizacion_id uuid references public.organizaciones(id) on delete set null,
  created_at      timestamptz not null default now()
);

-- Desactivar en lugar de borrar. Borrar un perfil rompería `creado_por` en
-- estudios: años de histórico desaparecerían porque alguien cambió de empresa.
alter table public.perfiles add column if not exists activo          boolean not null default true;
alter table public.perfiles add column if not exists desactivado_at  timestamptz;
alter table public.perfiles add column if not exists desactivado_por uuid references public.perfiles(id) on delete set null;

alter table public.perfiles drop constraint if exists perfiles_rol_check;
alter table public.perfiles add constraint perfiles_rol_check
  check (rol in ('admin','editor','viewer'));

create index if not exists ix_perfiles_org on public.perfiles(organizacion_id) where activo;

-- ----------------------------------------------------------------------------
-- 1.3 Dueños de la plataforma
--     OJO: esto NO es "Dirección de una empresa". soy_admin() dice si mandas
--     en TU organización; esto dice si eres el dueño del producto y puedes ver
--     lo que pasa en todas las empresas clientes (errores, uso, soporte).
--     Se rellena a mano, y a propósito: no hay ninguna forma de que alguien se
--     añada solo.
-- ----------------------------------------------------------------------------
create table if not exists public.plataforma_admins(
  perfil_id  uuid primary key references public.perfiles(id) on delete cascade,
  nota       text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 1.4 Estudios
-- ----------------------------------------------------------------------------
create table if not exists public.estudios(
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones(id) on delete cascade,
  creado_por      uuid references public.perfiles(id) on delete set null,
  nombre          text not null default 'Estudio sin nombre',
  ubicacion       text,
  estado          text not null default 'borrador',
  datos           jsonb not null default '{}'::jsonb,
  tir             numeric,
  margen          numeric,
  riesgo          text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.estudios add column if not exists updated_at timestamptz not null default now();

-- Métricas que el panel lista sin tener que traerse `datos` entero. Una sola
-- columna en vez de una por métrica: añadir un dato nuevo a la Vista de equipo
-- pasa a ser un cambio de frontal, sin migración de base de datos.
alter table public.estudios add column if not exists resumen jsonb not null default '{}'::jsonb;

-- Papelera: eliminar un estudio deja de ser irreversible.
alter table public.estudios add column if not exists eliminado_at  timestamptz;
alter table public.estudios add column if not exists eliminado_por uuid references public.perfiles(id) on delete set null;

alter table public.estudios drop constraint if exists estudios_estado_check;
alter table public.estudios add constraint estudios_estado_check
  check (estado in ('borrador','construccion','revision','aprobado','descartado'));

create index if not exists ix_estudios_org   on public.estudios(organizacion_id) where eliminado_at is null;
create index if not exists ix_estudios_autor on public.estudios(creado_por)      where eliminado_at is null;
create index if not exists ix_estudios_papelera on public.estudios(eliminado_at) where eliminado_at is not null;

create or replace function public.tocar_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_estudios_updated_at on public.estudios;
create trigger trg_estudios_updated_at
  before update on public.estudios
  for each row execute function public.tocar_updated_at();

-- ----------------------------------------------------------------------------
-- 1.5 Historial de versiones
-- ----------------------------------------------------------------------------
create table if not exists public.historial_versiones(
  id           uuid primary key default gen_random_uuid(),
  estudio_id   uuid not null references public.estudios(id) on delete cascade,
  datos        jsonb not null default '{}'::jsonb,
  guardado_por uuid references public.perfiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

alter table public.historial_versiones drop constraint if exists historial_versiones_estudio_id_fkey;
alter table public.historial_versiones add constraint historial_versiones_estudio_id_fkey
  foreign key (estudio_id) references public.estudios(id) on delete cascade;

create index if not exists ix_historial_est on public.historial_versiones(estudio_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 1.6 Estudios compartidos
-- ----------------------------------------------------------------------------
create table if not exists public.estudios_compartidos(
  id          uuid primary key default gen_random_uuid(),
  estudio_id  uuid not null references public.estudios(id) on delete cascade,
  perfil_id   uuid not null references public.perfiles(id) on delete cascade,
  estado      text not null default 'enviado',
  created_at  timestamptz not null default now()
);

alter table public.estudios_compartidos drop constraint if exists estudios_compartidos_estudio_id_fkey;
alter table public.estudios_compartidos add constraint estudios_compartidos_estudio_id_fkey
  foreign key (estudio_id) references public.estudios(id) on delete cascade;

alter table public.estudios_compartidos add column if not exists estado text not null default 'enviado';
alter table public.estudios_compartidos drop constraint if exists estudios_compartidos_estado_check;
alter table public.estudios_compartidos add constraint estudios_compartidos_estado_check
  check (estado in ('enviado','visto','descartado'));

create unique index if not exists ux_compartidos
  on public.estudios_compartidos(estudio_id, perfil_id);

-- ----------------------------------------------------------------------------
-- 1.7 Plantillas de supuestos de empresa
-- ----------------------------------------------------------------------------
create table if not exists public.plantillas(
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid references public.organizaciones(id) on delete cascade,
  nombre          text not null default 'Supuestos estándar',
  datos           jsonb not null default '{}'::jsonb,
  creado_por      uuid references public.perfiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

alter table public.plantillas add column if not exists organizacion_id uuid references public.organizaciones(id) on delete cascade;
alter table public.plantillas add column if not exists creado_por      uuid references public.perfiles(id) on delete set null;
alter table public.plantillas add column if not exists datos           jsonb not null default '{}'::jsonb;
alter table public.plantillas add column if not exists created_at      timestamptz not null default now();

create index if not exists ix_plantillas_org on public.plantillas(organizacion_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 1.8 Configuración maestra
--     Sigue igual que hasta ahora. El modelo por ámbitos geográficos (fase 3
--     de la hoja de ruta) se añadirá en su propia migración, conviviendo con
--     esta tabla durante la transición.
-- ----------------------------------------------------------------------------
create table if not exists public.configuracion_maestra(
  organizacion_id        uuid primary key references public.organizaciones(id) on delete cascade,
  coste_construccion_min numeric,
  precio_venta_min       numeric,
  margen_min             numeric default 0.18,
  tipo_interes           numeric default 0.05,
  regimen_fiscal         text    default 'ITP',
  updated_by             uuid references public.perfiles(id) on delete set null,
  updated_at             timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 1.9 Registro de errores
--     Esta tabla NO existía en ningún script, aunque js/error-logger.js y
--     Dashboard_v4.html escriben en ella. Los dos loggers tragan cualquier
--     fallo en un catch vacío a propósito, así que si faltaba la tabla o le
--     faltaba la política de inserción, todos los envíos fallaban en silencio.
-- ----------------------------------------------------------------------------
create table if not exists public.logs_errores(
  id              bigserial primary key,
  organizacion_id uuid references public.organizaciones(id) on delete set null,
  usuario_id      uuid references public.perfiles(id) on delete set null,
  app             text not null,            -- 'viabilidad' | 'dashboard'
  contexto        text,                     -- 'guardar estudio', 'cambiar rol'…
  mensaje         text not null,
  detalle         text,
  url             text,
  user_agent      text,
  version_app     text,
  estado          text not null default 'nuevo',
  created_at      timestamptz not null default now()
);

-- Columnas nuevas respecto a lo que hoy envía el código. El logger actual no
-- las manda y no pasa nada: se quedan a null hasta que se actualice el
-- JavaScript (ver PARCHES.md).
alter table public.logs_errores add column if not exists contexto    text;
alter table public.logs_errores add column if not exists user_agent  text;
alter table public.logs_errores add column if not exists version_app text;
alter table public.logs_errores add column if not exists estado      text not null default 'nuevo';

alter table public.logs_errores drop constraint if exists logs_errores_estado_check;
alter table public.logs_errores add constraint logs_errores_estado_check
  check (estado in ('nuevo','en curso','resuelto','ignorado'));

-- La huella agrupa el mismo error repetido. Sin ella, "los últimos 20 errores"
-- son veinte veces el mismo fallo y no se ve nada. Es una columna generada, así
-- que se calcula sola y no hay forma de que se desincronice.
alter table public.logs_errores add column if not exists huella text
  generated always as (md5(app || coalesce(contexto,'') || left(mensaje, 200))) stored;

create index if not exists ix_logs_huella on public.logs_errores(huella, created_at desc);
create index if not exists ix_logs_fecha  on public.logs_errores(created_at desc);
create index if not exists ix_logs_org    on public.logs_errores(organizacion_id, created_at desc);


-- ============================================================================
--  SECCIÓN 2 — FUNCIONES AUXILIARES
--  Las preguntas que cruzan dos tablas van dentro de funciones `security
--  definer`. Escritas directamente en una política, Postgres entraría en bucle
--  (estudios -> estudios_compartidos -> estudios -> …) y cortaría con
--  "infinite recursion detected in policy".
-- ============================================================================

create or replace function public.mi_org() returns uuid
  language sql stable security definer set search_path = public as
  $$ select organizacion_id from public.perfiles where id = auth.uid() $$;

create or replace function public.soy_admin() returns boolean
  language sql stable security definer set search_path = public as
  $$ select coalesce((select rol = 'admin' and activo
                      from public.perfiles where id = auth.uid()), false) $$;

-- Dueño de la plataforma: ve lo que pasa en todas las empresas.
create or replace function public.soy_plataforma() returns boolean
  language sql stable security definer set search_path = public as
  $$ select exists(select 1 from public.plataforma_admins pa
                   join public.perfiles p on p.id = pa.perfil_id
                   where pa.perfil_id = auth.uid() and p.activo) $$;

-- Cuenta activa. Una persona desactivada conserva su fila y sus estudios, pero
-- deja de poder hacer nada.
create or replace function public.estoy_activo() returns boolean
  language sql stable security definer set search_path = public as
  $$ select coalesce((select activo from public.perfiles where id = auth.uid()), false) $$;

create or replace function public.compartido_conmigo(p_estudio uuid) returns boolean
  language sql stable security definer set search_path = public as
  $$ select exists (select 1 from public.estudios_compartidos c
                    where c.estudio_id = p_estudio and c.perfil_id = auth.uid()) $$;

create or replace function public.mando_en_estudio(p_estudio uuid) returns boolean
  language sql stable security definer set search_path = public as
  $$ select exists (select 1 from public.estudios e
                    where e.id = p_estudio
                      and e.organizacion_id = public.mi_org()
                      and (e.creado_por = auth.uid() or public.soy_admin())) $$;

create or replace function public.puedo_ver_estudio(p_estudio uuid) returns boolean
  language sql stable security definer set search_path = public as
  $$ select exists (select 1 from public.estudios e
                    where e.id = p_estudio
                      and (
                        (e.organizacion_id = public.mi_org()
                         and (e.creado_por = auth.uid() or public.soy_admin()))
                        or public.compartido_conmigo(e.id)
                      )) $$;

grant execute on function
  public.mi_org(), public.soy_admin(), public.soy_plataforma(), public.estoy_activo(),
  public.compartido_conmigo(uuid), public.mando_en_estudio(uuid), public.puedo_ver_estudio(uuid)
  to authenticated;


-- ============================================================================
--  SECCIÓN 3 — CÓDIGO DE INVITACIÓN
-- ============================================================================

create or replace function public.generar_codigo_organizacion()
returns text language plpgsql security definer set search_path = public as $$
declare
  v_codigo text;
  v_existe boolean;
  v_alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- sin 0/O/1/I
begin
  loop
    v_codigo := '';
    for i in 1..6 loop
      v_codigo := v_codigo || substr(v_alfabeto, (floor(random()*length(v_alfabeto))+1)::int, 1);
    end loop;
    select exists(select 1 from public.organizaciones where codigo = v_codigo) into v_existe;
    exit when not v_existe;
  end loop;
  return v_codigo;
end $$;

update public.organizaciones set codigo = public.generar_codigo_organizacion() where codigo is null;
alter table public.organizaciones alter column codigo set not null;
alter table public.organizaciones drop constraint if exists organizaciones_codigo_key;
alter table public.organizaciones add constraint organizaciones_codigo_key unique (codigo);

create or replace function public.buscar_organizacion_por_codigo(p_codigo text)
returns table(id uuid, nombre text)
language sql stable security definer set search_path = public as
$$ select id, nombre from public.organizaciones where codigo = upper(trim(p_codigo)) $$;

create or replace function public.regenerar_codigo_organizacion()
returns text language plpgsql security definer set search_path = public as $$
declare v_nuevo text;
begin
  if not public.soy_admin() then
    raise exception 'Solo Dirección puede regenerar el código de invitación.';
  end if;
  v_nuevo := public.generar_codigo_organizacion();
  update public.organizaciones set codigo = v_nuevo where id = public.mi_org();
  return v_nuevo;
end $$;

create or replace function public.buscar_perfil_por_email(p_email text)
returns table(id uuid, nombre text, organizacion_nombre text)
language sql stable security definer set search_path = public as
$$
  select p.id, p.nombre, o.nombre as organizacion_nombre
  from public.perfiles p
  join auth.users u on u.id = p.id
  left join public.organizaciones o on o.id = p.organizacion_id
  where lower(u.email) = lower(trim(p_email)) and p.activo
$$;

create or replace function public.relacionado_por_comparticion(p_perfil uuid) returns boolean
  language sql stable security definer set search_path = public as
$$
  select exists(
    select 1 from public.estudios_compartidos c
    join public.estudios e on e.id = c.estudio_id
    where (c.perfil_id = auth.uid() and e.creado_por = p_perfil)
       or (e.creado_por = auth.uid() and c.perfil_id = p_perfil)
  )
$$;

grant execute on function public.buscar_organizacion_por_codigo(text) to anon, authenticated;
grant execute on function public.generar_codigo_organizacion()        to authenticated;
grant execute on function public.regenerar_codigo_organizacion()      to authenticated;
grant execute on function public.buscar_perfil_por_email(text)        to authenticated;
grant execute on function public.relacionado_por_comparticion(uuid)   to authenticated;


-- ============================================================================
--  SECCIÓN 4 — ALTA DE USUARIOS
--  El ROL nunca lo manda el formulario: lo decide el servidor mirando si de
--  verdad eres la primera persona de esa organización.
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

  -- Toda organización nueva nace con su fila de configuración maestra. Antes
  -- podía no tenerla y el guardado "actualizaba" cero filas en silencio.
  insert into public.configuracion_maestra (organizacion_id)
  values (v_org)
  on conflict (organizacion_id) do nothing;

  return new;
end $$;

drop trigger if exists trg_crear_perfil on auth.users;
create trigger trg_crear_perfil
  after insert on auth.users
  for each row execute function public.crear_perfil_nuevo_usuario();

-- Rellena la configuración maestra de las organizaciones que ya existían.
insert into public.configuracion_maestra (organizacion_id)
select id from public.organizaciones
on conflict (organizacion_id) do nothing;


-- ============================================================================
--  SECCIÓN 5 — DESACTIVAR PERSONAS
--  Sustituye a "eliminar empleado". Borrar de verdad exige la clave
--  service_role (imposible desde el navegador) y rompe `creado_por`.
-- ============================================================================

create or replace function public.desactivar_perfil(
  p_perfil uuid,
  p_reasignar_a uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_rol text;
  v_admins_restantes int;
begin
  if not public.soy_admin() then
    raise exception 'Solo Dirección puede desactivar a alguien del equipo.';
  end if;
  if p_perfil = auth.uid() then
    raise exception 'No puedes desactivarte a ti mismo.';
  end if;

  select organizacion_id, rol into v_org, v_rol
  from public.perfiles where id = p_perfil;

  if v_org is null or v_org <> public.mi_org() then
    raise exception 'Esa persona no pertenece a tu empresa.';
  end if;

  -- Nunca dejar una empresa sin nadie que pueda configurarla.
  if v_rol = 'admin' then
    select count(*) into v_admins_restantes
    from public.perfiles
    where organizacion_id = v_org and rol = 'admin' and activo and id <> p_perfil;
    if v_admins_restantes = 0 then
      raise exception 'Es la única persona de Dirección que queda activa. Asciende a otra antes de desactivarla.';
    end if;
  end if;

  -- Reasignar sus estudios, si se ha indicado a quién.
  if p_reasignar_a is not null then
    if not exists (select 1 from public.perfiles
                   where id = p_reasignar_a and organizacion_id = v_org and activo) then
      raise exception 'La persona a la que quieres reasignar los estudios no está activa en tu empresa.';
    end if;
    update public.estudios
      set creado_por = p_reasignar_a
      where creado_por = p_perfil and organizacion_id = v_org and eliminado_at is null;
  end if;

  update public.perfiles
    set activo = false, desactivado_at = now(), desactivado_por = auth.uid()
    where id = p_perfil;
end $$;

create or replace function public.reactivar_perfil(p_perfil uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.soy_admin() then
    raise exception 'Solo Dirección puede reactivar a alguien del equipo.';
  end if;
  update public.perfiles
    set activo = true, desactivado_at = null, desactivado_por = null
    where id = p_perfil and organizacion_id = public.mi_org();
end $$;

grant execute on function public.desactivar_perfil(uuid, uuid) to authenticated;
grant execute on function public.reactivar_perfil(uuid)        to authenticated;


-- ============================================================================
--  SECCIÓN 6 — PAPELERA DE ESTUDIOS
-- ============================================================================

create or replace function public.enviar_estudio_a_papelera(p_estudio uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.mando_en_estudio(p_estudio) then
    raise exception 'No tienes permiso para eliminar este estudio.';
  end if;
  update public.estudios
    set eliminado_at = now(), eliminado_por = auth.uid()
    where id = p_estudio and eliminado_at is null;
end $$;

create or replace function public.restaurar_estudio(p_estudio uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.mando_en_estudio(p_estudio) then
    raise exception 'No tienes permiso para restaurar este estudio.';
  end if;
  update public.estudios
    set eliminado_at = null, eliminado_por = null
    where id = p_estudio;
end $$;

grant execute on function public.enviar_estudio_a_papelera(uuid) to authenticated;
grant execute on function public.restaurar_estudio(uuid)         to authenticated;


-- ============================================================================
--  SECCIÓN 7 — SEGURIDAD (RLS)
--  Esto es lo único que impide que una organización lea los datos de otra. La
--  clave "anon" va escrita en el HTML: es pública por diseño y no protege nada.
-- ============================================================================

alter table public.organizaciones       enable row level security;
alter table public.perfiles             enable row level security;
alter table public.plataforma_admins    enable row level security;
alter table public.estudios             enable row level security;
alter table public.historial_versiones  enable row level security;
alter table public.estudios_compartidos enable row level security;
alter table public.plantillas           enable row level security;
alter table public.configuracion_maestra enable row level security;
alter table public.logs_errores         enable row level security;

-- --- ORGANIZACIONES ---------------------------------------------------------
drop policy if exists organizaciones_select on public.organizaciones;
create policy organizaciones_select on public.organizaciones for select
  using (id = public.mi_org() or public.soy_plataforma());

drop policy if exists organizaciones_update on public.organizaciones;
create policy organizaciones_update on public.organizaciones for update
  using (id = public.mi_org() and public.soy_admin());

-- --- PERFILES ---------------------------------------------------------------
drop policy if exists perfiles_select on public.perfiles;
create policy perfiles_select on public.perfiles for select
  using (
    id = auth.uid()
    or organizacion_id = public.mi_org()
    or public.relacionado_por_comparticion(id)
  );

-- Cada quien edita su propio perfil; Dirección edita el de su equipo. El
-- campo `activo` NO se toca por aquí: solo a través de desactivar_perfil(),
-- que comprueba que no se quede la empresa sin administrador.
drop policy if exists perfiles_update on public.perfiles;
create policy perfiles_update on public.perfiles for update
  using (id = auth.uid() or (public.soy_admin() and organizacion_id = public.mi_org()));

-- --- PLATAFORMA -------------------------------------------------------------
-- Solo se puede consultar si uno mismo está en la lista. Nadie se añade solo:
-- las altas se hacen desde el editor SQL de Supabase.
drop policy if exists plataforma_select on public.plataforma_admins;
create policy plataforma_select on public.plataforma_admins for select
  using (perfil_id = auth.uid());

-- --- ESTUDIOS ---------------------------------------------------------------
-- Lo que está en la papelera solo lo ve quien manda en el estudio.
drop policy if exists estudios_select on public.estudios;
create policy estudios_select on public.estudios for select
  using (
    (
      (organizacion_id = public.mi_org() and (creado_por = auth.uid() or public.soy_admin()))
      or (eliminado_at is null and public.compartido_conmigo(id))
    )
  );

drop policy if exists estudios_insert on public.estudios;
create policy estudios_insert on public.estudios for insert
  with check (creado_por = auth.uid()
              and organizacion_id = public.mi_org()
              and public.estoy_activo());

drop policy if exists estudios_update on public.estudios;
create policy estudios_update on public.estudios for update
  using (organizacion_id = public.mi_org()
         and (creado_por = auth.uid() or public.soy_admin())
         and public.estoy_activo());

-- El borrado en duro deja de estar disponible desde la aplicación: se pasa por
-- enviar_estudio_a_papelera(). La limpieza definitiva la hace la sección 8.
drop policy if exists estudios_delete on public.estudios;

-- --- HISTORIAL --------------------------------------------------------------
drop policy if exists historial_select on public.historial_versiones;
create policy historial_select on public.historial_versiones for select
  using (public.puedo_ver_estudio(estudio_id));

drop policy if exists historial_insert on public.historial_versiones;
create policy historial_insert on public.historial_versiones for insert
  with check (guardado_por = auth.uid() and public.puedo_ver_estudio(estudio_id));

-- --- COMPARTIDOS ------------------------------------------------------------
drop policy if exists compartidos_select on public.estudios_compartidos;
create policy compartidos_select on public.estudios_compartidos for select
  using (perfil_id = auth.uid() or public.mando_en_estudio(estudio_id));

drop policy if exists compartidos_insert on public.estudios_compartidos;
create policy compartidos_insert on public.estudios_compartidos for insert
  with check (public.mando_en_estudio(estudio_id) and public.estoy_activo());

drop policy if exists compartidos_delete on public.estudios_compartidos;
create policy compartidos_delete on public.estudios_compartidos for delete
  using (public.mando_en_estudio(estudio_id));

-- Cada destinatario marca SU propia fila como vista o descartada.
drop policy if exists compartidos_update_propio on public.estudios_compartidos;
create policy compartidos_update_propio on public.estudios_compartidos for update
  using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());

-- --- PLANTILLAS -------------------------------------------------------------
drop policy if exists plantillas_select on public.plantillas;
create policy plantillas_select on public.plantillas for select
  using (organizacion_id = public.mi_org());

drop policy if exists plantillas_write on public.plantillas;
create policy plantillas_write on public.plantillas for all
  using (organizacion_id = public.mi_org() and public.soy_admin())
  with check (organizacion_id = public.mi_org() and public.soy_admin());

-- --- CONFIGURACIÓN MAESTRA --------------------------------------------------
drop policy if exists config_select on public.configuracion_maestra;
create policy config_select on public.configuracion_maestra for select
  using (organizacion_id = public.mi_org());

drop policy if exists config_update on public.configuracion_maestra;
create policy config_update on public.configuracion_maestra for update
  using (organizacion_id = public.mi_org() and public.soy_admin());

-- El código hace upsert, así que hace falta también la de inserción. Sin ella,
-- una organización sin fila previa fallaba al guardar.
drop policy if exists config_insert on public.configuracion_maestra;
create policy config_insert on public.configuracion_maestra for insert
  with check (organizacion_id = public.mi_org() and public.soy_admin());

-- --- LOGS DE ERRORES --------------------------------------------------------
-- Insertar: cualquiera con sesión, pero solo errores a su propio nombre.
drop policy if exists logs_insert on public.logs_errores;
create policy logs_insert on public.logs_errores for insert
  with check (usuario_id = auth.uid());

-- Leer: Dirección ve los de su empresa; el dueño de la plataforma, todos.
drop policy if exists logs_select on public.logs_errores;
create policy logs_select on public.logs_errores for select
  using (public.soy_plataforma()
         or (organizacion_id = public.mi_org() and public.soy_admin()));

-- Cambiar el estado (resuelto, ignorado): solo el dueño de la plataforma.
drop policy if exists logs_update on public.logs_errores;
create policy logs_update on public.logs_errores for update
  using (public.soy_plataforma());


-- ============================================================================
--  SECCIÓN 8 — LIMPIEZA Y RETENCIÓN
--  Sin esto, historial_versiones y logs_errores crecen sin techo. El historial
--  además guarda el `state` entero, y dentro va el logo en base64: un estudio
--  guardado cincuenta veces son cincuenta copias de la misma imagen.
--
--  Para programarlas: Supabase -> Database -> Cron (extensión pg_cron), o una
--  llamada diaria desde una Edge Function.
-- ============================================================================

-- Conserva las 15 versiones más recientes de cada estudio, más una por día
-- del resto. Un estudio muy trabajado deja de ocupar cientos de copias.
create or replace function public.limpiar_historial_versiones()
returns integer language plpgsql security definer set search_path = public as $$
declare v_borradas integer;
begin
  with ordenadas as (
    select id, estudio_id, created_at,
           row_number() over (partition by estudio_id order by created_at desc) as pos,
           row_number() over (partition by estudio_id, date_trunc('day', created_at)
                              order by created_at desc) as pos_dia
    from public.historial_versiones
  )
  delete from public.historial_versiones h
  using ordenadas o
  where h.id = o.id and o.pos > 15 and o.pos_dia > 1;
  get diagnostics v_borradas = row_count;
  return v_borradas;
end $$;

-- Errores de más de 90 días.
create or replace function public.limpiar_logs_errores()
returns integer language plpgsql security definer set search_path = public as $$
declare v_borradas integer;
begin
  delete from public.logs_errores where created_at < now() - interval '90 days';
  get diagnostics v_borradas = row_count;
  return v_borradas;
end $$;

-- Papelera de más de 30 días: aquí sí se borra de verdad, con su historial.
create or replace function public.vaciar_papelera_antigua()
returns integer language plpgsql security definer set search_path = public as $$
declare v_borrados integer;
begin
  delete from public.estudios
  where eliminado_at is not null and eliminado_at < now() - interval '30 days';
  get diagnostics v_borrados = row_count;
  return v_borrados;
end $$;


-- ============================================================================
--  SECCIÓN 9 — TIEMPO REAL
-- ============================================================================

do $$
begin
  begin
    alter publication supabase_realtime add table public.estudios;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.configuracion_maestra;
  exception when duplicate_object then null;
  end;
end $$;


-- ============================================================================
--  SECCIÓN 10 — DESPUÉS DE EJECUTAR ESTO
-- ----------------------------------------------------------------------------
--  1) Date de alta como dueño de la plataforma (cambia el correo por el tuyo):
--
--     insert into public.plataforma_admins (perfil_id, nota)
--     select id, 'Dueño del producto' from auth.users
--     where email = 'tu-correo@ejemplo.com'
--     on conflict (perfil_id) do nothing;
--
--  2) Comprueba que el registro de errores funciona de verdad. Si esta
--     consulta devuelve 0 después de haber usado la app un rato, el logger
--     está fallando en silencio:
--
--     select app, count(*), max(created_at) from public.logs_errores group by app;
--
--  3) Los errores agrupados, que es como conviene mirarlos (y no los últimos
--     veinte, que son veinte veces el mismo):
--
--     select huella, app, contexto, min(mensaje) as mensaje,
--            count(*) as veces,
--            count(distinct usuario_id) as personas,
--            count(distinct organizacion_id) as empresas,
--            min(created_at) as primera, max(created_at) as ultima
--     from public.logs_errores
--     where estado = 'nuevo'
--     group by huella, app, contexto
--     order by ultima desc;
--
--  4) Programa las tres funciones de limpieza de la sección 8 (pg_cron):
--
--     select cron.schedule('limpiar-historial', '0 3 * * *',
--            $$select public.limpiar_historial_versiones()$$);
--     select cron.schedule('limpiar-logs', '15 3 * * *',
--            $$select public.limpiar_logs_errores()$$);
--     select cron.schedule('vaciar-papelera', '30 3 * * *',
--            $$select public.vaciar_papelera_antigua()$$);
-- ============================================================================
