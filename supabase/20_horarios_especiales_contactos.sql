-- =====================================================================
-- 20 · Horarios especiales, contactos con pacientes y citas huérfanas
-- Idempotente.
-- =====================================================================

-- ---------- Tablas ----------
CREATE TABLE IF NOT EXISTS public.horarios_especiales (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profesional_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  fecha          date NOT NULL,
  hora_inicio    time,
  hora_fin       time,
  motivo         varchar,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
     WHERE t.relname = 'horarios_especiales' AND c.contype IN ('u', 'p')
       AND (SELECT array_agg(a.attname::text ORDER BY a.attname) FROM pg_attribute a
             WHERE a.attrelid = t.oid AND a.attnum = ANY (c.conkey)) = ARRAY['fecha', 'profesional_id']
  ) THEN
    ALTER TABLE public.horarios_especiales ADD CONSTRAINT horarios_especiales_profesional_fecha_key UNIQUE (profesional_id, fecha);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'horarios_especiales_rango_chk') THEN
    ALTER TABLE public.horarios_especiales ADD CONSTRAINT horarios_especiales_rango_chk
      CHECK ((hora_inicio IS NULL AND hora_fin IS NULL) OR (hora_inicio IS NOT NULL AND hora_fin IS NOT NULL AND hora_fin > hora_inicio)) NOT VALID;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.contactos_paciente (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id    uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
  tipo           varchar NOT NULL,
  canal          varchar NOT NULL DEFAULT 'WHATSAPP',
  destino        varchar,
  mensaje        text NOT NULL,
  registrado_por uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  metadata       jsonb,
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contactos_paciente_idx ON public.contactos_paciente (paciente_id, created_at DESC);

ALTER TABLE public.horarios_especiales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contactos_paciente  ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.horarios_especiales, public.contactos_paciente FROM anon, authenticated;

-- ---------- Horario de atención de un día ----------
-- Si hay horario especial para la fecha, reemplaza al semanal (sin horas = no atiende ese día).
-- Sin horario especial ni semanal configurado: 09:00 a 19:00 de lunes a sábado.
CREATE OR REPLACE FUNCTION public.tramos_atencion(p_profesional uuid, p_fecha date)
RETURNS TABLE (hora_inicio time, hora_fin time) LANGUAGE sql STABLE AS $$
  SELECT e.hora_inicio, e.hora_fin
    FROM public.horarios_especiales e
   WHERE e.profesional_id = p_profesional AND e.fecha = p_fecha AND e.hora_inicio IS NOT NULL
  UNION ALL
  SELECT h.hora_inicio, h.hora_fin
    FROM public.horarios_atencion h
   WHERE h.profesional_id = p_profesional AND h.dia_semana = extract(isodow FROM p_fecha)::int
     AND NOT EXISTS (SELECT 1 FROM public.horarios_especiales e WHERE e.profesional_id = p_profesional AND e.fecha = p_fecha)
  UNION ALL
  SELECT '09:00'::time, '19:00'::time
   WHERE NOT EXISTS (SELECT 1 FROM public.horarios_especiales e WHERE e.profesional_id = p_profesional AND e.fecha = p_fecha)
     AND NOT EXISTS (SELECT 1 FROM public.horarios_atencion h WHERE h.profesional_id = p_profesional)
     AND extract(isodow FROM p_fecha) < 7;
$$;

-- El profesional tiene horario definido para la fecha (especial o semanal)
CREATE OR REPLACE FUNCTION public.tiene_horario_definido(p_profesional uuid, p_fecha date)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.horarios_especiales WHERE profesional_id = p_profesional AND fecha = p_fecha)
      OR EXISTS (SELECT 1 FROM public.horarios_atencion WHERE profesional_id = p_profesional);
$$;

-- ---------- Validación de citas (considera el horario especial) ----------
CREATE OR REPLACE FUNCTION public.validar_horario_cita(
  p_profesional uuid, p_box uuid, p_inicio timestamptz, p_fin timestamptz, p_sobrecupo boolean
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_local_ini timestamp := p_inicio AT TIME ZONE 'America/Santiago';
  v_local_fin timestamp := p_fin AT TIME ZONE 'America/Santiago';
  v_bloqueo record;
BEGIN
  SELECT tipo, motivo INTO v_bloqueo
    FROM public.bloqueos_agenda
   WHERE tstzrange(inicio, fin) && tstzrange(p_inicio, p_fin)
     AND ((profesional_id IS NULL AND box_id IS NULL)
          OR profesional_id = p_profesional
          OR (p_box IS NOT NULL AND box_id = p_box))
   LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION '%', 'Horario bloqueado (' || CASE v_bloqueo.tipo WHEN 'VACACIONES' THEN 'vacaciones'
      WHEN 'REUNION' THEN 'reunión' WHEN 'MANTENCION' THEN 'mantención' ELSE 'bloqueo' END || '): ' || v_bloqueo.motivo;
  END IF;

  IF p_sobrecupo THEN RETURN; END IF;

  IF public.tiene_horario_definido(p_profesional, v_local_ini::date) THEN
    IF v_local_ini::date <> v_local_fin::date AND v_local_fin::time <> '00:00' THEN
      RAISE EXCEPTION 'La cita no puede pasar de un día a otro.';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.tramos_atencion(p_profesional, v_local_ini::date) t
       WHERE t.hora_inicio <= v_local_ini::time AND t.hora_fin >= v_local_fin::time
    ) THEN
      RAISE EXCEPTION 'El horario está fuera de la jornada de atención del profesional. Usa sobrecupo si corresponde.';
    END IF;
  END IF;
