CREATE OR REPLACE FUNCTION public.catalogo_prestaciones(p_arancel uuid)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  WITH base AS (SELECT id FROM public.aranceles WHERE es_base)
  SELECT COALESCE(jsonb_agg(c ORDER BY c.orden, c.nombre), '[]'::jsonb)
  FROM (
    SELECT
      cat.id,
      cat.nombre,
      cat.orden,
      (
        SELECT jsonb_agg(
                 jsonb_build_object(
                   'id', p.id,
                   'codigo_interno', p.codigo_interno,
                   'nombre', p.nombre,
                   'icono', p.icono,
                   'precio', COALESCE(public.precio_vigente(p.id, p_arancel),
                                      public.precio_vigente(p.id, (SELECT id FROM base)))
                 ) ORDER BY p.nombre)
          FROM public.prestaciones p
         WHERE p.categoria_id = cat.id AND p.activo
      ) AS prestaciones
    FROM public.categorias_prestaciones cat
    WHERE cat.activo
      AND EXISTS (SELECT 1 FROM public.prestaciones p WHERE p.categoria_id = cat.id AND p.activo)
  ) c;
$$;

NOTIFY pgrst, 'reload schema';
