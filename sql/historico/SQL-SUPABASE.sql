-- ============================================================================
--  VIABLE — Script completo para Supabase
--  Cópialo entero, pégalo en Supabase → SQL Editor → Run. Es idempotente:
--  se puede ejecutar varias veces sin romper nada.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. COLUMNAS QUE FALTABAN
-- ----------------------------------------------------------------------------

-- updated_at: permite avisar cuando dos personas editan el mismo estudio
alter table public.estudios
  add column if not exists updated_at timestamptz not null default now();

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

-- La tabla de plantillas guarda ahora los supuestos completos de la empresa
alter table public.plantillas
  add column if not exists organizacion_id uuid,
  add column if not exists creado_por uuid references public.perfiles(id),
  add column if not exists datos jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now();

-- Si ya tenías filas de prueba sin organización, se las asignamos
update public.plantillas
  set organizacion_id = '00000000-0000-0000-0000-000000000001'
  where organizacion_id is null;


-- ----------------------------------------------------------------------------
-- 2. BORRADOS EN CASCADA
--    Al eliminar un estudio, que se lleve consigo su historial y sus permisos.
-- ----------------------------------------------------------------------------

alter table public.historial_versiones
  drop constraint if exists historial_versiones_estudio_id_fkey;
alter table public.historial_versiones
  add constraint historial_versiones_estudio_id_fkey
    foreign key (estudio_id) references public.estudios(id) on delete cascade;

alter table public.estudios_compartidos
  drop constraint if exists estudios_compartidos_estudio_id_fkey;
alter table public.estudios_compartidos
  add constraint estudios_compartidos_estudio_id_fkey
    foreign key (estudio_id) references public.estudios(id) on delete cascade;

-- No se puede compartir dos veces el mismo estudio con la misma persona
create unique index if not exists ux_compartidos
  on public.estudios_compartidos(estudio_id, perfil_id);

-- Índices para que las listas sigan siendo rápidas con cientos de estudios
create index if not exists ix_estudios_org    on public.estudios(organizacion_id);
create index if not exists ix_estudios_autor  on public.estudios(creado_por);
create index if not exists ix_historial_est   on public.historial_versiones(estudio_id);


-- ----------------------------------------------------------------------------
-- 3. ORGANIZACIONES Y CÓDIGO DE INVITACIÓN
--    Cada empresa que use esto es su propia organización, con su propio
--    código de invitación de 6 caracteres para que se una su equipo.
-- ----------------------------------------------------------------------------

create table if not exists public.organizaciones(
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  created_at timestamptz not null default now()
);
alter table public.organizaciones add column if not exists codigo text;

-- Generador de código: sin 0/O/1/I, para que no se confundan al copiarlo o
-- dictarlo por teléfono. security definer para que la comprobación de "no
-- repetido" vea TODAS las organizaciones, incluso durante el alta de alguien
-- que todavía no tiene perfil propio.
create or replace function public.generar_codigo_organizacion()
returns text language plpgsql security definer set search_path = public as $$
declare
  v_codigo text;
  v_existe boolean;
  v_alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
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

-- Tu empresa original (para que quede consistente con perfiles/estudios que
-- ya la referencian) y código para cualquier fila que aún no tuviera uno.
-- El codigo se genera aquí mismo (no se deja en null): un INSERT ... ON
-- CONFLICT DO NOTHING sigue validando las columnas NOT NULL del valor que
-- intenta insertar ANTES de comprobar el conflicto, así que en una segunda
-- ejecución (con la columna ya NOT NULL por la vez anterior) fallaría igual
-- aunque la fila ya existiera y el insert fuera a descartarse.
insert into public.organizaciones (id, nombre, codigo)
values ('00000000-0000-0000-0000-000000000001', 'Mi empresa', public.generar_codigo_organizacion())
on conflict (id) do nothing;

update public.organizaciones set codigo = public.generar_codigo_organizacion()
where codigo is null;

alter table public.organizaciones alter column codigo set not null;
alter table public.organizaciones drop constraint if exists organizaciones_codigo_key;
alter table public.organizaciones add constraint organizaciones_codigo_key unique (codigo);

-- Buscar una organización por su código ANTES de tener cuenta (se llama desde
-- el formulario de alta, con el usuario todavía anónimo).
create or replace function public.buscar_organizacion_por_codigo(p_codigo text)
returns table(id uuid, nombre text)
language sql stable security definer set search_path = public as
$$ select id, nombre from public.organizaciones where codigo = upper(trim(p_codigo)) $$;

grant execute on function public.buscar_organizacion_por_codigo(text) to anon, authenticated;
grant execute on function public.generar_codigo_organizacion() to authenticated;


-- ----------------------------------------------------------------------------
-- 4. EL ALTA: NI EL ROL NI LA EMPRESA LOS ELIGE A CIEGAS QUIEN SE REGISTRA
--    Antes el formulario de alta mandaba el rol, y todo el mundo entraba en
--    la misma organización fija. Ahora, al registrarse, cada quien elige
--    "crear una empresa nueva" (se convierte en su Dirección) o "unirme con
--    un código" — pero el ROL en sí nunca lo manda el formulario: lo decide
--    el servidor mirando si de verdad eres la primera persona de esa
--    organización, así nadie puede auto-nombrarse Dirección manipulando la
--    petición de alta a mano.
-- ----------------------------------------------------------------------------

