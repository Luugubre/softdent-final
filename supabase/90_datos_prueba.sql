INSERT INTO public.categorias_prestaciones (nombre, orden)
SELECT v.nombre, v.orden
FROM (VALUES ('Diagnóstico', 1), ('Radiología', 2), ('Prevención', 3), ('Operatoria', 4), ('Endodoncia', 5), ('Cirugía', 7),
             ('Prótesis', 8), ('Implantología', 9), ('Estética', 11), ('Urgencia', 12)) AS v(nombre, orden)
WHERE NOT EXISTS (SELECT 1 FROM public.categorias_prestaciones c WHERE lower(c.nombre) = lower(v.nombre));

INSERT INTO public.prestaciones (codigo_interno, codigo_fonasa, nombre, descripcion, categoria_id, especialidad_id, duracion_min, icono)
SELECT v.codigo, v.fonasa, v.nombre, v.descripcion,
       (SELECT id FROM public.categorias_prestaciones c WHERE lower(c.nombre) = lower(v.categoria) LIMIT 1),
       (SELECT id FROM public.especialidades e WHERE lower(e.nombre) = lower(v.especialidad) LIMIT 1),
       v.duracion, v.icono
FROM (VALUES
  ('EXA-01', '0101001', 'Examen y diagnóstico', 'Evaluación clínica inicial y plan de tratamiento', 'Diagnóstico', 'Odontología general', 30, 'otro'),
  ('RX-01', '0101009', 'Radiografía retroalveolar', 'Radiografía de una pieza dental', 'Radiología', 'Odontología general', 15, 'rayos'),
  ('RX-02', NULL, 'Radiografía panorámica', 'Radiografía de ambas arcadas', 'Radiología', 'Odontología general', 15, 'rayos'),
  ('PRE-01', '2701013', 'Destartraje y pulido coronario', 'Limpieza profesional', 'Prevención', 'Periodoncia', 45, 'limpieza'),
  ('PRE-02', '2701014', 'Sellante de fosas y fisuras', 'Sellante por pieza', 'Prevención', 'Odontopediatría', 30, 'sellante'),
  ('PRE-03', NULL, 'Aplicación de flúor barniz', 'Prevención de caries', 'Prevención', 'Odontopediatría', 15, 'otro'),
  ('OPE-01', '2701015', 'Restauración resina compuesta simple', 'Obturación de una cara', 'Operatoria', 'Odontología general', 45, 'restauracion'),
  ('OPE-02', NULL, 'Restauración resina compuesta compleja', 'Obturación de dos o más caras', 'Operatoria', 'Odontología general', 60, 'restauracion'),
  ('END-01', '2701020', 'Endodoncia unirradicular', 'Tratamiento de conducto de una raíz', 'Endodoncia', 'Endodoncia', 90, 'endodoncia'),
  ('END-02', NULL, 'Endodoncia multirradicular', 'Tratamiento de conducto de molar', 'Endodoncia', 'Endodoncia', 120, 'endodoncia'),
  ('CIR-01', '2701030', 'Exodoncia simple', 'Extracción dental simple', 'Cirugía', 'Cirugía maxilofacial', 30, 'extraccion'),
  ('CIR-02', NULL, 'Exodoncia de tercer molar', 'Extracción quirúrgica de muela del juicio', 'Cirugía', 'Cirugía maxilofacial', 60, 'cirugia'),
  ('PRO-01', NULL, 'Corona metal cerámica', 'Corona fija unitaria', 'Prótesis', 'Rehabilitación oral', 60, 'corona'),
  ('EST-01', NULL, 'Blanqueamiento dental', 'Blanqueamiento en clínica', 'Estética', 'Estética dental', 60, 'blanqueamiento'),
  ('URG-01', NULL, 'Atención de urgencia', 'Manejo del dolor e infección', 'Urgencia', 'Odontología general', 30, 'otro'),
  ('IMP-01', NULL, 'Implante dental', 'Implante de titanio con pilar', 'Implantología', 'Implantología', 120, 'implante')
) AS v(codigo, fonasa, nombre, descripcion, categoria, especialidad, duracion, icono)
ON CONFLICT (codigo_interno) DO NOTHING;

