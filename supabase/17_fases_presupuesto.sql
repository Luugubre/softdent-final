CREATE TABLE IF NOT EXISTS public.presupuesto_fases (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_id uuid NOT NULL REFERENCES public.presupuestos(id) ON DELETE RESTRICT,
  numero         integer NOT NULL CHECK (numero > 0),
  nombre         text NOT NULL CHECK (length(trim(nombre)) BETWEEN 2 AND 80),
  descripcion    text,
  creado_por     uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT presupuesto_fases_numero_key UNIQUE (presupuesto_id, numero) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS presupuesto_fases_presupuesto_idx ON public.presupuesto_fases (presupuesto_id);

ALTER TABLE public.presupuesto_items ADD COLUMN IF NOT EXISTS fase_id uuid REFERENCES public.presupuesto_fases(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS presupuesto_items_fase_idx ON public.presupuesto_items (fase_id);

CREATE OR REPLACE FUNCTION public.items_validar_fase()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.fase_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.presupuesto_fases WHERE id = NEW.fase_id AND presupuesto_id = NEW.presupuesto_id
  ) THEN
    RAISE EXCEPTION 'La fase no pertenece a este tratamiento.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS items_validar_fase_trg ON public.presupuesto_items;
CREATE TRIGGER items_validar_fase_trg
  BEFORE INSERT OR UPDATE OF fase_id ON public.presupuesto_items
  FOR EACH ROW EXECUTE FUNCTION public.items_validar_fase();

CREATE OR REPLACE FUNCTION public.fase_editable(p_presupuesto uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_estado text;
BEGIN
  SELECT estado INTO v_estado FROM public.presupuestos WHERE id = p_presupuesto;
  IF v_estado IS NULL THEN RAISE EXCEPTION 'Tratamiento no encontrado.'; END IF;
  IF v_estado = 'ANULADO' THEN RAISE EXCEPTION 'El tratamiento está anulado: no se pueden modificar sus fases.'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.crear_fase(p_presupuesto uuid, p_nombre text, p_usuario uuid, p_descripcion text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid;
  v_numero integer;
BEGIN
  PERFORM public.fase_editable(p_presupuesto);
  PERFORM 1 FROM public.presupuestos WHERE id = p_presupuesto FOR UPDATE;
  IF length(trim(COALESCE(p_nombre, ''))) < 2 THEN RAISE EXCEPTION 'Ingresa un nombre para la fase.'; END IF;
  IF EXISTS (SELECT 1 FROM public.presupuesto_fases WHERE presupuesto_id = p_presupuesto AND lower(nombre) = lower(trim(p_nombre))) THEN
    RAISE EXCEPTION '%', 'Ya existe una fase llamada "' || trim(p_nombre) || '" en este tratamiento.';
  END IF;

  SELECT COALESCE(max(numero), 0) + 1 INTO v_numero FROM public.presupuesto_fases WHERE presupuesto_id = p_presupuesto;
  INSERT INTO public.presupuesto_fases (presupuesto_id, numero, nombre, descripcion, creado_por)
  VALUES (p_presupuesto, v_numero, trim(p_nombre), NULLIF(trim(COALESCE(p_descripcion, '')), ''), p_usuario)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.editar_fase(p_fase uuid, p_nombre text, p_descripcion text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  f public.presupuesto_fases%ROWTYPE;
BEGIN
  SELECT * INTO f FROM public.presupuesto_fases WHERE id = p_fase FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fase no encontrada.'; END IF;
  PERFORM public.fase_editable(f.presupuesto_id);
  IF length(trim(COALESCE(p_nombre, ''))) < 2 THEN RAISE EXCEPTION 'Ingresa un nombre para la fase.'; END IF;
  IF EXISTS (SELECT 1 FROM public.presupuesto_fases WHERE presupuesto_id = f.presupuesto_id AND id <> p_fase AND lower(nombre) = lower(trim(p_nombre))) THEN
    RAISE EXCEPTION '%', 'Ya existe una fase llamada "' || trim(p_nombre) || '" en este tratamiento.';
  END IF;
  UPDATE public.presupuesto_fases
     SET nombre = trim(p_nombre), descripcion = NULLIF(trim(COALESCE(p_descripcion, '')), '')
   WHERE id = p_fase;
END;
$$;

CREATE OR REPLACE FUNCTION public.mover_fase(p_fase uuid, p_direccion integer)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  f public.presupuesto_fases%ROWTYPE;
  vecina public.presupuesto_fases%ROWTYPE;
BEGIN
  SELECT * INTO f FROM public.presupuesto_fases WHERE id = p_fase FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fase no encontrada.'; END IF;
  PERFORM public.fase_editable(f.presupuesto_id);

  IF p_direccion < 0 THEN
    SELECT * INTO vecina FROM public.presupuesto_fases
     WHERE presupuesto_id = f.presupuesto_id AND numero < f.numero ORDER BY numero DESC LIMIT 1 FOR UPDATE;
  ELSE
    SELECT * INTO vecina FROM public.presupuesto_fases
     WHERE presupuesto_id = f.presupuesto_id AND numero > f.numero ORDER BY numero LIMIT 1 FOR UPDATE;
  END IF;
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.presupuesto_fases SET numero = vecina.numero WHERE id = f.id;
  UPDATE public.presupuesto_fases SET numero = f.numero WHERE id = vecina.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.eliminar_fase(p_fase uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  f public.presupuesto_fases%ROWTYPE;
BEGIN
  SELECT * INTO f FROM public.presupuesto_fases WHERE id = p_fase FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fase no encontrada.'; END IF;
  PERFORM public.fase_editable(f.presupuesto_id);

  UPDATE public.presupuesto_items SET fase_id = NULL WHERE fase_id = p_fase;
  DELETE FROM public.presupuesto_fases WHERE id = p_fase;
  UPDATE public.presupuesto_fases SET numero = numero - 1 WHERE presupuesto_id = f.presupuesto_id AND numero > f.numero;
END;
$$;

CREATE OR REPLACE FUNCTION public.asignar_fase(p_item uuid, p_fase uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  it public.presupuesto_items%ROWTYPE;
BEGIN
  SELECT * INTO it FROM public.presupuesto_items WHERE id = p_item FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Prestación no encontrada.'; END IF;
  PERFORM public.fase_editable(it.presupuesto_id);
  IF p_fase IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.presupuesto_fases WHERE id = p_fase AND presupuesto_id = it.presupuesto_id) THEN
    RAISE EXCEPTION 'La fase no pertenece a este tratamiento.';
  END IF;
  UPDATE public.presupuesto_items SET fase_id = p_fase WHERE id = p_item;
END;
$$;

NOTIFY pgrst, 'reload schema';
