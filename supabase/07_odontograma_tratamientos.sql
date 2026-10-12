CREATE OR REPLACE FUNCTION public.pieza_fdi_valida(p integer)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p IS NOT NULL AND (
    (p / 10 BETWEEN 1 AND 4 AND p % 10 BETWEEN 1 AND 8) OR
    (p / 10 BETWEEN 5 AND 8 AND p % 10 BETWEEN 1 AND 5)
  );
$$;

CREATE TABLE IF NOT EXISTS public.odontograma_hallazgos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
  pieza       integer NOT NULL,
  tipo        text NOT NULL,
  codigo      text NOT NULL,
  caras       text[] NOT NULL DEFAULT '{}',
  nota        text,
  vigente     boolean NOT NULL DEFAULT true,
  creado_por  uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  baja_por    uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  fecha_baja  timestamptz,
  motivo_baja text,

  CONSTRAINT hallazgos_pieza_chk  CHECK (public.pieza_fdi_valida(pieza)),
  CONSTRAINT hallazgos_tipo_chk   CHECK (tipo IN ('PREEXISTENCIA', 'LESION', 'AUSENTE')),
  CONSTRAINT hallazgos_codigo_chk CHECK (codigo ~ '^[A-Z_]{2,30}$'),
  CONSTRAINT hallazgos_caras_chk  CHECK (caras <@ ARRAY['O','M','D','V','L']::text[]),
  CONSTRAINT hallazgos_baja_chk   CHECK (vigente OR fecha_baja IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS hallazgos_paciente_idx ON public.odontograma_hallazgos (paciente_id, pieza);
CREATE UNIQUE INDEX IF NOT EXISTS hallazgos_un_ausente
  ON public.odontograma_hallazgos (paciente_id, pieza) WHERE tipo = 'AUSENTE' AND vigente;

CREATE OR REPLACE FUNCTION public.hallazgos_validar()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tipo <> 'AUSENTE' AND EXISTS (
    SELECT 1 FROM public.odontograma_hallazgos
     WHERE paciente_id = NEW.paciente_id AND pieza = NEW.pieza AND tipo = 'AUSENTE' AND vigente
  ) THEN
    RAISE EXCEPTION 'La pieza % está marcada como ausente. Márcala sana primero si es un error.', NEW.pieza;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hallazgos_validar_trg ON public.odontograma_hallazgos;
CREATE TRIGGER hallazgos_validar_trg BEFORE INSERT ON public.odontograma_hallazgos
  FOR EACH ROW EXECUTE FUNCTION public.hallazgos_validar();

CREATE OR REPLACE FUNCTION public.hallazgos_proteger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'El historial del odontograma no se elimina.';
  END IF;
  IF NEW.pieza IS DISTINCT FROM OLD.pieza OR NEW.tipo IS DISTINCT FROM OLD.tipo
     OR NEW.codigo IS DISTINCT FROM OLD.codigo OR NEW.caras IS DISTINCT FROM OLD.caras
     OR NEW.paciente_id IS DISTINCT FROM OLD.paciente_id OR (OLD.vigente = false) THEN
    RAISE EXCEPTION 'Un hallazgo registrado no se modifica.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hallazgos_proteger_trg ON public.odontograma_hallazgos;
CREATE TRIGGER hallazgos_proteger_trg BEFORE UPDATE OR DELETE ON public.odontograma_hallazgos
  FOR EACH ROW EXECUTE FUNCTION public.hallazgos_proteger();

ALTER TABLE public.odontograma_hallazgos ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.historial_hallazgos_trg()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  titulo text;
BEGIN
  titulo := CASE NEW.tipo
    WHEN 'AUSENTE' THEN 'Pieza ' || NEW.pieza || ' marcada ausente'
    WHEN 'LESION' THEN 'Lesión en pieza ' || NEW.pieza || ': ' || initcap(replace(NEW.codigo, '_', ' '))
    ELSE 'Preexistencia en pieza ' || NEW.pieza || ': ' || initcap(replace(NEW.codigo, '_', ' '))
  END;
  PERFORM public.registrar_evento(NEW.paciente_id, 'ODONTOGRAMA', 'CREADO', titulo,
    concat_ws(' · ',
      CASE WHEN cardinality(NEW.caras) > 0 THEN 'Caras: ' || array_to_string(NEW.caras, ', ') END,
      NULLIF(trim(NEW.nota), '')),
    NULL, 'odontograma_hallazgos', NEW.id, jsonb_build_object('pieza', NEW.pieza), NEW.creado_por);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS historial_hallazgos ON public.odontograma_hallazgos;
CREATE TRIGGER historial_hallazgos AFTER INSERT ON public.odontograma_hallazgos
  FOR EACH ROW EXECUTE FUNCTION public.historial_hallazgos_trg();

CREATE OR REPLACE FUNCTION public.marcar_pieza_ausente(p_paciente uuid, p_pieza integer, p_usuario uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT public.pieza_fdi_valida(p_pieza) THEN RAISE EXCEPTION 'Pieza dental inválida.'; END IF;
  IF EXISTS (SELECT 1 FROM public.odontograma_hallazgos
              WHERE paciente_id = p_paciente AND pieza = p_pieza AND tipo = 'AUSENTE' AND vigente) THEN
    RAISE EXCEPTION 'La pieza % ya está marcada como ausente.', p_pieza;
  END IF;

  UPDATE public.odontograma_hallazgos
     SET vigente = false, fecha_baja = now(), baja_por = p_usuario, motivo_baja = 'Pieza marcada ausente'
   WHERE paciente_id = p_paciente AND pieza = p_pieza AND vigente;

  INSERT INTO public.odontograma_hallazgos (paciente_id, pieza, tipo, codigo, creado_por)
  VALUES (p_paciente, p_pieza, 'AUSENTE', 'AUSENTE', p_usuario);
END;
$$;

CREATE OR REPLACE FUNCTION public.marcar_pieza_sana(p_paciente uuid, p_pieza integer, p_usuario uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.odontograma_hallazgos
     SET vigente = false, fecha_baja = now(), baja_por = p_usuario, motivo_baja = 'Pieza marcada sana'
   WHERE paciente_id = p_paciente AND pieza = p_pieza AND vigente;
  GET DIAGNOSTICS n = ROW_COUNT;

  IF n = 0 THEN
    RAISE EXCEPTION 'La pieza % no tiene hallazgos registrados.', p_pieza;
  END IF;

  PERFORM public.registrar_evento(p_paciente, 'ODONTOGRAMA', 'ACTUALIZADO',
    'Pieza ' || p_pieza || ' marcada sana', n || ' hallazgo(s) dado(s) de baja',
    NULL, 'odontograma_hallazgos', NULL, jsonb_build_object('pieza', p_pieza), p_usuario);
END;
$$;

CREATE TABLE IF NOT EXISTS public.presupuestos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
  nombre      text NOT NULL DEFAULT 'Plan de tratamiento',
  arancel_id  uuid NOT NULL REFERENCES public.aranceles(id) ON DELETE RESTRICT,
  estado      text NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'FINALIZADO', 'ANULADO')),
  creado_por  uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS presupuestos_un_activo ON public.presupuestos (paciente_id) WHERE estado = 'ACTIVO';

DROP TRIGGER IF EXISTS presupuestos_set_updated_at ON public.presupuestos;
CREATE TRIGGER presupuestos_set_updated_at BEFORE UPDATE ON public.presupuestos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.presupuesto_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_id    uuid NOT NULL REFERENCES public.presupuestos(id) ON DELETE RESTRICT,
  paciente_id       uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
  prestacion_id     uuid NOT NULL REFERENCES public.prestaciones(id) ON DELETE RESTRICT,
  pieza             integer,
  caras             text[] NOT NULL DEFAULT '{}',
  precio            integer NOT NULL CHECK (precio > 0),
  progreso          integer NOT NULL DEFAULT 0,
  estado            text NOT NULL DEFAULT 'PENDIENTE',
  monto_habilitado  integer NOT NULL DEFAULT 0,
  abonado           integer NOT NULL DEFAULT 0,
  nota              text,
  profesional_id    uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  creado_por        uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  completado_en     timestamptz,
  motivo_anulacion  text,

  CONSTRAINT items_pieza_chk     CHECK (pieza IS NULL OR public.pieza_fdi_valida(pieza)),
  CONSTRAINT items_caras_chk     CHECK (caras <@ ARRAY['O','M','D','V','L']::text[]),
  CONSTRAINT items_progreso_chk  CHECK (progreso IN (0, 25, 50, 75, 100)),
  CONSTRAINT items_estado_chk    CHECK (estado IN ('PENDIENTE', 'EN_PROCESO', 'REALIZADO', 'ANULADO')),
  CONSTRAINT items_habilitado_chk CHECK (monto_habilitado BETWEEN 0 AND precio),
  CONSTRAINT items_abonado_chk   CHECK (abonado BETWEEN 0 AND precio)
);

