-- =====================================================================
-- 25 · Agenda online: el paciente reserva su hora desde la web pública
-- La app de agendamiento llama a la API de SoftDent, que usa estas funciones.
-- Idempotente. Requiere 01 a 24.
-- =====================================================================

-- ---------- Origen de la cita y dentistas visibles en la web ----------
ALTER TABLE public.citas    ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'CLINICA';
ALTER TABLE public.citas    ADD COLUMN IF NOT EXISTS validada_web_at timestamptz;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS agenda_online boolean NOT NULL DEFAULT true;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'citas_origen_chk') THEN
    ALTER TABLE public.citas ADD CONSTRAINT citas_origen_chk CHECK (origen IN ('CLINICA', 'WEB'));
  END IF;
END;
$$;
CREATE INDEX IF NOT EXISTS citas_web_por_validar_idx ON public.citas (inicio) WHERE origen = 'WEB' AND validada_web_at IS NULL;

-- ---------- Parámetros ----------
INSERT INTO public.parametros_sistema (clave, valor, descripcion, grupo, tipo, minimo, maximo) VALUES
  ('agenda_web.activa', '1', 'Agenda online habilitada (1 = sí, 0 = no)', 'Agenda online', 'ENTERO', 0, 1),
  ('agenda_web.duracion_min', '30', 'Duración de la cita reservada por internet (min)', 'Agenda online', 'ENTERO', 15, 120),
  ('agenda_web.dias', '30', 'Cuántos días hacia adelante se puede reservar', 'Agenda online', 'ENTERO', 1, 90),
  ('agenda_web.anticipacion_horas', '2', 'Horas mínimas de anticipación para reservar', 'Agenda online', 'ENTERO', 0, 72),
  ('agenda_web.maximo_pendientes', '2', 'Reservas web futuras que puede tener un mismo paciente', 'Agenda online', 'ENTERO', 1, 10)
ON CONFLICT (clave) DO NOTHING;

CREATE OR REPLACE FUNCTION public.parametro_entero(p_clave text, p_defecto integer)
RETURNS integer LANGUAGE sql STABLE AS $$
  SELECT COALESCE((SELECT NULLIF(trim(valor), '')::integer FROM public.parametros_sistema
                    WHERE clave = p_clave AND trim(valor) ~ '^-?\d+$'), p_defecto)
$$;

-- ---------- Configuración pública ----------
CREATE OR REPLACE FUNCTION public.agenda_web_config()
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'activa', public.parametro_entero('agenda_web.activa', 1) = 1,
    'duracion', public.parametro_entero('agenda_web.duracion_min', 30),
    'dias', public.parametro_entero('agenda_web.dias', 30),
    'clinica', jsonb_build_object(
      'nombre', COALESCE((SELECT valor FROM public.parametros_sistema WHERE clave = 'clinica.nombre'), 'Clínica dental'),
      'telefono', COALESCE((SELECT valor FROM public.parametros_sistema WHERE clave = 'clinica.telefono'), ''),
      'direccion', COALESCE((SELECT valor FROM public.parametros_sistema WHERE clave = 'clinica.direccion'), '')))
$$;

-- ---------- Dentistas que se pueden reservar ----------
CREATE OR REPLACE FUNCTION public.agenda_web_profesionales()
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre_completo, 'especialidad', NULLIF(trim(p.especialidad), ''))
                            ORDER BY p.nombre_completo), '[]'::jsonb)
    FROM public.perfiles p
   WHERE p.activo AND p.rol = 'DENTISTA' AND p.agenda_online
$$;

-- ---------- Horas libres por día ----------
CREATE OR REPLACE FUNCTION public.agenda_web_disponibilidad(p_profesional uuid, p_desde date, p_dias integer DEFAULT 7)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_hoy date := public.hoy_chile();
  v_limite date := v_hoy + public.parametro_entero('agenda_web.dias', 30);
  v_duracion integer := public.parametro_entero('agenda_web.duracion_min', 30);
  v_minimo timestamptz := now() + make_interval(hours => public.parametro_entero('agenda_web.anticipacion_horas', 2));
  v_resultado jsonb := '[]'::jsonb;
  v_horas jsonb;
  d date;
