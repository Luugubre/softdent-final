CREATE TABLE IF NOT EXISTS public.perfiles (
  id                   uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_completo      text NOT NULL,
  rut                  text UNIQUE,
  email                text NOT NULL UNIQUE,
  rol                  text NOT NULL,
  especialidad         text,
  registro_profesional text,
  activo               boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT perfiles_rol_chk
    CHECK (rol IN ('ADMINISTRADOR', 'DENTISTA', 'ASISTENTE', 'RECEPCIONISTA')),
  CONSTRAINT perfiles_rut_formato_chk
    CHECK (rut IS NULL OR rut ~ '^[0-9]{7,8}-[0-9K]$'),
  CONSTRAINT perfiles_nombre_chk
    CHECK (length(trim(nombre_completo)) > 0)
);

DROP TRIGGER IF EXISTS perfiles_set_updated_at ON public.perfiles;
CREATE TRIGGER perfiles_set_updated_at
  BEFORE UPDATE ON public.perfiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.nombre_usuario(p_id uuid)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT nombre_completo FROM public.perfiles WHERE id = p_id;
$$;

ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS modificado_por uuid;
ALTER TABLE public.pacientes DROP CONSTRAINT IF EXISTS pacientes_modificado_por_fkey;
ALTER TABLE public.pacientes ADD CONSTRAINT pacientes_modificado_por_fkey
  FOREIGN KEY (modificado_por) REFERENCES public.perfiles(id) ON DELETE SET NULL;

ALTER TABLE public.antecedentes ADD COLUMN IF NOT EXISTS baja_por uuid;
ALTER TABLE public.antecedentes DROP CONSTRAINT IF EXISTS antecedentes_profesional_id_fkey;
ALTER TABLE public.antecedentes ADD CONSTRAINT antecedentes_profesional_id_fkey
  FOREIGN KEY (profesional_id) REFERENCES public.perfiles(id) ON DELETE SET NULL;
ALTER TABLE public.antecedentes DROP CONSTRAINT IF EXISTS antecedentes_baja_por_fkey;
ALTER TABLE public.antecedentes ADD CONSTRAINT antecedentes_baja_por_fkey
  FOREIGN KEY (baja_por) REFERENCES public.perfiles(id) ON DELETE SET NULL;

ALTER TABLE public.evoluciones DROP CONSTRAINT IF EXISTS evoluciones_profesional_id_fkey;
ALTER TABLE public.evoluciones ADD CONSTRAINT evoluciones_profesional_id_fkey
  FOREIGN KEY (profesional_id) REFERENCES public.perfiles(id) ON DELETE SET NULL;

ALTER TABLE public.archivos_paciente ADD COLUMN IF NOT EXISTS subido_por_id uuid;
ALTER TABLE public.archivos_paciente DROP CONSTRAINT IF EXISTS archivos_subido_por_id_fkey;
ALTER TABLE public.archivos_paciente ADD CONSTRAINT archivos_subido_por_id_fkey
  FOREIGN KEY (subido_por_id) REFERENCES public.perfiles(id) ON DELETE SET NULL;

ALTER TABLE public.historial_paciente ADD COLUMN IF NOT EXISTS usuario_id uuid;
ALTER TABLE public.historial_paciente DROP CONSTRAINT IF EXISTS historial_usuario_id_fkey;
ALTER TABLE public.historial_paciente ADD CONSTRAINT historial_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES public.perfiles(id) ON DELETE SET NULL;

DROP FUNCTION IF EXISTS public.registrar_evento(uuid, text, text, text, text, text, text, uuid, jsonb);