CREATE INDEX IF NOT EXISTS items_paciente_idx ON public.presupuesto_items (paciente_id, created_at);

CREATE OR REPLACE FUNCTION public.items_no_borrar()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Las prestaciones del plan no se eliminan: se anulan.';
END;
$$;

DROP TRIGGER IF EXISTS items_no_borrar_trg ON public.presupuesto_items;
CREATE TRIGGER items_no_borrar_trg BEFORE DELETE ON public.presupuesto_items
  FOR EACH ROW EXECUTE FUNCTION public.items_no_borrar();

CREATE TABLE IF NOT EXISTS public.item_avances (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id           uuid NOT NULL REFERENCES public.presupuesto_items(id) ON DELETE RESTRICT,
  progreso_anterior integer NOT NULL,
  progreso_nuevo    integer NOT NULL,
  monto             integer NOT NULL CHECK (monto >= 0),
  nota              text,
  evolucion_id      uuid REFERENCES public.evoluciones(id) ON DELETE SET NULL,
  profesional_id    uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT avances_progreso_chk CHECK (progreso_nuevo > progreso_anterior)
);

CREATE INDEX IF NOT EXISTS avances_item_idx ON public.item_avances (item_id, created_at);

ALTER TABLE public.presupuestos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presupuesto_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_avances      ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.arancel_paciente(p_paciente uuid)
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT pr.arancel_id FROM public.presupuestos pr WHERE pr.paciente_id = p_paciente AND pr.estado = 'ACTIVO'),
    (SELECT a.id FROM public.aranceles a JOIN public.pacientes p ON p.id = p_paciente
      WHERE a.activo AND a.tipo = 'FONASA' AND p.prevision ILIKE 'FONASA%'
      ORDER BY a.created_at LIMIT 1),
    (SELECT id FROM public.aranceles WHERE es_base)
  );