BEGIN
  IF public.parametro_entero('agenda_web.activa', 1) <> 1 THEN RETURN v_resultado; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.perfiles WHERE id = p_profesional AND activo AND rol = 'DENTISTA' AND agenda_online) THEN
    RETURN v_resultado;
  END IF;
  d := GREATEST(COALESCE(p_desde, v_hoy), v_hoy);
  FOR i IN 0 .. LEAST(GREATEST(COALESCE(p_dias, 7), 1), 14) - 1 LOOP
    EXIT WHEN d + i > v_limite;
    SELECT COALESCE(jsonb_agg(x.hora ORDER BY x.hora), '[]'::jsonb) INTO v_horas
      FROM public.horas_disponibles(p_profesional, d + i, v_duracion) x
     WHERE public.hora_chile(d + i, x.hora::time) >= v_minimo;
    IF jsonb_array_length(v_horas) > 0 THEN
      v_resultado := v_resultado || jsonb_build_array(jsonb_build_object('fecha', d + i, 'horas', v_horas));
    END IF;
  END LOOP;
  RETURN v_resultado;
END;
$$;

-- ---------- ¿El paciente ya existe? (solo su primer nombre) ----------
CREATE OR REPLACE FUNCTION public.agenda_web_paciente(p_rut text)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN p.id IS NULL THEN jsonb_build_object('existe', false)
              ELSE jsonb_build_object('existe', true, 'nombre', split_part(trim(p.nombres), ' ', 1), 'activo', p.activo) END
    FROM (SELECT 1) uno
    LEFT JOIN public.pacientes p ON upper(p.rut) = upper(trim(p_rut))
$$;

