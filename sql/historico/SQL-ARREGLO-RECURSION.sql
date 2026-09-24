-- ============================================================================
--  ARREGLO: "infinite recursion detected in policy for relation estudios"
--  (código 42P17)
--
--  Pega esto entero en Supabase → SQL Editor → Run, y recarga el panel.
--  Se puede ejecutar aunque ya hubieras lanzado el script anterior: sustituye
--  las políticas defectuosas por las buenas.
--
--  QUÉ PASABA
--  La política de lectura de `estudios` preguntaba "¿está compartido conmigo?",
--  lo que obliga a leer `estudios_compartidos`; y la política de lectura de
--  `estudios_compartidos` preguntaba "¿soy el dueño de ese estudio?", lo que
--  obliga a leer `estudios` otra vez. Postgres entra en bucle y corta con ese
--  error, así que fallaba todo: la lista, el alta y el guardado.
--
--  LA SOLUCIÓN
--  Las dos preguntas cruzadas pasan a hacerse dentro de funciones
--  `security definer`. Una función así se ejecuta con los permisos de quien la
--  creó, de modo que consulta la tabla sin volver a pasar por las políticas y
--  el bucle desaparece. La regla de negocio es exactamente la misma.
-- ============================================================================

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

-- ---------------------------------------------------------------------------
-- 2. Políticas corregidas
-- ---------------------------------------------------------------------------

alter table public.perfiles              enable row level security;
alter table public.estudios              enable row level security;
alter table public.historial_versiones   enable row level security;
alter table public.estudios_compartidos  enable row level security;
alter table public.plantillas            enable row level security;
alter table public.configuracion_maestra enable row level security;

-- --- PERFILES: cada uno ve a sus compañeros (hace falta para "Compartir con…")
drop policy if exists perfiles_select on public.perfiles;
create policy perfiles_select on public.perfiles for select
  using (id = auth.uid() or organizacion_id = public.mi_org());

drop policy if exists perfiles_update on public.perfiles;
create policy perfiles_update on public.perfiles for update
  using (id = auth.uid() or public.soy_admin());

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

-- ---------------------------------------------------------------------------
-- 3. Comprobación rápida
--    Debe devolver una fila por cada estudio tuyo. Si devuelve el error 42P17,
--    avísame: quedaría alguna política antigua con otro nombre.
-- ---------------------------------------------------------------------------
-- select id, nombre from public.estudios;
