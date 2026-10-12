CREATE TABLE IF NOT EXISTS public.antecedentes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id    uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
  categoria      text NOT NULL,
  contenido      text NOT NULL,
  vigente        boolean NOT NULL DEFAULT true,
  profesional_id uuid,
  fecha_registro timestamptz NOT NULL DEFAULT now(),
  fecha_baja     timestamptz,
  motivo_baja    text,

  CONSTRAINT antecedentes_categoria_chk
    CHECK (categoria IN ('ALERGIA', 'ENFERMEDAD', 'MEDICAMENTO', 'CIRUGIA', 'HABITO', 'OTRO')),
  CONSTRAINT antecedentes_contenido_chk
    CHECK (length(trim(contenido)) > 0),
  CONSTRAINT antecedentes_baja_chk
    CHECK (vigente OR fecha_baja IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS antecedentes_paciente_idx ON public.antecedentes (paciente_id, fecha_registro DESC);

CREATE OR REPLACE FUNCTION public.antecedentes_proteger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Los antecedentes no se eliminan: dalos de baja.';
  END IF;

  IF NEW.contenido IS DISTINCT FROM OLD.contenido
     OR NEW.categoria IS DISTINCT FROM OLD.categoria
     OR NEW.paciente_id IS DISTINCT FROM OLD.paciente_id
     OR NEW.fecha_registro IS DISTINCT FROM OLD.fecha_registro THEN
    RAISE EXCEPTION 'Un antecedente registrado no se modifica: dalo de baja y registra uno nuevo.';
  END IF;

  IF OLD.vigente = false AND NEW.vigente = true THEN
    RAISE EXCEPTION 'Un antecedente dado de baja no se reactiva: registra uno nuevo.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS antecedentes_proteger_trg ON public.antecedentes;
CREATE TRIGGER antecedentes_proteger_trg
  BEFORE UPDATE OR DELETE ON public.antecedentes
  FOR EACH ROW EXECUTE FUNCTION public.antecedentes_proteger();

ALTER TABLE public.antecedentes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.pacientes_validar_titular()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.titular_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.pacientes WHERE id = NEW.titular_id AND titular_id IS NOT NULL) THEN
      RAISE EXCEPTION 'El titular elegido ya es carga de otro paciente.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.pacientes WHERE titular_id = NEW.id) THEN
      RAISE EXCEPTION 'Este paciente es titular de otras cargas y no puede ser carga.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pacientes_validar_titular_trg ON public.pacientes;
CREATE TRIGGER pacientes_validar_titular_trg
  BEFORE INSERT OR UPDATE OF titular_id ON public.pacientes
  FOR EACH ROW EXECUTE FUNCTION public.pacientes_validar_titular();
