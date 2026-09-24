-- ============================================================================
--  COMPARTIR ENTRE ORGANIZACIONES (brókeres / family offices / promotoras)
-- ----------------------------------------------------------------------------
--  Idempotente: se puede ejecutar varias veces sin romper nada.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Arreglo de seguridad previo (imprescindible antes de abrir nada):
--    mando_en_estudio() no comprobaba que el estudio fuera de TU organización.
--    Hoy es inofensivo porque estudios_select exige igualmente pertenecer a la
--    misma organización -- pero en cuanto esa exigencia se relaje (paso 2),
--    esto pasaría de ser un fallo latente a uno explotable: cualquier admin de
--    cualquier organización podría regalar acceso a estudios ajenos.
-- ----------------------------------------------------------------------------
create or replace function public.mando_en_estudio(p_estudio uuid) returns boolean
  language sql stable security definer set search_path = public as
  $$ select exists (select 1 from public.estudios e
                    where e.id = p_estudio
                      and e.organizacion_id = public.mi_org()
                      and (e.creado_por = auth.uid() or public.soy_admin())) $$;

-- ----------------------------------------------------------------------------
-- 2. estudios_select / puedo_ver_estudio: que "compartido conmigo" baste por
--    sí solo, sin exigir pertenecer a la misma organización que el estudio.
--    El resto de vías (ser el creador, ser admin) SIGUEN exigiendo tu propia
--    organización -- solo se abre la puerta para la compartición explícita.
-- ----------------------------------------------------------------------------
drop policy if exists estudios_select on public.estudios;
create policy estudios_select on public.estudios for select
  using (
    (organizacion_id = public.mi_org() and (creado_por = auth.uid() or public.soy_admin()))
    or public.compartido_conmigo(id)
  );

create or replace function public.puedo_ver_estudio(p_estudio uuid) returns boolean
  language sql stable security definer set search_path = public as
  $$ select exists (select 1 from public.estudios e
                    where e.id = p_estudio
                      and (
                        (e.organizacion_id = public.mi_org() and (e.creado_por = auth.uid() or public.soy_admin()))
                        or public.compartido_conmigo(e.id)
                      )) $$;
-- historial_select ya usa puedo_ver_estudio(), así que hereda el arreglo sin tocarla.

-- ----------------------------------------------------------------------------
-- 3. perfiles_select: poder ver el nombre de quien te ha compartido algo (o a
--    quien tú le has compartido algo), aunque sea de otra organización -- sin
--    abrir la tabla entera. "Copia oculta": esto NO deja ver a un tercero sin
--    relación directa (p.ej. Neinor nunca ve el perfil del director de
--    Metrovacesa solo porque ambos recibieron el mismo estudio del bróker).
-- ----------------------------------------------------------------------------
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
grant execute on function public.relacionado_por_comparticion(uuid) to authenticated;

drop policy if exists perfiles_select on public.perfiles;
create policy perfiles_select on public.perfiles for select
  using (
    id = auth.uid()
    or organizacion_id = public.mi_org()
    or public.relacionado_por_comparticion(id)
  );

-- ----------------------------------------------------------------------------
-- 4. Buscar un perfil por email para compartir fuera de tu organización (sin
--    exponer la tabla de perfiles/usuarios entera -- solo confirma una
--    coincidencia exacta, mismo patrón que buscar_organizacion_por_codigo).
-- ----------------------------------------------------------------------------
create or replace function public.buscar_perfil_por_email(p_email text)
returns table(id uuid, nombre text, organizacion_nombre text)
language sql stable security definer set search_path = public as
$$
  select p.id, p.nombre, o.nombre as organizacion_nombre
  from public.perfiles p
  join auth.users u on u.id = p.id
  left join public.organizaciones o on o.id = p.organizacion_id
  where lower(u.email) = lower(trim(p_email))
$$;
grant execute on function public.buscar_perfil_por_email(text) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Trazabilidad de lectura: estado del envío (enviado/visto/descartado).
--    Cada destinatario solo puede tocar SU PROPIA fila.
-- ----------------------------------------------------------------------------
alter table public.estudios_compartidos add column if not exists estado text not null default 'enviado';
alter table public.estudios_compartidos drop constraint if exists estudios_compartidos_estado_check;
alter table public.estudios_compartidos add constraint estudios_compartidos_estado_check
  check (estado in ('enviado','visto','descartado'));

drop policy if exists compartidos_update_propio on public.estudios_compartidos;
create policy compartidos_update_propio on public.estudios_compartidos for update
  using (perfil_id = auth.uid())
  with check (perfil_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 6. Comprobación rápida
-- ----------------------------------------------------------------------------
-- select nombre, organizacion_nombre from public.buscar_perfil_por_email('alguien@ejemplo.com');
