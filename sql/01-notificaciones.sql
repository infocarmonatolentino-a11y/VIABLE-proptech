-- ============================================================================
--  VIABLE — 01. NOTIFICACIONES, PREFERENCIAS DE AVISO Y ERRORES AGRUPADOS
-- ----------------------------------------------------------------------------
--  Segunda migración. Se ejecuta DESPUÉS de 00-esquema-completo.sql, sobre el
--  mismo proyecto. Como el anterior, es idempotente: se puede volver a lanzar
--  sin romper nada.
--
--  QUÉ TRAE
--    · Notificaciones dentro de la app (la campanita del panel).
--    · Preferencias de aviso por correo, con las tres opciones de la hoja de
--      ruta: al momento, resumen diario, nunca.
--    · Dos disparadores: al compartir un estudio, y al abrirlo por primera vez
--      quien lo recibió (para que el remitente sepa que lo han visto).
--    · Las funciones que agrupan logs_errores por huella, que es lo que
--      alimenta la pantalla de errores del dueño de la plataforma.
--
--  LO QUE ESTO NO HACE
--    El envío del correo en sí vive fuera de la base de datos, en una Edge
--    Function (carpeta supabase/functions/ de la app). Aquí solo se prepara el
--    terreno: la fila de notificaciones y la preferencia de la persona. El
--    Database Webhook que conecta una cosa con la otra se configura a mano en
--    el panel de Supabase — instrucciones en supabase/README.md.
-- ============================================================================


-- ============================================================================
--  SECCIÓN 1 — NOTIFICACIONES DENTRO DE LA APP
-- ============================================================================

create table if not exists public.notificaciones(
  id          uuid primary key default gen_random_uuid(),
  perfil_id   uuid not null references public.perfiles(id) on delete cascade,
  tipo        text not null,                -- 'estudio_compartido' | 'estudio_visto'
  titulo      text not null,
  cuerpo      text,
  estudio_id  uuid references public.estudios(id) on delete cascade,
  leida       boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists ix_notif_perfil on public.notificaciones(perfil_id, created_at desc);
create index if not exists ix_notif_no_leidas on public.notificaciones(perfil_id) where not leida;

alter table public.notificaciones enable row level security;

-- Cada quien ve y marca como leídas las suyas, nada más. Las inserciones NO
-- tienen política para "authenticated": solo las crean los disparadores de
-- abajo, que corren con permisos de servidor (security definer) y no dependen
-- de que el remitente tenga permiso de escritura sobre la tabla.
drop policy if exists notif_select on public.notificaciones;
create policy notif_select on public.notificaciones for select
  using (perfil_id = auth.uid());

drop policy if exists notif_update on public.notificaciones;
create policy notif_update on public.notificaciones for update
  using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());

-- ============================================================================
--  SECCIÓN 2 — PREFERENCIAS DE AVISO POR CORREO
--  Gobiernan SOLO el canal de correo. El aviso dentro de la app de la sección
--  1 aparece siempre, decida lo que decida cada persona aquí: apagar el correo
--  no debe dejar a nadie sin enterarse dentro de la propia herramienta.
-- ============================================================================

create table if not exists public.preferencias_notificacion(
  perfil_id   uuid not null references public.perfiles(id) on delete cascade,
  tipo        text not null default 'estudio_compartido',
  modo        text not null default 'inmediato',
  updated_at  timestamptz not null default now(),
  primary key (perfil_id, tipo)
);

alter table public.preferencias_notificacion drop constraint if exists preferencias_notificacion_modo_check;
alter table public.preferencias_notificacion add constraint preferencias_notificacion_modo_check
  check (modo in ('inmediato','resumen_diario','nunca'));

alter table public.preferencias_notificacion enable row level security;

drop policy if exists prefs_notif_rw on public.preferencias_notificacion;
create policy prefs_notif_rw on public.preferencias_notificacion for all
  using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());

