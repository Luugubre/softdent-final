-- =====================================================================
-- Agenda clínica v2 (estilo línea de tiempo)
-- Pegar en Supabase → SQL Editor → Run (después de 13_agenda.sql)
--
-- · Nuevo estado EN_ESPERA (paciente llegó, sala de espera) con hora de llegada
-- · Horas de inicio y fin de la atención
-- · Cita asociada a un tratamiento del paciente
-- · Registro de recordatorio enviado
-- · Agendar varios bloques de una vez (todas o ninguna)
-- · Buscar las próximas horas libres entre todos los dentistas
-- =====================================================================

-- 1. Columnas nuevas ----------------------------------------------------
ALTER TABLE public.citas ADD COLUMN IF NOT EXISTS hora_llegada          timestamptz;
ALTER TABLE public.citas ADD COLUMN IF NOT EXISTS hora_inicio_atencion  timestamptz;
ALTER TABLE public.citas ADD COLUMN IF NOT EXISTS hora_fin_atencion     timestamptz;
ALTER TABLE public.citas ADD COLUMN IF NOT EXISTS recordatorio_enviado_en timestamptz;
ALTER TABLE public.citas ADD COLUMN IF NOT EXISTS presupuesto_id uuid REFERENCES public.presupuestos(id) ON DELETE SET NULL;

-- 2. Estado EN_ESPERA (hay que rehacer las reglas que listan estados) -----
ALTER TABLE public.citas DROP CONSTRAINT IF EXISTS citas_estado_chk;
ALTER TABLE public.citas ADD CONSTRAINT citas_estado_chk CHECK (estado IN
  ('AGENDADA', 'CONFIRMADA', 'EN_ESPERA', 'EN_ATENCION', 'REALIZADA', 'CANCELADA', 'NO_ASISTIO', 'REAGENDADA'));

ALTER TABLE public.citas DROP CONSTRAINT IF EXISTS citas_sin_choque_profesional;
ALTER TABLE public.citas DROP CONSTRAINT IF EXISTS citas_sin_choque_box;
ALTER TABLE public.citas DROP CONSTRAINT IF EXISTS citas_sin_choque_paciente;

ALTER TABLE public.citas ADD CONSTRAINT citas_sin_choque_profesional EXCLUDE USING gist (
  profesional_id WITH =, tstzrange(inicio, fin) WITH &&
) WHERE (estado IN ('AGENDADA', 'CONFIRMADA', 'EN_ESPERA', 'EN_ATENCION') AND NOT sobrecupo);
ALTER TABLE public.citas ADD CONSTRAINT citas_sin_choque_box EXCLUDE USING gist (
  box_id WITH =, tstzrange(inicio, fin) WITH &&
) WHERE (estado IN ('AGENDADA', 'CONFIRMADA', 'EN_ESPERA', 'EN_ATENCION') AND NOT sobrecupo AND box_id IS NOT NULL);
ALTER TABLE public.citas ADD CONSTRAINT citas_sin_choque_paciente EXCLUDE USING gist (
  paciente_id WITH =, tstzrange(inicio, fin) WITH &&
) WHERE (estado IN ('AGENDADA', 'CONFIRMADA', 'EN_ESPERA', 'EN_ATENCION'));