CREATE OR REPLACE FUNCTION public.registrar_evento(
  p_paciente_id uuid,
  p_tipo        text,
  p_accion      text,
  p_titulo      text,
  p_detalle     text  DEFAULT NULL,
  p_profesional text  DEFAULT NULL,
  p_tabla       text  DEFAULT NULL,
  p_ref_id      uuid  DEFAULT NULL,
  p_datos       jsonb DEFAULT NULL,
  p_usuario_id  uuid  DEFAULT NULL
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.historial_paciente
    (paciente_id, tipo, accion, titulo, detalle, profesional, referencia_tabla, referencia_id, datos, usuario_id)
  VALUES
    (p_paciente_id, p_tipo, p_accion, p_titulo, p_detalle,
     COALESCE(p_profesional, public.nombre_usuario(p_usuario_id)),
     p_tabla, p_ref_id, p_datos, p_usuario_id);
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
  usuario uuid := NEW.modificado_por;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.registrar_evento(NEW.id, 'PACIENTE', 'CREADO', 'Paciente registrado',
      'Ficha #' || NEW.numero_ficha || ' · Previsión: ' || NEW.prevision,
      NULL, 'pacientes', NEW.id, NULL, usuario);
    RETURN NEW;
  END IF;

  IF NEW.activo IS DISTINCT FROM OLD.activo THEN
    IF NEW.activo THEN
      PERFORM public.registrar_evento(NEW.id, 'PACIENTE', 'HABILITADO', 'Paciente habilitado',
        NULL, NULL, 'pacientes', NEW.id, NULL, usuario);
    ELSE
      PERFORM public.registrar_evento(NEW.id, 'PACIENTE', 'DESHABILITADO', 'Paciente deshabilitado',
        NEW.motivo_deshabilitado, NULL, 'pacientes', NEW.id, NULL, usuario);
    END IF;
  END IF;

  IF NEW.titular_id IS DISTINCT FROM OLD.titular_id THEN
    PERFORM public.registrar_evento(NEW.id, 'PACIENTE', 'ACTUALIZADO',
      CASE WHEN NEW.titular_id IS NULL THEN 'Desvinculado de su titular' ELSE 'Asignado como carga familiar' END,
      (SELECT nombres || ' ' || apellidos FROM public.pacientes WHERE id = COALESCE(NEW.titular_id, OLD.titular_id)),
      NULL, 'pacientes', NEW.id, NULL, usuario);
  END IF;

  SELECT string_agg(etiquetas ->> n.key, ', ')
    INTO cambios
    FROM jsonb_each(to_jsonb(NEW)) AS n
   WHERE etiquetas ? n.key
     AND n.value IS DISTINCT FROM (to_jsonb(OLD) -> n.key);

  IF cambios IS NOT NULL THEN
    PERFORM public.registrar_evento(NEW.id, 'PACIENTE', 'ACTUALIZADO', 'Datos personales actualizados',
      'Campos modificados: ' || cambios, NULL, 'pacientes', NEW.id, NULL, usuario);
  END IF;

  RETURN NEW;
END;
$$;

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
      jsonb_build_object('categoria', NEW.categoria), NEW.profesional_id);
  ELSIF OLD.vigente AND NOT NEW.vigente THEN
    PERFORM public.registrar_evento(NEW.paciente_id, 'ANTECEDENTE', 'BAJA',
      'Antecedente dado de baja: ' || nombre_cat,
      NEW.contenido || COALESCE(' · Motivo: ' || NEW.motivo_baja, ''), NULL, 'antecedentes', NEW.id,
      jsonb_build_object('categoria', NEW.categoria), NEW.baja_por);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.historial_evoluciones_trg()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.registrar_evento(NEW.paciente_id, 'EVOLUCION', 'CREADO',
    COALESCE('Evolución · ' || NULLIF(trim(NEW.motivo), ''), 'Evolución'),
    NEW.procedimiento, NEW.profesional_nombre, 'evoluciones', NEW.id,
    jsonb_build_object('fecha_atencion', NEW.fecha_atencion, 'diagnostico', NEW.diagnostico),
    NEW.profesional_id);
  RETURN NEW;
END;
$$;

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
    jsonb_build_object('ruta', NEW.ruta_storage, 'tipo_mime', NEW.tipo_mime, 'categoria', NEW.categoria),
    NEW.subido_por_id);
  RETURN NEW;
END;
$$;