-- Preferencia efectiva de una persona para un tipo de aviso. Sin fila propia,
-- el valor por defecto es "inmediato": alguien que nunca ha tocado sus
-- preferencias sigue recibiendo el correo, que es lo que espera.
create or replace function public.preferencia_notificacion(p_perfil uuid, p_tipo text)
returns text language sql stable security definer set search_path = public as
$$ select coalesce(
     (select modo from public.preferencias_notificacion where perfil_id = p_perfil and tipo = p_tipo),
     'inmediato'
   ) $$;

grant execute on function public.preferencia_notificacion(uuid, text) to authenticated;


-- ============================================================================
--  SECCIÓN 3 — DISPARADORES
-- ============================================================================

-- 3.1 Al compartir un estudio: aviso dentro de la app para quien lo recibe.
--     El correo (si su preferencia lo permite) lo manda la Edge Function que
--     escucha el mismo evento a través del Database Webhook.
create or replace function public.notificar_estudio_compartido()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_estudio  record;
  v_remitente text;
begin
  select nombre, ubicacion into v_estudio from public.estudios where id = new.estudio_id;
  select nombre into v_remitente from public.perfiles where id = auth.uid();

  insert into public.notificaciones (perfil_id, tipo, titulo, cuerpo, estudio_id)
  values (
    new.perfil_id,
    'estudio_compartido',
    coalesce(v_remitente, 'Alguien de tu red') || ' te ha compartido un estudio',
    v_estudio.nombre || case when nullif(v_estudio.ubicacion,'') is not null then ' — ' || v_estudio.ubicacion else '' end,
    new.estudio_id
  );
  return new;
end $$;

drop trigger if exists trg_notificar_estudio_compartido on public.estudios_compartidos;
create trigger trg_notificar_estudio_compartido
  after insert on public.estudios_compartidos
  for each row execute function public.notificar_estudio_compartido();

-- 3.2 Al abrir por primera vez un estudio compartido: aviso para quien lo mandó.
--     Es justo lo que pedías con "así también saben cuando le enviaron
--     estudio para analizar", visto desde el otro lado: además de saber que
--     ha llegado, el remitente sabe cuándo lo han abierto.
create or replace function public.notificar_estudio_visto()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_estudio record;
  v_lector  text;
begin
  if new.estado = 'visto' and old.estado is distinct from 'visto' then
    select nombre, creado_por into v_estudio from public.estudios where id = new.estudio_id;
    select nombre into v_lector from public.perfiles where id = new.perfil_id;

    if v_estudio.creado_por is not null and v_estudio.creado_por <> new.perfil_id then
      insert into public.notificaciones (perfil_id, tipo, titulo, cuerpo, estudio_id)
      values (
        v_estudio.creado_por,
        'estudio_visto',
        coalesce(v_lector, 'Alguien') || ' ha abierto tu estudio',
        v_estudio.nombre,
        new.estudio_id
      );
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_notificar_estudio_visto on public.estudios_compartidos;
create trigger trg_notificar_estudio_visto
  after update on public.estudios_compartidos
  for each row execute function public.notificar_estudio_visto();


-- ============================================================================
--  SECCIÓN 4 — ERRORES AGRUPADOS POR HUELLA
--  "Los últimos 20 errores" (tu consulta de partida) enseña veinte veces el
--  mismo fallo. Esto agrupa por huella y ordena por lo que de verdad importa:
--  cuántas personas y cuántas empresas ha tocado, y cuándo fue la última vez.
-- ============================================================================