INSERT INTO public.prestacion_precios (prestacion_id, arancel_id, precio, vigente_desde, motivo)
SELECT p.id, a.id, CASE WHEN a.tipo = 'FONASA' THEN v.fonasa ELSE v.particular END, date_trunc('year', current_date)::date, 'Precio inicial'
FROM (VALUES
  ('EXA-01', 25000, 15000), ('RX-01', 12000, 8000), ('RX-02', 30000, 25000), ('PRE-01', 40000, 28000),
  ('PRE-02', 18000, 12000), ('PRE-03', 15000, 10000), ('OPE-01', 45000, 32000), ('OPE-02', 60000, 45000),
  ('END-01', 150000, 110000), ('END-02', 220000, 170000), ('CIR-01', 35000, 25000), ('CIR-02', 120000, 95000),
  ('PRO-01', 280000, 230000), ('EST-01', 180000, 150000), ('URG-01', 30000, 20000), ('IMP-01', 750000, 650000)
) AS v(codigo, particular, fonasa)
JOIN public.prestaciones p ON p.codigo_interno = v.codigo
JOIN public.aranceles a ON a.activo AND (a.es_base OR a.tipo = 'FONASA')
WHERE NOT EXISTS (SELECT 1 FROM public.prestacion_precios x WHERE x.prestacion_id = p.id AND x.arancel_id = a.id);