$$;

CREATE OR REPLACE FUNCTION public.agregar_prestacion_paciente(
  p_paciente   uuid,
  p_prestacion uuid,
  p_pieza      integer,
  p_caras      text[],
  p_usuario    uuid,
  p_nota       text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_presupuesto uuid;
  v_arancel uuid;
  v_precio integer;
  v_nuevo uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.pacientes WHERE id = p_paciente AND activo) THEN
    RAISE EXCEPTION 'El paciente no existe o está deshabilitado.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.prestaciones WHERE id = p_prestacion AND activo) THEN
    RAISE EXCEPTION 'La prestación no existe o está desactivada.';
  END IF;
  IF p_pieza IS NOT NULL AND NOT public.pieza_fdi_valida(p_pieza) THEN
    RAISE EXCEPTION 'Pieza dental inválida.';
  END IF;

  SELECT id, arancel_id INTO v_presupuesto, v_arancel
    FROM public.presupuestos WHERE paciente_id = p_paciente AND estado = 'ACTIVO';

  IF v_presupuesto IS NULL THEN
    v_arancel := public.arancel_paciente(p_paciente);
    INSERT INTO public.presupuestos (paciente_id, arancel_id, creado_por)
    VALUES (p_paciente, v_arancel, p_usuario)
    RETURNING id INTO v_presupuesto;
  END IF;

  v_precio := COALESCE(
    public.precio_vigente(p_prestacion, v_arancel),
    public.precio_vigente(p_prestacion, (SELECT id FROM public.aranceles WHERE es_base))
  );
  IF v_precio IS NULL OR v_precio <= 0 THEN
    RAISE EXCEPTION 'La prestación no tiene precio vigente. Asígnale un precio en Prestaciones.';
  END IF;

  INSERT INTO public.presupuesto_items
    (presupuesto_id, paciente_id, prestacion_id, pieza, caras, precio, nota, creado_por)
  VALUES
    (v_presupuesto, p_paciente, p_prestacion, p_pieza, COALESCE(p_caras, '{}'), v_precio, NULLIF(trim(p_nota), ''), p_usuario)
  RETURNING id INTO v_nuevo;

  RETURN v_nuevo;
END;
$$;