CREATE OR REPLACE FUNCTION public.transicion_cita_valida(p_actual text, p_nuevo text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_actual
    WHEN 'AGENDADA'    THEN p_nuevo IN ('CONFIRMADA', 'EN_ESPERA', 'EN_ATENCION', 'REAGENDADA', 'CANCELADA', 'NO_ASISTIO')
    WHEN 'CONFIRMADA'  THEN p_nuevo IN ('EN_ESPERA', 'EN_ATENCION', 'REAGENDADA', 'CANCELADA', 'NO_ASISTIO')
    WHEN 'EN_ESPERA'   THEN p_nuevo IN ('EN_ATENCION', 'REALIZADA', 'NO_ASISTIO')
    WHEN 'EN_ATENCION' THEN p_nuevo IN ('REALIZADA')
    ELSE false
  END;
$$;


-- 3. Vista de la agenda (se rehace para incluir las columnas nuevas) -----
DROP VIEW IF EXISTS public.v_agenda;
CREATE VIEW public.v_agenda WITH (security_invoker = true) AS
SELECT
  c.*,
  (c.inicio AT TIME ZONE 'America/Santiago')::date                    AS fecha,
  to_char(c.inicio AT TIME ZONE 'America/Santiago', 'HH24:MI')         AS hora_inicio,
  to_char(c.fin AT TIME ZONE 'America/Santiago', 'HH24:MI')            AS hora_fin,
  extract(hour FROM c.inicio AT TIME ZONE 'America/Santiago')::int * 60
    + extract(minute FROM c.inicio AT TIME ZONE 'America/Santiago')::int AS minuto_inicio,
  pa.nombres || ' ' || pa.apellidos AS paciente_nombre,
  pa.nombres                        AS paciente_nombres,
  pa.apellidos                      AS paciente_apellidos,
  pa.rut                            AS paciente_rut,
  pa.telefono                       AS paciente_telefono,
  pf.nombre_completo                AS profesional_nombre,
  b.nombre                          AS box_nombre,
  pr.nombre                         AS prestacion_nombre,
  ps.numero                         AS tratamiento_numero,
  ps.nombre                         AS tratamiento_nombre,
  cr.nombre_completo                AS creado_por_nombre
FROM public.citas c
JOIN public.pacientes pa ON pa.id = c.paciente_id
JOIN public.perfiles pf  ON pf.id = c.profesional_id
LEFT JOIN public.boxes b ON b.id = c.box_id
LEFT JOIN public.prestaciones pr ON pr.id = c.prestacion_id
LEFT JOIN public.presupuestos ps ON ps.id = c.presupuesto_id
LEFT JOIN public.perfiles cr ON cr.id = c.creado_por;


-- 4. Agendar (ahora con tratamiento) ------------------------------------
DROP FUNCTION IF EXISTS public.agendar_cita(uuid, uuid, date, time, integer, uuid, uuid, uuid, text, boolean, text, uuid);

CREATE OR REPLACE FUNCTION public.agendar_cita(
  p_paciente         uuid,
  p_profesional      uuid,
  p_fecha            date,
  p_hora             time,
  p_duracion         integer,
  p_usuario          uuid,
  p_box              uuid DEFAULT NULL,
  p_prestacion       uuid DEFAULT NULL,
  p_motivo           text DEFAULT NULL,
  p_sobrecupo        boolean DEFAULT false,
  p_motivo_sobrecupo text DEFAULT NULL,
  p_cita_original    uuid DEFAULT NULL,
  p_presupuesto      uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid;
  v_inicio timestamptz := public.hora_chile(p_fecha, p_hora);
  v_duracion integer := p_duracion;
  v_fin timestamptz;
  v_constraint text;
  v_prof text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.pacientes WHERE id = p_paciente AND activo) THEN
    RAISE EXCEPTION 'El paciente no existe o está deshabilitado.';
  END IF;
  SELECT nombre_completo INTO v_prof FROM public.perfiles WHERE id = p_profesional AND activo AND rol IN ('DENTISTA', 'ADMINISTRADOR');
  IF NOT FOUND THEN RAISE EXCEPTION 'El profesional no existe o está desactivado.'; END IF;
  IF p_box IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.boxes WHERE id = p_box AND activo) THEN
    RAISE EXCEPTION 'El box no existe o está desactivado.';
  END IF;
  IF p_presupuesto IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.presupuestos WHERE id = p_presupuesto AND paciente_id = p_paciente) THEN
    RAISE EXCEPTION 'El tratamiento no pertenece al paciente.';
  END IF;
  IF p_prestacion IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.prestaciones WHERE id = p_prestacion AND activo) THEN
      RAISE EXCEPTION 'La prestación no existe o está desactivada.';
    END IF;
    IF v_duracion IS NULL THEN
      v_duracion := (SELECT duracion_min FROM public.prestaciones WHERE id = p_prestacion);
    END IF;
  END IF;
  v_duracion := COALESCE(v_duracion, 30);
  IF v_duracion < 5 OR v_duracion > 480 OR v_duracion % 5 <> 0 THEN
    RAISE EXCEPTION 'La duración debe ser entre 5 y 480 minutos, en múltiplos de 5.';
  END IF;
  IF v_inicio < now() - interval '5 minutes' THEN
    RAISE EXCEPTION '%', 'No se puede agendar en una fecha u hora pasada (' || to_char(p_fecha, 'DD-MM') || ' ' || to_char(p_hora, 'HH24:MI') || ').';
  END IF;
  IF p_sobrecupo AND length(trim(COALESCE(p_motivo_sobrecupo, ''))) = 0 THEN
    RAISE EXCEPTION 'Indica el motivo del sobrecupo.';
  END IF;

  v_fin := v_inicio + make_interval(mins => v_duracion);
  PERFORM public.validar_horario_cita(p_profesional, p_box, v_inicio, v_fin, COALESCE(p_sobrecupo, false));

  BEGIN
    INSERT INTO public.citas (paciente_id, profesional_id, box_id, prestacion_id, presupuesto_id, inicio, fin, duracion_min,
                              motivo, sobrecupo, motivo_sobrecupo, cita_original_id, creado_por)
    VALUES (p_paciente, p_profesional, p_box, p_prestacion, p_presupuesto, v_inicio, v_fin, v_duracion,
            NULLIF(upper(trim(p_motivo)), ''), COALESCE(p_sobrecupo, false),
            CASE WHEN p_sobrecupo THEN trim(p_motivo_sobrecupo) END, p_cita_original, p_usuario)
    RETURNING id INTO v_id;
  EXCEPTION WHEN exclusion_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    RAISE EXCEPTION '%', public.mensaje_choque_cita(v_constraint) || ' (' || to_char(p_fecha, 'DD-MM') || ' ' || to_char(p_hora, 'HH24:MI') || ')';
  END;

  INSERT INTO public.citas_historial (cita_id, estado_anterior, estado_nuevo, motivo, usuario_id)
  VALUES (v_id, NULL, 'AGENDADA', CASE WHEN p_sobrecupo THEN 'Sobrecupo: ' || trim(p_motivo_sobrecupo) END, p_usuario);

  PERFORM public.registrar_evento(p_paciente, 'CITA', CASE WHEN p_cita_original IS NULL THEN 'CREADO' ELSE 'REAGENDADO' END,
    CASE WHEN p_cita_original IS NULL THEN 'Cita agendada' ELSE 'Cita reprogramada' END
      || ' · ' || to_char(p_fecha, 'DD-MM-YYYY') || ' ' || to_char(p_hora, 'HH24:MI'),
    concat_ws(' · ', v_prof, (SELECT nombre FROM public.prestaciones WHERE id = p_prestacion),
              (SELECT nombre FROM public.boxes WHERE id = p_box),
              CASE WHEN p_sobrecupo THEN 'Sobrecupo' END, NULLIF(upper(trim(p_motivo)), '')),
    v_prof, 'citas', v_id, NULL, p_usuario);

  RETURN v_id;
