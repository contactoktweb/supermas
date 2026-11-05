-- ==============================================================================
-- 094 · Cuentas de inventario, costo e ingreso por tipo de IVA
-- ==============================================================================
-- Las subcuentas 1435/6135/4135 estaban por familia de producto (abarrotes, lácteos,
-- aseo, bebidas, general), creadas por nosotros y sin relación con lo tributario.
-- Para los informes de IVA, exógena e impuesto mensual quedan cuatro, una por tipo de IVA:
--   01 Gravado al 19%   02 Gravado al 5%   03 Exento   04 Excluido
-- * Se renombran 143501–143504, 613501–613504 y 413501–413504 (y sus auxiliares .01);
--   el enlace inventario ↔ costo ↔ ingreso (accounting_inventory_account_map) se conserva.
-- * Se desactivan 143505/613505/413505 "Mercancías generales" y su enlace.
-- * La cuenta de inventario del producto se asigna sola según su IVA (trigger), también
--   en la importación desde Excel. Un producto al 0 % sin clasificar queda sin cuenta
--   (usa la de inventario por defecto) hasta que se clasifique como exento o excluido.
-- * Se reasignan todos los productos existentes.
-- Requiere saldo cero en las cuentas que se desactivan. Re-ejecutable.
-- ==============================================================================

DO $$
DECLARE
  v_renames CONSTANT TEXT[][] := ARRAY[
    ARRAY['143501',    'Gravado al 19%'],
    ARRAY['143501.01', 'Gravado al 19%'],
    ARRAY['143502',    'Gravado al 5%'],
    ARRAY['143502.01', 'Gravado al 5%'],
    ARRAY['143503',    'Exento'],
    ARRAY['143503.01', 'Exento'],
    ARRAY['143504',    'Excluido'],
    ARRAY['143504.01', 'Excluido'],
    ARRAY['613501',    'Costo de ventas gravadas al 19%'],
    ARRAY['613501.01', 'Costo de ventas gravadas al 19%'],
    ARRAY['613502',    'Costo de ventas gravadas al 5%'],
    ARRAY['613502.01', 'Costo de ventas gravadas al 5%'],
    ARRAY['613503',    'Costo de ventas exentas'],
    ARRAY['613503.01', 'Costo de ventas exentas'],
    ARRAY['613504',    'Costo de ventas excluidas'],
    ARRAY['613504.01', 'Costo de ventas excluidas'],
    ARRAY['413501',    'Ventas gravadas al 19%'],
    ARRAY['413501.01', 'Ventas gravadas al 19%'],
    ARRAY['413502',    'Ventas gravadas al 5%'],
    ARRAY['413502.01', 'Ventas gravadas al 5%'],
    ARRAY['413503',    'Ventas exentas'],
    ARRAY['413503.01', 'Ventas exentas'],
    ARRAY['413504',    'Ventas excluidas'],
    ARRAY['413504.01', 'Ventas excluidas']
  ];
  v_retired CONSTANT TEXT[] := ARRAY['143505', '143505.01', '613505', '613505.01', '413505', '413505.01'];
  i INT;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.accounting_entry_lines l
    JOIN public.accounting_entries e ON e.id = l.entry_id AND e.status = 'POSTED'
    JOIN public.accounting_accounts a ON a.id = l.account_id
    WHERE a.code = ANY (v_retired)
    GROUP BY a.id
    HAVING SUM(l.debit_amount - l.credit_amount) <> 0
  ) THEN
    RAISE EXCEPTION 'Las cuentas de mercancías generales (143505/613505/413505) tienen saldo: reclasifíquelo antes de aplicar 094.';
  END IF;

  FOR i IN 1 .. array_length(v_renames, 1) LOOP
    UPDATE public.accounting_accounts SET name = v_renames[i][2], is_active = true
    WHERE code = v_renames[i][1];
  END LOOP;

  UPDATE public.accounting_inventory_account_map m SET is_active = false, updated_at = NOW()
  FROM public.accounting_accounts a
  WHERE a.id = m.inventory_account_id AND a.code = '143505.01' AND m.is_active;

  UPDATE public.accounting_accounts SET is_active = false WHERE code = ANY (v_retired);
END;
$$;

-- Cuenta auxiliar de inventario que corresponde a un tratamiento de IVA.
CREATE OR REPLACE FUNCTION public.fn_inventory_account_for_iva(
  p_iva_treatment TEXT,
  p_tax_rate_percent NUMERIC
)
RETURNS UUID
LANGUAGE sql
STABLE
SET search_path TO 'pg_catalog', 'public'
AS $$
  SELECT a.id
  FROM public.accounting_accounts a
  WHERE a.is_active
    AND a.code = CASE
      WHEN UPPER(COALESCE(p_iva_treatment, '')) = 'EXCLUIDO' THEN '143504.01'
      WHEN UPPER(COALESCE(p_iva_treatment, '')) = 'EXENTO' THEN '143503.01'
      WHEN UPPER(COALESCE(p_iva_treatment, '')) = 'GRAVADO' AND COALESCE(p_tax_rate_percent, 0) = 5 THEN '143502.01'
      WHEN UPPER(COALESCE(p_iva_treatment, '')) = 'GRAVADO' AND COALESCE(p_tax_rate_percent, 0) > 0 THEN '143501.01'
    END
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.fn_inventory_account_for_iva(TEXT, NUMERIC) IS
  'Cuenta de inventario según el IVA: gravado 19 % → 143501.01, gravado 5 % → 143502.01, exento → 143503.01, excluido → 143504.01; NULL si el producto no está clasificado.';

CREATE OR REPLACE FUNCTION public.fn_assign_product_inventory_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
  NEW.accounting_account_id := public.fn_inventory_account_for_iva(NEW.iva_treatment, NEW.tax_rate_percent);
  NEW.accounting_category_id := NEW.accounting_account_id;
  RETURN NEW;
END;
$$;

-- El nombre ordena el trigger antes de trg_validate_product_inventory_account (orden alfabético).
DROP TRIGGER IF EXISTS trg_assign_product_inventory_account ON public.products;
CREATE TRIGGER trg_assign_product_inventory_account
  BEFORE INSERT OR UPDATE OF iva_treatment, tax_rate_percent, is_tax_exempt, accounting_account_id
  ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.fn_assign_product_inventory_account();

-- Reasignar los productos existentes.
UPDATE public.products
SET accounting_account_id = public.fn_inventory_account_for_iva(iva_treatment, tax_rate_percent)
WHERE accounting_account_id IS DISTINCT FROM public.fn_inventory_account_for_iva(iva_treatment, tax_rate_percent);