CREATE OR REPLACE FUNCTION public.evolucionar_item(
  p_item     uuid,
  p_progreso integer,
  p_usuario  uuid,
  p_nota     text DEFAULT NULL
) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  it public.presupuesto_items%ROWTYPE;
  v_prestacion public.prestaciones%ROWTYPE;
  v_monto integer;
  v_nombre text;
  v_evolucion uuid;
  v_texto text;
BEGIN
  IF p_progreso NOT IN (25, 50, 75, 100) THEN
    RAISE EXCEPTION '%', 'El avance debe ser 25, 50, 75 o 100%.';
  END IF;

  SELECT * INTO it FROM public.presupuesto_items WHERE id = p_item FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Prestación no encontrada.'; END IF;
  IF it.estado = 'ANULADO' THEN RAISE EXCEPTION 'La prestación está anulada.'; END IF;
  IF p_progreso <= it.progreso THEN
    RAISE EXCEPTION '%', 'El avance debe ser mayor al actual (' || it.progreso || '%).';
  END IF;

  v_nombre := public.nombre_usuario(p_usuario);
  IF v_nombre IS NULL THEN RAISE EXCEPTION 'Usuario no válido.'; END IF;

  SELECT * INTO v_prestacion FROM public.prestaciones WHERE id = it.prestacion_id;

  v_monto := round(it.precio * p_progreso / 100.0)::int - round(it.precio * it.progreso / 100.0)::int;

  v_texto := v_prestacion.nombre
    || COALESCE(' · Pieza ' || it.pieza, '')
    || CASE WHEN cardinality(it.caras) > 0 THEN ' (' || array_to_string(it.caras, ', ') || ')' ELSE '' END
    || ' · Avance ' || it.progreso || '% → ' || p_progreso || '%'
    || COALESCE(E'\n' || NULLIF(trim(p_nota), ''), '');

  INSERT INTO public.evoluciones (paciente_id, fecha_atencion, profesional_nombre, profesional_id, motivo, procedimiento)
  VALUES (it.paciente_id, public.hoy_chile(), v_nombre, p_usuario, 'Avance de tratamiento', v_texto)
  RETURNING id INTO v_evolucion;

  INSERT INTO public.item_avances (item_id, progreso_anterior, progreso_nuevo, monto, nota, evolucion_id, profesional_id)
  VALUES (p_item, it.progreso, p_progreso, v_monto, NULLIF(trim(p_nota), ''), v_evolucion, p_usuario);

  UPDATE public.presupuesto_items
     SET progreso = p_progreso,
         estado = CASE WHEN p_progreso = 100 THEN 'REALIZADO' ELSE 'EN_PROCESO' END,
         monto_habilitado = monto_habilitado + v_monto,
         completado_en = CASE WHEN p_progreso = 100 THEN now() ELSE NULL END,
         profesional_id = COALESCE(profesional_id, p_usuario)
   WHERE id = p_item;

  RETURN v_monto;
END;
$$;

CREATE OR REPLACE FUNCTION public.historial_items_trg()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_nombre text := (SELECT nombre FROM public.prestaciones WHERE id = NEW.prestacion_id);
  v_donde text := COALESCE(' · Pieza ' || NEW.pieza, '')
    || CASE WHEN cardinality(NEW.caras) > 0 THEN ' (' || array_to_string(NEW.caras, ', ') || ')' ELSE '' END;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.registrar_evento(NEW.paciente_id, 'PRESUPUESTO', 'CREADO',
      'Prestación agregada al plan: ' || v_nombre,
      'Valor $' || to_char(NEW.precio, 'FM999G999G999') || v_donde,
      NULL, 'presupuesto_items', NEW.id, jsonb_build_object('pieza', NEW.pieza), NEW.creado_por);
  ELSIF NEW.estado = 'ANULADO' AND OLD.estado <> 'ANULADO' THEN
    PERFORM public.registrar_evento(NEW.paciente_id, 'PRESUPUESTO', 'ANULADO',
      'Prestación anulada: ' || v_nombre, concat_ws(' · ', NULLIF(v_donde, ''), NEW.motivo_anulacion),
      NULL, 'presupuesto_items', NEW.id, jsonb_build_object('pieza', NEW.pieza), NULL);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS historial_items ON public.presupuesto_items;
CREATE TRIGGER historial_items AFTER INSERT OR UPDATE ON public.presupuesto_items
  FOR EACH ROW EXECUTE FUNCTION public.historial_items_trg();
