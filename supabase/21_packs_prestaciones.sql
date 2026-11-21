-- =====================================================================
-- 21 · Packs (plantillas) de prestaciones
-- Idempotente.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.plantillas_prestaciones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL,
  descripcion text,
  activo      boolean NOT NULL DEFAULT true,
  creado_por  uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.plantilla_prestacion_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plantilla_id  uuid NOT NULL REFERENCES public.plantillas_prestaciones(id) ON DELETE CASCADE,
  prestacion_id uuid NOT NULL REFERENCES public.prestaciones(id) ON DELETE RESTRICT,
  cantidad      integer NOT NULL DEFAULT 1,
  precio_pack   integer,
  nota          text,
  orden         integer NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS plantilla_prestacion_items_idx ON public.plantilla_prestacion_items (plantilla_id, orden);

-- RLS activo sin políticas: acceso solo desde el servidor (service role).
ALTER TABLE public.plantillas_prestaciones    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plantilla_prestacion_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.plantillas_prestaciones, public.plantilla_prestacion_items FROM anon, authenticated;

-- La función aplicar_plantilla_tratamiento solo la ejecuta el servidor
DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = 'aplicar_plantilla_tratamiento' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END;
$$;
