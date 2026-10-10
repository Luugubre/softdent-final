-- =====================================================================
-- Varios tratamientos por paciente (cada uno con su odontograma y plan)
-- Pegar en Supabase → SQL Editor → Run (después de 07)
-- =====================================================================

-- 1) Se permite más de un tratamiento activo por paciente
DROP INDEX IF EXISTS public.presupuestos_un_activo;

ALTER TABLE public.presupuestos
  ADD COLUMN IF NOT EXISTS numero           integer,
  ADD COLUMN IF NOT EXISTS descripcion      text,
  ADD COLUMN IF NOT EXISTS profesional_id   uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS finalizado_en    timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_anulacion text;

ALTER TABLE public.presupuestos ALTER COLUMN nombre SET DEFAULT 'Tratamiento';

-- Numerar los tratamientos que ya existían (1, 2, 3... por paciente)
UPDATE public.presupuestos p
   SET numero = s.n
  FROM (SELECT id, row_number() OVER (PARTITION BY paciente_id ORDER BY created_at) AS n
          FROM public.presupuestos) s
 WHERE s.id = p.id AND p.numero IS NULL;

ALTER TABLE public.presupuestos ALTER COLUMN numero SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS presupuestos_numero_key ON public.presupuestos (paciente_id, numero);
CREATE INDEX IF NOT EXISTS presupuestos_paciente_idx ON public.presupuestos (paciente_id, created_at DESC);

-- Un tratamiento no se borra: se anula
CREATE OR REPLACE FUNCTION public.presupuestos_no_borrar()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Los tratamientos no se eliminan: se anulan.';
END;
$$;

DROP TRIGGER IF EXISTS presupuestos_no_borrar_trg ON public.presupuestos;
CREATE TRIGGER presupuestos_no_borrar_trg BEFORE DELETE ON public.presupuestos
  FOR EACH ROW EXECUTE FUNCTION public.presupuestos_no_borrar();


-- 2) Arancel sugerido según la previsión del paciente
CREATE OR REPLACE FUNCTION public.arancel_paciente(p_paciente uuid)
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT a.id FROM public.aranceles a JOIN public.pacientes p ON p.id = p_paciente
      WHERE a.activo AND a.tipo = 'FONASA' AND p.prevision ILIKE 'FONASA%'
      ORDER BY a.created_at LIMIT 1),
    (SELECT id FROM public.aranceles WHERE es_base)
  );
$$;


-- 3) Crear tratamiento
CREATE OR REPLACE FUNCTION public.crear_tratamiento(
  p_paciente    uuid,
  p_nombre      text,
  p_usuario     uuid,
  p_arancel     uuid DEFAULT NULL,
  p_profesional uuid DEFAULT NULL,
  p_descripcion text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_arancel uuid := COALESCE(p_arancel, public.arancel_paciente(p_paciente));
  v_numero integer;
  v_id uuid;
BEGIN
  -- Bloquea al paciente para numerar sin choques
  PERFORM 1 FROM public.pacientes WHERE id = p_paciente AND activo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'El paciente no existe o está deshabilitado.'; END IF;

  IF length(trim(COALESCE(p_nombre, ''))) < 3 THEN
    RAISE EXCEPTION 'Ingresa un nombre para el tratamiento (mínimo 3 caracteres).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.aranceles WHERE id = v_arancel AND activo) THEN
    RAISE EXCEPTION 'El arancel no existe o está desactivado.';
  END IF;
  IF p_profesional IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.perfiles WHERE id = p_profesional AND activo AND rol IN ('DENTISTA', 'ADMINISTRADOR')
  ) THEN
    RAISE EXCEPTION 'El profesional seleccionado no es válido.';
  END IF;

  SELECT COALESCE(max(numero), 0) + 1 INTO v_numero FROM public.presupuestos WHERE paciente_id = p_paciente;

  INSERT INTO public.presupuestos (paciente_id, numero, nombre, descripcion, arancel_id, profesional_id, creado_por)
  VALUES (p_paciente, v_numero, trim(p_nombre), NULLIF(trim(p_descripcion), ''), v_arancel, p_profesional, p_usuario)
  RETURNING id INTO v_id;

  PERFORM public.registrar_evento(p_paciente, 'PRESUPUESTO', 'CREADO',
    'Tratamiento N° ' || v_numero || ' creado: ' || trim(p_nombre),
    'Arancel: ' || (SELECT nombre FROM public.aranceles WHERE id = v_arancel)
      || COALESCE(' · Profesional: ' || public.nombre_usuario(p_profesional), ''),
    NULL, 'presupuestos', v_id, NULL, p_usuario);

  RETURN v_id;
