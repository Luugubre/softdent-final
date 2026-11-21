-- =====================================================================
-- 18 · Recetario, plantillas de documentos y perfil de usuario
-- Idempotente.
-- =====================================================================

-- ---------- Perfil: columnas nuevas ----------
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS telefono           text;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS firma_svg          text;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS preferencias       jsonb;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS intentos_fallidos  integer DEFAULT 0;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS bloqueado_hasta    timestamptz;

-- ---------- Recetas ----------
CREATE TABLE IF NOT EXISTS public.recetas (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folio                  integer NOT NULL,
  paciente_id            uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
  profesional_id         uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE RESTRICT,
  diagnostico            text NOT NULL,
  indicaciones_generales text,
  estado                 text NOT NULL DEFAULT 'EMITIDA',
  motivo_anulacion       text,
  anulada_at             timestamptz,
  anulada_por            uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  created_at             timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.receta_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receta_id    uuid NOT NULL REFERENCES public.recetas(id) ON DELETE RESTRICT,
  medicamento  text NOT NULL,
  presentacion text NOT NULL,
  dosis        text NOT NULL,
  frecuencia   text NOT NULL,
  duracion     text NOT NULL,
  via          text NOT NULL DEFAULT 'Oral',
  cantidad     text NOT NULL
);

