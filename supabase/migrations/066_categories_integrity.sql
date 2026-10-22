-- ==============================================================================
-- 066_CATEGORIES_INTEGRITY.sql
-- ERP SUPER MÁS S.A.S. - Integridad de categorías en la base de datos
--
-- El formulario ya valida estas reglas; la base las impone también para cualquier
-- otra vía de escritura (API directa, importaciones, scripts):
--   1. Nombre obligatorio (sin espacios sobrantes) y código normalizado en MAYÚSCULAS,
--      de modo que 'prb-aba' y 'PRB-ABA' choquen con la restricción única existente.
--   2. Sin ciclos en la jerarquía: una categoría no puede quedar bajo uno de sus
--      descendientes (A → B → A), no solo bajo sí misma.
-- No modifica datos existentes. Se puede re-ejecutar.
-- ==============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.fn_validate_category_parent_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_ancestor UUID;
    v_depth INTEGER := 0;
BEGIN
    NEW.name := BTRIM(NEW.name);
    IF NEW.name IS NULL OR NEW.name = '' THEN
        RAISE EXCEPTION 'El nombre de la categoría es obligatorio.'
            USING ERRCODE = '23514';
    END IF;

    NEW.code := NULLIF(UPPER(BTRIM(NEW.code)), '');

    IF NEW.parent_id IS NOT NULL THEN
        -- 1. Prevenir que sea su propio padre (auto-referencia cíclica)
        IF NEW.id IS NOT NULL AND NEW.parent_id = NEW.id THEN
            RAISE EXCEPTION 'Una categoría no puede ser su propia categoría padre.'
                USING ERRCODE = '22000';
        END IF;

        -- 2. Garantizar que la categoría padre exista y pertenezca estrictamente a la misma empresa
        IF NOT EXISTS (
            SELECT 1 FROM public.categories
            WHERE id = NEW.parent_id AND company_id = NEW.company_id
        ) THEN
            RAISE EXCEPTION 'Violación multiempresa: La categoría padre debe pertenecer a la misma empresa.'
                USING ERRCODE = '23503';
        END IF;

        -- 3. El nuevo padre no puede ser descendiente de esta categoría (ciclo en la jerarquía)
        IF TG_OP = 'UPDATE' THEN
            v_ancestor := NEW.parent_id;
            WHILE v_ancestor IS NOT NULL AND v_depth < 100 LOOP
                IF v_ancestor = NEW.id THEN
                    RAISE EXCEPTION 'Jerarquía cíclica: la categoría padre elegida es una subcategoría de esta categoría.'
                        USING ERRCODE = '22000';
                END IF;
                SELECT parent_id INTO v_ancestor FROM public.categories WHERE id = v_ancestor;
                v_depth := v_depth + 1;
            END LOOP;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_validate_category_parent_tenant() FROM PUBLIC, anon, authenticated;

COMMIT;