create or replace function public.crear_perfil_nuevo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_rol text;
  v_es_primero boolean;
begin
  v_org := (new.raw_user_meta_data->>'organizacion_id')::uuid;

  if v_org is null or not exists (select 1 from public.organizaciones where id = v_org) then
    -- "Crear una empresa nueva" en el formulario, o metadatos sin
    -- organización válida: se crea una organización propia en vez de dejar
    -- a la persona sin ningún sitio donde entrar.
    insert into public.organizaciones(nombre, codigo)
    values (
      coalesce(nullif(trim(new.raw_user_meta_data->>'empresa_nombre'), ''), 'Mi empresa'),
      public.generar_codigo_organizacion()
    )
    returning id into v_org;
    v_rol := 'admin';
  else
    -- "Unirme con un código": se mira si de verdad eres la primera persona
    -- de esa organización — nunca se confía en lo que mande el formulario.
    select not exists(select 1 from public.perfiles where organizacion_id = v_org) into v_es_primero;
    v_rol := case when v_es_primero then 'admin' else 'editor' end;
  end if;

  insert into public.perfiles (id, nombre, rol, organizacion_id)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', 'Usuario'), v_rol, v_org)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists trg_crear_perfil on auth.users;
create trigger trg_crear_perfil
  after insert on auth.users
  for each row execute function public.crear_perfil_nuevo_usuario();

-- Con esto, la primera persona que se registra "creando una empresa nueva"
-- ya es Dirección automáticamente — no hace falta tocar nada a mano. Esta
-- línea solo sirve para ascender a alguien MÁS TARDE, dentro de una empresa
-- que ya tiene gente (cambia el correo por el suyo, quita los -- y ejecútala
-- aparte):
--
-- update public.perfiles set rol = 'admin'
--   where id = (select id from auth.users where email = 'correo@ejemplo.com');