CREATE INDEX IF NOT EXISTS recetas_paciente_idx ON public.recetas (paciente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS receta_items_receta_idx ON public.receta_items (receta_id);

-- Restricciones: folio único, estados válidos y motivo al anular
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recetas_folio_key') THEN
    ALTER TABLE public.recetas ADD CONSTRAINT recetas_folio_key UNIQUE (folio);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recetas_estado_chk') THEN
    ALTER TABLE public.recetas ADD CONSTRAINT recetas_estado_chk CHECK (estado IN ('EMITIDA', 'ANULADA'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recetas_anulacion_chk') THEN
    ALTER TABLE public.recetas ADD CONSTRAINT recetas_anulacion_chk
      CHECK (estado <> 'ANULADA' OR length(trim(COALESCE(motivo_anulacion, ''))) >= 5) NOT VALID;
  END IF;
END;
$$;

-- ---------- Plantillas de documentos ----------
CREATE TABLE IF NOT EXISTS public.plantillas_documento (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo       varchar NOT NULL,
  nombre     varchar NOT NULL,
  contenido  text NOT NULL,
  version    integer NOT NULL DEFAULT 1,
  activa     boolean NOT NULL DEFAULT true,
  creado_por uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- Una sola versión activa por tipo. Si hay plantillas distintas activas con el
-- mismo tipo, la más reciente conserva el tipo y las demás reciben uno propio.
UPDATE public.plantillas_documento p
   SET tipo = left(d.tipo, 53) || '_' || upper(left(replace(p.id::text, '-', ''), 6))
  FROM (
    SELECT id, tipo, row_number() OVER (PARTITION BY tipo ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id) AS n
      FROM public.plantillas_documento
     WHERE activa
  ) d
 WHERE p.id = d.id AND d.n > 1;

CREATE UNIQUE INDEX IF NOT EXISTS plantillas_una_activa ON public.plantillas_documento (tipo) WHERE activa;

-- ---------- Seguridad ----------
-- RLS activo sin políticas: acceso solo desde el servidor (service role).
ALTER TABLE public.recetas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receta_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plantillas_documento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presupuesto_fases    ENABLE ROW LEVEL SECURITY;

-- Elimina las políticas del schema public
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END;
$$;

REVOKE ALL ON public.recetas, public.receta_items, public.plantillas_documento FROM anon, authenticated;

-- ---------- Funciones atómicas ----------

-- Emite una receta con sus medicamentos en una transacción, con folio correlativo.
CREATE OR REPLACE FUNCTION public.emitir_receta(
  p_paciente     uuid,
  p_profesional  uuid,
  p_diagnostico  text,
  p_indicaciones text,
  p_items        jsonb,
  p_usuario      uuid
) RETURNS TABLE (receta_id uuid, folio integer)
LANGUAGE plpgsql AS $$
DECLARE
  v_id    uuid;
  v_folio integer;
  v_item  jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.pacientes WHERE id = p_paciente) THEN
    RAISE EXCEPTION 'El paciente no existe.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.perfiles WHERE id = p_profesional AND rol = 'DENTISTA' AND activo) THEN
    RAISE EXCEPTION 'La receta debe emitirla un dentista activo.';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La receta debe tener al menos un medicamento.';
  END IF;

  -- Serializa la asignación de folios
  PERFORM pg_advisory_xact_lock(hashtext('recetas_folio'));
  SELECT COALESCE(MAX(r.folio), 0) + 1 INTO v_folio FROM public.recetas r;

  INSERT INTO public.recetas (folio, paciente_id, profesional_id, diagnostico, indicaciones_generales, estado)
  VALUES (v_folio, p_paciente, p_profesional, trim(p_diagnostico), NULLIF(trim(COALESCE(p_indicaciones, '')), ''), 'EMITIDA')
  RETURNING id INTO v_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.receta_items (receta_id, medicamento, presentacion, dosis, frecuencia, duracion, via, cantidad)
    VALUES (v_id, v_item->>'medicamento', v_item->>'presentacion', v_item->>'dosis', v_item->>'frecuencia',
            v_item->>'duracion', COALESCE(NULLIF(v_item->>'via', ''), 'Oral'), v_item->>'cantidad');
  END LOOP;

  PERFORM public.registrar_evento(p_paciente, 'RECETA', 'CREADO', 'Receta folio ' || v_folio,
    trim(p_diagnostico), NULL, 'recetas', v_id, jsonb_build_object('items', jsonb_array_length(p_items)), p_usuario);

  RETURN QUERY SELECT v_id, v_folio;
END;
$$;

-- Anula una receta emitida (dentista: solo las propias; administrador: cualquiera).
CREATE OR REPLACE FUNCTION public.anular_receta(p_receta uuid, p_usuario uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_receta public.recetas;
  v_rol    text;
BEGIN
  IF length(trim(COALESCE(p_motivo, ''))) < 5 THEN
    RAISE EXCEPTION 'Indica el motivo de la anulación (mínimo 5 caracteres).';
  END IF;

  SELECT * INTO v_receta FROM public.recetas WHERE id = p_receta FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La receta no existe.'; END IF;
  IF v_receta.estado <> 'EMITIDA' THEN RAISE EXCEPTION 'La receta ya está anulada.'; END IF;

  SELECT rol INTO v_rol FROM public.perfiles WHERE id = p_usuario;
  IF v_rol IS DISTINCT FROM 'ADMINISTRADOR' AND v_receta.profesional_id <> p_usuario THEN
    RAISE EXCEPTION 'Solo puedes anular tus propias recetas.';
  END IF;

  UPDATE public.recetas
     SET estado = 'ANULADA', motivo_anulacion = trim(p_motivo), anulada_at = now(), anulada_por = p_usuario
   WHERE id = p_receta;

  PERFORM public.registrar_evento(v_receta.paciente_id, 'RECETA', 'ANULADO', 'Receta folio ' || v_receta.folio,
    trim(p_motivo), NULL, 'recetas', p_receta, NULL, p_usuario);
END;
$$;

-- Nueva versión de plantilla; la anterior queda inactiva.
CREATE OR REPLACE FUNCTION public.guardar_plantilla(p_tipo text, p_nombre text, p_contenido text, p_usuario uuid)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE v_version integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('plantilla:' || p_tipo));
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_version FROM public.plantillas_documento WHERE tipo = p_tipo;

  UPDATE public.plantillas_documento SET activa = false, updated_at = now() WHERE tipo = p_tipo AND activa;
  INSERT INTO public.plantillas_documento (tipo, nombre, contenido, version, activa, creado_por)
  VALUES (p_tipo, trim(p_nombre), p_contenido, v_version, true, p_usuario);

  RETURN v_version;
END;
$$;

-- Ejecución solo para service_role
REVOKE ALL ON FUNCTION public.emitir_receta(uuid, uuid, text, text, jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.anular_receta(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guardar_plantilla(text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.emitir_receta(uuid, uuid, text, text, jsonb, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.anular_receta(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.guardar_plantilla(text, text, text, uuid) TO service_role;

-- ---------- Verificación: no deben quedar políticas en public ----------
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