INSERT INTO public.pacientes (rut, nombres, apellidos, sexo, fecha_nacimiento, telefono, email, direccion, comuna, ciudad, prevision, actividad_profesion)
VALUES
  ('10433012-6', 'Camila Andrea', 'González Rojas', 'FEMENINO', '1990-03-14', '+56950123316', 'camila.gonzalez51@correo.cl', 'Av. Providencia 693', 'Providencia', 'Santiago', 'FONASA B', 'Profesora'),
  ('18778696-7', 'Matías Ignacio', 'Muñoz Soto', 'MASCULINO', '1985-07-22', '+56975962432', 'matias.munoz13@correo.cl', 'Av. Matta 4874', 'Las Condes', 'Santiago', 'Isapre Colmena', 'Ingeniero civil'),
  ('5973060-6', 'Valentina Paz', 'Rojas Díaz', 'FEMENINO', '1998-11-02', '+56974053435', 'valentina.rojas28@correo.cl', 'Av. Providencia 804', 'Ñuñoa', 'Santiago', 'FONASA C', 'Estudiante'),
  ('12275367-0', 'Benjamín Alonso', 'Díaz Pérez', 'MASCULINO', '1976-01-30', '+56968063058', 'benjamin.diaz9@correo.cl', 'Av. Grecia 843', 'Maipú', 'Santiago', 'Particular', 'Contador'),
  ('17245038-5', 'Javiera Belén', 'Pérez Contreras', 'FEMENINO', '2001-05-18', '+56968489000', 'javiera.perez8@correo.cl', 'Av. Pajaritos 1114', 'Puente Alto', 'Santiago', 'FONASA A', 'Estudiante'),
  ('8745328-6', 'Sebastián Andrés', 'Contreras Silva', 'MASCULINO', '1969-09-09', '+56982320588', 'sebastian.contreras81@correo.cl', 'Av. Pajaritos 606', 'Vitacura', 'Santiago', 'Isapre Banmédica', 'Abogado'),
  ('14682180-4', 'Catalina Fernanda', 'Silva Martínez', 'FEMENINO', '1993-12-25', '+56979295019', 'catalina.silva51@correo.cl', 'Av. Providencia 1911', 'La Florida', 'Santiago', 'FONASA D', 'Enfermera'),
  ('5781527-2', 'Diego Alejandro', 'Martínez Sepúlveda', 'MASCULINO', '1988-04-03', '+56977357148', 'diego.martinez18@correo.cl', 'Pedro de Valdivia 3533', 'San Miguel', 'Santiago', 'Isapre Consalud', 'Vendedor'),
  ('10420198-9', 'Florencia Antonia', 'Sepúlveda Morales', 'FEMENINO', '2012-08-11', '+56976284815', NULL, 'Los Leones 4776', 'Providencia', 'Santiago', 'FONASA B', NULL),
  ('10175466-9', 'Joaquín Esteban', 'Morales Rodríguez', 'MASCULINO', '1955-02-17', '+56977598229', 'joaquin.morales88@correo.cl', 'Irarrázaval 944', 'Recoleta', 'Santiago', 'FONASA C', 'Jubilado'),
  ('14757631-5', 'Antonia Ignacia', 'Rodríguez López', 'FEMENINO', '1979-06-28', '+56978332877', 'antonia.rodriguez82@correo.cl', 'Av. Grecia 3150', 'Lo Barnechea', 'Santiago', 'Isapre Cruz Blanca', 'Arquitecta'),
  ('6634613-7', 'Tomás Felipe', 'López Fuentes', 'MASCULINO', '1995-10-07', '+56976758508', 'tomas.lopez92@correo.cl', 'Los Leones 4723', 'Santiago Centro', 'Santiago', 'Particular', 'Diseñador'),
  ('5999941-9', 'Isidora Valentina', 'Fuentes Hernández', 'FEMENINO', '1982-03-21', '+56981541030', 'isidora.fuentes27@correo.cl', 'Av. Vicuña Mackenna 4455', 'Macul', 'Santiago', 'FONASA D', 'Secretaria'),
  ('15173808-7', 'Martín Nicolás', 'Hernández Torres', 'MASCULINO', '2015-01-15', '+56992158940', NULL, 'Av. Matta 3914', 'Providencia', 'Santiago', 'FONASA B', NULL),
  ('14824097-3', 'Fernanda Josefa', 'Torres Araya', 'FEMENINO', '1972-11-30', '+56970412688', 'fernanda.torres47@correo.cl', 'Pedro de Valdivia 2135', 'La Reina', 'Santiago', 'Isapre Vida Tres', 'Médico'),
  ('18327476-7', 'Cristóbal Ignacio', 'Araya Flores', 'MASCULINO', '1999-07-04', '+56952063942', 'cristobal.araya90@correo.cl', 'Av. Grecia 770', 'Pudahuel', 'Santiago', 'FONASA A', 'Garzón'),
  ('14637230-9', 'Martina Sofía', 'Flores Espinoza', 'FEMENINO', '1987-09-19', '+56960149377', 'martina.flores68@correo.cl', 'Av. Vicuña Mackenna 2913', 'Quilicura', 'Santiago', 'FONASA C', 'Técnico en párvulos'),
  ('17238061-1', 'Vicente Agustín', 'Espinoza Valenzuela', 'MASCULINO', '1963-05-12', '+56970120752', 'vicente.espinoza37@correo.cl', 'Av. Pajaritos 699', 'Peñalolén', 'Santiago', 'Isapre Nueva Masvida', 'Comerciante'),
  ('9980815-2', 'Emilia Constanza', 'Valenzuela Castillo', 'FEMENINO', '2004-02-08', '+56974355230', 'emilia.valenzuela54@correo.cl', 'Irarrázaval 2902', 'Estación Central', 'Santiago', 'Particular', 'Estudiante'),
  ('7549877-2', 'Agustín Matías', 'Castillo Tapia', 'MASCULINO', '1991-12-01', '+56972813758', 'agustin.castillo54@correo.cl', 'Av. Providencia 735', 'Independencia', 'Santiago', 'FONASA B', 'Chofer')
ON CONFLICT (rut) DO NOTHING;

UPDATE public.pacientes
   SET apoderado_nombre = 'Joaquín Morales Rodríguez', apoderado_telefono = '+56987654321'
 WHERE rut = '10420198-9' AND apoderado_nombre IS NULL;

UPDATE public.pacientes h
   SET titular_id = t.id, apoderado_nombre = t.nombres || ' ' || t.apellidos, apoderado_rut = t.rut, apoderado_telefono = t.telefono
  FROM public.pacientes t
 WHERE h.rut = '15173808-7' AND t.rut = '14824097-3' AND h.titular_id IS NULL;