create or replace function public.logs_agrupados(
  p_app    text default null,
  p_estado text default null,
  p_dias   int  default 30
) returns table(
  huella   text, app text, contexto text, mensaje text,
  veces    bigint, personas bigint, empresas bigint,
  primera  timestamptz, ultima timestamptz, estado text
)
language sql stable security definer set search_path = public as
$$
  with filtrado as (
    select l.*
    from public.logs_errores l
    where (public.soy_plataforma() or (l.organizacion_id = public.mi_org() and public.soy_admin()))
      and (p_app is null or l.app = p_app)
      and l.created_at >= now() - (p_dias || ' days')::interval
  ),
  agregado as (
    select huella, app, contexto,
           min(mensaje)                     as mensaje,
           count(*)                         as veces,
           count(distinct usuario_id)       as personas,
           count(distinct organizacion_id)  as empresas,
           min(created_at)                  as primera,
           max(created_at)                  as ultima
    from filtrado
    group by huella, app, contexto
  ),
  estados as (
    -- El estado que se enseña es el de la ocurrencia más reciente de cada
    -- huella, no un agregado: si ya se marcó "resuelto" y ha vuelto a pasar,
    -- lo correcto es que vuelva a aparecer como pendiente.
    select distinct on (huella) huella, estado
    from filtrado
    order by huella, created_at desc
  )
  select a.huella, a.app, a.contexto, a.mensaje, a.veces, a.personas, a.empresas,
         a.primera, a.ultima, e.estado
  from agregado a
  join estados e using (huella)
  where (p_estado is null or e.estado = p_estado)
  order by a.ultima desc
$$;

grant execute on function public.logs_agrupados(text, text, int) to authenticated;

-- Las últimas ocurrencias de una huella concreta, para el detalle del grupo.
create or replace function public.logs_detalle(p_huella text, p_limite int default 20)
returns setof public.logs_errores
language sql stable security definer set search_path = public as
$$
  select l.*
  from public.logs_errores l
  where l.huella = p_huella
    and (public.soy_plataforma() or (l.organizacion_id = public.mi_org() and public.soy_admin()))
  order by l.created_at desc
  limit p_limite
$$;

grant execute on function public.logs_detalle(text, int) to authenticated;


-- ============================================================================
--  SECCIÓN 5 — LIMPIEZA
-- ============================================================================

-- Las leídas, a los 30 días. Las no leídas se dejan más margen (180 días):
-- alguien que no entra en un mes no debería perder el aviso antes de verlo.
create or replace function public.limpiar_notificaciones()
returns integer language plpgsql security definer set search_path = public as $$
declare v_borradas integer;
begin
  delete from public.notificaciones
  where (leida and created_at < now() - interval '30 days')
     or (not leida and created_at < now() - interval '180 days');
  get diagnostics v_borradas = row_count;
  return v_borradas;
end $$;


-- ============================================================================
--  SECCIÓN 6 — TIEMPO REAL
--  Para que la campanita se actualice sola sin que nadie recargue la página.
-- ============================================================================

do $$
begin
  begin
    alter publication supabase_realtime add table public.notificaciones;
  exception when duplicate_object then null;
  end;
end $$;


-- ============================================================================
--  SECCIÓN 7 — DESPUÉS DE EJECUTAR ESTO
-- ----------------------------------------------------------------------------
--  1) La pantalla de errores y las notificaciones ya funcionan por completo
--     dentro de la app en cuanto subas el código nuevo. No hace falta nada
--     más para eso.
--
--  2) El AVISO POR CORREO necesita, aparte de este SQL:
--       · Una cuenta en Resend (o Postmark) y el dominio verificado con sus
--         registros SPF, DKIM y DMARC. Sin esto, los correos acaban en spam.
--       · Desplegar las dos Edge Functions de supabase/functions/.
--       · Un Database Webhook en Supabase, tabla estudios_compartidos,
--         evento INSERT, apuntando a la función notificar-por-email.
--     Todo esto viene explicado paso a paso en supabase/README.md — son
--     pasos que solo se pueden hacer desde el panel de Supabase y de Resend,
--     no desde este script.
--
--  3) Para probar la agrupación de errores sin esperar a que ocurra uno de
--     verdad:
--
--     insert into public.logs_errores (usuario_id, organizacion_id, app, contexto, mensaje)
--     select id, organizacion_id, 'dashboard', 'prueba manual', 'Esto es una prueba'
--     from public.perfiles where id = auth.uid();
--
--     select * from public.logs_agrupados(null, null, 30);
-- ============================================================================