END;
$$;

-- ---------- Horas libres (las usa también proximas_horas) ----------
CREATE OR REPLACE FUNCTION public.horas_disponibles(
  p_profesional uuid, p_fecha date, p_duracion integer, p_box uuid DEFAULT NULL, p_excluir uuid DEFAULT NULL
) RETURNS TABLE (hora text) LANGUAGE sql STABLE AS $$
  WITH candidatos AS (
    SELECT DISTINCT public.hora_chile(p_fecha, s::time) AS ini
      FROM public.tramos_atencion(p_profesional, p_fecha) t,
           generate_series(p_fecha + t.hora_inicio, p_fecha + t.hora_fin - make_interval(mins => p_duracion), interval '15 minutes') s
  )
  SELECT to_char(ini AT TIME ZONE 'America/Santiago', 'HH24:MI')
    FROM candidatos
   WHERE ini >= now()
     AND NOT EXISTS (
       SELECT 1 FROM public.citas c
        WHERE c.estado IN ('AGENDADA', 'CONFIRMADA', 'EN_ESPERA', 'EN_ATENCION') AND NOT c.sobrecupo
          AND (p_excluir IS NULL OR c.id <> p_excluir)
          AND (c.profesional_id = p_profesional OR (p_box IS NOT NULL AND c.box_id = p_box))
          AND tstzrange(c.inicio, c.fin) && tstzrange(ini, ini + make_interval(mins => p_duracion)))
     AND NOT EXISTS (
       SELECT 1 FROM public.bloqueos_agenda b
        WHERE tstzrange(b.inicio, b.fin) && tstzrange(ini, ini + make_interval(mins => p_duracion))
          AND ((b.profesional_id IS NULL AND b.box_id IS NULL) OR b.profesional_id = p_profesional
               OR (p_box IS NOT NULL AND b.box_id = p_box)))
   ORDER BY 1;
$$;

-- ---------- Citas huérfanas ----------
-- Reemplaza las versiones anteriores de la función.
DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = 'citas_huerfanas' LOOP
    EXECUTE format('DROP FUNCTION %s', f);
  END LOOP;
END;
$$;

-- Versiones antiguas creadas fuera del repositorio. La de horas_disponibles con
-- 3 parámetros hace ambigua la llamada desde proximas_horas ("is not unique").
DROP FUNCTION IF EXISTS public.horas_disponibles(uuid, date, integer);
DROP FUNCTION IF EXISTS public.validar_horario_cita(uuid, date, time, time);

CREATE FUNCTION public.citas_huerfanas(p_desde date, p_hasta date)
RETURNS TABLE (cita_id uuid, profesional_id uuid, motivo text) LANGUAGE sql STABLE AS $$
  SELECT x.id, x.profesional_id, x.motivo
    FROM (
      SELECT c.id, c.profesional_id,
             CASE
               WHEN EXISTS (
                 SELECT 1 FROM public.bloqueos_agenda b
                  WHERE tstzrange(b.inicio, b.fin) && tstzrange(c.inicio, c.fin)
                    AND ((b.profesional_id IS NULL AND b.box_id IS NULL) OR b.profesional_id = c.profesional_id
                         OR (c.box_id IS NOT NULL AND b.box_id = c.box_id)))
                 THEN 'Dentro de un bloqueo'
               WHEN NOT p.activo THEN 'Doctor desactivado'
               WHEN bx.id IS NOT NULL AND NOT bx.activo THEN 'Box desactivado'
               WHEN NOT c.sobrecupo
                AND public.tiene_horario_definido(c.profesional_id, (c.inicio AT TIME ZONE 'America/Santiago')::date)
                AND NOT EXISTS (
                  SELECT 1 FROM public.tramos_atencion(c.profesional_id, (c.inicio AT TIME ZONE 'America/Santiago')::date) t
                   WHERE t.hora_inicio <= (c.inicio AT TIME ZONE 'America/Santiago')::time
                     AND t.hora_fin >= (c.fin AT TIME ZONE 'America/Santiago')::time)
                 THEN 'Fuera del horario del doctor'
             END AS motivo
        FROM public.citas c
        JOIN public.perfiles p ON p.id = c.profesional_id
        LEFT JOIN public.boxes bx ON bx.id = c.box_id
       WHERE c.estado IN ('AGENDADA', 'CONFIRMADA')
         AND (c.inicio AT TIME ZONE 'America/Santiago')::date BETWEEN p_desde AND p_hasta
    ) x
   WHERE x.motivo IS NOT NULL;
$$;

-- Ejecución solo para service_role
REVOKE ALL ON FUNCTION public.tramos_atencion(uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tiene_horario_definido(uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.citas_huerfanas(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tramos_atencion(uuid, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.tiene_horario_definido(uuid, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.citas_huerfanas(date, date) TO service_role;
