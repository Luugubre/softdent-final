CREATE TABLE IF NOT EXISTS public.historial_paciente (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id      uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
  tipo             text NOT NULL,
  accion           text NOT NULL,
  titulo           text NOT NULL,
  detalle          text,
  profesional      text,
  referencia_tabla text,
  referencia_id    uuid,
  datos            jsonb,
  fecha            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT historial_tipo_chk CHECK (tipo IN (
    'PACIENTE', 'ANTECEDENTE', 'EVOLUCION', 'ARCHIVO', 'CITA', 'PRESUPUESTO',
    'PAGO', 'ODONTOGRAMA', 'RECETA', 'DOCUMENTO', 'CONSENTIMIENTO'
  ))
);

CREATE INDEX IF NOT EXISTS historial_paciente_fecha_idx
  ON public.historial_paciente (paciente_id, fecha DESC);

CREATE OR REPLACE FUNCTION public.historial_solo_insercion()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'El historial del paciente no se modifica ni se elimina.';
END;
$$;

DROP TRIGGER IF EXISTS historial_solo_insercion_trg ON public.historial_paciente;
CREATE TRIGGER historial_solo_insercion_trg
  BEFORE UPDATE OR DELETE ON public.historial_paciente
  FOR EACH ROW EXECUTE FUNCTION public.historial_solo_insercion();