END;
$$;


-- 4) Agregar prestación a UN tratamiento (reemplaza la función anterior)
DROP FUNCTION IF EXISTS public.agregar_prestacion_paciente(uuid, uuid, integer, text[], uuid, text);

CREATE OR REPLACE FUNCTION public.agregar_prestacion_tratamiento(
  p_presupuesto uuid,
  p_prestacion  uuid,
  p_pieza       integer,
  p_caras       text[],
  p_usuario     uuid,
  p_nota        text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_pres public.presupuestos%ROWTYPE;
  v_precio integer;
  v_nuevo uuid;
BEGIN
  SELECT * INTO v_pres FROM public.presupuestos WHERE id = p_presupuesto;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tratamiento no encontrado.'; END IF;
  IF v_pres.estado <> 'ACTIVO' THEN
    RAISE EXCEPTION 'El tratamiento está finalizado o anulado: crea uno nuevo para agregar prestaciones.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pacientes WHERE id = v_pres.paciente_id AND activo) THEN
    RAISE EXCEPTION 'El paciente está deshabilitado.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.prestaciones WHERE id = p_prestacion AND activo) THEN
    RAISE EXCEPTION 'La prestación no existe o está desactivada.';
  END IF;
  IF p_pieza IS NOT NULL AND NOT public.pieza_fdi_valida(p_pieza) THEN
    RAISE EXCEPTION 'Pieza dental inválida.';
  END IF;

  v_precio := COALESCE(
    public.precio_vigente(p_prestacion, v_pres.arancel_id),
    public.precio_vigente(p_prestacion, (SELECT id FROM public.aranceles WHERE es_base))
  );
  IF v_precio IS NULL OR v_precio <= 0 THEN
    RAISE EXCEPTION 'La prestación no tiene precio vigente. Asígnale un precio en Prestaciones.';
  END IF;

  INSERT INTO public.presupuesto_items
    (presupuesto_id, paciente_id, prestacion_id, pieza, caras, precio, nota, creado_por)
  VALUES
    (p_presupuesto, v_pres.paciente_id, p_prestacion, p_pieza, COALESCE(p_caras, '{}'), v_precio,
     NULLIF(trim(p_nota), ''), p_usuario)
  RETURNING id INTO v_nuevo;

  RETURN v_nuevo;
END;
$$;


-- 5) Finalizar / anular tratamiento
CREATE OR REPLACE FUNCTION public.finalizar_tratamiento(p_presupuesto uuid, p_usuario uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_pres public.presupuestos%ROWTYPE;
BEGIN
  SELECT * INTO v_pres FROM public.presupuestos WHERE id = p_presupuesto FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tratamiento no encontrado.'; END IF;
  IF v_pres.estado <> 'ACTIVO' THEN RAISE EXCEPTION 'El tratamiento ya está finalizado o anulado.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.presupuesto_items WHERE presupuesto_id = p_presupuesto AND estado = 'REALIZADO') THEN
    RAISE EXCEPTION 'El tratamiento no tiene prestaciones realizadas.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.presupuesto_items
              WHERE presupuesto_id = p_presupuesto AND estado IN ('PENDIENTE', 'EN_PROCESO')) THEN
    RAISE EXCEPTION 'Aún hay prestaciones sin completar: evolúcionalas al 100%% o anúlalas.';
  END IF;

  UPDATE public.presupuestos SET estado = 'FINALIZADO', finalizado_en = now() WHERE id = p_presupuesto;

  PERFORM public.registrar_evento(v_pres.paciente_id, 'PRESUPUESTO', 'FINALIZADO',
    'Tratamiento N° ' || v_pres.numero || ' finalizado: ' || v_pres.nombre,
    NULL, NULL, 'presupuestos', p_presupuesto, NULL, p_usuario);