DO $$
DECLARE
  v_admin uuid;
  v_dent1 uuid;
  v_dent2 uuid;
  v_dent uuid;
  v_pac uuid;
  v_trat uuid;
  v_item uuid;
  v_precio integer;
  v_monto integer;
  v_cita uuid;
  v_conv uuid;
  v_bono uuid;
  v_fecha date;
  v_dia integer := 0;
  v_hora text;
  v_n integer := 0;
  v_citas integer := 0;
  v_pagos integer := 0;
  plan jsonb;
  it jsonb;
  v_ruts text[] := ARRAY['10433012-6','18778696-7','5973060-6','12275367-0','17245038-5','8745328-6','14682180-4','5781527-2',
                         '10420198-9','10175466-9','14757631-5','6634613-7','5999941-9','15173808-7','14824097-3','18327476-7',
                         '14637230-9','17238061-1','9980815-2','7549877-2'];
  v_motivos text[] := ARRAY['Control', 'Limpieza', 'Dolor en muela', 'Evaluación', 'Continuar tratamiento', 'Revisión de restauración'];
  v_horas text[] := ARRAY['09:00','09:45','10:30','11:30','12:15','15:00','15:45','16:30','17:15'];
  v_planes jsonb := '[
    {"rut":"10433012-6","nombre":"Plan de higiene y restauraciones","items":[
      {"c":"EXA-01","p":100,"pago":"total","m":"EFECTIVO"},
      {"c":"PRE-01","p":100,"pago":"total","m":"DEBITO"},
      {"c":"OPE-01","pieza":16,"caras":["O"],"p":100,"pago":"parcial","m":"TRANSFERENCIA"},
      {"c":"OPE-01","pieza":26,"caras":["O","M"],"p":0,"pago":"no"}]},
    {"rut":"18778696-7","nombre":"Rehabilitación molar inferior","items":[
      {"c":"EXA-01","p":100,"pago":"total","m":"CREDITO"},
      {"c":"END-02","pieza":36,"p":100,"pago":"total","m":"TRANSFERENCIA"},
      {"c":"PRO-01","pieza":36,"p":50,"pago":"parcial","m":"CREDITO"}]},
    {"rut":"12275367-0","nombre":"Urgencia y extracción","items":[
      {"c":"URG-01","p":100,"pago":"total","m":"EFECTIVO"},
      {"c":"CIR-01","pieza":48,"p":100,"pago":"no"}]},
    {"rut":"8745328-6","nombre":"Implante pieza 46","items":[
      {"c":"EXA-01","p":100,"pago":"total","m":"DEBITO"},
      {"c":"RX-02","p":100,"pago":"total","m":"DEBITO"},
      {"c":"IMP-01","pieza":46,"p":25,"pago":"parcial","m":"TRANSFERENCIA"}]},
    {"rut":"14682180-4","nombre":"Prevención","items":[
      {"c":"EXA-01","p":100,"pago":"total","m":"EFECTIVO"},
      {"c":"PRE-02","pieza":17,"caras":["O"],"p":100,"pago":"total","m":"EFECTIVO"},
      {"c":"PRE-02","pieza":47,"caras":["O"],"p":100,"pago":"total","m":"EFECTIVO"}]},
    {"rut":"10175466-9","nombre":"Extracciones","items":[
      {"c":"EXA-01","p":100,"pago":"total","m":"EFECTIVO"},
      {"c":"CIR-01","pieza":18,"p":100,"pago":"total","m":"EFECTIVO"},
      {"c":"CIR-01","pieza":28,"p":0,"pago":"no"}]},
    {"rut":"14757631-5","nombre":"Estética","items":[
      {"c":"EST-01","p":100,"pago":"total","m":"CREDITO"}]},
    {"rut":"5999941-9","nombre":"Endodoncia pieza 11","items":[
      {"c":"EXA-01","p":100,"pago":"total","m":"DEBITO"},
      {"c":"END-01","pieza":11,"p":75,"pago":"parcial","m":"DEBITO"},
      {"c":"OPE-02","pieza":11,"caras":["M","D","V"],"p":0,"pago":"no"}]},
    {"rut":"15173808-7","nombre":"Control infantil","items":[
      {"c":"EXA-01","p":100,"pago":"total","m":"EFECTIVO"},
      {"c":"PRE-03","p":100,"pago":"total","m":"EFECTIVO"},
      {"c":"PRE-02","pieza":36,"caras":["O"],"p":0,"pago":"no"},
      {"c":"PRE-02","pieza":46,"caras":["O"],"p":0,"pago":"no"}]},
    {"rut":"18327476-7","nombre":"Urgencia","items":[
      {"c":"URG-01","p":100,"pago":"no"},
      {"c":"RX-01","pieza":21,"p":100,"pago":"no"}]},
    {"rut":"17238061-1","nombre":"Terceros molares","items":[
      {"c":"EXA-01","p":100,"pago":"total","m":"TRANSFERENCIA"},
      {"c":"CIR-02","pieza":38,"p":100,"pago":"total","m":"TRANSFERENCIA"},
      {"c":"CIR-02","pieza":48,"p":0,"pago":"no"}]}
  ]';