ALTER TABLE public.historial_paciente ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.registrar_evento(
  p_paciente_id uuid,
  p_tipo        text,
  p_accion      text,
  p_titulo      text,
  p_detalle     text  DEFAULT NULL,
  p_profesional text  DEFAULT NULL,
  p_tabla       text  DEFAULT NULL,
  p_ref_id      uuid  DEFAULT NULL,
  p_datos       jsonb DEFAULT NULL
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.historial_paciente
    (paciente_id, tipo, accion, titulo, detalle, profesional, referencia_tabla, referencia_id, datos)
  VALUES
    (p_paciente_id, p_tipo, p_accion, p_titulo, p_detalle, p_profesional, p_tabla, p_ref_id, p_datos);
END;
$$;

CREATE OR REPLACE FUNCTION public.historial_pacientes_trg()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  etiquetas jsonb := '{
    "rut": "RUT", "extranjero": "extranjero", "nombres": "nombres", "apellidos": "apellidos",
    "nombre_social": "nombre social", "fecha_nacimiento": "fecha de nacimiento", "sexo": "sexo",
    "genero": "género", "telefono": "celular", "telefono_fijo": "teléfono fijo", "email": "correo",
    "direccion": "dirección", "comuna": "comuna", "ciudad": "ciudad", "prevision": "previsión",
    "actividad_profesion": "actividad", "empleador": "empleador", "referencia": "referencia",
    "observaciones": "observaciones", "apoderado_nombre": "apoderado", "apoderado_rut": "RUT apoderado",
    "apoderado_telefono": "teléfono apoderado"
  }';
  cambios text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.registrar_evento(NEW.id, 'PACIENTE', 'CREADO', 'Paciente registrado',
      'Ficha #' || NEW.numero_ficha || ' · Previsión: ' || NEW.prevision, NULL, 'pacientes', NEW.id);
    RETURN NEW;
  END IF;

  IF NEW.activo IS DISTINCT FROM OLD.activo THEN
    IF NEW.activo THEN
      PERFORM public.registrar_evento(NEW.id, 'PACIENTE', 'HABILITADO', 'Paciente habilitado',
        NULL, NULL, 'pacientes', NEW.id);
    ELSE
      PERFORM public.registrar_evento(NEW.id, 'PACIENTE', 'DESHABILITADO', 'Paciente deshabilitado',
        NEW.motivo_deshabilitado, NULL, 'pacientes', NEW.id);
    END IF;
  END IF;

  IF NEW.titular_id IS DISTINCT FROM OLD.titular_id THEN
    PERFORM public.registrar_evento(NEW.id, 'PACIENTE', 'ACTUALIZADO',
      CASE WHEN NEW.titular_id IS NULL THEN 'Desvinculado de su titular' ELSE 'Asignado como carga familiar' END,
      (SELECT nombres || ' ' || apellidos FROM public.pacientes WHERE id = COALESCE(NEW.titular_id, OLD.titular_id)),
      NULL, 'pacientes', NEW.id);
  END IF;

  SELECT string_agg(etiquetas ->> n.key, ', ')
    INTO cambios
    FROM jsonb_each(to_jsonb(NEW)) AS n
   WHERE etiquetas ? n.key
     AND n.value IS DISTINCT FROM (to_jsonb(OLD) -> n.key);

  IF cambios IS NOT NULL THEN
    PERFORM public.registrar_evento(NEW.id, 'PACIENTE', 'ACTUALIZADO', 'Datos personales actualizados',
      'Campos modificados: ' || cambios, NULL, 'pacientes', NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS historial_pacientes ON public.pacientes;
CREATE TRIGGER historial_pacientes
  AFTER INSERT OR UPDATE ON public.pacientes
  FOR EACH ROW EXECUTE FUNCTION public.historial_pacientes_trg();

CREATE OR REPLACE FUNCTION public.historial_antecedentes_trg()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  nombre_cat text := CASE NEW.categoria
    WHEN 'ALERGIA' THEN 'Alergia' WHEN 'ENFERMEDAD' THEN 'Enfermedad'
    WHEN 'MEDICAMENTO' THEN 'Medicamento' WHEN 'CIRUGIA' THEN 'Cirugía'
    WHEN 'HABITO' THEN 'Hábito' ELSE 'Otro' END;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.registrar_evento(NEW.paciente_id, 'ANTECEDENTE', 'CREADO',
      'Antecedente registrado: ' || nombre_cat, NEW.contenido, NULL, 'antecedentes', NEW.id,
      jsonb_build_object('categoria', NEW.categoria));
  ELSIF OLD.vigente AND NOT NEW.vigente THEN
    PERFORM public.registrar_evento(NEW.paciente_id, 'ANTECEDENTE', 'BAJA',
      'Antecedente dado de baja: ' || nombre_cat,
      NEW.contenido || COALESCE(' · Motivo: ' || NEW.motivo_baja, ''), NULL, 'antecedentes', NEW.id,
      jsonb_build_object('categoria', NEW.categoria));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS historial_antecedentes ON public.antecedentes;
CREATE TRIGGER historial_antecedentes
  AFTER INSERT OR UPDATE ON public.antecedentes
  FOR EACH ROW EXECUTE FUNCTION public.historial_antecedentes_trg();

CREATE TABLE IF NOT EXISTS public.evoluciones (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id        uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
  fecha_atencion     date NOT NULL DEFAULT CURRENT_DATE,
  profesional_nombre text NOT NULL,
  profesional_id     uuid,
  motivo             text,
  diagnostico        text,
  procedimiento      text NOT NULL,
  observaciones      text,
  indicaciones       text,
  created_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT evoluciones_fecha_chk CHECK (fecha_atencion <= CURRENT_DATE),
  CONSTRAINT evoluciones_procedimiento_chk CHECK (length(trim(procedimiento)) > 0),
  CONSTRAINT evoluciones_profesional_chk CHECK (length(trim(profesional_nombre)) > 0)
);

CREATE INDEX IF NOT EXISTS evoluciones_paciente_idx
  ON public.evoluciones (paciente_id, fecha_atencion DESC, created_at DESC);

CREATE OR REPLACE FUNCTION public.evoluciones_inmutables()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Una evolución registrada no se modifica ni se elimina: registra una nueva evolución como corrección.';
END;
$$;

DROP TRIGGER IF EXISTS evoluciones_inmutables_trg ON public.evoluciones;
CREATE TRIGGER evoluciones_inmutables_trg
  BEFORE UPDATE OR DELETE ON public.evoluciones
  FOR EACH ROW EXECUTE FUNCTION public.evoluciones_inmutables();

ALTER TABLE public.evoluciones ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.historial_evoluciones_trg()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.registrar_evento(NEW.paciente_id, 'EVOLUCION', 'CREADO',
    COALESCE('Evolución · ' || NULLIF(trim(NEW.motivo), ''), 'Evolución'),
    NEW.procedimiento, NEW.profesional_nombre, 'evoluciones', NEW.id,
    jsonb_build_object('fecha_atencion', NEW.fecha_atencion, 'diagnostico', NEW.diagnostico));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS historial_evoluciones ON public.evoluciones;
CREATE TRIGGER historial_evoluciones
  AFTER INSERT ON public.evoluciones
  FOR EACH ROW EXECUTE FUNCTION public.historial_evoluciones_trg();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'archivos-pacientes', 'archivos-pacientes', false, 10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.archivos_paciente (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id    uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
  categoria      text NOT NULL DEFAULT 'RADIOGRAFIA',
  titulo         text NOT NULL,
  descripcion    text,
  ruta_storage   text NOT NULL UNIQUE,
  nombre_archivo text NOT NULL,
  tipo_mime      text NOT NULL,
  tamano_bytes   bigint NOT NULL,
  subido_por     text,
  fecha_subida   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT archivos_categoria_chk
    CHECK (categoria IN ('RADIOGRAFIA', 'FOTO_CLINICA', 'EXAMEN', 'DOCUMENTO', 'OTRO')),
  CONSTRAINT archivos_tamano_chk CHECK (tamano_bytes > 0 AND tamano_bytes <= 10485760)
);

CREATE INDEX IF NOT EXISTS archivos_paciente_idx
  ON public.archivos_paciente (paciente_id, fecha_subida DESC);

ALTER TABLE public.archivos_paciente ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.historial_archivos_trg()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  nombre_cat text := CASE NEW.categoria
    WHEN 'RADIOGRAFIA' THEN 'Radiografía' WHEN 'FOTO_CLINICA' THEN 'Foto clínica'
    WHEN 'EXAMEN' THEN 'Examen' WHEN 'DOCUMENTO' THEN 'Documento' ELSE 'Archivo' END;
BEGIN
  PERFORM public.registrar_evento(NEW.paciente_id, 'ARCHIVO', 'CREADO',
    nombre_cat || ' subida: ' || NEW.titulo, NEW.descripcion, NEW.subido_por,
    'archivos_paciente', NEW.id,
    jsonb_build_object('ruta', NEW.ruta_storage, 'tipo_mime', NEW.tipo_mime, 'categoria', NEW.categoria));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS historial_archivos ON public.archivos_paciente;
CREATE TRIGGER historial_archivos
  AFTER INSERT ON public.archivos_paciente
  FOR EACH ROW EXECUTE FUNCTION public.historial_archivos_trg();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.historial_paciente) THEN
    INSERT INTO public.historial_paciente (paciente_id, tipo, accion, titulo, detalle, referencia_tabla, referencia_id, fecha)
    SELECT id, 'PACIENTE', 'CREADO', 'Paciente registrado',
           'Ficha #' || numero_ficha || ' · Previsión: ' || prevision, 'pacientes', id, created_at
      FROM public.pacientes;

    INSERT INTO public.historial_paciente (paciente_id, tipo, accion, titulo, detalle, referencia_tabla, referencia_id, datos, fecha)
    SELECT paciente_id, 'ANTECEDENTE', 'CREADO', 'Antecedente registrado', contenido,
           'antecedentes', id, jsonb_build_object('categoria', categoria), fecha_registro
      FROM public.antecedentes;
  END IF;
END;
$$;
