-- ============================================================================
--  MULTI-EMPRESA: cada organización, sus propios datos
-- ----------------------------------------------------------------------------
--  Pega esto entero en Supabase → SQL Editor → Run. Es idempotente: se puede
--  ejecutar varias veces sin romper nada, e incluye a tu empresa actual
--  (Grupo Promotor Costa Llevant), que sigue funcionando exactamente igual.
--
--  QUÉ CAMBIA
--  Hasta ahora, todo el que se registraba entraba en la MISMA organización,
--  fijada a mano en js/supabase-config.js (ORGANIZACION_UNICA_ID). Con esto:
--
--  - Al registrarse, cada persona elige: "Crear una empresa nueva" (se
--    convierte en su Dirección) o "Unirme con un código" (el código que le
--    pase quien ya la creó).
--  - Cada organización tiene un código de invitación de 6 caracteres,
--    generado solo, que Dirección puede ver y regenerar desde
--    "Configuración maestra".
--  - El ROL nunca lo decide el formulario, ni siquiera indirectamente: lo
--    decide el servidor mirando si eres la PRIMERA persona en entrar en esa
--    organización. Así, aunque alguien manipule la petición de alta a mano,
--    no puede auto-nombrarse Dirección de una empresa que ya tiene gente.
--  - Cada organización solo ve sus propios estudios, plantillas y
--    configuración — eso ya lo hacían las políticas RLS existentes
--    (todas comparan contra `organizacion_id = public.mi_org()`); lo único
--    que faltaba era que hubiera más de una organización real donde probarlo.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Tabla `organizaciones`: nombre + código de invitación
-- ----------------------------------------------------------------------------

create table if not exists public.organizaciones(
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  created_at timestamptz not null default now()
);
alter table public.organizaciones add column if not exists codigo text;

-- ----------------------------------------------------------------------------
-- 2. Generador de código (6 caracteres, sin 0/O/1/I para que no se
--    confundan al copiarlo o dictarlo por teléfono). security definer para
--    que la comprobación de "no repetido" vea TODAS las organizaciones,
--    incluso durante el alta de alguien que todavía no tiene perfil propio.
-- ----------------------------------------------------------------------------

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

-- Tu empresa actual, con código si todavía no tenía (no toca nada si ya lo tenía)
update public.organizaciones set codigo = public.generar_codigo_organizacion()
where codigo is null;

alter table public.organizaciones alter column codigo set not null;
alter table public.organizaciones drop constraint if exists organizaciones_codigo_key;
alter table public.organizaciones add constraint organizaciones_codigo_key unique (codigo);

-- ----------------------------------------------------------------------------
-- 3. Buscar una organización por su código, ANTES de tener cuenta
--    (se llama desde el formulario de alta, con el usuario todavía anónimo).
-- ----------------------------------------------------------------------------

create or replace function public.buscar_organizacion_por_codigo(p_codigo text)
returns table(id uuid, nombre text)
language sql stable security definer set search_path = public as
$$ select id, nombre from public.organizaciones where codigo = upper(trim(p_codigo)) $$;

grant execute on function public.buscar_organizacion_por_codigo(text) to anon, authenticated;
grant execute on function public.generar_codigo_organizacion() to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Regenerar el código (solo Dirección, solo de su propia organización)
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- 5. El alta ya no mete a todo el mundo en la misma organización
--    Sustituye a la versión de la sección 3 del script anterior.
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
    -- "Unirme con un código": el rol NUNCA se toma de lo que mande el
    -- formulario — se decide aquí, mirando si de verdad eres la primera
    -- persona de esa organización. Así no hay forma de auto-nombrarse
    -- Dirección de una empresa ajena manipulando la petición de alta.
    select not exists(select 1 from public.perfiles where organizacion_id = v_org) into v_es_primero;
    v_rol := case when v_es_primero then 'admin' else 'editor' end;
  end if;

  insert into public.perfiles (id, nombre, rol, organizacion_id)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', 'Usuario'), v_rol, v_org)
  on conflict (id) do nothing;
  return new;
end $$;

-- (el trigger trg_crear_perfil ya apunta a esta función — no hay que tocarlo)

-- ----------------------------------------------------------------------------
-- 6. RLS de `organizaciones`
--    Cada persona solo ve el nombre/código de SU PROPIA organización — nunca
--    la lista entera. Buscar por código pasa por la función de arriba
--    (security definer), no por esta política.
-- ----------------------------------------------------------------------------

alter table public.organizaciones enable row level security;

drop policy if exists organizaciones_select on public.organizaciones;
create policy organizaciones_select on public.organizaciones for select
  using (id = public.mi_org());

drop policy if exists organizaciones_update on public.organizaciones;
create policy organizaciones_update on public.organizaciones for update
  using (id = public.mi_org() and public.soy_admin());

-- ----------------------------------------------------------------------------
-- 7. Comprobación rápida
-- ----------------------------------------------------------------------------
-- select nombre, codigo from public.organizaciones;   -- debe verse tu empresa, con código
