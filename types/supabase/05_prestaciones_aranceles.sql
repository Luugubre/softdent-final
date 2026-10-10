-- =====================================================================
-- Prestaciones y Aranceles · Supabase
-- Pegar en Supabase → SQL Editor → Run (después de 01 a 04)
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;   -- para impedir vigencias solapadas

-- Fecha de hoy en Chile (el servidor de Supabase está en UTC)
CREATE OR REPLACE FUNCTION public.hoy_chile()
RETURNS date LANGUAGE sql STABLE AS $$
  SELECT (now() AT TIME ZONE 'America/Santiago')::date;
$$;


-- =====================================================================
-- 1. CATÁLOGOS: especialidades y categorías
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.especialidades (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text NOT NULL UNIQUE CHECK (length(trim(nombre)) > 0),
  activo     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.categorias_prestaciones (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text NOT NULL UNIQUE CHECK (length(trim(nombre)) > 0),
  orden      integer NOT NULL DEFAULT 0,
  activo     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.especialidades (nombre) VALUES
  ('Odontología general'), ('Ortodoncia'), ('Endodoncia'), ('Periodoncia'),
  ('Implantología'), ('Rehabilitación oral'), ('Odontopediatría'),
  ('Cirugía maxilofacial'), ('Estética dental')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO public.categorias_prestaciones (nombre, orden) VALUES
  ('Diagnóstico', 1), ('Radiología', 2), ('Prevención', 3), ('Operatoria', 4),
  ('Endodoncia', 5), ('Periodoncia', 6), ('Cirugía', 7), ('Prótesis', 8),
  ('Implantología', 9), ('Ortodoncia', 10), ('Estética', 11), ('Urgencia', 12)
ON CONFLICT (nombre) DO NOTHING;


-- =====================================================================
-- 2. ARANCELES (listas de precios)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.aranceles (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre               text NOT NULL UNIQUE CHECK (length(trim(nombre)) > 0),
  tipo                 text NOT NULL CHECK (tipo IN ('PARTICULAR', 'FONASA', 'CONVENIO')),
  descripcion          text,
  -- Convenios: descuento automático sobre el arancel base cuando no hay precio especial
  porcentaje_descuento numeric(5,2) NOT NULL DEFAULT 0 CHECK (porcentaje_descuento BETWEEN 0 AND 100),
  es_base              boolean NOT NULL DEFAULT false,
  activo               boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT aranceles_base_chk CHECK (NOT es_base OR (tipo = 'PARTICULAR' AND porcentaje_descuento = 0 AND activo)),
  CONSTRAINT aranceles_descuento_chk CHECK (tipo = 'CONVENIO' OR porcentaje_descuento = 0)
);

-- Solo puede existir un arancel base
CREATE UNIQUE INDEX IF NOT EXISTS aranceles_un_solo_base ON public.aranceles (es_base) WHERE es_base;

DROP TRIGGER IF EXISTS aranceles_set_updated_at ON public.aranceles;
CREATE TRIGGER aranceles_set_updated_at BEFORE UPDATE ON public.aranceles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.aranceles (nombre, tipo, es_base, descripcion) VALUES
  ('Arancel particular', 'PARTICULAR', true, 'Precios generales de la clínica'),
  ('FONASA', 'FONASA', false, 'Valores para pacientes FONASA')
ON CONFLICT (nombre) DO NOTHING;


-- =====================================================================
-- 3. PRESTACIONES
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.prestaciones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_interno  text NOT NULL UNIQUE,
  codigo_fonasa   text,
  nombre          text NOT NULL,
  descripcion     text,
  categoria_id    uuid NOT NULL REFERENCES public.categorias_prestaciones(id) ON DELETE RESTRICT,
  especialidad_id uuid REFERENCES public.especialidades(id) ON DELETE RESTRICT,
  duracion_min    integer NOT NULL DEFAULT 30,
  activo          boolean NOT NULL DEFAULT true,
  creado_por      uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT prestaciones_codigo_formato_chk CHECK (codigo_interno ~ '^[A-Z0-9-]{2,20}$'),
  CONSTRAINT prestaciones_fonasa_formato_chk CHECK (codigo_fonasa IS NULL OR codigo_fonasa ~ '^[0-9]{7}$'),
  CONSTRAINT prestaciones_nombre_chk CHECK (length(trim(nombre)) >= 3),
  CONSTRAINT prestaciones_duracion_chk CHECK (duracion_min BETWEEN 5 AND 480 AND duracion_min % 5 = 0)
);

-- Duplicados: código FONASA único, y nombre único dentro de la misma especialidad
CREATE UNIQUE INDEX IF NOT EXISTS prestaciones_codigo_fonasa_key
  ON public.prestaciones (codigo_fonasa) WHERE codigo_fonasa IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS prestaciones_nombre_especialidad_key
  ON public.prestaciones (lower(trim(nombre)), COALESCE(especialidad_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS prestaciones_categoria_idx ON public.prestaciones (categoria_id);

DROP TRIGGER IF EXISTS prestaciones_set_updated_at ON public.prestaciones;
CREATE TRIGGER prestaciones_set_updated_at BEFORE UPDATE ON public.prestaciones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Profesionales habilitados (si no hay ninguno, todos los dentistas pueden realizarla)
CREATE TABLE IF NOT EXISTS public.prestacion_profesionales (
  prestacion_id  uuid NOT NULL REFERENCES public.prestaciones(id) ON DELETE CASCADE,
  profesional_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  PRIMARY KEY (prestacion_id, profesional_id)
);


-- =====================================================================
-- 4. PRECIOS por prestación y arancel, con vigencia e historial
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.prestacion_precios (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prestacion_id uuid NOT NULL REFERENCES public.prestaciones(id) ON DELETE RESTRICT,
  arancel_id    uuid NOT NULL REFERENCES public.aranceles(id) ON DELETE RESTRICT,
  precio        integer NOT NULL CHECK (precio > 0),
  vigente_desde date NOT NULL,
  vigente_hasta date,                    -- NULL = vigente indefinidamente
  motivo        text,
  creado_por    uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT precios_rango_chk CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde),
  -- Regla: no pueden existir vigencias solapadas para la misma prestación y arancel
  CONSTRAINT precios_sin_solapamiento EXCLUDE USING gist (
    prestacion_id WITH =,
    arancel_id WITH =,
    daterange(vigente_desde, vigente_hasta, '[]') WITH &&
  )
);

CREATE INDEX IF NOT EXISTS precios_busqueda_idx
  ON public.prestacion_precios (prestacion_id, arancel_id, vigente_desde DESC);

-- El historial de precios no se borra ni se reescribe: solo se puede cerrar la vigencia
CREATE OR REPLACE FUNCTION public.precios_proteger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'El historial de precios no se elimina.';
  END IF;
  IF NEW.precio IS DISTINCT FROM OLD.precio
     OR NEW.vigente_desde IS DISTINCT FROM OLD.vigente_desde
     OR NEW.prestacion_id IS DISTINCT FROM OLD.prestacion_id
     OR NEW.arancel_id IS DISTINCT FROM OLD.arancel_id
     OR OLD.vigente_hasta IS NOT NULL THEN
    RAISE EXCEPTION 'Un precio registrado no se modifica: registra un nuevo precio con su fecha de inicio.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS precios_proteger_trg ON public.prestacion_precios;
CREATE TRIGGER precios_proteger_trg BEFORE UPDATE OR DELETE ON public.prestacion_precios
  FOR EACH ROW EXECUTE FUNCTION public.precios_proteger();


-- ---------------------------------------------------------------------
-- fijar_precio: registra un nuevo precio y cierra el anterior (atómico)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fijar_precio(
  p_prestacion_id uuid,
  p_arancel_id    uuid,
  p_precio        integer,
  p_desde         date,
  p_usuario_id    uuid DEFAULT NULL,
  p_motivo        text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  ultimo public.prestacion_precios%ROWTYPE;
  nuevo_id uuid;
BEGIN
  IF p_precio IS NULL OR p_precio <= 0 THEN
    RAISE EXCEPTION 'El precio debe ser mayor a cero.';
  END IF;
  IF p_desde < public.hoy_chile() THEN
    RAISE EXCEPTION 'No se permiten cambios de precio retroactivos: la fecha debe ser hoy o posterior.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.aranceles WHERE id = p_arancel_id AND activo) THEN
    RAISE EXCEPTION 'El arancel no existe o está desactivado.';
  END IF;

  SELECT * INTO ultimo
    FROM public.prestacion_precios
   WHERE prestacion_id = p_prestacion_id AND arancel_id = p_arancel_id
   ORDER BY vigente_desde DESC
   LIMIT 1
   FOR UPDATE;

  IF FOUND THEN
    IF p_desde <= ultimo.vigente_desde THEN
      RAISE EXCEPTION 'La fecha de inicio debe ser posterior al %, cuando empezó el precio actual.',
        to_char(ultimo.vigente_desde, 'DD-MM-YYYY');
    END IF;
    IF ultimo.vigente_hasta IS NULL THEN
      UPDATE public.prestacion_precios SET vigente_hasta = p_desde - 1 WHERE id = ultimo.id;
    END IF;
  END IF;

  INSERT INTO public.prestacion_precios (prestacion_id, arancel_id, precio, vigente_desde, motivo, creado_por)
  VALUES (p_prestacion_id, p_arancel_id, p_precio, p_desde, NULLIF(trim(p_motivo), ''), p_usuario_id)
  RETURNING id INTO nuevo_id;

  RETURN nuevo_id;
END;
$$;


-- ---------------------------------------------------------------------
-- precio_vigente: precio de una prestación en un arancel para una fecha.
-- Si el convenio no tiene precio especial, aplica su % de descuento
-- sobre el arancel base. Lo usarán presupuestos y pagos.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.precio_vigente(
  p_prestacion_id uuid,
  p_arancel_id    uuid,
  p_fecha         date DEFAULT NULL
) RETURNS integer LANGUAGE plpgsql STABLE AS $$
DECLARE
  fecha date := COALESCE(p_fecha, public.hoy_chile());
  resultado integer;
  descuento numeric;
  base integer;
BEGIN
  SELECT precio INTO resultado
    FROM public.prestacion_precios
   WHERE prestacion_id = p_prestacion_id AND arancel_id = p_arancel_id
     AND daterange(vigente_desde, vigente_hasta, '[]') @> fecha;
  IF resultado IS NOT NULL THEN
    RETURN resultado;
  END IF;

  SELECT porcentaje_descuento INTO descuento FROM public.aranceles WHERE id = p_arancel_id;
  IF COALESCE(descuento, 0) > 0 THEN
    SELECT pp.precio INTO base
      FROM public.prestacion_precios pp
      JOIN public.aranceles a ON a.id = pp.arancel_id AND a.es_base
     WHERE pp.prestacion_id = p_prestacion_id
       AND daterange(pp.vigente_desde, pp.vigente_hasta, '[]') @> fecha;
    IF base IS NOT NULL THEN
      RETURN round(base * (1 - descuento / 100.0));
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

-- Vista con el precio de hoy de cada prestación en cada arancel activo
CREATE OR REPLACE VIEW public.v_precios_vigentes
WITH (security_invoker = true) AS
SELECT
  p.id AS prestacion_id,
  a.id AS arancel_id,
  public.precio_vigente(p.id, a.id) AS precio,
  EXISTS (
    SELECT 1 FROM public.prestacion_precios pp
     WHERE pp.prestacion_id = p.id AND pp.arancel_id = a.id
       AND daterange(pp.vigente_desde, pp.vigente_hasta, '[]') @> public.hoy_chile()
  ) AS es_precio_especifico
FROM public.prestaciones p
CROSS JOIN public.aranceles a
WHERE a.activo;


-- =====================================================================
-- 5. SEGURIDAD
-- =====================================================================
ALTER TABLE public.especialidades           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias_prestaciones  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aranceles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prestaciones             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prestacion_profesionales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prestacion_precios       ENABLE ROW LEVEL SECURITY;