END;
$$;

CREATE OR REPLACE FUNCTION public.anular_tratamiento(p_presupuesto uuid, p_usuario uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_pres public.presupuestos%ROWTYPE;
BEGIN
  IF length(trim(COALESCE(p_motivo, ''))) = 0 THEN RAISE EXCEPTION 'Indica el motivo de la anulación.'; END IF;

  SELECT * INTO v_pres FROM public.presupuestos WHERE id = p_presupuesto FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tratamiento no encontrado.'; END IF;
  IF v_pres.estado <> 'ACTIVO' THEN RAISE EXCEPTION 'El tratamiento ya está finalizado o anulado.'; END IF;
  IF EXISTS (SELECT 1 FROM public.presupuesto_items WHERE presupuesto_id = p_presupuesto AND progreso > 0) THEN
    RAISE EXCEPTION 'No se puede anular: tiene prestaciones con avances (ya hay montos habilitados para cobro).';
  END IF;

  UPDATE public.presupuesto_items
     SET estado = 'ANULADO', motivo_anulacion = 'Tratamiento anulado: ' || trim(p_motivo)
   WHERE presupuesto_id = p_presupuesto AND estado <> 'ANULADO';

  UPDATE public.presupuestos SET estado = 'ANULADO', motivo_anulacion = trim(p_motivo) WHERE id = p_presupuesto;

  PERFORM public.registrar_evento(v_pres.paciente_id, 'PRESUPUESTO', 'ANULADO',
    'Tratamiento N° ' || v_pres.numero || ' anulado: ' || v_pres.nombre, trim(p_motivo),
    NULL, 'presupuestos', p_presupuesto, NULL, p_usuario);
END;
$$;


-- 6) El historial de prestaciones indica a qué tratamiento pertenecen
CREATE OR REPLACE FUNCTION public.historial_items_trg()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_nombre text := (SELECT nombre FROM public.prestaciones WHERE id = NEW.prestacion_id);
  v_trat text := (SELECT 'Tratamiento N° ' || numero || ' (' || nombre || ')' FROM public.presupuestos WHERE id = NEW.presupuesto_id);
  v_donde text := COALESCE(' · Pieza ' || NEW.pieza, '')
    || CASE WHEN cardinality(NEW.caras) > 0 THEN ' (' || array_to_string(NEW.caras, ', ') || ')' ELSE '' END;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.registrar_evento(NEW.paciente_id, 'PRESUPUESTO', 'CREADO',
      'Prestación agregada: ' || v_nombre,
      v_trat || ' · Valor $' || to_char(NEW.precio, 'FM999G999G999') || v_donde,
      NULL, 'presupuesto_items', NEW.id, jsonb_build_object('pieza', NEW.pieza), NEW.creado_por);
  ELSIF NEW.estado = 'ANULADO' AND OLD.estado <> 'ANULADO' THEN
    PERFORM public.registrar_evento(NEW.paciente_id, 'PRESUPUESTO', 'ANULADO',
      'Prestación anulada: ' || v_nombre, concat_ws(' · ', v_trat, NULLIF(v_donde, ''), NEW.motivo_anulacion),
      NULL, 'presupuesto_items', NEW.id, jsonb_build_object('pieza', NEW.pieza), NULL);
  END IF;
  RETURN NEW;
END;
$$;