-- ---------- Reservar ----------
CREATE OR REPLACE FUNCTION public.agenda_web_agendar(
  p_rut              text,
  p_extranjero       boolean,
  p_nombres          text,
  p_apellidos        text,
  p_fecha_nacimiento date,
  p_telefono         text,
  p_email            text,
  p_profesional      uuid,
  p_fecha            date,
  p_hora             time,
  p_comentario       text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_rut text := upper(trim(COALESCE(p_rut, '')));
  v_paciente public.pacientes%ROWTYPE;
  v_duracion integer := public.parametro_entero('agenda_web.duracion_min', 30);
  v_cita uuid;
  v_prof text;
  v_hora text := to_char(p_hora, 'HH24:MI');
  v_nuevo boolean := false;
BEGIN
  IF public.parametro_entero('agenda_web.activa', 1) <> 1 THEN
    RAISE EXCEPTION 'La agenda online no está disponible en este momento.';
  END IF;
  SELECT nombre_completo INTO v_prof FROM public.perfiles
   WHERE id = p_profesional AND activo AND rol = 'DENTISTA' AND agenda_online;
  IF NOT FOUND THEN RAISE EXCEPTION 'El profesional elegido no tiene agenda online.'; END IF;

  -- La hora debe seguir libre y dentro de la ventana permitida
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(public.agenda_web_disponibilidad(p_profesional, p_fecha, 1)) dia,
                  jsonb_array_elements_text(dia -> 'horas') h
     WHERE (dia ->> 'fecha')::date = p_fecha AND h = v_hora) THEN
    RAISE EXCEPTION 'Esa hora ya no está disponible. Elige otra, por favor.';
  END IF;

  SELECT * INTO v_paciente FROM public.pacientes WHERE upper(rut) = v_rut;
  IF FOUND THEN
    IF NOT v_paciente.activo THEN
      RAISE EXCEPTION 'No pudimos reservar en línea. Comunícate con la clínica para agendar.';
    END IF;
  ELSE
    IF length(trim(COALESCE(p_nombres, ''))) < 2 OR length(trim(COALESCE(p_apellidos, ''))) < 2 THEN
      RAISE EXCEPTION 'Ingresa tu nombre y apellido.';
    END IF;
    IF p_fecha_nacimiento IS NULL OR p_fecha_nacimiento > public.hoy_chile() OR p_fecha_nacimiento < date '1900-01-01' THEN
      RAISE EXCEPTION 'Ingresa una fecha de nacimiento válida.';
    END IF;
    IF length(regexp_replace(COALESCE(p_telefono, ''), '\D', '', 'g')) NOT BETWEEN 8 AND 12 THEN
      RAISE EXCEPTION 'Ingresa un teléfono válido.';
    END IF;
    INSERT INTO public.pacientes (rut, extranjero, nombres, apellidos, fecha_nacimiento, telefono, email, observaciones)
    VALUES (v_rut, COALESCE(p_extranjero, false), initcap(trim(p_nombres)), initcap(trim(p_apellidos)), p_fecha_nacimiento,
            trim(p_telefono), NULLIF(lower(trim(COALESCE(p_email, ''))), ''), 'Registrado desde la agenda online')
    RETURNING * INTO v_paciente;
    v_nuevo := true;
  END IF;

  IF (SELECT count(*) FROM public.citas
       WHERE paciente_id = v_paciente.id AND origen = 'WEB' AND inicio > now()
         AND estado IN ('AGENDADA', 'CONFIRMADA')) >= public.parametro_entero('agenda_web.maximo_pendientes', 2) THEN
    RAISE EXCEPTION 'Ya tienes reservas pendientes. Para otra hora comunícate con la clínica.';
  END IF;

  v_cita := public.agendar_cita(
    p_paciente    => v_paciente.id,
    p_profesional => p_profesional,
    p_fecha       => p_fecha,
    p_hora        => p_hora,
    p_duracion    => v_duracion,
    p_usuario     => NULL,
    p_motivo      => left('AGENDA ONLINE' || COALESCE(': ' || NULLIF(trim(p_comentario), ''), ''), 200));
  UPDATE public.citas SET origen = 'WEB' WHERE id = v_cita;

  RETURN jsonb_build_object(
    'cita_id', v_cita,
    'fecha', p_fecha,
    'hora', v_hora,
    'duracion', v_duracion,
    'profesional', v_prof,
    'paciente', split_part(trim(v_paciente.nombres), ' ', 1),
    'nuevo', v_nuevo);
END;
$$;

-- ---------- Validación de la clínica ----------
CREATE OR REPLACE FUNCTION public.validar_cita_web(p_cita uuid, p_usuario uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  c public.citas%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.citas WHERE id = p_cita FOR UPDATE;
  IF NOT FOUND OR c.origen <> 'WEB' THEN RAISE EXCEPTION 'La cita no es una reserva web.'; END IF;
  IF c.validada_web_at IS NOT NULL THEN RETURN; END IF;
  UPDATE public.citas SET validada_web_at = now() WHERE id = p_cita;
  IF c.estado = 'AGENDADA' THEN
    PERFORM public.cambiar_estado_cita(p_cita, 'CONFIRMADA', p_usuario, 'Reserva web validada');
  END IF;
END;
$$;

-- ---------- Permisos: solo el servidor (service_role) ----------
REVOKE ALL ON FUNCTION public.parametro_entero(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agenda_web_config() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agenda_web_profesionales() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agenda_web_disponibilidad(uuid, date, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agenda_web_paciente(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agenda_web_agendar(text, boolean, text, text, date, text, text, uuid, date, time, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validar_cita_web(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.parametro_entero(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.agenda_web_config() TO service_role;
GRANT EXECUTE ON FUNCTION public.agenda_web_profesionales() TO service_role;
GRANT EXECUTE ON FUNCTION public.agenda_web_disponibilidad(uuid, date, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.agenda_web_paciente(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.agenda_web_agendar(text, boolean, text, text, date, text, text, uuid, date, time, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.validar_cita_web(uuid, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
