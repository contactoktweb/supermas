-- ==============================================================================
-- 088: Subcuenta general de mercancías no fabricadas (1435)
-- ==============================================================================
-- Las subcuentas de la 1435 existentes (Abarrotes, Lácteos, Aseo, Bebidas) no
-- corresponden a las líneas reales del negocio (ferretería, belleza, droguería…).
-- Se crea una línea general con su costo (6135) e ingreso (4135) emparejados, para
-- usarla por defecto al crear productos y en los productos que no tienen cuenta.
-- Idempotente: no duplica cuentas ni el emparejamiento si ya existen.
-- ==============================================================================

BEGIN;

-- Primero las subcuentas (nivel 4): las auxiliares necesitan ver a su padre ya creado.
INSERT INTO public.accounting_accounts (code, name, account_class, level, parent_id, nature, requires_third_party, requires_cost_center, is_active)
SELECT v.code, v.name, v.account_class, v.level, p.id, v.nature, v.requires_third_party, true, true
FROM (VALUES
  ('143505',    'Inventario - Mercancías Generales',                       1, 4, '1435',   'DEBIT',  false),
  ('613505',    'Costo de Venta - Mercancías Generales',                   6, 4, '6135',   'DEBIT',  false),
  ('413505',    'Venta de Mercancías Generales',                           4, 4, '4135',   'CREDIT', true)
) AS v(code, name, account_class, level, parent_code, nature, requires_third_party)
CROSS JOIN LATERAL (SELECT id FROM public.accounting_accounts WHERE code = v.parent_code) p
WHERE NOT EXISTS (SELECT 1 FROM public.accounting_accounts a WHERE a.code = v.code);

INSERT INTO public.accounting_accounts (code, name, account_class, level, parent_id, nature, requires_third_party, requires_cost_center, is_active)
SELECT v.code, v.name, v.account_class, v.level, p.id, v.nature, v.requires_third_party, true, true
FROM (VALUES
  ('143505.01', 'Mercancías no Fabricadas - General Detallado',            1, 5, '143505', 'DEBIT',  false),
  ('613505.01', 'Costo de Venta - Mercancías Generales Detallado',         6, 5, '613505', 'DEBIT',  false),
  ('413505.01', 'Venta de Mercancías Generales - Mostrador y POS',         4, 5, '413505', 'CREDIT', false)
) AS v(code, name, account_class, level, parent_code, nature, requires_third_party)
CROSS JOIN LATERAL (SELECT id FROM public.accounting_accounts WHERE code = v.parent_code) p
WHERE NOT EXISTS (SELECT 1 FROM public.accounting_accounts a WHERE a.code = v.code);

INSERT INTO public.accounting_inventory_account_map (company_id, inventory_account_id, cost_account_id, income_account_id)
SELECT c.id, inv.id, cost.id, inc.id
FROM public.companies c
CROSS JOIN (SELECT id FROM public.accounting_accounts WHERE code = '143505.01') inv
CROSS JOIN (SELECT id FROM public.accounting_accounts WHERE code = '613505.01') cost
CROSS JOIN (SELECT id FROM public.accounting_accounts WHERE code = '413505.01') inc
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_inventory_account_map m
  WHERE m.company_id = c.id AND m.inventory_account_id = inv.id
);

-- Productos sin cuenta de inventario: pasan a la línea general.
UPDATE public.products p
SET accounting_account_id = a.id,
    accounting_category_id = a.id
FROM public.accounting_accounts a
WHERE a.code = '143505.01'
  AND p.accounting_account_id IS NULL;

COMMIT;
