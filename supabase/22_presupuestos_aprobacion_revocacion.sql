-- =====================================================================
-- 22 · Aprobación y seguimiento de presupuestos, revocación de consentimientos
-- Idempotente.
-- =====================================================================

-- ---------- Presupuestos: aprobación y seguimiento comercial ----------
ALTER TABLE public.presupuestos ADD COLUMN IF NOT EXISTS aprobacion           text DEFAULT 'PENDIENTE';
ALTER TABLE public.presupuestos ADD COLUMN IF NOT EXISTS aprobado_en          timestamptz;
ALTER TABLE public.presupuestos ADD COLUMN IF NOT EXISTS motivo_rechazo       text;
ALTER TABLE public.presupuestos ADD COLUMN IF NOT EXISTS rechazo_detalle      text;
ALTER TABLE public.presupuestos ADD COLUMN IF NOT EXISTS rechazado_en         timestamptz;
ALTER TABLE public.presupuestos ADD COLUMN IF NOT EXISTS ultimo_contacto_at   timestamptz;
ALTER TABLE public.presupuestos ADD COLUMN IF NOT EXISTS ultimo_contacto_nota text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'presupuestos_aprobacion_chk') THEN
    ALTER TABLE public.presupuestos ADD CONSTRAINT presupuestos_aprobacion_chk
      CHECK (aprobacion IN ('PENDIENTE', 'APROBADO', 'RECHAZADO')) NOT VALID;
  END IF;
END;
$$;
CREATE INDEX IF NOT EXISTS presupuestos_aprobacion_idx ON public.presupuestos (aprobacion) WHERE estado = 'ACTIVO';

-- ---------- Consentimientos: revocación ----------
ALTER TABLE public.consentimientos_paciente ADD COLUMN IF NOT EXISTS motivo_revocacion text;
ALTER TABLE public.consentimientos_paciente ADD COLUMN IF NOT EXISTS revocado_at       timestamptz;

-- ---------- Saldos por paciente ----------
-- La vista respeta los permisos de quien consulta y solo la lee el servidor.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'v_saldos_pacientes') THEN
    EXECUTE 'ALTER VIEW public.v_saldos_pacientes SET (security_invoker = true)';
    EXECUTE 'REVOKE ALL ON public.v_saldos_pacientes FROM anon, authenticated';
  END IF;
END;
$$;