END;
$$;

-- Varios bloques de una vez: si uno falla, no se agenda ninguno
-- p_bloques: [{"fecha":"2026-10-12","hora":"10:00","duracion":30,"sobrecupo":false}, ...]
CREATE OR REPLACE FUNCTION public.agendar_citas(
  p_paciente         uuid,
  p_profesional      uuid,
  p_bloques          jsonb,
  p_usuario          uuid,
  p_box              uuid DEFAULT NULL,
  p_prestacion       uuid DEFAULT NULL,
  p_motivo           text DEFAULT NULL,
  p_presupuesto      uuid DEFAULT NULL,
  p_motivo_sobrecupo text DEFAULT NULL
) RETURNS uuid[] LANGUAGE plpgsql AS $$
DECLARE
  b jsonb;
  v_ids uuid[] := '{}';
BEGIN
  IF p_bloques IS NULL OR jsonb_typeof(p_bloques) <> 'array' OR jsonb_array_length(p_bloques) = 0 THEN
    RAISE EXCEPTION 'Selecciona al menos un horario.';
  END IF;
  FOR b IN SELECT * FROM jsonb_array_elements(p_bloques) ORDER BY value ->> 'fecha', value ->> 'hora' LOOP
    v_ids := v_ids || public.agendar_cita(
      p_paciente, p_profesional, (b ->> 'fecha')::date, (b ->> 'hora')::time, (b ->> 'duracion')::int, p_usuario,
      p_box, p_prestacion, p_motivo, COALESCE((b ->> 'sobrecupo')::boolean, false),
      CASE WHEN COALESCE((b ->> 'sobrecupo')::boolean, false) THEN COALESCE(NULLIF(trim(p_motivo_sobrecupo), ''), 'Sobrecupo autorizado al agendar') END,
      NULL, p_presupuesto);
  END LOOP;
  RETURN v_ids;
