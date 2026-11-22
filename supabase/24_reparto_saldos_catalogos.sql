-- =====================================================================
-- 24 · Reparto del pago por carpeta (100% doctor, 100% clínica, x% doctor),
--      saldos pendientes, catálogos de laboratorios y bancos, e inasistencias
-- Idempotente. Requiere 18 a 23.
-- =====================================================================

-- ---------- Catálogos: laboratorios y bancos ----------
CREATE TABLE IF NOT EXISTS public.laboratorios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL UNIQUE,
  descripcion text,
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.bancos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL UNIQUE,
  descripcion text,
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.bancos (nombre) VALUES
  ('Banco de Chile'), ('Banco Estado'), ('Banco Santander'), ('Banco BCI'), ('Scotiabank'),
  ('Banco Itaú'), ('Banco Falabella'), ('Banco Security'), ('Banco BICE'), ('Banco Ripley'), ('Tenpo'), ('Mercado Pago')
ON CONFLICT (nombre) DO NOTHING;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['laboratorios', 'bancos'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_auditoria', t);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.auditar_cambios()', t || '_auditoria', t);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_no_borrar', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalogo_no_borrar()', t || '_no_borrar', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.guardar_catalogo(
  p_tabla       text,
  p_id          uuid,
  p_nombre      text,
  p_usuario     uuid,
  p_descripcion text DEFAULT NULL,
  p_activo      boolean DEFAULT true,
  p_extra       jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid := p_id;
  v_nombre text := trim(COALESCE(p_nombre, ''));
BEGIN
  IF p_tabla NOT IN ('especialidades', 'categorias_prestaciones', 'boxes', 'previsiones', 'tipos_atencion', 'laboratorios', 'bancos') THEN
    RAISE EXCEPTION 'Catálogo no válido.';
  END IF;
  IF length(v_nombre) = 0 THEN RAISE EXCEPTION 'El nombre es obligatorio.'; END IF;
  PERFORM set_config('app.usuario', COALESCE(p_usuario::text, ''), true);

  BEGIN
    IF v_id IS NULL THEN
      EXECUTE format('INSERT INTO public.%I (nombre) VALUES ($1) RETURNING id', p_tabla) INTO v_id USING v_nombre;
    ELSE
      EXECUTE format('UPDATE public.%I SET nombre = $1, activo = $2 WHERE id = $3', p_tabla) USING v_nombre, COALESCE(p_activo, true), v_id;
    END IF;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION '%', 'Ya existe un registro llamado "' || v_nombre || '".';
  END;

  IF p_tabla IN ('especialidades', 'laboratorios') THEN
    EXECUTE format('UPDATE public.%I SET descripcion = NULLIF(trim($1), '''') WHERE id = $2', p_tabla) USING p_descripcion, v_id;
  ELSIF p_tabla = 'categorias_prestaciones' AND p_extra ? 'reparto' THEN
    UPDATE public.categorias_prestaciones
       SET reparto = p_extra ->> 'reparto',
           porcentaje_doctor = CASE WHEN p_extra ->> 'reparto' = 'PORCENTAJE' THEN (p_extra ->> 'porcentaje_doctor')::numeric END
     WHERE id = v_id;
  ELSIF p_tabla = 'previsiones' AND p_extra ? 'tipo' THEN
    UPDATE public.previsiones SET tipo = p_extra ->> 'tipo' WHERE id = v_id;
  ELSIF p_tabla = 'tipos_atencion' AND p_extra ? 'duracion_min' THEN
    UPDATE public.tipos_atencion SET duracion_min = (p_extra ->> 'duracion_min')::int WHERE id = v_id;
  END IF;
  RETURN v_id;
END;
$$;

-- ---------- Reparto del pago por carpeta (categoría de prestaciones) ----------
-- PROFESIONAL: % de cada dentista · DOCTOR: 100% doctor · CLINICA: 100% clínica · PORCENTAJE: % fijo de la carpeta
ALTER TABLE public.categorias_prestaciones ADD COLUMN IF NOT EXISTS reparto text NOT NULL DEFAULT 'PROFESIONAL';
ALTER TABLE public.categorias_prestaciones ADD COLUMN IF NOT EXISTS porcentaje_doctor numeric(5,2);
ALTER TABLE public.prestaciones ADD COLUMN IF NOT EXISTS laboratorio_id uuid REFERENCES public.laboratorios(id) ON DELETE SET NULL;
ALTER TABLE public.presupuesto_items ADD COLUMN IF NOT EXISTS reparto text;
ALTER TABLE public.presupuesto_items ADD COLUMN IF NOT EXISTS porcentaje_doctor numeric(5,2);
ALTER TABLE public.liquidacion_detalle ADD COLUMN IF NOT EXISTS reparto text;
ALTER TABLE public.liquidacion_detalle ADD COLUMN IF NOT EXISTS monto_clinica integer;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categorias_reparto_chk') THEN
    ALTER TABLE public.categorias_prestaciones ADD CONSTRAINT categorias_reparto_chk CHECK (
      reparto IN ('PROFESIONAL', 'DOCTOR', 'CLINICA', 'PORCENTAJE')
      AND (reparto <> 'PORCENTAJE' OR porcentaje_doctor BETWEEN 0 AND 100));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'presupuesto_items_reparto_chk') THEN
    ALTER TABLE public.presupuesto_items ADD CONSTRAINT presupuesto_items_reparto_chk CHECK (
      reparto IS NULL OR (reparto IN ('PROFESIONAL', 'DOCTOR', 'CLINICA', 'PORCENTAJE')
      AND (reparto <> 'PORCENTAJE' OR porcentaje_doctor BETWEEN 0 AND 100)));
  END IF;
END;
$$;

-- Al presupuestar se copia el reparto vigente de la carpeta: cambios posteriores no afectan lo ya presupuestado
CREATE OR REPLACE FUNCTION public.item_copiar_reparto()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.reparto IS NULL THEN
    SELECT c.reparto, CASE WHEN c.reparto = 'PORCENTAJE' THEN c.porcentaje_doctor END
      INTO NEW.reparto, NEW.porcentaje_doctor
      FROM public.prestaciones p
      JOIN public.categorias_prestaciones c ON c.id = p.categoria_id
     WHERE p.id = NEW.prestacion_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS presupuesto_items_reparto ON public.presupuesto_items;
CREATE TRIGGER presupuesto_items_reparto BEFORE INSERT ON public.presupuesto_items
  FOR EACH ROW EXECUTE FUNCTION public.item_copiar_reparto();

CREATE OR REPLACE FUNCTION public.porcentaje_item(p_reparto text, p_porcentaje numeric, p_profesional numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_reparto
           WHEN 'DOCTOR' THEN 100
           WHEN 'CLINICA' THEN 0
           WHEN 'PORCENTAJE' THEN p_porcentaje
           ELSE p_profesional
         END
$$;

-- Producción por avance: el porcentaje es el de la carpeta de la prestación (o el del dentista)
CREATE OR REPLACE VIEW public.v_produccion_profesional WITH (security_invoker = true) AS
 SELECT a.id AS avance_id,
    a.item_id,
    a.profesional_id,
    pf.nombre_completo AS profesional_nombre,
    public.porcentaje_item(i.reparto, i.porcentaje_doctor, pf.porcentaje_liquidacion)::numeric(5,2) AS porcentaje,
    i.paciente_id,
    ((pa.nombres || ' '::text) || pa.apellidos) AS paciente_nombre,
    pa.numero_ficha,
    pr.nombre AS prestacion_nombre,
    i.pieza,
    ps.numero AS tratamiento_numero,
    a.progreso_anterior,
    a.progreso_nuevo,
    a.monto AS monto_base,
    a.created_at AS fecha_avance,
    i.precio,
    i.progreso,
    i.abonado,
    i.completado_en,
    pg.fecha_pagado,
    ((i.progreso = 100) AND (i.abonado = i.precio)) AS liquidable,
        CASE
            WHEN ((i.progreso = 100) AND (i.abonado = i.precio)) THEN GREATEST(i.completado_en, pg.fecha_pagado)
            ELSE NULL::timestamp with time zone
        END AS fecha_liquidable,
    ld.liquidacion_id,
    l.numero AS liquidacion_numero,
    COALESCE(i.reparto, 'PROFESIONAL') AS reparto
   FROM ((((((((public.item_avances a
     JOIN public.presupuesto_items i ON ((i.id = a.item_id)))
     JOIN public.presupuestos ps ON ((ps.id = i.presupuesto_id)))
     JOIN public.pacientes pa ON ((pa.id = i.paciente_id)))
     JOIN public.prestaciones pr ON ((pr.id = i.prestacion_id)))
     JOIN public.perfiles pf ON ((pf.id = a.profesional_id)))
     LEFT JOIN LATERAL ( SELECT max(p.fecha) AS fecha_pagado
           FROM (public.pago_detalle d
             JOIN public.pagos p ON ((p.id = d.pago_id)))
          WHERE ((d.item_id = i.id) AND (p.estado = 'VIGENTE'::text))) pg ON (true))
     LEFT JOIN public.liquidacion_detalle ld ON (((ld.avance_id = a.id) AND ld.vigente)))
     LEFT JOIN public.liquidaciones l ON ((l.id = ld.liquidacion_id)))
  WHERE ((a.monto > 0) AND (i.estado <> 'ANULADO'::text));

-- Liquidación: cada prestación se reparte según su carpeta (100% doctor, 100% clínica, x% doctor o el % del dentista)
CREATE OR REPLACE FUNCTION public.generar_liquidacion(
  p_profesional  uuid,
  p_periodo      text,
  p_usuario      uuid,
  p_bonificacion integer DEFAULT 0,
  p_ajuste       integer DEFAULT 0,
  p_descuento    integer DEFAULT 0,
  p_nota         text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_pct numeric(5,2);
  v_id uuid;
  v_cantidad integer;
  v_inicio date;
  v_corte date;
  v_base integer;
  v_prof integer;
  v_total integer;
BEGIN
  IF p_periodo IS NULL OR p_periodo !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Período no válido (formato AAAA-MM).'; END IF;
  v_inicio := (p_periodo || '-01')::date;
  IF v_inicio > public.hoy_chile() THEN RAISE EXCEPTION 'No se puede liquidar un mes futuro.'; END IF;
  v_corte := LEAST((v_inicio + interval '1 month - 1 day')::date, public.hoy_chile());
  IF COALESCE(p_bonificacion, 0) < 0 OR COALESCE(p_descuento, 0) < 0 THEN
    RAISE EXCEPTION 'La bonificación y el descuento no pueden ser negativos (usa el ajuste para restar).';
  END IF;

  SELECT porcentaje_liquidacion INTO v_pct FROM public.perfiles WHERE id = p_profesional FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profesional no encontrado.'; END IF;
  IF v_pct IS NULL THEN RAISE EXCEPTION 'El profesional no tiene configurado su porcentaje de liquidación.'; END IF;
  IF EXISTS (SELECT 1 FROM public.liquidaciones WHERE profesional_id = p_profesional AND periodo = p_periodo AND estado <> 'ANULADA') THEN
    RAISE EXCEPTION '%', 'Ya existe una liquidación de ' || p_periodo || ' para este profesional. Las correcciones van como ajuste en el mes siguiente.';
  END IF;

  INSERT INTO public.liquidaciones (profesional_id, periodo, fecha_corte, porcentaje, porcentaje_clinica, nota, creado_por, estado)
  VALUES (p_profesional, p_periodo, v_corte, v_pct, 100 - v_pct, NULLIF(trim(p_nota), ''), p_usuario, 'CALCULADA')
  RETURNING id INTO v_id;

  INSERT INTO public.liquidacion_detalle
    (liquidacion_id, avance_id, item_id, paciente_id, paciente_nombre, prestacion_nombre, pieza, tramo,
     fecha_realizado, fecha_pagado, monto_base, porcentaje, monto, monto_clinica, reparto)
  SELECT v_id, v.avance_id, v.item_id, v.paciente_id, v.paciente_nombre, v.prestacion_nombre, v.pieza,
         v.progreso_anterior || '% → ' || v.progreso_nuevo || '%',
         v.completado_en, v.fecha_pagado,
         v.monto_base, v.porcentaje,
         round(v.monto_base * v.porcentaje / 100.0)::int,
         v.monto_base - round(v.monto_base * v.porcentaje / 100.0)::int,
         v.reparto
    FROM public.v_produccion_profesional v
   WHERE v.profesional_id = p_profesional AND v.liquidable AND v.liquidacion_id IS NULL
     AND (v.fecha_liquidable AT TIME ZONE 'America/Santiago')::date <= v_corte;
  GET DIAGNOSTICS v_cantidad = ROW_COUNT;

  IF v_cantidad = 0 AND COALESCE(p_bonificacion, 0) = 0 AND COALESCE(p_ajuste, 0) = 0 THEN
    RAISE EXCEPTION 'No hay prestaciones terminadas y pagadas pendientes de liquidar en ese período.';
  END IF;

  SELECT COALESCE(sum(monto_base), 0), COALESCE(sum(monto), 0)
    INTO v_base, v_prof FROM public.liquidacion_detalle WHERE liquidacion_id = v_id;
  v_total := v_prof + COALESCE(p_bonificacion, 0) + COALESCE(p_ajuste, 0) - COALESCE(p_descuento, 0);
  IF v_total < 0 THEN RAISE EXCEPTION 'El total a pagar quedaría negativo: revisa el ajuste y el descuento.'; END IF;

  UPDATE public.liquidaciones
     SET cantidad = v_cantidad, total_base = v_base, base_profesional = v_prof,
         bonificacion = COALESCE(p_bonificacion, 0), ajuste = COALESCE(p_ajuste, 0), descuento = COALESCE(p_descuento, 0),
         total = v_total, total_clinica = v_base - v_prof
   WHERE id = v_id;
  RETURN v_id;
END;
$$;

-- ---------- Saldos pendientes ----------
-- saldo: lo realizado y no pagado · saldo_tratamiento: lo que falta pagar del total de los tratamientos
DROP VIEW IF EXISTS public.v_saldos_pacientes;
CREATE VIEW public.v_saldos_pacientes WITH (security_invoker = true) AS
WITH items AS (
  SELECT pi.paciente_id,
         sum(pi.precio) AS total_tratamiento,
         sum(COALESCE(pi.monto_habilitado, 0)) AS total_habilitado,
         sum(COALESCE(pi.abonado, 0)) AS total_abonado,
         sum(COALESCE(pi.monto_habilitado, 0) - COALESCE(pi.abonado, 0)) AS saldo,
         sum(pi.precio - COALESCE(pi.abonado, 0)) AS saldo_tratamiento,
         min(pi.created_at) FILTER (WHERE COALESCE(pi.monto_habilitado, 0) > COALESCE(pi.abonado, 0)) AS primer_cargo_at,
         array_agg(DISTINCT COALESCE(pi.profesional_id, pr.profesional_id))
           FILTER (WHERE COALESCE(pi.profesional_id, pr.profesional_id) IS NOT NULL) AS doctor_ids
    FROM public.presupuesto_items pi
    JOIN public.presupuestos pr ON pr.id = pi.presupuesto_id
   WHERE pi.estado <> 'ANULADO' AND pr.estado <> 'ANULADO'
   GROUP BY pi.paciente_id
  HAVING sum(pi.precio - COALESCE(pi.abonado, 0)) > 0
), ultimos_pagos AS (
  SELECT paciente_id, max(fecha) AS ultimo_pago_at
    FROM public.pagos WHERE estado <> 'ANULADO'
   GROUP BY paciente_id
)
SELECT p.id AS paciente_id,
       p.rut,
       p.nombres,
       p.apellidos,
       trim(concat_ws(' ', p.nombres, p.apellidos)) AS paciente_nombre,
       p.telefono,
       p.email,
       d.total_habilitado,
       d.total_abonado,
       GREATEST(d.saldo, 0) AS saldo,
       up.ultimo_pago_at,
       COALESCE(up.ultimo_pago_at, d.primer_cargo_at, p.created_at) AS referencia_deuda_at,
       GREATEST(0, extract(day FROM now() - COALESCE(up.ultimo_pago_at, d.primer_cargo_at, p.created_at))::int) AS antiguedad_dias,
       d.doctor_ids[1] AS doctor_id,
       COALESCE((SELECT string_agg(pf.nombre_completo, ', ' ORDER BY pf.nombre_completo)
                   FROM public.perfiles pf WHERE pf.id = ANY (d.doctor_ids)), 'Sin doctor asignado') AS doctor_nombre,
       d.total_tratamiento,
       d.saldo_tratamiento,
       COALESCE(d.doctor_ids, '{}'::uuid[]) AS doctor_ids
  FROM items d
  JOIN public.pacientes p ON p.id = d.paciente_id
  LEFT JOIN ultimos_pagos up ON up.paciente_id = p.id
 WHERE p.activo
 ORDER BY GREATEST(d.saldo, 0) DESC, d.saldo_tratamiento DESC;
REVOKE ALL ON public.v_saldos_pacientes FROM anon, authenticated;
GRANT SELECT ON public.v_saldos_pacientes TO service_role;

-- ---------- Inasistencias: se pueden marcar desde el día de la cita ----------
-- Columnas de la sala de espera creadas fuera del repositorio
ALTER TABLE public.citas ADD COLUMN IF NOT EXISTS llegada_at         timestamptz;
ALTER TABLE public.citas ADD COLUMN IF NOT EXISTS atencion_inicio_at timestamptz;
ALTER TABLE public.citas ADD COLUMN IF NOT EXISTS atencion_fin_at    timestamptz;

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
  IF p_estado = 'NO_ASISTIO' AND v_fecha > public.hoy_chile() THEN
    RAISE EXCEPTION 'Solo se puede marcar inasistencia desde el día de la cita. Si el paciente avisa antes, anula o reagenda la cita.';
  END IF;

  UPDATE public.citas
     SET estado = p_estado,
         motivo_cancelacion   = CASE WHEN p_estado = 'CANCELADA' THEN trim(p_motivo) ELSE motivo_cancelacion END,
         hora_llegada         = CASE WHEN p_estado = 'EN_ESPERA' THEN now()
                                     WHEN p_estado = 'EN_ATENCION' THEN COALESCE(hora_llegada, now()) ELSE hora_llegada END,
         hora_inicio_atencion = CASE WHEN p_estado = 'EN_ATENCION' THEN now()
                                     WHEN p_estado = 'REALIZADA' THEN COALESCE(hora_inicio_atencion, now()) ELSE hora_inicio_atencion END,
         hora_fin_atencion    = CASE WHEN p_estado = 'REALIZADA' THEN now() ELSE hora_fin_atencion END,
         llegada_at           = CASE WHEN p_estado = 'EN_ESPERA' THEN now()
                                     WHEN p_estado = 'EN_ATENCION' THEN COALESCE(llegada_at, hora_llegada, now()) ELSE llegada_at END,
         atencion_inicio_at   = CASE WHEN p_estado = 'EN_ATENCION' THEN now()
                                     WHEN p_estado = 'REALIZADA' THEN COALESCE(atencion_inicio_at, hora_inicio_atencion, now()) ELSE atencion_inicio_at END,
         atencion_fin_at      = CASE WHEN p_estado = 'REALIZADA' THEN now() ELSE atencion_fin_at END
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

-- ---------- Permisos ----------
REVOKE ALL ON FUNCTION public.item_copiar_reparto() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.porcentaje_item(text, numeric, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guardar_catalogo(text, uuid, text, uuid, text, boolean, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generar_liquidacion(uuid, text, uuid, integer, integer, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cambiar_estado_cita(uuid, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guardar_catalogo(text, uuid, text, uuid, text, boolean, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.generar_liquidacion(uuid, text, uuid, integer, integer, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cambiar_estado_cita(uuid, text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.porcentaje_item(text, numeric, numeric) TO service_role;

NOTIFY pgrst, 'reload schema';