-- ----------------------------------------------------------------------------
-- 5. SEGURIDAD REAL (RLS)
--    Esto es lo único que impide que una organización lea los datos de otra,
--    o que un delegado lea los estudios de otro dentro de la misma empresa.
--    La clave "anon" va escrita en el HTML: es pública por diseño, no protege
--    nada. Lo que protege son estas políticas.
--
--    Las preguntas que cruzan dos tablas ("¿está compartido conmigo?", "¿soy
--    el dueño de este estudio?") van dentro de funciones `security definer`.
--    Si se escribieran directamente en la política, Postgres entraría en bucle
--    (estudios -> estudios_compartidos -> estudios -> ...) y cortaría con
--    "infinite recursion detected in policy", que deja el panel sin funcionar.
-- ----------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Funciones auxiliares (rompen el bucle)
-- ---------------------------------------------------------------------------

create or replace function public.mi_org() returns uuid
  language sql stable security definer set search_path = public as
  $$ select organizacion_id from public.perfiles where id = auth.uid() $$;

create or replace function public.soy_admin() returns boolean
  language sql stable security definer set search_path = public as
  $$ select coalesce((select rol = 'admin' from public.perfiles where id = auth.uid()), false) $$;

-- ¿Este estudio está compartido conmigo?
create or replace function public.compartido_conmigo(p_estudio uuid) returns boolean
  language sql stable security definer set search_path = public as
  $$ select exists (select 1 from public.estudios_compartidos c
                    where c.estudio_id = p_estudio and c.perfil_id = auth.uid()) $$;

-- ¿Soy el creador de este estudio (o Dirección)?
create or replace function public.mando_en_estudio(p_estudio uuid) returns boolean
  language sql stable security definer set search_path = public as
  $$ select exists (select 1 from public.estudios e
                    where e.id = p_estudio
                      and (e.creado_por = auth.uid() or public.soy_admin())) $$;

-- ¿Puedo ver este estudio? (creador, Dirección o compartido conmigo)
create or replace function public.puedo_ver_estudio(p_estudio uuid) returns boolean
  language sql stable security definer set search_path = public as
  $$ select exists (select 1 from public.estudios e
                    where e.id = p_estudio
                      and e.organizacion_id = public.mi_org()
                      and (e.creado_por = auth.uid()
                           or public.soy_admin()
                           or public.compartido_conmigo(e.id))) $$;

grant execute on function public.mi_org(), public.soy_admin(),
  public.compartido_conmigo(uuid), public.mando_en_estudio(uuid),
  public.puedo_ver_estudio(uuid) to authenticated;

-- Regenerar el código de invitación: solo Dirección, solo de su propia
-- organización. Va aquí (y no en la sección 3) porque necesita soy_admin()
-- y mi_org(), definidas justo arriba.
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

grant execute on function public.regenerar_codigo_organizacion() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Políticas corregidas
-- ---------------------------------------------------------------------------

alter table public.perfiles              enable row level security;
alter table public.estudios              enable row level security;
alter table public.historial_versiones   enable row level security;
alter table public.estudios_compartidos  enable row level security;
alter table public.plantillas            enable row level security;
alter table public.configuracion_maestra enable row level security;
alter table public.organizaciones        enable row level security;

-- --- PERFILES: cada uno ve a sus compañeros (hace falta para "Compartir con…")
drop policy if exists perfiles_select on public.perfiles;
create policy perfiles_select on public.perfiles for select
  using (id = auth.uid() or organizacion_id = public.mi_org());

drop policy if exists perfiles_update on public.perfiles;
create policy perfiles_update on public.perfiles for update
  using (id = auth.uid() or public.soy_admin());

-- --- ORGANIZACIONES: cada quien ve solo el nombre/código de la SUYA — nunca
-- la lista entera. Buscar por código pasa por la función de la sección 3
-- (security definer), no por esta política.
drop policy if exists organizaciones_select on public.organizaciones;
create policy organizaciones_select on public.organizaciones for select
  using (id = public.mi_org());

drop policy if exists organizaciones_update on public.organizaciones;
create policy organizaciones_update on public.organizaciones for update
  using (id = public.mi_org() and public.soy_admin());

-- --- ESTUDIOS
drop policy if exists estudios_select on public.estudios;
create policy estudios_select on public.estudios for select
  using (organizacion_id = public.mi_org()
         and (creado_por = auth.uid()
              or public.soy_admin()
              or public.compartido_conmigo(id)));

drop policy if exists estudios_insert on public.estudios;
create policy estudios_insert on public.estudios for insert
  with check (creado_por = auth.uid() and organizacion_id = public.mi_org());

drop policy if exists estudios_update on public.estudios;
create policy estudios_update on public.estudios for update
  using (organizacion_id = public.mi_org()
         and (creado_por = auth.uid() or public.soy_admin()));

drop policy if exists estudios_delete on public.estudios;
create policy estudios_delete on public.estudios for delete
  using (organizacion_id = public.mi_org()
         and (creado_por = auth.uid() or public.soy_admin()));

-- --- HISTORIAL: quien puede ver el estudio, puede ver su historial
drop policy if exists historial_select on public.historial_versiones;
create policy historial_select on public.historial_versiones for select
  using (public.puedo_ver_estudio(estudio_id));

drop policy if exists historial_insert on public.historial_versiones;
create policy historial_insert on public.historial_versiones for insert
  with check (guardado_por = auth.uid() and public.puedo_ver_estudio(estudio_id));

-- --- COMPARTIDOS: solo el creador del estudio (o Dirección) reparte accesos
drop policy if exists compartidos_select on public.estudios_compartidos;
create policy compartidos_select on public.estudios_compartidos for select
  using (perfil_id = auth.uid() or public.mando_en_estudio(estudio_id));

drop policy if exists compartidos_insert on public.estudios_compartidos;
create policy compartidos_insert on public.estudios_compartidos for insert
  with check (public.mando_en_estudio(estudio_id));

drop policy if exists compartidos_delete on public.estudios_compartidos;
create policy compartidos_delete on public.estudios_compartidos for delete
  using (public.mando_en_estudio(estudio_id));

-- --- PLANTILLAS: todo el equipo las lee, solo Dirección las escribe
drop policy if exists plantillas_select on public.plantillas;
create policy plantillas_select on public.plantillas for select
  using (organizacion_id = public.mi_org());

drop policy if exists plantillas_write on public.plantillas;
create policy plantillas_write on public.plantillas for all
  using (organizacion_id = public.mi_org() and public.soy_admin())
  with check (organizacion_id = public.mi_org() and public.soy_admin());

-- --- CONFIGURACIÓN MAESTRA: todos la leen, solo Dirección la cambia
drop policy if exists config_select on public.configuracion_maestra;
create policy config_select on public.configuracion_maestra for select
  using (organizacion_id = public.mi_org());

drop policy if exists config_update on public.configuracion_maestra;
create policy config_update on public.configuracion_maestra for update
  using (organizacion_id = public.mi_org() and public.soy_admin());

-- ----------------------------------------------------------------------------
-- 6. TIEMPO REAL
--    Para que el panel se actualice solo cuando alguien guarda.
-- ----------------------------------------------------------------------------

alter publication supabase_realtime add table public.estudios;
alter publication supabase_realtime add table public.configuracion_maestra;
-- Si alguna de las dos ya estaba añadida, Postgres dará un aviso: es normal,
-- ejecuta la otra línea por separado y sigue adelante.


-- ----------------------------------------------------------------------------
-- 7. FILA DE CONFIGURACIÓN MAESTRA (por si no existe)
-- ----------------------------------------------------------------------------

insert into public.configuracion_maestra
  (organizacion_id, coste_construccion_min, precio_venta_min, margen_min, tipo_interes, regimen_fiscal)
values
  ('00000000-0000-0000-0000-000000000001', 1200, 3500, 0.18, 0.05, 'ITP')
on conflict (organizacion_id) do nothing;