END;
$$;


-- 5. Reprogramar (misma lógica, con el nuevo agendar) --------------------
CREATE OR REPLACE FUNCTION public.reagendar_cita(
  p_cita             uuid,
  p_fecha            date,
  p_hora             time,
  p_usuario          uuid,
  p_profesional      uuid DEFAULT NULL,
  p_box              uuid DEFAULT NULL,
  p_duracion         integer DEFAULT NULL,
  p_motivo           text DEFAULT NULL,
  p_sobrecupo        boolean DEFAULT false,
  p_motivo_sobrecupo text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  c public.citas%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.citas WHERE id = p_cita FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La cita no existe.'; END IF;
  IF NOT public.transicion_cita_valida(c.estado, 'REAGENDADA') THEN
    RAISE EXCEPTION '%', 'Una cita ' || lower(replace(c.estado, '_', ' ')) || ' no se puede reprogramar.';
  END IF;

  UPDATE public.citas SET estado = 'REAGENDADA' WHERE id = p_cita;
  INSERT INTO public.citas_historial (cita_id, estado_anterior, estado_nuevo, motivo, usuario_id)
  VALUES (p_cita, c.estado, 'REAGENDADA', NULLIF(trim(p_motivo), ''), p_usuario);

  RETURN public.agendar_cita(
    c.paciente_id, COALESCE(p_profesional, c.profesional_id), p_fecha, p_hora,
    COALESCE(p_duracion, c.duracion_min), p_usuario, COALESCE(p_box, c.box_id), c.prestacion_id,
    COALESCE(NULLIF(trim(p_motivo), ''), c.motivo),
    COALESCE(p_sobrecupo, false),
    CASE WHEN p_sobrecupo THEN COALESCE(NULLIF(trim(p_motivo_sobrecupo), ''), 'Sobrecupo autorizado al reprogramar') END,
    p_cita, c.presupuesto_id);
END;
$$;


-- 6. Cambiar estado (registra llegada e inicio/fin de la atención) --------
CREATE OR REPLACE FUNCTION public.cambiar_estado_cita(p_cita uuid, p_estado text, p_usuario uuid, p_motivo text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  c public.citas%ROWTYPE;
  v_fecha date;
  v_titulo text;
BEGIN
  SELECT * INTO c FROM public.citas WHERE id = p_cita FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La cita no existe.'; END IF;
  IF p_estado = 'REAGENDADA' THEN RAISE EXCEPTION 'Para cambiar la hora usa Reprogramar.'; END IF;
  IF NOT public.transicion_cita_valida(c.estado, p_estado) THEN
    RAISE EXCEPTION '%', 'Una cita ' || lower(replace(c.estado, '_', ' ')) || ' no puede pasar a ' || lower(replace(p_estado, '_', ' ')) || '.';
  END IF;
  IF p_estado = 'CANCELADA' AND length(trim(COALESCE(p_motivo, ''))) = 0 THEN
    RAISE EXCEPTION 'Indica el motivo de la anulación.';
  END IF;

  v_fecha := (c.inicio AT TIME ZONE 'America/Santiago')::date;
  IF p_estado IN ('EN_ESPERA', 'EN_ATENCION', 'REALIZADA') AND v_fecha > public.hoy_chile() THEN
    RAISE EXCEPTION 'No se puede registrar la llegada ni la atención de una cita de un día futuro.';
  END IF;
  IF p_estado = 'NO_ASISTIO' AND c.inicio > now() THEN
    RAISE EXCEPTION 'Solo se puede marcar inasistencia después de la hora de la cita.';
  END IF;

  UPDATE public.citas
     SET estado = p_estado,
         motivo_cancelacion   = CASE WHEN p_estado = 'CANCELADA' THEN trim(p_motivo) ELSE motivo_cancelacion END,
         hora_llegada         = CASE WHEN p_estado = 'EN_ESPERA' THEN now()
                                     WHEN p_estado = 'EN_ATENCION' THEN COALESCE(hora_llegada, now()) ELSE hora_llegada END,
         hora_inicio_atencion = CASE WHEN p_estado = 'EN_ATENCION' THEN now()
                                     WHEN p_estado = 'REALIZADA' THEN COALESCE(hora_inicio_atencion, now()) ELSE hora_inicio_atencion END,
         hora_fin_atencion    = CASE WHEN p_estado = 'REALIZADA' THEN now() ELSE hora_fin_atencion END
   WHERE id = p_cita;

  INSERT INTO public.citas_historial (cita_id, estado_anterior, estado_nuevo, motivo, usuario_id)
  VALUES (p_cita, c.estado, p_estado, NULLIF(trim(p_motivo), ''), p_usuario);

  v_titulo := CASE p_estado
    WHEN 'CONFIRMADA' THEN 'Cita confirmada'
    WHEN 'EN_ESPERA' THEN 'Paciente llegó (sala de espera)'
    WHEN 'EN_ATENCION' THEN 'Paciente en box'
    WHEN 'REALIZADA' THEN 'Paciente atendido'
    WHEN 'CANCELADA' THEN 'Cita anulada'
    WHEN 'NO_ASISTIO' THEN 'No asistió a la cita'
  END;
  PERFORM public.registrar_evento(c.paciente_id, 'CITA', p_estado,
    v_titulo || ' · ' || to_char(c.inicio AT TIME ZONE 'America/Santiago', 'DD-MM-YYYY HH24:MI'),
    NULLIF(trim(p_motivo), ''), public.nombre_usuario(c.profesional_id), 'citas', p_cita, NULL, p_usuario);
END;
$$;


-- 7. Horas disponibles (considera EN_ESPERA como ocupada) ------------------
CREATE OR REPLACE FUNCTION public.horas_disponibles(
  p_profesional uuid, p_fecha date, p_duracion integer, p_box uuid DEFAULT NULL, p_excluir uuid DEFAULT NULL
) RETURNS TABLE (hora text) LANGUAGE sql STABLE AS $$
  WITH tramos AS (
    SELECT h.hora_inicio, h.hora_fin FROM public.horarios_atencion h
     WHERE h.profesional_id = p_profesional AND h.dia_semana = extract(isodow FROM p_fecha)::int
    UNION ALL
    SELECT '09:00'::time, '19:00'::time
     WHERE NOT EXISTS (SELECT 1 FROM public.horarios_atencion WHERE profesional_id = p_profesional)
       AND extract(isodow FROM p_fecha) < 7
  ),
  candidatos AS (
    SELECT DISTINCT public.hora_chile(p_fecha, s::time) AS ini
      FROM tramos t,
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


-- 8. "¿Cuándo hay hora?": próximas horas libres -------------------------
-- Hasta 3 opciones por dentista y día (sin solaparse), turno mañana (< 13:00) o tarde.
CREATE OR REPLACE FUNCTION public.proximas_horas(
  p_duracion    integer,
  p_desde       date,
  p_profesional uuid DEFAULT NULL,
  p_turno       text DEFAULT 'cualquiera',
  p_limite      integer DEFAULT 10
) RETURNS TABLE (fecha date, hora text, profesional_id uuid, profesional_nombre text)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  d date;
  pr record;
  h record;
  v_total integer := 0;
  v_por_dia integer;
  v_ultimo_fin integer;
  v_min integer;
BEGIN
  FOR i IN 0..120 LOOP
    d := GREATEST(p_desde, public.hoy_chile()) + i;
    FOR pr IN
      SELECT id, nombre_completo FROM public.perfiles
       WHERE activo AND rol = 'DENTISTA' AND (p_profesional IS NULL OR id = p_profesional)
       ORDER BY nombre_completo
    LOOP
      v_por_dia := 0;
      v_ultimo_fin := -1;
      FOR h IN SELECT x.hora FROM public.horas_disponibles(pr.id, d, p_duracion) x LOOP
        v_min := split_part(h.hora, ':', 1)::int * 60 + split_part(h.hora, ':', 2)::int;
        CONTINUE WHEN p_turno = 'manana' AND v_min >= 780;
        CONTINUE WHEN p_turno = 'tarde' AND v_min < 780;
        CONTINUE WHEN v_min < v_ultimo_fin;
        fecha := d; hora := h.hora; profesional_id := pr.id; profesional_nombre := pr.nombre_completo;
        RETURN NEXT;
        v_total := v_total + 1;
        v_por_dia := v_por_dia + 1;
        v_ultimo_fin := v_min + p_duracion;
        EXIT WHEN v_por_dia >= 3;
      END LOOP;
    END LOOP;
    EXIT WHEN v_total >= p_limite;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
