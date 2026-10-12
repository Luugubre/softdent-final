CREATE OR REPLACE FUNCTION public.registrar_pago(
  p_paciente   uuid,
  p_monto      integer,
  p_metodo     text,
  p_detalle    jsonb,
  p_usuario    uuid,
  p_referencia text DEFAULT NULL,
  p_boleta     text DEFAULT NULL,
  p_nota       text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid;
  v_numero bigint;
  v_suma integer;
  v_item public.presupuesto_items%ROWTYPE;
  v_nombre text;
  v_trat_estado text;
  v_metodo public.metodos_pago%ROWTYPE;
  v_caja uuid := public.caja_abierta();
  v_paciente text;
  r record;
BEGIN
  IF p_monto IS NULL OR p_monto <= 0 THEN RAISE EXCEPTION 'El monto debe ser mayor a cero.'; END IF;
  SELECT nombres || ' ' || apellidos INTO v_paciente FROM public.pacientes WHERE id = p_paciente;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paciente no encontrado.'; END IF;

  SELECT * INTO v_metodo FROM public.metodos_pago WHERE codigo = p_metodo AND activo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Método de pago no válido o desactivado.'; END IF;
  IF v_metodo.pide_referencia AND length(trim(COALESCE(p_referencia, ''))) = 0 THEN
    RAISE EXCEPTION '%', 'Ingresa el N° de operación o comprobante (' || v_metodo.nombre || ').';
  END IF;
  IF v_metodo.registra_en_caja AND v_caja IS NULL THEN
    RAISE EXCEPTION '%', 'No hay una caja abierta: para recibir un pago con ' || v_metodo.nombre || ' abre la caja en el módulo Caja.';
  END IF;

  IF p_detalle IS NULL OR jsonb_typeof(p_detalle) <> 'array' OR jsonb_array_length(p_detalle) = 0 THEN
    RAISE EXCEPTION 'Indica a qué prestaciones se aplica el pago.';
  END IF;
  SELECT COALESCE(sum((e ->> 'monto')::integer), 0) INTO v_suma FROM jsonb_array_elements(p_detalle) e;
  IF v_suma <> p_monto THEN
    RAISE EXCEPTION '%', 'La distribución ($' || v_suma || ') no coincide con el monto del pago ($' || p_monto || ').';
  END IF;

  INSERT INTO public.pagos (paciente_id, monto, metodo, referencia, numero_boleta, nota, registrado_por)
  VALUES (p_paciente, p_monto, p_metodo, NULLIF(trim(p_referencia), ''), NULLIF(trim(p_boleta), ''), NULLIF(trim(p_nota), ''), p_usuario)
  RETURNING id, numero INTO v_id, v_numero;

  FOR r IN SELECT (e ->> 'item_id')::uuid AS item_id, (e ->> 'monto')::integer AS monto FROM jsonb_array_elements(p_detalle) e LOOP
    IF r.monto IS NULL OR r.monto <= 0 THEN RAISE EXCEPTION 'Cada monto aplicado debe ser mayor a cero.'; END IF;
    SELECT * INTO v_item FROM public.presupuesto_items WHERE id = r.item_id FOR UPDATE;
    IF NOT FOUND OR v_item.paciente_id <> p_paciente THEN RAISE EXCEPTION 'Una de las prestaciones no pertenece al paciente.'; END IF;
    v_nombre := (SELECT nombre FROM public.prestaciones WHERE id = v_item.prestacion_id);
    v_trat_estado := (SELECT estado FROM public.presupuestos WHERE id = v_item.presupuesto_id);
    IF v_item.estado = 'ANULADO' OR v_trat_estado = 'ANULADO' THEN
      RAISE EXCEPTION '%', 'No se puede pagar "' || v_nombre || '": está anulada.';
    END IF;
    IF r.monto > v_item.precio - v_item.abonado THEN
      RAISE EXCEPTION '%', 'El abono a "' || v_nombre || '" supera su saldo ($' || (v_item.precio - v_item.abonado) || ').';
    END IF;
    INSERT INTO public.pago_detalle (pago_id, item_id, monto) VALUES (v_id, r.item_id, r.monto);
    UPDATE public.presupuesto_items SET abonado = abonado + r.monto WHERE id = r.item_id;
  END LOOP;

  IF v_caja IS NOT NULL AND v_metodo.registra_en_caja THEN
    INSERT INTO public.caja_movimientos (caja_id, tipo, origen, monto, metodo, descripcion, pago_id, registrado_por)
    VALUES (v_caja, 'INGRESO', 'PAGO', p_monto, p_metodo, 'Pago N° ' || v_numero || ' · ' || v_paciente, v_id, p_usuario);
  END IF;

  PERFORM public.registrar_evento(p_paciente, 'PAGO', 'CREADO',
    'Pago N° ' || v_numero || ' · ' || public.pesos(p_monto),
    v_metodo.nombre || COALESCE(' · Ref. ' || NULLIF(trim(p_referencia), ''), '') || COALESCE(' · Boleta ' || NULLIF(trim(p_boleta), ''), ''),
    NULL, 'pagos', v_id, NULL, p_usuario);

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.anular_pago(p_pago uuid, p_usuario uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_pago public.pagos%ROWTYPE;
  v_liq bigint;
  v_mov public.caja_movimientos%ROWTYPE;
  v_estado_caja text;
  v_caja uuid := public.caja_abierta();
  d record;
BEGIN
  IF length(trim(COALESCE(p_motivo, ''))) < 3 THEN RAISE EXCEPTION 'Indica el motivo de la anulación.'; END IF;
  SELECT * INTO v_pago FROM public.pagos WHERE id = p_pago FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pago no encontrado.'; END IF;
  IF v_pago.estado <> 'VIGENTE' THEN RAISE EXCEPTION 'El pago ya está anulado.'; END IF;

  SELECT l.numero INTO v_liq
    FROM public.pago_detalle pd
    JOIN public.liquidacion_detalle ld ON ld.item_id = pd.item_id AND ld.vigente
    JOIN public.liquidaciones l ON l.id = ld.liquidacion_id
   WHERE pd.pago_id = p_pago LIMIT 1;
  IF v_liq IS NOT NULL THEN
    RAISE EXCEPTION '%', 'No se puede anular: este pago cubre prestaciones ya liquidadas al profesional (liquidación N° ' || v_liq || '). Si la liquidación aún no se paga, anúlala primero.';
  END IF;

  SELECT * INTO v_mov FROM public.caja_movimientos WHERE pago_id = p_pago AND NOT anulado LIMIT 1;
  IF FOUND THEN
    SELECT estado INTO v_estado_caja FROM public.cajas WHERE id = v_mov.caja_id;
    IF v_estado_caja = 'ABIERTA' THEN
      UPDATE public.caja_movimientos
         SET anulado = true, motivo_anulacion = 'Pago anulado: ' || trim(p_motivo), anulado_por = p_usuario, anulado_en = now()
       WHERE id = v_mov.id;
    ELSE
      IF v_caja IS NULL THEN
        RAISE EXCEPTION 'Ese pago entró en una caja ya cerrada: abre una caja para registrar la devolución.';
      ELSE
        INSERT INTO public.caja_movimientos (caja_id, tipo, origen, monto, metodo, descripcion, pago_id, registrado_por)
        VALUES (v_caja, 'EGRESO', 'AJUSTE', v_pago.monto, v_pago.metodo,
                'Anulación pago N° ' || v_pago.numero || ' (caja N° ' || (SELECT numero FROM public.cajas WHERE id = v_mov.caja_id) || '): ' || trim(p_motivo),
                p_pago, p_usuario);
      END IF;
    END IF;
  END IF;

  FOR d IN SELECT item_id, monto FROM public.pago_detalle WHERE pago_id = p_pago LOOP
    UPDATE public.presupuesto_items SET abonado = abonado - d.monto WHERE id = d.item_id;
  END LOOP;

  UPDATE public.pagos
     SET estado = 'ANULADO', anulado_por = p_usuario, fecha_anulacion = now(), motivo_anulacion = trim(p_motivo)
   WHERE id = p_pago;

  PERFORM public.registrar_evento(v_pago.paciente_id, 'PAGO', 'ANULADO',
    'Pago N° ' || v_pago.numero || ' anulado · ' || public.pesos(v_pago.monto),
    trim(p_motivo), NULL, 'pagos', p_pago, NULL, p_usuario);
END;
$$;

CREATE OR REPLACE FUNCTION public.pagar_cuota(p_cuota uuid, p_metodo text, p_usuario uuid, p_referencia text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  q public.convenio_cuotas%ROWTYPE;
  m public.metodos_pago%ROWTYPE;
  v_caja uuid := public.caja_abierta();
  v_desc text;
BEGIN
  SELECT * INTO q FROM public.convenio_cuotas WHERE id = p_cuota FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cuota no encontrada.'; END IF;
  IF q.pagada_en IS NOT NULL THEN RAISE EXCEPTION 'La cuota ya está pagada.'; END IF;
  SELECT * INTO m FROM public.metodos_pago WHERE codigo = p_metodo AND activo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Método de pago no válido.'; END IF;
  IF m.pide_referencia AND length(trim(COALESCE(p_referencia, ''))) = 0 THEN RAISE EXCEPTION 'Ingresa el N° de operación.'; END IF;
  IF m.registra_en_caja AND v_caja IS NULL THEN
    RAISE EXCEPTION '%', 'No hay una caja abierta: para recibir un pago con ' || m.nombre || ' abre la caja en el módulo Caja.';
  END IF;

  UPDATE public.convenio_cuotas
     SET pagada_en = now(), metodo = p_metodo, referencia = NULLIF(trim(p_referencia), ''), registrado_por = p_usuario
   WHERE id = p_cuota;

  IF v_caja IS NOT NULL AND m.registra_en_caja THEN
    SELECT 'Cuota ' || q.numero || '/' || ct.cantidad_cuotas || ' · contrato N° ' || ct.numero || ' · ' || cv.nombre
      INTO v_desc
      FROM public.convenio_contratos ct JOIN public.convenios cv ON cv.id = ct.convenio_id WHERE ct.id = q.contrato_id;
    INSERT INTO public.caja_movimientos (caja_id, tipo, origen, monto, metodo, descripcion, registrado_por)
    VALUES (v_caja, 'INGRESO', 'CUOTA_CONVENIO', q.monto, p_metodo, v_desc, p_usuario);
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