BEGIN
  SELECT id INTO v_admin FROM public.perfiles WHERE activo AND rol = 'ADMINISTRADOR' ORDER BY created_at LIMIT 1;
  SELECT id INTO v_dent1 FROM public.perfiles WHERE activo AND rol = 'DENTISTA' ORDER BY created_at LIMIT 1;
  SELECT id INTO v_dent2 FROM public.perfiles WHERE activo AND rol = 'DENTISTA' ORDER BY created_at OFFSET 1 LIMIT 1;
  v_admin := COALESCE(v_admin, v_dent1);
  v_dent1 := COALESCE(v_dent1, v_admin);
  v_dent2 := COALESCE(v_dent2, v_dent1);

  IF v_admin IS NULL THEN
    RAISE NOTICE 'Se cargaron prestaciones y pacientes. No hay usuarios en perfiles: crea un administrador y un dentista y vuelve a ejecutar para cargar tratamientos, pagos y citas.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.presupuestos WHERE descripcion = 'Datos de prueba') THEN
    RAISE NOTICE 'Los tratamientos, pagos y citas de prueba ya estaban cargados.';
    RETURN;
  END IF;

  PERFORM set_config('app.usuario', v_admin::text, true);

  UPDATE public.perfiles SET porcentaje_liquidacion = 50 WHERE rol = 'DENTISTA' AND porcentaje_liquidacion IS NULL;

  IF public.caja_abierta() IS NULL THEN
    PERFORM public.abrir_caja(30000, v_admin, 'Caja con datos de prueba');
  END IF;

  INSERT INTO public.antecedentes (paciente_id, categoria, contenido, profesional_id)
  SELECT p.id, v.categoria, v.contenido, v_dent1
  FROM (VALUES
    ('10433012-6', 'ALERGIA', 'Alergia a la penicilina'),
    ('8745328-6', 'ENFERMEDAD', 'Hipertensión arterial controlada'),
    ('8745328-6', 'MEDICAMENTO', 'Losartán 50 mg cada 12 horas'),
    ('10175466-9', 'ENFERMEDAD', 'Diabetes mellitus tipo 2'),
    ('10175466-9', 'MEDICAMENTO', 'Metformina 850 mg'),
    ('14824097-3', 'HABITO', 'Bruxismo nocturno'),
    ('17238061-1', 'HABITO', 'Fumador, 10 cigarrillos al día'),
    ('14757631-5', 'CIRUGIA', 'Apendicectomía (2015)')
  ) AS v(rut, categoria, contenido)
  JOIN public.pacientes p ON p.rut = v.rut;

  FOR plan IN SELECT * FROM jsonb_array_elements(v_planes) LOOP
    SELECT id INTO v_pac FROM public.pacientes WHERE rut = plan->>'rut' AND activo;
    CONTINUE WHEN v_pac IS NULL;
    v_n := v_n + 1;
    v_dent := CASE WHEN v_n % 2 = 1 THEN v_dent1 ELSE v_dent2 END;
    v_trat := public.crear_tratamiento(v_pac, plan->>'nombre', v_admin, NULL, v_dent, 'Datos de prueba');

    FOR it IN SELECT * FROM jsonb_array_elements(plan->'items') LOOP
      v_item := public.agregar_prestacion_tratamiento(
        v_trat,
        (SELECT id FROM public.prestaciones WHERE codigo_interno = it->>'c'),
        (it->>'pieza')::integer,
        COALESCE(ARRAY(SELECT jsonb_array_elements_text(it->'caras')), '{}'::text[]),
        v_dent);

      IF (it->>'p')::integer > 0 THEN
        PERFORM public.evolucionar_item(v_item, (it->>'p')::integer, v_dent, 'Atención registrada');
      END IF;

      IF it->>'pago' IN ('total', 'parcial') THEN
        SELECT precio INTO v_precio FROM public.presupuesto_items WHERE id = v_item;
        v_monto := CASE WHEN it->>'pago' = 'total' THEN v_precio ELSE round(v_precio / 2.0)::integer END;
        PERFORM public.registrar_pago(
          v_pac, v_monto, it->>'m',
          jsonb_build_array(jsonb_build_object('item_id', v_item, 'monto', v_monto)),
          v_admin,
          CASE WHEN it->>'m' = 'EFECTIVO' THEN NULL ELSE 'OP-' || lpad((100000 + v_pagos * 7919 % 900000)::text, 6, '0') END,
          NULL, NULL);
        v_pagos := v_pagos + 1;
      END IF;
    END LOOP;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM public.convenios WHERE nombre = 'Sindicato de Trabajadores N°1') THEN
    v_conv := public.crear_convenio('Sindicato de Trabajadores N°1', 'Sindicato N°1 Empresa Ejemplo', 'SINDICATO', 15,
                                    (current_date - 30), v_admin, NULL, NULL, 'contacto@sindicato.cl', '15% de descuento en todas las prestaciones');
    PERFORM public.agregar_beneficiario(v_conv, p.id, v_admin) FROM public.pacientes p WHERE p.rut IN ('5781527-2', '14637230-9');
  END IF;

  BEGIN
    SELECT i.id, i.paciente_id INTO v_item, v_pac
      FROM public.presupuesto_items i JOIN public.prestaciones pr ON pr.id = i.prestacion_id
      JOIN public.pacientes p ON p.id = i.paciente_id
     WHERE p.rut = '10433012-6' AND pr.codigo_interno = 'OPE-01' AND i.progreso = 0 LIMIT 1;
    IF v_item IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.bonos_fonasa WHERE folio = '100200301') THEN
      PERFORM public.registrar_bono('100200301', v_pac, (SELECT id FROM public.prestaciones WHERE codigo_interno = 'OPE-01'), 20000, v_admin, 12000, v_item, current_date);
    END IF;

    SELECT i.id, i.paciente_id INTO v_item, v_pac
      FROM public.presupuesto_items i JOIN public.prestaciones pr ON pr.id = i.prestacion_id
      JOIN public.pacientes p ON p.id = i.paciente_id
     WHERE p.rut = '10175466-9' AND pr.codigo_interno = 'CIR-01' AND i.progreso = 0 LIMIT 1;
    IF v_item IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.bonos_fonasa WHERE folio = '100200302') THEN
      v_bono := public.registrar_bono('100200302', v_pac, (SELECT id FROM public.prestaciones WHERE codigo_interno = 'CIR-01'), 18000, v_admin, 7000, v_item, current_date);
      PERFORM public.usar_bono(v_bono, v_admin, v_item);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'No se cargaron los bonos FONASA de prueba: %', SQLERRM;
  END;

  WHILE v_dia <= 7 LOOP
    v_fecha := current_date + v_dia;
    IF extract(isodow FROM v_fecha) < 7 THEN
      FOR i IN 1 .. array_length(v_horas, 1) LOOP
        v_hora := v_horas[i];
        CONTINUE WHEN (i + v_dia) % 3 = 0;
        CONTINUE WHEN public.hora_chile(v_fecha, v_hora::time) < now() + interval '15 minutes';
        v_dent := CASE WHEN i % 2 = 0 THEN v_dent2 ELSE v_dent1 END;
        BEGIN
          v_cita := public.agendar_cita(
            (SELECT id FROM public.pacientes WHERE rut = v_ruts[1 + ((v_dia * 9 + i) % array_length(v_ruts, 1))]),
            v_dent, v_fecha, v_hora::time, 45, v_admin,
            (SELECT id FROM public.boxes WHERE activo ORDER BY nombre OFFSET (i % 2) LIMIT 1),
            NULL, v_motivos[1 + ((v_dia + i) % array_length(v_motivos, 1))]);
          v_citas := v_citas + 1;
          IF v_dia <= 1 AND i % 2 = 1 THEN
            PERFORM public.cambiar_estado_cita(v_cita, 'CONFIRMADA', v_admin);
          END IF;
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;
      END LOOP;
    END IF;
    v_dia := v_dia + 1;
  END LOOP;

  RAISE NOTICE 'Datos de prueba cargados: % tratamientos, % pagos y % citas.', v_n, v_pagos, v_citas;
END $$;

NOTIFY pgrst, 'reload schema';
