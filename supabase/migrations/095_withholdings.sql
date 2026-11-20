-- ==============================================================================
-- 095 · Retenciones configurables (retención en la fuente, ReteIVA y ReteICA)
-- ==============================================================================
-- Los conceptos de retención se configuran en Configuración → Retenciones y se
-- seleccionan en cada compra (la empresa retiene al proveedor) y en cada venta (el
-- cliente agente retenedor le retiene a la empresa).
--   - withholding_concepts: catálogo por empresa (tipo, a qué aplica, tarifa, base
--     mínima en UVT y cuentas PUC). Sin semillas: los define el contador.
--   - uvt_values: valor de la UVT por año, para la base mínima.
--   - Perfil tributario: autorretenedor, régimen simple y ZESE en proveedores y en la
--     empresa; agente retenedor en clientes; retenciones habituales por tercero.
--   - ZESE (Decreto 2112 de 2019): la retención en la fuente a título de renta se
--     multiplica por 0 los primeros 5 años desde el inicio del beneficio y por 0,5 los
--     5 siguientes. No afecta ReteIVA ni ReteICA.
--   - document_withholdings: detalle por documento (snapshot de tarifa, base y cuenta).
--   - Compras: proveedor por el neto (total - retenciones) y crédito a cada retención.
--   - Ventas: anticipo de impuestos (débito) por cada retención y cobro por el neto.
--   - Cuentas por pagar y por cobrar: el saldo es total - retenciones - pagado.
-- La factura electrónica DIAN no cambia (la retención no entra al XML ni al CUFE).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Catálogo de conceptos y UVT
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.withholding_concepts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    code VARCHAR(30) NOT NULL CHECK (code ~ '^[A-Z0-9_.-]{1,30}$'),
    name VARCHAR(150) NOT NULL CHECK (length(btrim(name)) >= 3),
    withholding_type VARCHAR(20) NOT NULL CHECK (withholding_type IN ('RETEFUENTE', 'RETEIVA', 'RETEICA')),
    applies_to VARCHAR(20) NOT NULL DEFAULT 'BOTH' CHECK (applies_to IN ('PURCHASES', 'SALES', 'BOTH')),
    base_type VARCHAR(20) NOT NULL DEFAULT 'SUBTOTAL' CHECK (base_type IN ('SUBTOTAL', 'TAX_AMOUNT')),
    rate_percent NUMERIC(7,4) NOT NULL CHECK (rate_percent > 0 AND rate_percent <= 100),
    min_base_uvt NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (min_base_uvt >= 0),
    payable_account_id UUID REFERENCES public.accounting_accounts(id),
    receivable_account_id UUID REFERENCES public.accounting_accounts(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    updated_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_withholding_concepts_company_code UNIQUE (company_id, code),
    CONSTRAINT chk_withholding_payable_account CHECK (applies_to = 'SALES' OR payable_account_id IS NOT NULL),
    CONSTRAINT chk_withholding_receivable_account CHECK (applies_to = 'PURCHASES' OR receivable_account_id IS NOT NULL),
    CONSTRAINT chk_withholding_base_type CHECK (base_type = 'SUBTOTAL' OR withholding_type = 'RETEIVA')
);

COMMENT ON TABLE public.withholding_concepts IS
    'Conceptos de retención por empresa. Compras: la empresa retiene (cuenta por pagar 2365/2367/2368). Ventas: el cliente retiene (anticipo 1355).';

CREATE TABLE IF NOT EXISTS public.uvt_values (
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    year INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
    value NUMERIC(12,2) NOT NULL CHECK (value > 0),
    updated_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (company_id, year)
);

COMMENT ON TABLE public.uvt_values IS 'Valor de la UVT por año, usado para la base mínima de las retenciones.';

-- Cuentas: auxiliares activas con el prefijo que corresponde a cada lado.
CREATE OR REPLACE FUNCTION public.fn_validate_withholding_concept()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_code TEXT;
BEGIN
    NEW.code := upper(btrim(NEW.code));
    NEW.name := btrim(NEW.name);
    NEW.updated_at := NOW();
    IF TG_OP = 'UPDATE' AND NEW.company_id IS DISTINCT FROM OLD.company_id THEN
        RAISE EXCEPTION 'No se puede cambiar la empresa de un concepto de retención.' USING ERRCODE = '42501';
    END IF;

    IF NEW.payable_account_id IS NOT NULL THEN
        SELECT code INTO v_code FROM public.accounting_accounts a
        WHERE a.id = NEW.payable_account_id AND a.is_active
          AND NOT EXISTS (SELECT 1 FROM public.accounting_accounts c WHERE c.parent_id = a.id);
        IF v_code IS NULL OR NOT (v_code LIKE '2365%' OR v_code LIKE '2367%' OR v_code LIKE '2368%') THEN
            RAISE EXCEPTION 'La cuenta de compras debe ser una subcuenta auxiliar activa de 2365, 2367 o 2368.'
                USING ERRCODE = '23514';
        END IF;
    END IF;
    IF NEW.receivable_account_id IS NOT NULL THEN
        SELECT code INTO v_code FROM public.accounting_accounts a
        WHERE a.id = NEW.receivable_account_id AND a.is_active
          AND NOT EXISTS (SELECT 1 FROM public.accounting_accounts c WHERE c.parent_id = a.id);
        IF v_code IS NULL OR v_code NOT LIKE '1355%' THEN
            RAISE EXCEPTION 'La cuenta de ventas debe ser una subcuenta auxiliar activa de 1355.' USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_withholding_concept ON public.withholding_concepts;
CREATE TRIGGER trg_validate_withholding_concept
    BEFORE INSERT OR UPDATE ON public.withholding_concepts
    FOR EACH ROW EXECUTE FUNCTION public.fn_validate_withholding_concept();

ALTER TABLE public.withholding_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uvt_values ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.withholding_concepts FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.uvt_values FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.withholding_concepts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.uvt_values TO authenticated;

DROP POLICY IF EXISTS withholding_concepts_select ON public.withholding_concepts;
CREATE POLICY withholding_concepts_select ON public.withholding_concepts
    FOR SELECT TO authenticated USING (company_id = public.get_auth_company_id());
DROP POLICY IF EXISTS withholding_concepts_insert ON public.withholding_concepts;
CREATE POLICY withholding_concepts_insert ON public.withholding_concepts
    FOR INSERT TO authenticated
    WITH CHECK (company_id = public.get_auth_company_id() AND (public.is_admin() OR public.has_permission('settings.manage')));
DROP POLICY IF EXISTS withholding_concepts_update ON public.withholding_concepts;
CREATE POLICY withholding_concepts_update ON public.withholding_concepts
    FOR UPDATE TO authenticated
    USING (company_id = public.get_auth_company_id() AND (public.is_admin() OR public.has_permission('settings.manage')))
    WITH CHECK (company_id = public.get_auth_company_id());

DROP POLICY IF EXISTS uvt_values_select ON public.uvt_values;
CREATE POLICY uvt_values_select ON public.uvt_values
    FOR SELECT TO authenticated USING (company_id = public.get_auth_company_id());
DROP POLICY IF EXISTS uvt_values_insert ON public.uvt_values;
CREATE POLICY uvt_values_insert ON public.uvt_values
    FOR INSERT TO authenticated
    WITH CHECK (company_id = public.get_auth_company_id() AND (public.is_admin() OR public.has_permission('settings.manage')));
DROP POLICY IF EXISTS uvt_values_update ON public.uvt_values;
CREATE POLICY uvt_values_update ON public.uvt_values
    FOR UPDATE TO authenticated
    USING (company_id = public.get_auth_company_id() AND (public.is_admin() OR public.has_permission('settings.manage')))
    WITH CHECK (company_id = public.get_auth_company_id());

-- ------------------------------------------------------------------------------
-- 2. Perfil tributario de terceros y empresa
-- ------------------------------------------------------------------------------
ALTER TABLE public.suppliers
    ADD COLUMN IF NOT EXISTS is_self_withholder BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_simple_regime BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_zese_beneficiary BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS zese_start_date DATE,
    ADD COLUMN IF NOT EXISTS default_withholding_concept_ids UUID[] NOT NULL DEFAULT '{}';

ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS is_withholding_agent BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS default_withholding_concept_ids UUID[] NOT NULL DEFAULT '{}';

ALTER TABLE public.companies
    ADD COLUMN IF NOT EXISTS is_self_withholder BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_simple_regime BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_zese_beneficiary BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS zese_start_date DATE;

ALTER TABLE public.suppliers DROP CONSTRAINT IF EXISTS chk_suppliers_zese_start;
ALTER TABLE public.suppliers ADD CONSTRAINT chk_suppliers_zese_start
    CHECK (NOT is_zese_beneficiary OR zese_start_date IS NOT NULL);
ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS chk_companies_zese_start;
ALTER TABLE public.companies ADD CONSTRAINT chk_companies_zese_start
    CHECK (NOT is_zese_beneficiary OR zese_start_date IS NOT NULL);

-- ------------------------------------------------------------------------------
-- 3. Detalle por documento y totales
-- ------------------------------------------------------------------------------
ALTER TABLE public.purchases
    ADD COLUMN IF NOT EXISTS withholding_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (withholding_amount >= 0),
    ADD COLUMN IF NOT EXISTS withholding_concept_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE public.sales
    ADD COLUMN IF NOT EXISTS withholding_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (withholding_amount >= 0);

CREATE TABLE IF NOT EXISTS public.document_withholdings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    document_type VARCHAR(20) NOT NULL CHECK (document_type IN ('PURCHASE', 'SALE')),
    document_id UUID NOT NULL,
    concept_id UUID NOT NULL REFERENCES public.withholding_concepts(id),
    concept_code VARCHAR(30) NOT NULL,
    concept_name VARCHAR(150) NOT NULL,
    withholding_type VARCHAR(20) NOT NULL,
    base_amount NUMERIC(15,2) NOT NULL CHECK (base_amount >= 0),
    nominal_rate NUMERIC(7,4) NOT NULL,
    zese_factor NUMERIC(4,2) NOT NULL DEFAULT 1,
    effective_rate NUMERIC(7,4) NOT NULL,
    amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    account_id UUID NOT NULL REFERENCES public.accounting_accounts(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_document_withholdings_concept UNIQUE (document_type, document_id, concept_id)
);

CREATE INDEX IF NOT EXISTS idx_document_withholdings_document
    ON public.document_withholdings (document_type, document_id);
CREATE INDEX IF NOT EXISTS idx_document_withholdings_company_type
    ON public.document_withholdings (company_id, document_type, created_at);

COMMENT ON TABLE public.document_withholdings IS
    'Retenciones aplicadas a cada compra o venta (tarifa, factor ZESE, base y cuenta al momento del documento). Solo se escribe vía funciones del servidor.';

ALTER TABLE public.document_withholdings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.document_withholdings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.document_withholdings TO authenticated;
DROP POLICY IF EXISTS document_withholdings_select ON public.document_withholdings;
CREATE POLICY document_withholdings_select ON public.document_withholdings
    FOR SELECT TO authenticated USING (company_id = public.get_auth_company_id());

-- ------------------------------------------------------------------------------
-- 4. Cálculo (única fuente de verdad: lo usan la vista previa, compras y ventas)
-- ------------------------------------------------------------------------------
-- Devuelve un arreglo con una entrada por concepto seleccionado: applied indica si se
-- retiene y reason explica por qué no (autorretenedor, régimen simple, base mínima, ZESE).
CREATE OR REPLACE FUNCTION public.fn_compute_withholdings_internal(
    p_company_id UUID,
    p_side TEXT,
    p_third_party_id UUID,
    p_base NUMERIC,
    p_tax NUMERIC,
    p_concept_ids UUID[],
    p_date DATE,
    p_allow_inactive BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_concept RECORD;
    v_result JSONB := '[]'::JSONB;
    v_self BOOLEAN := false;
    v_simple BOOLEAN := false;
    v_zese BOOLEAN := false;
    v_zese_start DATE;
    v_agent BOOLEAN;
    v_party_name TEXT;
    v_factor NUMERIC := 1;
    v_eff_factor NUMERIC;
    v_uvt NUMERIC;
    v_min NUMERIC;
    v_base NUMERIC(15,2);
    v_rate NUMERIC(7,4);
    v_amount NUMERIC(15,2);
    v_applied BOOLEAN;
    v_reason TEXT;
    v_account UUID;
    v_found INT := 0;
    v_date DATE := COALESCE(p_date, (NOW() AT TIME ZONE 'America/Bogota')::DATE);
BEGIN
    IF p_side NOT IN ('PURCHASES', 'SALES') THEN
        RAISE EXCEPTION 'Tipo de documento no válido para retenciones: %.', p_side USING ERRCODE = '22023';
    END IF;
    IF p_concept_ids IS NULL OR cardinality(p_concept_ids) = 0 THEN
        RETURN '[]'::JSONB;
    END IF;
    IF (SELECT count(DISTINCT x) FROM unnest(p_concept_ids) x) <> cardinality(p_concept_ids) THEN
        RAISE EXCEPTION 'Una retención está seleccionada dos veces.' USING ERRCODE = '22023';
    END IF;

    IF p_side = 'PURCHASES' THEN
        SELECT s.is_self_withholder, s.is_simple_regime, s.is_zese_beneficiary, s.zese_start_date,
               COALESCE(s.name, s.legal_name, 'Proveedor')
        INTO v_self, v_simple, v_zese, v_zese_start, v_party_name
        FROM public.suppliers s WHERE s.id = p_third_party_id AND s.company_id = p_company_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Seleccione el proveedor antes de aplicar retenciones.' USING ERRCODE = '23502';
        END IF;
    ELSE
        SELECT c.is_withholding_agent,
               COALESCE(NULLIF(COALESCE(c.company_name, TRIM(CONCAT(c.first_name, ' ', c.last_name))), ''), 'Cliente')
        INTO v_agent, v_party_name
        FROM public.customers c WHERE c.id = p_third_party_id AND c.company_id = p_company_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Seleccione el cliente antes de aplicar retenciones.' USING ERRCODE = '23502';
        END IF;
        IF NOT COALESCE(v_agent, false) THEN
            RAISE EXCEPTION 'El cliente "%" no está marcado como agente retenedor en su ficha.', v_party_name
                USING ERRCODE = '22023';
        END IF;
        SELECT co.is_self_withholder, co.is_simple_regime, co.is_zese_beneficiary, co.zese_start_date
        INTO v_self, v_simple, v_zese, v_zese_start
        FROM public.companies co WHERE co.id = p_company_id;
    END IF;

    -- ZESE: 0 % los primeros 5 años, 50 % los 5 siguientes (solo retención en la fuente de renta).
    IF COALESCE(v_zese, false) AND v_zese_start IS NOT NULL THEN
        v_factor := CASE
            WHEN v_date < v_zese_start THEN 1
            WHEN v_date < (v_zese_start + INTERVAL '5 years')::DATE THEN 0
            WHEN v_date < (v_zese_start + INTERVAL '10 years')::DATE THEN 0.5
            ELSE 1 END;
    END IF;

    FOR v_concept IN
        SELECT * FROM public.withholding_concepts
        WHERE id = ANY(p_concept_ids)
        ORDER BY CASE withholding_type WHEN 'RETEFUENTE' THEN 1 WHEN 'RETEIVA' THEN 2 ELSE 3 END, code
    LOOP
        v_found := v_found + 1;
        IF v_concept.company_id <> p_company_id THEN
            RAISE EXCEPTION 'Una retención seleccionada no pertenece a su empresa.' USING ERRCODE = '42501';
        END IF;
        IF NOT v_concept.is_active AND NOT p_allow_inactive THEN
            RAISE EXCEPTION 'La retención "%" está inactiva.', v_concept.name USING ERRCODE = '55000';
        END IF;
        IF v_concept.applies_to NOT IN ('BOTH', p_side) THEN
            RAISE EXCEPTION 'La retención "%" no aplica a %.', v_concept.name,
                CASE p_side WHEN 'PURCHASES' THEN 'compras' ELSE 'ventas' END USING ERRCODE = '22023';
        END IF;
        v_account := CASE p_side WHEN 'PURCHASES' THEN v_concept.payable_account_id ELSE v_concept.receivable_account_id END;
        IF v_account IS NULL THEN
            RAISE EXCEPTION 'La retención "%" no tiene cuenta contable configurada.', v_concept.name USING ERRCODE = '23502';
        END IF;

        v_base := ROUND(GREATEST(CASE v_concept.base_type WHEN 'TAX_AMOUNT' THEN COALESCE(p_tax, 0) ELSE COALESCE(p_base, 0) END, 0), 2);
        v_eff_factor := CASE WHEN v_concept.withholding_type = 'RETEFUENTE' THEN v_factor ELSE 1 END;
        v_applied := true;
        v_reason := NULL;
        v_min := 0;

        IF v_concept.withholding_type = 'RETEFUENTE' AND COALESCE(v_self, false) THEN
            v_applied := false;
            v_reason := CASE p_side WHEN 'PURCHASES' THEN 'El proveedor es autorretenedor' ELSE 'La empresa es autorretenedora' END;
        ELSIF v_concept.withholding_type = 'RETEFUENTE' AND COALESCE(v_simple, false) THEN
            v_applied := false;
            v_reason := CASE p_side WHEN 'PURCHASES' THEN 'El proveedor pertenece al régimen simple' ELSE 'La empresa pertenece al régimen simple' END;
        ELSIF v_base <= 0 THEN
            v_applied := false;
            v_reason := CASE v_concept.base_type WHEN 'TAX_AMOUNT' THEN 'El documento no tiene IVA' ELSE 'El documento no tiene base' END;
        ELSE
            IF v_concept.min_base_uvt > 0 THEN
                SELECT value INTO v_uvt FROM public.uvt_values
                WHERE company_id = p_company_id AND year = EXTRACT(YEAR FROM v_date)::INT;
                IF v_uvt IS NULL THEN
                    RAISE EXCEPTION 'Configure el valor de la UVT de % en Configuración → Retenciones.', EXTRACT(YEAR FROM v_date)::INT
                        USING ERRCODE = '23502';
                END IF;
                v_min := ROUND(v_concept.min_base_uvt * v_uvt, 2);
            END IF;
            IF v_base < v_min THEN
                v_applied := false;
                v_reason := 'La base no alcanza el mínimo de ' || translate(to_char(v_min, 'FM999,999,999,990'), ',', '.') || ' pesos';
            ELSIF v_eff_factor = 0 THEN
                v_applied := false;
                v_reason := 'Beneficiario ZESE: tarifa 0 % en los primeros 5 años';
            END IF;
        END IF;

        v_rate := ROUND(v_concept.rate_percent * v_eff_factor, 4);
        v_amount := CASE WHEN v_applied THEN ROUND(v_base * v_rate / 100, 2) ELSE 0 END;
        IF v_applied AND v_amount <= 0 THEN
            v_applied := false;
            v_reason := 'El valor calculado es cero';
        END IF;

        v_result := v_result || jsonb_build_object(
            'concept_id', v_concept.id,
            'code', v_concept.code,
            'name', v_concept.name,
            'withholding_type', v_concept.withholding_type,
            'base_amount', v_base,
            'min_base_amount', v_min,
            'nominal_rate', v_concept.rate_percent,
            'zese_factor', v_eff_factor,
            'effective_rate', v_rate,
            'amount', v_amount,
            'account_id', v_account,
            'applied', v_applied,
            'reason', v_reason);
    END LOOP;

    IF v_found <> cardinality(p_concept_ids) THEN
        RAISE EXCEPTION 'Una retención seleccionada no existe.' USING ERRCODE = '23503';
    END IF;
    RETURN v_result;
END;
$$;

-- Guarda el detalle aplicado de un documento (reemplaza el anterior) y devuelve el total.
CREATE OR REPLACE FUNCTION public.fn_store_document_withholdings_internal(
    p_company_id UUID, p_document_type TEXT, p_document_id UUID, p_lines JSONB)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_total NUMERIC(15,2);
BEGIN
    DELETE FROM public.document_withholdings
    WHERE document_type = p_document_type AND document_id = p_document_id;

    INSERT INTO public.document_withholdings (
        company_id, document_type, document_id, concept_id, concept_code, concept_name, withholding_type,
        base_amount, nominal_rate, zese_factor, effective_rate, amount, account_id)
    SELECT p_company_id, p_document_type, p_document_id, (l->>'concept_id')::UUID, l->>'code', l->>'name',
           l->>'withholding_type', (l->>'base_amount')::NUMERIC, (l->>'nominal_rate')::NUMERIC,
           (l->>'zese_factor')::NUMERIC, (l->>'effective_rate')::NUMERIC, (l->>'amount')::NUMERIC,
           (l->>'account_id')::UUID
    FROM jsonb_array_elements(COALESCE(p_lines, '[]'::JSONB)) l
    WHERE (l->>'applied')::BOOLEAN;

    SELECT COALESCE(SUM(amount), 0) INTO v_total
    FROM public.document_withholdings
    WHERE document_type = p_document_type AND document_id = p_document_id;
    RETURN v_total;
END;
$$;

-- Vista previa para los formularios (no guarda nada).
CREATE OR REPLACE FUNCTION public.fn_preview_withholdings(
    p_side TEXT, p_third_party_id UUID, p_base NUMERIC, p_tax NUMERIC,
    p_concept_ids UUID[], p_date DATE DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_company UUID := public.get_auth_company_id();
BEGIN
    IF auth.uid() IS NULL OR v_company IS NULL THEN
        RAISE EXCEPTION 'Acceso denegado: usuario no autenticado.' USING ERRCODE = '28000';
    END IF;
    RETURN public.fn_compute_withholdings_internal(
        v_company, p_side, p_third_party_id, p_base, p_tax, p_concept_ids, p_date, false);
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. Compras: selección, recálculo automático y guardado atómico con la orden
-- ------------------------------------------------------------------------------
-- p_concept_ids NULL recalcula con la selección ya guardada (cambio de montos o proveedor).
CREATE OR REPLACE FUNCTION public.fn_apply_purchase_withholdings_internal(p_purchase_id UUID, p_concept_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_pur RECORD;
    v_ids UUID[];
    v_recalc BOOLEAN := p_concept_ids IS NULL;
    v_lines JSONB;
    v_total NUMERIC(15,2);
    v_net NUMERIC(15,2);
BEGIN
    SELECT * INTO v_pur FROM public.purchases WHERE id = p_purchase_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La orden de compra no existe.' USING ERRCODE = '23503';
    END IF;
    v_ids := COALESCE(p_concept_ids, v_pur.withholding_concept_ids, '{}'::UUID[]);

    v_lines := public.fn_compute_withholdings_internal(
        v_pur.company_id, 'PURCHASES', v_pur.supplier_id,
        COALESCE(v_pur.total_amount, 0) - COALESCE(v_pur.tax_amount, 0), COALESCE(v_pur.tax_amount, 0),
        v_ids, COALESCE(v_pur.issue_date, (NOW() AT TIME ZONE 'America/Bogota')::DATE), v_recalc);
    v_total := public.fn_store_document_withholdings_internal(v_pur.company_id, 'PURCHASE', v_pur.id, v_lines);

    v_net := COALESCE(v_pur.total_amount, 0) - v_total;
    IF v_total > 0 AND v_net <= 0 THEN
        RAISE EXCEPTION 'Las retenciones de la compra % igualan o superan su total.', v_pur.purchase_number USING ERRCODE = '22023';
    END IF;
    IF COALESCE(v_pur.paid_amount, 0) > v_net THEN
        RAISE EXCEPTION 'La compra % ya tiene pagos por % y las retenciones dejarían un neto de %.',
            v_pur.purchase_number, v_pur.paid_amount, v_net USING ERRCODE = '22023';
    END IF;

    UPDATE public.purchases
    SET withholding_concept_ids = v_ids,
        withholding_amount = v_total,
        payment_status = CASE
            WHEN COALESCE(paid_amount, 0) > 0 AND COALESCE(paid_amount, 0) >= v_net THEN 'PAID'
            WHEN COALESCE(paid_amount, 0) > 0 THEN 'PARTIAL'
            ELSE payment_status END,
        updated_at = NOW()
    WHERE id = v_pur.id;

    RETURN jsonb_build_object('withholding_amount', v_total, 'net_amount', v_net, 'lines', v_lines);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_trg_recalculate_purchase_withholdings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    PERFORM public.fn_apply_purchase_withholdings_internal(NEW.id, NULL);
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalculate_purchase_withholdings ON public.purchases;
CREATE TRIGGER trg_recalculate_purchase_withholdings
    AFTER UPDATE OF subtotal_amount, discount_amount, tax_amount, total_amount, supplier_id, issue_date
    ON public.purchases
    FOR EACH ROW
    WHEN (cardinality(NEW.withholding_concept_ids) > 0 AND (
          NEW.total_amount IS DISTINCT FROM OLD.total_amount
       OR NEW.tax_amount IS DISTINCT FROM OLD.tax_amount
       OR NEW.subtotal_amount IS DISTINCT FROM OLD.subtotal_amount
       OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
       OR NEW.supplier_id IS DISTINCT FROM OLD.supplier_id
       OR NEW.issue_date IS DISTINCT FROM OLD.issue_date))
    EXECUTE FUNCTION public.fn_trg_recalculate_purchase_withholdings();

-- Selección desde la interfaz: solo antes de la recepción completa y de la causación.
CREATE OR REPLACE FUNCTION public.fn_set_purchase_withholdings(p_purchase_id UUID, p_concept_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_company UUID := public.get_auth_company_id();
    v_pur RECORD;
    v_result JSONB;
BEGIN
    IF auth.uid() IS NULL OR v_company IS NULL THEN
        RAISE EXCEPTION 'Acceso denegado: usuario no autenticado.' USING ERRCODE = '28000';
    END IF;
    IF NOT (public.has_permission('purchases.create') OR public.is_admin()) THEN
        RAISE EXCEPTION 'Acceso denegado: aplicar retenciones requiere el permiso purchases.create.' USING ERRCODE = '42501';
    END IF;

    SELECT id, company_id, purchase_number, UPPER(COALESCE(inventory_status, '')) AS st, withholding_amount,
           withholding_concept_ids
    INTO v_pur FROM public.purchases WHERE id = p_purchase_id FOR UPDATE;
    IF NOT FOUND OR v_pur.company_id <> v_company THEN
        RAISE EXCEPTION 'La orden de compra no existe o no pertenece a su empresa.' USING ERRCODE = '42501';
    END IF;
    IF v_pur.st IN ('RECEIVED', 'RECIBIDA', 'CANCELLED', 'CANCELADA') THEN
        RAISE EXCEPTION 'La compra % ya está % y sus retenciones no se pueden cambiar.', v_pur.purchase_number,
            CASE WHEN v_pur.st IN ('CANCELLED', 'CANCELADA') THEN 'anulada' ELSE 'recibida y causada' END
            USING ERRCODE = '55000';
    END IF;
    IF EXISTS (SELECT 1 FROM public.accounting_entries
               WHERE company_id = v_company AND document_type = 'PURCHASE'
                 AND document_reference = v_pur.purchase_number AND status = 'POSTED') THEN
        RAISE EXCEPTION 'La compra % ya está causada en contabilidad: sus retenciones no se pueden cambiar.', v_pur.purchase_number
            USING ERRCODE = '55000';
    END IF;

    v_result := public.fn_apply_purchase_withholdings_internal(p_purchase_id, COALESCE(p_concept_ids, '{}'::UUID[]));

    INSERT INTO public.audit_logs (company_id, user_id, user_name, action, module, entity_name, entity_id,
                                   previous_value, new_value, created_at)
    VALUES (v_company, auth.uid(),
            COALESCE((SELECT full_name FROM public.users WHERE id = auth.uid()), 'Usuario'),
            'PURCHASE_WITHHOLDINGS_SET', 'PURCHASES', 'purchases', p_purchase_id::TEXT,
            jsonb_build_object('withholding_amount', v_pur.withholding_amount, 'concept_ids', v_pur.withholding_concept_ids),
            jsonb_build_object('withholding_amount', v_result->'withholding_amount', 'concept_ids', p_concept_ids),
            NOW());
    RETURN v_result;
END;
$$;

-- Guardado atómico: la orden y sus retenciones en la misma transacción.
CREATE OR REPLACE FUNCTION public.fn_create_purchase_order_with_withholdings(
    p_supplier_id UUID, p_location_id UUID, p_supplier_invoice_number CHARACTER VARYING,
    p_issue_date DATE, p_due_date DATE, p_payment_terms CHARACTER VARYING, p_notes TEXT,
    p_save_as_draft BOOLEAN, p_items JSONB, p_withholding_concept_ids UUID[] DEFAULT '{}'::UUID[])
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_id UUID;
BEGIN
    v_id := public.fn_create_purchase_order(p_supplier_id, p_location_id, p_supplier_invoice_number,
        p_issue_date, p_due_date, p_payment_terms, p_notes, p_save_as_draft, p_items);
    IF COALESCE(cardinality(p_withholding_concept_ids), 0) > 0 THEN
        PERFORM public.fn_set_purchase_withholdings(v_id, p_withholding_concept_ids);
    END IF;
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_update_purchase_order_with_withholdings(
    p_purchase_id UUID, p_supplier_id UUID, p_location_id UUID, p_supplier_invoice_number CHARACTER VARYING,
    p_issue_date DATE, p_due_date DATE, p_payment_terms CHARACTER VARYING, p_notes TEXT,
    p_save_as_draft BOOLEAN, p_items JSONB, p_withholding_concept_ids UUID[] DEFAULT '{}'::UUID[])
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_id UUID;
BEGIN
    v_id := public.fn_update_purchase_order(p_purchase_id, p_supplier_id, p_location_id, p_supplier_invoice_number,
        p_issue_date, p_due_date, p_payment_terms, p_notes, p_save_as_draft, p_items);
    PERFORM public.fn_set_purchase_withholdings(v_id, COALESCE(p_withholding_concept_ids, '{}'::UUID[]));
    RETURN v_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. Cuentas por pagar: el saldo es total - retenciones - pagado
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_assert_purchase_payable_internal(p_purchase_id uuid, p_company_id uuid, p_amount numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    v_purchase RECORD;
    v_pending NUMERIC(15,2);
BEGIN
    SELECT id, company_id, purchase_number, total_amount, paid_amount, withholding_amount,
           UPPER(COALESCE(inventory_status, '')) AS inv_status
    INTO v_purchase
    FROM public.purchases WHERE id = p_purchase_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La orden de compra especificada no existe.' USING ERRCODE = '23503';
    END IF;
    IF v_purchase.company_id <> p_company_id THEN
        RAISE EXCEPTION 'La orden de compra pertenece a otra empresa.' USING ERRCODE = '42501';
    END IF;
    IF v_purchase.inv_status IN ('CANCELADA', 'CANCELLED') THEN
        RAISE EXCEPTION 'No se pueden registrar pagos en una orden de compra anulada.' USING ERRCODE = '42200';
    END IF;
    IF v_purchase.inv_status IN ('BORRADOR', 'DRAFT') THEN
        RAISE EXCEPTION 'No se pueden registrar pagos en órdenes de compra en borrador. Debe confirmarse primero.' USING ERRCODE = '42200';
    END IF;
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'El monto del pago debe ser mayor a 0.' USING ERRCODE = '42200';
    END IF;

    v_pending := v_purchase.total_amount - COALESCE(v_purchase.withholding_amount, 0) - v_purchase.paid_amount;
    IF v_pending <= 0 THEN
        RAISE EXCEPTION 'La compra % ya está totalmente pagada.', v_purchase.purchase_number USING ERRCODE = '42200';
    END IF;
    IF p_amount > v_pending THEN
        RAISE EXCEPTION 'El monto a pagar (%) excede el saldo pendiente de la compra % (%).',
            p_amount, v_purchase.purchase_number, v_pending USING ERRCODE = '42200';
    END IF;
    RETURN v_pending;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_register_supplier_payment(p_purchase_id uuid, p_amount numeric, p_payment_date date DEFAULT CURRENT_DATE, p_payment_method character varying DEFAULT 'BANK_TRANSFER'::character varying, p_transaction_reference character varying DEFAULT NULL::character varying, p_notes text DEFAULT NULL::text, p_bank_account_id uuid DEFAULT NULL::uuid, p_cash_session_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    v_user RECORD;
    v_user_name VARCHAR(150);
    v_company_id UUID;
    v_purchase RECORD;
    v_supplier RECORD;
    v_pending NUMERIC(15,2);
    v_date DATE := COALESCE(p_payment_date, (NOW() AT TIME ZONE 'America/Bogota')::DATE);
    v_method VARCHAR(30);
    v_payment_id UUID := gen_random_uuid();
    v_treasury_id UUID;
    v_payment_number VARCHAR(50);
    v_bank RECORD;
    v_new_bank_balance NUMERIC(15,2);
    v_bank_movement_id UUID;
    v_bank_movement_number VARCHAR(50);
    v_cash_session_id UUID;
    v_session_cash NUMERIC(15,2);
    v_cs RECORD;
    v_cash_movement_id UUID;
    v_new_paid NUMERIC(15,2);
    v_new_status VARCHAR(30);
    v_entry JSONB;
BEGIN
    -- 1. Usuario, empresa y permisos
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Acceso denegado: usuario no autenticado.' USING ERRCODE = '28000';
    END IF;
    v_company_id := public.get_auth_company_id();
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Acceso denegado: el usuario no tiene empresa asignada.' USING ERRCODE = '42501';
    END IF;
    IF NOT (public.is_admin() OR public.has_permission('purchases.create') OR public.has_permission('treasury.create')) THEN
        RAISE EXCEPTION 'No tienes permisos para registrar pagos a proveedores.' USING ERRCODE = '42501';
    END IF;
    SELECT full_name, assigned_cash_register_id INTO v_user FROM public.users WHERE id = v_user_id;
    v_user_name := COALESCE(NULLIF(TRIM(v_user.full_name), ''), 'Usuario');

    -- 2. Compra pagable y saldo
    PERFORM pg_advisory_xact_lock(hashtext('purchase_supplier_payment_' || p_purchase_id::text));
    v_pending := public.fn_assert_purchase_payable_internal(p_purchase_id, v_company_id, p_amount);
    SELECT id, location_id, supplier_id, purchase_number, total_amount, paid_amount, withholding_amount
    INTO v_purchase FROM public.purchases WHERE id = p_purchase_id;
    SELECT COALESCE(name, legal_name, 'Proveedor') AS name, tax_id INTO v_supplier
    FROM public.suppliers WHERE id = v_purchase.supplier_id AND company_id = v_company_id;

    -- 3. Medio de pago: efectivo sale de la caja del usuario; los demás, de una cuenta bancaria elegida.
    v_method := UPPER(TRIM(COALESCE(p_payment_method, 'BANK_TRANSFER')));
    v_method := CASE
        WHEN v_method IN ('EFECTIVO', 'CASH') THEN 'CASH'
        WHEN v_method IN ('TRANSFERENCIA', 'BANK_TRANSFER', 'CONSIGNACION') THEN 'BANK_TRANSFER'
        WHEN v_method IN ('CHEQUE', 'CHECK') THEN 'CHECK'
        ELSE 'OTHER'
    END;

    v_payment_number := public.fn_next_supplier_payment_number(v_company_id);

    IF v_method = 'CASH' THEN
        SELECT cs.id INTO v_cash_session_id
        FROM public.cash_sessions cs
        LEFT JOIN public.cash_registers cr ON cr.id = cs.cash_register_id
        WHERE cs.company_id = v_company_id
          AND cs.user_id = v_user_id
          AND cs.status = 'OPEN'
          AND (p_cash_session_id IS NULL OR cs.id = p_cash_session_id)
          AND COALESCE(cs.location_id, cr.location_id) = v_purchase.location_id
          AND (v_user.assigned_cash_register_id IS NULL OR cs.cash_register_id = v_user.assigned_cash_register_id)
        ORDER BY cs.opening_time DESC
        LIMIT 1;
        IF v_cash_session_id IS NULL THEN
            RAISE EXCEPTION 'Para pagar en efectivo debe tener su caja abierta en la sede de la compra.' USING ERRCODE = '55001';
        END IF;

        -- Misma llave que los demás movimientos de caja (046/079)
        PERFORM pg_advisory_xact_lock(hashtext('cash_session_' || v_cash_session_id::TEXT));
        SELECT id, opening_float, status INTO v_cs FROM public.cash_sessions WHERE id = v_cash_session_id FOR UPDATE;
        SELECT COALESCE(v_cs.opening_float, 0)
               + COALESCE(SUM(amount) FILTER (WHERE type IN ('CASH_IN', 'SALE_CASH')), 0)
               - COALESCE(SUM(amount) FILTER (WHERE type = 'CASH_OUT'), 0)
        INTO v_session_cash
        FROM public.cash_movements WHERE session_id = v_cash_session_id;
        IF v_session_cash < p_amount THEN
            RAISE EXCEPTION 'La caja no tiene efectivo suficiente para pagar % (disponible: %).', p_amount, v_session_cash
                USING ERRCODE = '55000';
        END IF;

        INSERT INTO public.cash_movements (company_id, session_id, type, amount, reason, authorized_by_user_id, created_at)
        VALUES (v_company_id, v_cash_session_id, 'CASH_OUT', p_amount,
                'Pago a proveedor ' || v_supplier.name || ' (' || v_purchase.purchase_number || ' - ' || v_payment_number || ')',
                v_user_id, NOW())
        RETURNING id INTO v_cash_movement_id;
    ELSE
        IF p_bank_account_id IS NULL THEN
            RAISE EXCEPTION 'Seleccione la cuenta bancaria de la que sale el pago.' USING ERRCODE = '42200';
        END IF;
        PERFORM pg_advisory_xact_lock(hashtext('bank_account_' || p_bank_account_id::text));
        SELECT id, company_id, location_id, bank_name, account_number, current_balance, is_active
        INTO v_bank FROM public.bank_accounts WHERE id = p_bank_account_id FOR UPDATE;
        IF NOT FOUND OR v_bank.company_id <> v_company_id THEN
            RAISE EXCEPTION 'La cuenta bancaria no existe o pertenece a otra empresa.' USING ERRCODE = '42501';
        END IF;
        IF NOT v_bank.is_active THEN
            RAISE EXCEPTION 'La cuenta bancaria "%" está inactiva.', v_bank.bank_name USING ERRCODE = '42200';
        END IF;
        IF v_bank.current_balance < p_amount THEN
            RAISE EXCEPTION 'Fondos insuficientes en "% (%)". Saldo disponible: %, monto requerido: %.',
                v_bank.bank_name, v_bank.account_number, v_bank.current_balance, p_amount USING ERRCODE = '42200';
        END IF;

        v_new_bank_balance := v_bank.current_balance - p_amount;
        UPDATE public.bank_accounts SET current_balance = v_new_bank_balance, updated_at = NOW() WHERE id = v_bank.id;

        v_bank_movement_number := public.fn_next_treasury_consecutive(v_company_id, 'BANK_MOV');
        v_bank_movement_id := gen_random_uuid();
        INSERT INTO public.bank_movements (
            id, company_id, location_id, bank_account_id, movement_number, movement_date, movement_type,
            amount, balance_after, concept, reference, treasury_payment_id, is_reconciled,
            created_by_user_id, created_at, updated_at
        ) VALUES (
            v_bank_movement_id, v_company_id, v_bank.location_id, v_bank.id, v_bank_movement_number, v_date, 'DEBIT',
            p_amount, v_new_bank_balance,
            'Pago a proveedor ' || v_supplier.name || ' (' || v_purchase.purchase_number || ' - ' || v_payment_number || ')',
            p_transaction_reference, NULL, false, v_user_id, NOW(), NOW()
        );
    END IF;

    -- 4. Pago bancario visible en Tesorería (ejecutado)
    IF v_method <> 'CASH' THEN
    v_treasury_id := gen_random_uuid();
    INSERT INTO public.treasury_payments (
        id, company_id, location_id, payment_number, payment_type, purchase_id, supplier_id, bank_account_id,
        amount, payment_date, payment_method, reference_number, status, notes, created_by_user_id,
        updated_by_user_id, paid_at, created_at, updated_at
    ) VALUES (
        v_treasury_id, v_company_id, v_purchase.location_id, v_payment_number, 'SUPPLIER_PAYMENT', v_purchase.id,
        v_purchase.supplier_id, p_bank_account_id, p_amount, v_date,
        CASE v_method WHEN 'CHECK' THEN 'CHEQUE' WHEN 'BANK_TRANSFER' THEN 'TRANSFERENCIA' ELSE 'OTRO' END,
        p_transaction_reference, 'PAID', p_notes, v_user_id, v_user_id, NOW(), NOW(), NOW()
    );
    UPDATE public.bank_movements SET treasury_payment_id = v_treasury_id WHERE id = v_bank_movement_id;
    END IF;

    -- 5. Historial de Cuentas por Pagar
    INSERT INTO public.supplier_payments (
        id, purchase_id, company_id, location_id, payment_number, payment_date, amount, payment_method,
        transaction_reference, notes, created_by_user_id, bank_account_id, bank_movement_id,
        cash_session_id, cash_movement_id, created_at
    ) VALUES (
        v_payment_id, v_purchase.id, v_company_id, v_purchase.location_id, v_payment_number, v_date, p_amount, v_method,
        p_transaction_reference, p_notes, v_user_id,
        CASE WHEN v_method = 'CASH' THEN NULL ELSE p_bank_account_id END,
        v_bank_movement_id, v_cash_session_id, v_cash_movement_id, NOW()
    );
    IF v_bank_movement_id IS NOT NULL THEN
        UPDATE public.bank_movements SET supplier_payment_id = v_payment_id WHERE id = v_bank_movement_id;
    END IF;

    -- 6. Saldo de la compra
    v_new_paid := v_purchase.paid_amount + p_amount;
    v_new_status := CASE WHEN v_new_paid >= v_purchase.total_amount - COALESCE(v_purchase.withholding_amount, 0) THEN 'PAID' ELSE 'PARTIAL' END;
    UPDATE public.purchases SET paid_amount = v_new_paid, payment_status = v_new_status, updated_at = NOW()
    WHERE id = v_purchase.id;

    -- 7. Comprobante de egreso: Dr proveedores / Cr banco (subcuenta de la cuenta) o caja
    IF v_method = 'CASH' THEN
        v_entry := public.fn_create_accounting_entry(
            p_date := v_date,
            p_concept := 'Pago a proveedor ' || v_supplier.name || ' en efectivo (' || v_payment_number || ')',
            p_document_type := 'SUPPLIER_PAYMENT',
            p_document_reference := v_payment_number,
            p_lines := jsonb_build_array(
                jsonb_build_object(
                    'account_id', public.fn_get_default_account(v_company_id, 'SUPPLIERS_PAYABLE'),
                    'debit_amount', p_amount, 'credit_amount', 0,
                    'third_party_doc', v_supplier.tax_id, 'third_party_name', v_supplier.name,
                    'description', 'Abono a proveedor ' || v_supplier.name || ' pago ' || v_payment_number),
                jsonb_build_object(
                    'account_id', public.fn_get_default_account(v_company_id, 'CASH'),
                    'debit_amount', 0, 'credit_amount', p_amount,
                    'third_party_doc', v_supplier.tax_id, 'third_party_name', v_supplier.name,
                    'description', 'Egreso de caja pago ' || v_payment_number)
            ),
            p_location_id := v_purchase.location_id,
            p_auto_post := true,
            p_company_id := v_company_id
        );
    ELSE
        v_entry := public.fn_cause_payment_accounting_internal(v_treasury_id);
    END IF;

    -- 8. Auditoría
    INSERT INTO public.audit_logs (
        company_id, user_id, user_name, action, module, entity_name, entity_id, location_id,
        previous_value, new_value, created_at
    ) VALUES (
        v_company_id, v_user_id, v_user_name, 'SUPPLIER_PAYMENT_CREATED', 'PURCHASES', 'supplier_payments',
        v_payment_id::TEXT, v_purchase.location_id,
        jsonb_build_object('paid_amount', v_purchase.paid_amount, 'pending_balance', v_pending),
        jsonb_build_object(
            'payment_number', v_payment_number, 'purchase_number', v_purchase.purchase_number,
            'supplier_name', v_supplier.name, 'amount', p_amount, 'payment_method', v_method,
            'treasury_payment_id', v_treasury_id, 'bank_movement_id', v_bank_movement_id,
            'cash_movement_id', v_cash_movement_id, 'accounting_entry_number', v_entry->>'entry_number'),
        NOW()
    );

    RETURN jsonb_build_object(
        'payment_id', v_payment_id,
        'payment_number', v_payment_number,
        'purchase_id', v_purchase.id,
        'purchase_number', v_purchase.purchase_number,
        'amount', p_amount,
        'payment_date', v_date,
        'payment_method', v_method,
        'transaction_reference', p_transaction_reference,
        'total_amount', v_purchase.total_amount,
        'paid_amount', v_new_paid,
        'withholding_amount', COALESCE(v_purchase.withholding_amount, 0),
        'pending_balance', v_purchase.total_amount - COALESCE(v_purchase.withholding_amount, 0) - v_new_paid,
        'payment_status', v_new_status,
        'bank_movement_id', v_bank_movement_id,
        'cash_movement_id', v_cash_movement_id,
        'treasury_payment_id', v_treasury_id,
        'accounting_entry_id', v_entry->>'entry_id',
        'accounting_entry_number', v_entry->>'entry_number'
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_execute_treasury_payment(p_payment_id uuid, p_bank_account_id uuid DEFAULT NULL::uuid, p_reference_number text DEFAULT NULL::text, p_support_document_url text DEFAULT NULL::text, p_payment_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    v_company_id UUID;
    v_user_name VARCHAR(150);
    v_payment RECORD;
    v_bank_id UUID;
    v_bank RECORD;
    v_new_balance NUMERIC(15,2);
    v_mov_number VARCHAR(50);
    v_mov_id UUID;
    v_date DATE := COALESCE(p_payment_date, (NOW() AT TIME ZONE 'America/Bogota')::DATE);
    v_entry JSONB;
    v_voucher VARCHAR(5);
BEGIN
    IF v_user_id IS NOT NULL THEN
        v_company_id := public.get_auth_company_id();
        IF v_company_id IS NULL THEN
            RAISE EXCEPTION 'Acceso denegado: el usuario no tiene empresa asignada.' USING ERRCODE = '42501';
        END IF;
        IF NOT (public.is_admin() OR public.has_permission('treasury.create')) THEN
            RAISE EXCEPTION 'Acceso denegado: ejecutar pagos requiere el permiso treasury.create.' USING ERRCODE = '42501';
        END IF;
    ELSIF NOT public.fn_is_trusted_server_context() THEN
        RAISE EXCEPTION 'Acceso denegado: usuario no autenticado.' USING ERRCODE = '28000';
    END IF;

    -- Bloqueo pesimista del pago
    PERFORM pg_advisory_xact_lock(hashtext('treasury_payment_' || p_payment_id::text));

    SELECT * INTO v_payment FROM public.treasury_payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El pago programado especificado no existe.' USING ERRCODE = '23503';
    END IF;
    v_company_id := COALESCE(v_company_id, v_payment.company_id);
    IF v_payment.company_id <> v_company_id THEN
        RAISE EXCEPTION 'El pago programado pertenece a otra empresa.' USING ERRCODE = '42501';
    END IF;
    IF v_payment.status <> 'SCHEDULED' THEN
        RAISE EXCEPTION 'El pago % ya fue procesado o se encuentra en estado %.', v_payment.payment_number, v_payment.status
            USING ERRCODE = '42200';
    END IF;

    v_bank_id := COALESCE(p_bank_account_id, v_payment.bank_account_id);

    -- Bloqueo pesimista de la cuenta bancaria
    PERFORM pg_advisory_xact_lock(hashtext('bank_account_' || v_bank_id::text));
    SELECT * INTO v_bank FROM public.bank_accounts WHERE id = v_bank_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La cuenta bancaria seleccionada no existe.' USING ERRCODE = '23503';
    END IF;
    IF v_bank.company_id <> v_company_id THEN
        RAISE EXCEPTION 'La cuenta bancaria pertenece a otra empresa.' USING ERRCODE = '42501';
    END IF;
    IF v_bank.is_active <> true THEN
        RAISE EXCEPTION 'La cuenta bancaria "%" está inactiva.', v_bank.bank_name USING ERRCODE = '42200';
    END IF;
    IF v_bank.current_balance < v_payment.amount THEN
        RAISE EXCEPTION 'Fondos insuficientes en la cuenta bancaria "% (%)". Saldo disponible: %, Monto requerido: %.',
            v_bank.bank_name, v_bank.account_number, v_bank.current_balance, v_payment.amount
            USING ERRCODE = '42200';
    END IF;

    v_new_balance := v_bank.current_balance - v_payment.amount;

    IF v_user_id IS NOT NULL THEN
        SELECT full_name INTO v_user_name FROM public.users WHERE id = v_user_id;
    END IF;
    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Usuario Sistema';
    END IF;

    -- 1. Saldo bancario
    UPDATE public.bank_accounts SET current_balance = v_new_balance, updated_at = NOW() WHERE id = v_bank_id;

    -- 2. Movimiento bancario (DEBIT = salida, convención de 047)
    v_mov_number := public.fn_next_treasury_consecutive(v_company_id, 'BANK_MOV');
    v_mov_id := gen_random_uuid();
    INSERT INTO public.bank_movements (
        id, company_id, location_id, bank_account_id, movement_number, movement_date, movement_type,
        amount, balance_after, concept, reference, treasury_payment_id, is_reconciled,
        created_by_user_id, created_at, updated_at
    ) VALUES (
        v_mov_id, v_company_id, v_bank.location_id, v_bank_id, v_mov_number, v_date, 'DEBIT',
        v_payment.amount, v_new_balance, 'Desembolso pago ' || v_payment.payment_number,
        COALESCE(p_reference_number, v_payment.reference_number), p_payment_id, false,
        v_user_id, NOW(), NOW()
    );

    -- 3. Pago a PAID
    UPDATE public.treasury_payments
    SET status = 'PAID',
        bank_account_id = v_bank_id,
        reference_number = COALESCE(p_reference_number, reference_number),
        support_document_url = COALESCE(p_support_document_url, support_document_url),
        payment_date = v_date,
        paid_at = NOW(),
        updated_by_user_id = COALESCE(v_user_id, updated_by_user_id),
        updated_at = NOW()
    WHERE id = p_payment_id;

    -- 4. Cuenta por pagar de la compra, si aplica
    IF v_payment.purchase_id IS NOT NULL THEN
        UPDATE public.purchases
        SET paid_amount = paid_amount + v_payment.amount,
            payment_status = CASE WHEN (paid_amount + v_payment.amount) >= total_amount - COALESCE(withholding_amount, 0)
                                  THEN 'PAID' ELSE 'PARTIAL' END,
            updated_at = NOW()
        WHERE id = v_payment.purchase_id;
    END IF;

    -- 5. Comprobante de egreso (CE) en la misma transacción: Dr proveedores / Cr subcuenta del banco
    v_entry := public.fn_cause_payment_accounting_internal(p_payment_id);
    SELECT voucher_type_code INTO v_voucher FROM public.accounting_entries WHERE id = (v_entry->>'entry_id')::UUID;

    -- 6. Auditoría
    INSERT INTO public.audit_logs (
        company_id, user_id, user_name, action, module, entity_name, entity_id, location_id, new_value, created_at
    ) VALUES (
        v_company_id, v_user_id, v_user_name, 'TREASURY_PAYMENT_EXECUTED', 'TREASURY', 'treasury_payments',
        p_payment_id, v_bank.location_id,
        jsonb_build_object(
            'payment_id', p_payment_id,
            'payment_number', v_payment.payment_number,
            'amount', v_payment.amount,
            'bank_account_id', v_bank_id,
            'bank_movement_id', v_mov_id,
            'previous_bank_balance', v_bank.current_balance,
            'new_bank_balance', v_new_balance,
            'purchase_id', v_payment.purchase_id,
            'accounting_entry_number', v_entry->>'entry_number'
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', p_payment_id,
        'payment_number', v_payment.payment_number,
        'amount', v_payment.amount,
        'bank_movement_id', v_mov_id,
        'bank_movement_number', v_mov_number,
        'new_bank_balance', v_new_balance,
        'status', 'PAID',
        'accounting_entry_id', v_entry->>'entry_id',
        'accounting_entry_number', v_entry->>'entry_number',
        'voucher_type_code', v_voucher
    );
END;
$function$;

-- ------------------------------------------------------------------------------
-- 7. Causación de compras: proveedor por el neto y crédito a cada retención
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_cause_purchase_accounting_internal(p_purchase_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_pur RECORD;
  v_existing RECORD;
  v_supp RECORD;
  v_status VARCHAR(30);
  v_lines JSONB := '[]'::JSONB;
  v_grp RECORD;
  v_inventory_total NUMERIC(15,2);
  v_allocated NUMERIC(15,2) := 0;
  v_accounts UUID[] := ARRAY[]::UUID[];
  v_amounts NUMERIC[] := ARRAY[]::NUMERIC[];
  v_invoice_ref TEXT;
  v_wh RECORD;
  v_withholding NUMERIC(15,2);
BEGIN
  SELECT * INTO v_pur FROM public.purchases WHERE id = p_purchase_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compra % no encontrada para causación contable.', p_purchase_id USING ERRCODE = 'P0002';
  END IF;

  -- Idempotencia: un solo asiento contabilizado por compra.
  SELECT id, entry_number INTO v_existing
  FROM public.accounting_entries
  WHERE company_id = v_pur.company_id AND document_type = 'PURCHASE'
    AND document_reference = v_pur.purchase_number AND status = 'POSTED'
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'already_caused', true,
      'entry_id', v_existing.id, 'entry_number', v_existing.entry_number);
  END IF;

  v_status := UPPER(COALESCE(v_pur.inventory_status, ''));
  IF v_status IN ('', 'DRAFT', 'BORRADOR') THEN
    RAISE EXCEPTION 'La compra % está en borrador: confírmela antes de causarla.', v_pur.purchase_number
      USING ERRCODE = '22023';
  END IF;
  IF v_status IN ('CANCELLED', 'CANCELADA') THEN
    RAISE EXCEPTION 'La compra % está anulada y no se causa.', v_pur.purchase_number USING ERRCODE = '22023';
  END IF;
  IF COALESCE(v_pur.total_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'La compra % no tiene valor para causar.', v_pur.purchase_number USING ERRCODE = '22023';
  END IF;

  SELECT tax_id, name INTO v_supp
  FROM public.suppliers WHERE id = v_pur.supplier_id AND company_id = v_pur.company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El proveedor de la compra % no existe en la empresa.', v_pur.purchase_number
      USING ERRCODE = 'P0002';
  END IF;
  v_invoice_ref := COALESCE(NULLIF(BTRIM(v_pur.supplier_invoice_number), ''), v_pur.purchase_number);

  -- DÉBITOS DE INVENTARIO: una línea por cuenta de inventario de los productos comprados.
  v_inventory_total := v_pur.total_amount - COALESCE(v_pur.tax_amount, 0);
  IF v_inventory_total > 0 THEN
    FOR v_grp IN
      SELECT public.fn_product_inventory_account(v_pur.company_id, pi.product_id) AS account_id,
             ROUND(SUM(GREATEST(pi.subtotal - COALESCE(pi.discount_amount, 0), 0)), 2) AS net_amount
      FROM public.purchase_items pi
      WHERE pi.purchase_id = p_purchase_id
      GROUP BY 1
      ORDER BY 2 DESC, 1
    LOOP
      IF v_grp.account_id IS NULL THEN
        RAISE EXCEPTION 'Un producto de la compra % no tiene cuenta de inventario y falta la cuenta por defecto (INVENTORY).',
          v_pur.purchase_number USING ERRCODE = 'P0002';
      END IF;
      v_accounts := v_accounts || v_grp.account_id;
      v_amounts := v_amounts || v_grp.net_amount;
      v_allocated := v_allocated + v_grp.net_amount;
    END LOOP;

    IF COALESCE(array_length(v_accounts, 1), 0) = 0 THEN
      -- Compra sin líneas: todo a la cuenta de inventario por defecto.
      v_accounts := ARRAY[public.fn_get_default_account(v_pur.company_id, 'INVENTORY')];
      v_amounts := ARRAY[v_inventory_total];
    ELSE
      -- La diferencia de redondeo contra la cabecera va a la línea de mayor valor.
      v_amounts[1] := v_amounts[1] + (v_inventory_total - v_allocated);
    END IF;

    FOR i IN 1 .. array_length(v_accounts, 1) LOOP
      CONTINUE WHEN v_amounts[i] = 0;
      IF v_amounts[i] < 0 THEN
        RAISE EXCEPTION 'Los valores de la compra % no cuadran con sus líneas.', v_pur.purchase_number
          USING ERRCODE = '22023';
      END IF;
      v_lines := v_lines || jsonb_build_object(
        'account_id', v_accounts[i],
        'debit_amount', v_amounts[i], 'credit_amount', 0,
        'third_party_doc', v_supp.tax_id, 'third_party_name', v_supp.name,
        'description', 'Entrada de mercancías compra ' || v_pur.purchase_number);
    END LOOP;
  END IF;

  IF COALESCE(v_pur.tax_amount, 0) > 0 THEN
    v_lines := v_lines || jsonb_build_object(
      'account_id', public.fn_get_default_account(v_pur.company_id, 'VAT_DEDUCTIBLE'),
      'debit_amount', v_pur.tax_amount, 'credit_amount', 0,
      'third_party_doc', v_supp.tax_id, 'third_party_name', v_supp.name,
      'description', 'IVA descontable compra ' || v_pur.purchase_number);
  END IF;

  -- 095: retenciones practicadas al proveedor (crédito a la cuenta por pagar de cada concepto)
  SELECT COALESCE(SUM(amount), 0) INTO v_withholding
  FROM public.document_withholdings WHERE document_type = 'PURCHASE' AND document_id = v_pur.id;
  IF v_withholding <> COALESCE(v_pur.withholding_amount, 0) THEN
    RAISE EXCEPTION 'Las retenciones de la compra % no cuadran con su detalle. Vuelva a guardarlas.', v_pur.purchase_number
      USING ERRCODE = '22000';
  END IF;
  IF v_withholding >= v_pur.total_amount THEN
    RAISE EXCEPTION 'Las retenciones de la compra % igualan o superan su total.', v_pur.purchase_number
      USING ERRCODE = '22023';
  END IF;
  FOR v_wh IN
    SELECT account_id, concept_name, SUM(amount) AS amount
    FROM public.document_withholdings
    WHERE document_type = 'PURCHASE' AND document_id = v_pur.id AND amount > 0
    GROUP BY account_id, concept_name ORDER BY concept_name
  LOOP
    v_lines := v_lines || jsonb_build_object(
      'account_id', v_wh.account_id,
      'debit_amount', 0, 'credit_amount', v_wh.amount,
      'third_party_doc', v_supp.tax_id, 'third_party_name', v_supp.name,
      'description', v_wh.concept_name || ' compra ' || v_pur.purchase_number);
  END LOOP;

  v_lines := v_lines || jsonb_build_object(
    'account_id', public.fn_get_default_account(v_pur.company_id, 'SUPPLIERS_PAYABLE'),
    'debit_amount', 0, 'credit_amount', v_pur.total_amount - v_withholding,
    'third_party_doc', v_supp.tax_id, 'third_party_name', v_supp.name,
    'description', 'Cuenta por pagar a ' || v_supp.name || ' factura ' || v_invoice_ref);

  RETURN public.fn_create_accounting_entry(
    p_date := v_pur.issue_date,
    p_concept := 'Causación compra ' || v_pur.purchase_number || ' - ' || v_supp.name || ' (factura ' || v_invoice_ref || ')',
    p_document_type := 'PURCHASE',
    p_document_reference := v_pur.purchase_number,
    p_lines := v_lines,
    p_location_id := v_pur.location_id,
    p_auto_post := true,
    p_company_id := v_pur.company_id,
    p_due_date := v_pur.due_date,
    p_voucher_type_code := 'FC'
  ) || jsonb_build_object('already_caused', false);
END;
$function$;

-- ------------------------------------------------------------------------------
-- 8. Ventas: la retención del cliente se fija al crear la venta y se cobra el neto
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_guard_sales_server_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  -- Dentro de una función SECURITY DEFINER current_user es su dueño; la API llega como anon/authenticated.
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Las ventas solo se registran desde el servidor (Ventas, POS o conversión de documentos).'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.total_amount IS DISTINCT FROM OLD.total_amount
     OR NEW.subtotal_amount IS DISTINCT FROM OLD.subtotal_amount
     OR NEW.tax_amount IS DISTINCT FROM OLD.tax_amount
     OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
     OR NEW.total_cost_amount IS DISTINCT FROM OLD.total_cost_amount
     OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
     OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
     OR NEW.paid_amount IS DISTINCT FROM OLD.paid_amount
     OR NEW.withholding_amount IS DISTINCT FROM OLD.withholding_amount
     OR NEW.payment_terms IS DISTINCT FROM OLD.payment_terms
     OR NEW.due_date IS DISTINCT FROM OLD.due_date
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.company_id IS DISTINCT FROM OLD.company_id
     OR NEW.location_id IS DISTINCT FROM OLD.location_id
     OR NEW.seller_user_id IS DISTINCT FROM OLD.seller_user_id
     OR NEW.cash_session_id IS DISTINCT FROM OLD.cash_session_id
     OR NEW.sale_number IS DISTINCT FROM OLD.sale_number
     OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
     OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason THEN
    RAISE EXCEPTION 'Los importes, el cliente, los pagos y el estado de la venta % solo los cambia el servidor (cobro, devolución o anulación).',
      OLD.sale_number USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_register_sale_payments_internal(p_sale_id uuid, p_payments jsonb, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_sale RECORD;
  v_pay JSONB;
  v_method VARCHAR(30);
  v_methods TEXT[];
  v_sale_method TEXT;
  v_amount NUMERIC(15,2);
  v_bank_id UUID;
  v_bank RECORD;
  v_specified NUMERIC(15,2) := 0;
  v_open_count INT := 0;
  v_sum NUMERIC(15,2) := 0;
  v_count INT := 0;
BEGIN
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta % no encontrada.', p_sale_id USING ERRCODE = 'P0002';
  END IF;

  IF v_sale.status::TEXT IN ('CANCELLED', 'RETURNED') THEN
    RAISE EXCEPTION 'La venta % está % y no admite registro de pagos.', v_sale.sale_number, v_sale.status
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (SELECT 1 FROM public.sale_payments WHERE sale_id = p_sale_id) THEN
    RAISE EXCEPTION 'Los pagos de la venta % ya fueron registrados.', v_sale.sale_number USING ERRCODE = '23505';
  END IF;

  IF p_payments IS NULL OR jsonb_typeof(p_payments) <> 'array' OR jsonb_array_length(p_payments) = 0 THEN
    RAISE EXCEPTION 'Debe indicar al menos un medio de pago.' USING ERRCODE = '23502';
  END IF;

  -- Los medios deben coincidir con el medio de la venta: CREDIT solo en ventas a crédito, un medio
  -- único igual al de la venta, y MIXED con al menos dos medios distintos.
  SELECT ARRAY(SELECT DISTINCT UPPER(TRIM(e->>'method')) FROM jsonb_array_elements(p_payments) e ORDER BY 1)
  INTO v_methods;
  v_sale_method := v_sale.payment_method::TEXT;
  IF 'CREDIT' = ANY(v_methods) AND v_sale_method <> 'CREDIT' THEN
    RAISE EXCEPTION 'La venta % no es a crédito (%): no puede registrar pagos CREDIT.', v_sale.sale_number, v_sale_method
      USING ERRCODE = '22023';
  END IF;
  IF v_sale_method = 'MIXED' THEN
    IF COALESCE(array_length(v_methods, 1), 0) < 2 THEN
      RAISE EXCEPTION 'La venta % es de pago mixto: registre al menos dos medios de pago distintos.', v_sale.sale_number
        USING ERRCODE = '22023';
    END IF;
  ELSIF v_methods IS DISTINCT FROM ARRAY[v_sale_method] THEN
    RAISE EXCEPTION 'Los medios de pago (%) no coinciden con el medio de la venta % (%).',
      array_to_string(v_methods, ', '), v_sale.sale_number, v_sale_method USING ERRCODE = '22023';
  END IF;

  -- Un (solo) pago puede venir sin valor: toma el saldo que falta para el total calculado por el servidor.
  FOR v_pay IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    IF v_pay->'amount' IS NULL OR jsonb_typeof(v_pay->'amount') = 'null' THEN
      v_open_count := v_open_count + 1;
    ELSE
      v_specified := v_specified + ROUND((v_pay->>'amount')::NUMERIC, 2);
    END IF;
  END LOOP;
  IF v_open_count > 1 THEN
    RAISE EXCEPTION 'Solo un medio de pago puede tomar el saldo restante.' USING ERRCODE = '22023';
  END IF;

  FOR v_pay IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_method := UPPER(TRIM(v_pay->>'method'));
    IF v_pay->'amount' IS NULL OR jsonb_typeof(v_pay->'amount') = 'null' THEN
      v_amount := v_sale.total_amount - COALESCE(v_sale.withholding_amount, 0) - v_specified;
    ELSE
      v_amount := ROUND((v_pay->>'amount')::NUMERIC, 2);
    END IF;
    v_bank_id := NULLIF(v_pay->>'bank_account_id', '')::UUID;

    IF v_method NOT IN ('CASH', 'BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD', 'CREDIT') THEN
      RAISE EXCEPTION 'Medio de pago no válido: %.', v_method USING ERRCODE = '22023';
    END IF;
    IF v_amount IS NULL OR v_amount <= 0 THEN
      RAISE EXCEPTION 'Cada pago debe tener un valor mayor a cero (revise el valor en efectivo del pago mixto).' USING ERRCODE = '22003';
    END IF;

    IF v_method IN ('BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD') THEN
      IF v_bank_id IS NULL THEN
        RAISE EXCEPTION 'El pago por % requiere seleccionar la cuenta bancaria que recibe el dinero.', v_method USING ERRCODE = '23502';
      END IF;
      SELECT * INTO v_bank FROM public.bank_accounts WHERE id = v_bank_id;
      IF NOT FOUND OR v_bank.company_id <> v_sale.company_id OR v_bank.is_active = false THEN
        RAISE EXCEPTION 'La cuenta bancaria seleccionada no existe, está inactiva o no es de la empresa.' USING ERRCODE = '23503';
      END IF;
      IF UPPER(v_bank.account_type) = 'CAJA_EFECTIVO' THEN
        RAISE EXCEPTION 'Una transferencia o tarjeta no puede ir a una cuenta de caja en efectivo (%).', v_bank.bank_name
          USING ERRCODE = '22023';
      END IF;
      IF v_bank.accounting_account_id IS NULL THEN
        RAISE EXCEPTION 'La cuenta bancaria % *% no tiene subcuenta PUC asignada. Configúrela en Tesorería.',
          v_bank.bank_name, RIGHT(v_bank.account_number, 4) USING ERRCODE = '23502';
      END IF;
    ELSE
      v_bank_id := NULL;
    END IF;

    INSERT INTO public.sale_payments (company_id, sale_id, payment_method, amount, bank_account_id, reference, created_by_user_id)
    VALUES (v_sale.company_id, p_sale_id, v_method::payment_method_type, v_amount, v_bank_id,
            NULLIF(TRIM(v_pay->>'reference'), ''), p_user_id);

    v_sum := v_sum + v_amount;
    v_count := v_count + 1;
  END LOOP;

  IF v_sum <> v_sale.total_amount - COALESCE(v_sale.withholding_amount, 0) THEN
    RAISE EXCEPTION 'La suma de los pagos (%) no coincide con el total a cobrar de la venta (%).', v_sum,
      v_sale.total_amount - COALESCE(v_sale.withholding_amount, 0)
      USING ERRCODE = '22000';
  END IF;

  RETURN jsonb_build_object('success', true, 'payments', v_count, 'total', v_sum);
END;
$function$;

DROP FUNCTION IF EXISTS public.fn_create_sale_with_payments_internal(uuid, uuid, uuid, jsonb, jsonb, text, boolean, jsonb);

CREATE OR REPLACE FUNCTION public.fn_create_sale_with_payments_internal(p_location_id uuid, p_customer_id uuid, p_idempotency_key uuid, p_items jsonb, p_payments jsonb, p_notes text, p_allow_agreed_price boolean, p_origin jsonb, p_withholding_concept_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  c_max_discount CONSTANT NUMERIC := 50;        -- mismo tope que la venta POS (035)
  c_max_lines CONSTANT INT := 300;
  c_default_credit_days CONSTANT INT := 30;     -- plazo cuando el cliente no tiene credit_days
  v_caller UUID := auth.uid();
  v_company UUID;
  v_user RECORD;
  v_existing RECORD;
  v_loc RECORD;
  v_cust RECORD;
  v_cust_name VARCHAR(200);
  v_payments JSONB;
  v_methods TEXT[];
  v_method VARCHAR(30);
  v_has_cash BOOLEAN;
  v_is_credit BOOLEAN;
  v_cs RECORD;
  v_cash_session_id UUID;
  v_lines JSONB := '[]'::JSONB;
  v_line JSONB;
  v_ord BIGINT;
  v_pid UUID;
  v_qty NUMERIC;
  v_disc NUMERIC;
  v_agreed NUMERIC;              -- 079
  v_agg RECORD;
  v_prod RECORD;
  v_stock RECORD;
  v_info JSONB := '{}'::JSONB;
  v_pinfo JSONB;
  v_tax_rate NUMERIC(5,2);
  v_price NUMERIC(15,2);
  v_cost NUMERIC(15,2);
  v_gross NUMERIC(15,2);
  v_line_disc NUMERIC(15,2);
  v_taxable NUMERIC(15,2);
  v_line_tax NUMERIC(15,2);
  v_calc JSONB := '[]'::JSONB;
  v_subtotal NUMERIC(15,2) := 0;
  v_discount_total NUMERIC(15,2) := 0;
  v_tax_total NUMERIC(15,2) := 0;
  v_total NUMERIC(15,2) := 0;
  v_total_cost NUMERIC(15,2) := 0;
  v_today DATE := (NOW() AT TIME ZONE 'America/Bogota')::DATE;
  v_due_date DATE;
  v_sale_id UUID := gen_random_uuid();
  v_sale_number VARCHAR(50);
  v_effects JSONB;               -- 079
  v_entry JSONB;
  v_withholdings JSONB := '[]'::JSONB;   -- 095
  v_withholding NUMERIC(15,2) := 0;
  v_net NUMERIC(15,2);
BEGIN
  -- 1. Autenticación, empresa y permiso
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Acceso denegado: usuario no autenticado.' USING ERRCODE = '28000';
  END IF;
  v_company := public.get_auth_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Acceso denegado: el usuario no tiene empresa asignada.' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.is_admin() OR public.has_permission('sales.create')) THEN
    RAISE EXCEPTION 'Acceso denegado: registrar ventas requiere el permiso sales.create.' USING ERRCODE = '42501';
  END IF;
  SELECT full_name, is_active, assigned_cash_register_id INTO v_user FROM public.users WHERE id = v_caller;
  IF NOT FOUND OR v_user.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Acceso denegado: el usuario está inactivo.' USING ERRCODE = '42501';
  END IF;

  -- 2. Idempotencia: los reintentos con la misma clave devuelven la venta ya creada
  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Se requiere la clave de idempotencia de la venta.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('sale-idem:' || v_company::TEXT || ':' || p_idempotency_key::TEXT));
  SELECT id, sale_number, seller_user_id INTO v_existing
  FROM public.sales WHERE company_id = v_company AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.seller_user_id IS DISTINCT FROM v_caller THEN
      RAISE EXCEPTION 'La clave de idempotencia ya se usó en otra venta (%). Inicie una venta nueva.', v_existing.sale_number
        USING ERRCODE = '23505';
    END IF;
    RETURN public.fn_sale_with_payments_summary(v_existing.id, true);
  END IF;

  -- 3. Sede: de la empresa, activa y con acceso del usuario
  SELECT id, name, status, company_id INTO v_loc FROM public.locations WHERE id = p_location_id;
  IF NOT FOUND OR v_loc.company_id IS DISTINCT FROM v_company THEN
    RAISE EXCEPTION 'La sede de la venta no existe o no pertenece a su empresa.' USING ERRCODE = '42501';
  END IF;
  IF v_loc.status::TEXT <> 'ACTIVE' THEN
    RAISE EXCEPTION 'La sede "%" está inactiva.', v_loc.name USING ERRCODE = '55001';
  END IF;
  IF NOT public.has_location_access(p_location_id) THEN
    RAISE EXCEPTION 'Acceso denegado: no tiene acceso a la sede "%".', v_loc.name USING ERRCODE = '42501';
  END IF;

  -- 4. Medios de pago (normalizados una vez). El crédito no se combina con otros medios.
  IF p_payments IS NULL OR jsonb_typeof(p_payments) <> 'array' OR jsonb_array_length(p_payments) = 0 THEN
    RAISE EXCEPTION 'Debe indicar al menos un medio de pago.' USING ERRCODE = '23502';
  END IF;
  SELECT jsonb_agg(e || jsonb_build_object('method', UPPER(BTRIM(COALESCE(e->>'method', '')))))
  INTO v_payments FROM jsonb_array_elements(p_payments) e;
  SELECT ARRAY(SELECT DISTINCT e->>'method' FROM jsonb_array_elements(v_payments) e ORDER BY 1) INTO v_methods;
  IF EXISTS (SELECT 1 FROM unnest(v_methods) m
             WHERE m NOT IN ('CASH', 'BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD', 'CREDIT')) THEN
    RAISE EXCEPTION 'Medio de pago no válido (%). Use efectivo, transferencia, tarjeta o crédito.',
      array_to_string(v_methods, ', ') USING ERRCODE = '22023';
  END IF;
  v_is_credit := 'CREDIT' = ANY(v_methods);
  IF v_is_credit AND array_length(v_methods, 1) > 1 THEN
    RAISE EXCEPTION 'Una venta a crédito no se combina con otros medios de pago.' USING ERRCODE = '22023';
  END IF;
  v_method := CASE WHEN array_length(v_methods, 1) = 1 THEN v_methods[1] ELSE 'MIXED' END;
  v_has_cash := 'CASH' = ANY(v_methods);

  -- 5. Efectivo: a la sesión de caja abierta del propio usuario en esta sede
  IF v_has_cash THEN
    IF NOT (public.is_admin() OR public.has_permission('pos.cash_register')) THEN
      RAISE EXCEPTION 'Acceso denegado: recibir efectivo requiere el permiso pos.cash_register.' USING ERRCODE = '42501';
    END IF;
    SELECT cs.id, cr.name AS register_name INTO v_cs
    FROM public.cash_sessions cs
    LEFT JOIN public.cash_registers cr ON cr.id = cs.cash_register_id
    WHERE cs.company_id = v_company
      AND cs.user_id = v_caller
      AND cs.status = 'OPEN'
      AND COALESCE(cs.location_id, cr.location_id) = p_location_id
      AND (v_user.assigned_cash_register_id IS NULL OR cs.cash_register_id = v_user.assigned_cash_register_id)
    ORDER BY cs.opening_time DESC
    LIMIT 1
    FOR SHARE OF cs;  -- impide que la sesión se cierre mientras entra este efectivo
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Para recibir efectivo debe tener su caja abierta en la sede "%". Abra su sesión de caja o use otro medio de pago.',
        v_loc.name USING ERRCODE = '55001';
    END IF;
    v_cash_session_id := v_cs.id;
  END IF;

  -- 6. Cliente de la empresa y activo (bloqueado si la venta es a crédito: cupo sin carreras)
  IF p_customer_id IS NULL THEN
    RAISE EXCEPTION 'Debe seleccionar el cliente de la venta.' USING ERRCODE = '23502';
  END IF;
  IF v_is_credit THEN
    SELECT id, company_id, is_active, document_number, credit_limit, current_balance, credit_days,
           COALESCE(company_name, TRIM(CONCAT(first_name, ' ', last_name))) AS display_name
    INTO v_cust FROM public.customers WHERE id = p_customer_id FOR UPDATE;
  ELSE
    SELECT id, company_id, is_active, document_number, credit_limit, current_balance, credit_days,
           COALESCE(company_name, TRIM(CONCAT(first_name, ' ', last_name))) AS display_name
    INTO v_cust FROM public.customers WHERE id = p_customer_id;
  END IF;
  IF NOT FOUND OR v_cust.company_id IS DISTINCT FROM v_company THEN
    RAISE EXCEPTION 'El cliente no existe o no pertenece a su empresa.' USING ERRCODE = '42501';
  END IF;
  IF v_cust.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'El cliente "%" está inactivo y no puede comprar.', v_cust.display_name USING ERRCODE = '55001';
  END IF;
  v_cust_name := COALESCE(NULLIF(v_cust.display_name, ''), 'Cliente');

  -- 7. Líneas: solo producto, cantidad y descuento (079: y precio acordado si se permite)
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La venta debe contener al menos un producto.' USING ERRCODE = '23502';
  END IF;
  IF jsonb_array_length(p_items) > c_max_lines THEN
    RAISE EXCEPTION 'La venta supera el máximo de % líneas.', c_max_lines USING ERRCODE = '22023';
  END IF;

  FOR v_line, v_ord IN SELECT e, o FROM jsonb_array_elements(p_items) WITH ORDINALITY AS t(e, o)
  LOOP
    BEGIN
      v_pid := (v_line->>'product_id')::UUID;
      v_qty := (v_line->>'quantity')::NUMERIC;
      v_disc := COALESCE((v_line->>'discount_percent')::NUMERIC, 0);
      -- 079: el precio acordado solo lo envían las conversiones de cotización autorizadas
      v_agreed := CASE WHEN p_allow_agreed_price IS TRUE THEN (v_line->>'agreed_unit_price')::NUMERIC END;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'La línea % de la venta tiene datos no válidos.', v_ord USING ERRCODE = '22023';
    END;
    IF v_pid IS NULL THEN
      RAISE EXCEPTION 'La línea % no indica el producto.', v_ord USING ERRCODE = '23502';
    END IF;
    IF v_qty IS NULL OR v_qty <= 0 OR v_qty > 100000 OR v_qty <> ROUND(v_qty, 2) THEN
      RAISE EXCEPTION 'Cantidad no válida en la línea % (mayor a 0, hasta 100.000 y con máximo 2 decimales).', v_ord
        USING ERRCODE = '22003';
    END IF;
    IF v_disc < 0 OR v_disc > c_max_discount OR v_disc <> ROUND(v_disc, 2) THEN
      RAISE EXCEPTION 'Descuento no permitido en la línea % (de 0 %% a % %%).', v_ord, c_max_discount USING ERRCODE = '22003';
    END IF;
    -- 079
    IF v_agreed IS NOT NULL AND (v_agreed <= 0 OR v_agreed <> ROUND(v_agreed, 2)) THEN
      RAISE EXCEPTION 'Precio acordado no válido en la línea %.', v_ord USING ERRCODE = '22003';
    END IF;
    v_lines := v_lines || jsonb_build_object('product_id', v_pid, 'quantity', v_qty, 'discount_percent', v_disc,
                                             'agreed_unit_price', v_agreed);  -- 079
  END LOOP;

  -- 8. Por producto (cantidades agregadas, en orden fijo para evitar bloqueos cruzados):
  --    catálogo, precio, IVA, costo promedio y stock bloqueado
  FOR v_agg IN
    SELECT (l->>'product_id')::UUID AS product_id, SUM((l->>'quantity')::NUMERIC) AS quantity
    FROM jsonb_array_elements(v_lines) l
    GROUP BY 1 ORDER BY 1
  LOOP
    SELECT id, company_id, name, is_active, public_sale_price, tax_rate_percent, is_tax_exempt, iva_treatment
    INTO v_prod FROM public.products WHERE id = v_agg.product_id;
    IF NOT FOUND OR v_prod.company_id IS DISTINCT FROM v_company THEN
      RAISE EXCEPTION 'Un producto de la venta no existe o no pertenece a su empresa.' USING ERRCODE = '23503';
    END IF;
    IF v_prod.is_active IS NOT TRUE THEN
      RAISE EXCEPTION 'El producto "%" está inactivo y no puede venderse.', v_prod.name USING ERRCODE = '55001';
    END IF;
    IF COALESCE(v_prod.public_sale_price, 0) <= 0 THEN
      RAISE EXCEPTION 'El producto "%" no tiene precio de venta configurado.', v_prod.name USING ERRCODE = '22023';
    END IF;

    SELECT quantity, COALESCE(reserved_quantity, 0) AS reserved, COALESCE(average_cost, 0) AS average_cost
    INTO v_stock
    FROM public.stock_levels
    WHERE product_id = v_agg.product_id AND location_id = p_location_id
    FOR UPDATE;
    IF NOT FOUND OR v_stock.quantity - v_stock.reserved < v_agg.quantity THEN
      RAISE EXCEPTION 'Stock insuficiente de "%" en "%". Disponible: %, solicitado: %.',
        v_prod.name, v_loc.name,
        CASE WHEN FOUND THEN GREATEST(v_stock.quantity - v_stock.reserved, 0) ELSE 0 END, v_agg.quantity
        USING ERRCODE = '55000';
    END IF;

    v_tax_rate := CASE
      WHEN v_prod.is_tax_exempt IS TRUE OR v_prod.iva_treatment IN ('EXENTO', 'EXCLUIDO') THEN 0
      ELSE COALESCE(v_prod.tax_rate_percent, 0) END;

    v_info := v_info || jsonb_build_object(v_agg.product_id::TEXT, jsonb_build_object(
      'name', v_prod.name,
      'price', v_prod.public_sale_price,
      'tax_rate', v_tax_rate,
      'cost', v_stock.average_cost,
      'stock', v_stock.quantity,
      'quantity', v_agg.quantity));
  END LOOP;

  -- 9. Cálculo de cada línea (mismas fórmulas que el POS, 035)
  FOR v_line IN SELECT e FROM jsonb_array_elements(v_lines) e
  LOOP
    v_pinfo := v_info->(v_line->>'product_id');
    v_qty := (v_line->>'quantity')::NUMERIC;
    v_disc := (v_line->>'discount_percent')::NUMERIC;
    -- 079: precio acordado de la cotización (si se permitió) o precio vigente del catálogo
    v_price := COALESCE((v_line->>'agreed_unit_price')::NUMERIC, (v_pinfo->>'price')::NUMERIC);
    v_tax_rate := (v_pinfo->>'tax_rate')::NUMERIC;
    v_cost := (v_pinfo->>'cost')::NUMERIC;

    v_gross := ROUND(v_qty * v_price, 2);
    v_line_disc := ROUND(v_gross * v_disc / 100.0, 2);
    v_taxable := v_gross - v_line_disc;
    v_line_tax := ROUND(v_taxable * v_tax_rate / 100.0, 2);

    v_subtotal := v_subtotal + v_gross;
    v_discount_total := v_discount_total + v_line_disc;
    v_tax_total := v_tax_total + v_line_tax;
    v_total := v_total + v_taxable + v_line_tax;
    v_total_cost := v_total_cost + ROUND(v_qty * v_cost, 2);

    v_calc := v_calc || jsonb_build_object(
      'product_id', v_line->>'product_id', 'quantity', v_qty, 'unit_price', v_price,
      'unit_cost', v_cost, 'discount_percent', v_disc, 'tax_rate', v_tax_rate,
      'tax_amount', v_line_tax, 'subtotal', v_taxable, 'total', v_taxable + v_line_tax);
  END LOOP;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'El total de la venta debe ser mayor a cero.' USING ERRCODE = '22003';
  END IF;

  -- 095: retenciones que el cliente (agente retenedor) le practica a la empresa
  IF COALESCE(cardinality(p_withholding_concept_ids), 0) > 0 THEN
    v_withholdings := public.fn_compute_withholdings_internal(
      v_company, 'SALES', p_customer_id, v_total - v_tax_total, v_tax_total, p_withholding_concept_ids, v_today, false);
    SELECT COALESCE(SUM((w->>'amount')::NUMERIC), 0) INTO v_withholding
    FROM jsonb_array_elements(v_withholdings) w WHERE (w->>'applied')::BOOLEAN;
    IF v_withholding >= v_total THEN
      RAISE EXCEPTION 'Las retenciones (%) igualan o superan el total de la venta (%).', v_withholding, v_total
        USING ERRCODE = '22023';
    END IF;
  END IF;
  v_net := v_total - v_withholding;

  -- 10. Crédito: cupo aprobado y plazo del cliente
  IF v_is_credit THEN
    IF v_cust.document_number = '222222222222' THEN
      RAISE EXCEPTION 'No se vende a crédito a Consumidor Final. Seleccione el cliente.' USING ERRCODE = '22023';
    END IF;
    IF COALESCE(v_cust.credit_limit, 0) <= 0 THEN
      RAISE EXCEPTION 'El cliente "%" no tiene cupo de crédito aprobado. Configure el cupo en la ficha del cliente.', v_cust_name
        USING ERRCODE = '22023';
    END IF;
    IF COALESCE(v_cust.current_balance, 0) + v_net > v_cust.credit_limit THEN
      RAISE EXCEPTION 'La venta (%) excede el cupo de crédito de "%": cupo %, saldo actual %, disponible %.',
        v_net, v_cust_name, v_cust.credit_limit, COALESCE(v_cust.current_balance, 0),
        GREATEST(v_cust.credit_limit - COALESCE(v_cust.current_balance, 0), 0) USING ERRCODE = '22023';
    END IF;
    v_due_date := v_today + CASE WHEN COALESCE(v_cust.credit_days, 0) > 0 THEN v_cust.credit_days ELSE c_default_credit_days END;
  ELSE
    v_due_date := v_today;
  END IF;

  -- 11. Venta, líneas y kardex
  v_sale_number := public.fn_next_sale_number(v_company);

  INSERT INTO public.sales (
    id, company_id, location_id, customer_id, seller_user_id, cash_session_id, sale_number,
    subtotal_amount, discount_amount, tax_amount, total_amount, total_cost_amount, withholding_amount,
    paid_amount, payment_status, payment_terms, due_date, payment_method, status,
    idempotency_key, notes, created_at, updated_at
  ) VALUES (
    v_sale_id, v_company, p_location_id, p_customer_id, v_caller, NULL, v_sale_number,
    v_subtotal, v_discount_total, v_tax_total, v_total, v_total_cost, v_withholding,
    CASE WHEN v_is_credit THEN 0 ELSE v_net END,
    CASE WHEN v_is_credit THEN 'PENDING' ELSE 'PAID' END,
    CASE WHEN v_is_credit THEN 'CREDITO' ELSE 'CONTADO' END,
    v_due_date, v_method::payment_method_type, 'ISSUED'::sale_status,
    p_idempotency_key,
    COALESCE(NULLIF(BTRIM(LEFT(p_notes, 1000)), ''), 'Venta comercial ' || v_sale_number),
    NOW(), NOW()
  );

  -- iva_treatment de la línea lo asigna trg_sale_item_set_iva_treatment (060)
  INSERT INTO public.sale_items (
    company_id, sale_id, product_id, quantity, unit_cost, unit_price, discount_percent,
    tax_rate_percent, tax_amount, subtotal, total
  )
  SELECT v_company, v_sale_id, (c->>'product_id')::UUID, (c->>'quantity')::NUMERIC, (c->>'unit_cost')::NUMERIC,
         (c->>'unit_price')::NUMERIC, (c->>'discount_percent')::NUMERIC, (c->>'tax_rate')::NUMERIC,
         (c->>'tax_amount')::NUMERIC, (c->>'subtotal')::NUMERIC, (c->>'total')::NUMERIC
  FROM jsonb_array_elements(v_calc) c;

  -- Un movimiento por producto con la cantidad total (process_inventory_movement actualiza stock_levels)
  INSERT INTO public.inventory_movements (
    company_id, product_id, location_id, movement_type, quantity_in, quantity_out,
    previous_stock, new_stock, unit_cost, total_cost, document_type, document_reference,
    reason, user_id, created_at
  )
  SELECT v_company, k::UUID, p_location_id, 'SALE_OUT'::inventory_movement_type, 0, (v->>'quantity')::NUMERIC,
         (v->>'stock')::NUMERIC, (v->>'stock')::NUMERIC - (v->>'quantity')::NUMERIC,
         (v->>'cost')::NUMERIC, ROUND((v->>'quantity')::NUMERIC * (v->>'cost')::NUMERIC, 2),
         'SALE', v_sale_number, 'Venta ' || v_sale_number || ' - ' || v_cust_name, v_caller, NOW()
  FROM jsonb_each(v_info) AS t(k, v)
  ORDER BY k;

  -- 095: detalle de retenciones de la venta
  PERFORM public.fn_store_document_withholdings_internal(v_company, 'SALE', v_sale_id, v_withholdings);

  -- 12. Pagos con su cuenta destino (valida medios, cuentas bancarias y que la suma iguale el total)
  PERFORM public.fn_register_sale_payments_internal(v_sale_id, v_payments, v_caller);

  -- 13-15. (079) Efectivo a la caja del usuario, bancos y cartera: rutina común
  v_effects := public.fn_apply_sale_payment_effects_internal(v_sale_id, v_cash_session_id, v_caller, true);

  -- 16. Asiento contable en la misma transacción (FV): si falla, no queda la venta
  v_entry := public.fn_cause_sale_accounting_internal(v_sale_id);

  -- 17. Auditoría (079: con el origen de la venta)
  INSERT INTO public.audit_logs (company_id, user_id, user_name, action, module, entity_name, entity_id,
                                 location_id, new_value, created_at)
  VALUES (v_company, v_caller, COALESCE(v_user.full_name, 'Vendedor'), 'SALE_CREATED', 'SALES', 'sales',
          v_sale_id::TEXT, p_location_id,
          jsonb_build_object('sale_number', v_sale_number, 'total_amount', v_total, 'withholding_amount', v_withholding,
                             'payment_method', v_method,
                             'customer_id', p_customer_id, 'cash_session_id', v_cash_session_id,
                             'accounting_entry_number', v_entry->>'entry_number')
            || COALESCE(p_origin, '{}'::JSONB),
          NOW());

  RETURN public.fn_sale_with_payments_summary(v_sale_id, false);
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_create_sale_with_payments_internal(uuid, uuid, uuid, jsonb, jsonb, text, boolean, jsonb, uuid[]) FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.fn_create_sale_with_payments(uuid, uuid, uuid, jsonb, jsonb, text);

CREATE OR REPLACE FUNCTION public.fn_create_sale_with_payments(p_location_id uuid, p_customer_id uuid, p_idempotency_key uuid, p_items jsonb, p_payments jsonb, p_notes text DEFAULT NULL::text, p_withholding_concept_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  RETURN public.fn_create_sale_with_payments_internal(
    p_location_id, p_customer_id, p_idempotency_key, p_items, p_payments, p_notes,
    false, jsonb_build_object('origin', 'SALES'), p_withholding_concept_ids);
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_create_sale_with_payments(uuid, uuid, uuid, jsonb, jsonb, text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_create_sale_with_payments(uuid, uuid, uuid, jsonb, jsonb, text, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_cause_sale_accounting_internal(p_sale_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_sale RECORD;
  v_existing RECORD;
  v_lines JSONB := '[]'::JSONB;
  v_customer_doc VARCHAR(50);
  v_customer_name VARCHAR(200);
  v_pay RECORD;
  v_has_payments BOOLEAN;
  v_income NUMERIC(15,2);
  v_debit_account UUID;
  v_grp RECORD;
  v_base_total NUMERIC(15,2);
  v_amount NUMERIC(15,2);
  v_allocated NUMERIC(15,2) := 0;
  v_income_accounts UUID[] := ARRAY[]::UUID[];
  v_income_amounts NUMERIC[] := ARRAY[]::NUMERIC[];
  v_inventory_account UUID;
  v_wh RECORD;
BEGIN
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta % no encontrada para causación contable.', p_sale_id USING ERRCODE = 'P0002';
  END IF;

  -- Idempotencia: un solo asiento contabilizado por venta.
  SELECT id, entry_number INTO v_existing
  FROM public.accounting_entries
  WHERE company_id = v_sale.company_id AND document_type = 'SALE'
    AND document_reference = v_sale.sale_number AND status = 'POSTED'
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'already_caused', true,
      'entry_id', v_existing.id, 'entry_number', v_existing.entry_number);
  END IF;

  SELECT document_number, COALESCE(company_name, TRIM(CONCAT(first_name, ' ', last_name)))
  INTO v_customer_doc, v_customer_name
  FROM public.customers WHERE id = v_sale.customer_id;

  -- DÉBITOS: una línea por cuenta destino real (caja, cada cuenta bancaria, cartera).
  SELECT EXISTS (SELECT 1 FROM public.sale_payments WHERE sale_id = p_sale_id) INTO v_has_payments;

  IF v_has_payments THEN
    FOR v_pay IN
      SELECT
        CASE
          WHEN sp.payment_method = 'CASH' THEN public.fn_get_default_account(v_sale.company_id, 'CASH')
          WHEN sp.payment_method = 'CREDIT' THEN public.fn_get_default_account(v_sale.company_id, 'CUSTOMER_CREDIT')
          ELSE ba.accounting_account_id
        END AS account_id,
        STRING_AGG(DISTINCT CASE WHEN ba.id IS NOT NULL THEN ba.bank_name || ' *' || RIGHT(ba.account_number, 4)
                                 WHEN sp.payment_method = 'CASH' THEN 'Efectivo' ELSE 'Crédito' END, ', ') AS label,
        SUM(sp.amount) AS amount
      FROM public.sale_payments sp
      LEFT JOIN public.bank_accounts ba ON ba.id = sp.bank_account_id
      WHERE sp.sale_id = p_sale_id
      GROUP BY 1
    LOOP
      IF v_pay.account_id IS NULL THEN
        RAISE EXCEPTION 'Un pago de la venta % llegó a una cuenta bancaria sin subcuenta PUC.', v_sale.sale_number
          USING ERRCODE = 'P0002';
      END IF;
      v_lines := v_lines || jsonb_build_object(
        'account_id', v_pay.account_id,
        'debit_amount', v_pay.amount,
        'credit_amount', 0,
        'third_party_doc', v_customer_doc,
        'third_party_name', v_customer_name,
        'description', 'Cobro venta ' || v_sale.sale_number || ' - ' || v_pay.label);
    END LOOP;
  ELSE
    -- Ventas antiguas sin detalle de pagos: solo se pueden causar si fueron efectivo o crédito.
    IF v_sale.payment_method::TEXT = 'CASH' THEN
      v_debit_account := public.fn_get_default_account(v_sale.company_id, 'CASH');
    ELSIF v_sale.payment_method::TEXT = 'CREDIT' THEN
      v_debit_account := public.fn_get_default_account(v_sale.company_id, 'CUSTOMER_CREDIT');
    ELSE
      RAISE EXCEPTION 'La venta % (%) no tiene registrada la cuenta bancaria que recibió el pago. Registre los pagos antes de causarla.',
        v_sale.sale_number, v_sale.payment_method USING ERRCODE = 'P0002';
    END IF;
    v_lines := v_lines || jsonb_build_object(
      'account_id', v_debit_account, 'debit_amount', v_sale.total_amount - COALESCE(v_sale.withholding_amount, 0), 'credit_amount', 0,
      'third_party_doc', v_customer_doc, 'third_party_name', v_customer_name,
      'description', 'Cobro venta ' || v_sale.sale_number);
  END IF;

  -- 095: retenciones que practicó el cliente (anticipo de impuestos a favor)
  FOR v_wh IN
    SELECT account_id, concept_name, SUM(amount) AS amount
    FROM public.document_withholdings
    WHERE document_type = 'SALE' AND document_id = p_sale_id AND amount > 0
    GROUP BY account_id, concept_name ORDER BY concept_name
  LOOP
    v_lines := v_lines || jsonb_build_object(
      'account_id', v_wh.account_id,
      'debit_amount', v_wh.amount, 'credit_amount', 0,
      'third_party_doc', v_customer_doc, 'third_party_name', v_customer_name,
      'description', v_wh.concept_name || ' venta ' || v_sale.sale_number);
  END LOOP;

  -- CRÉDITOS: ingreso neto de descuentos (total - IVA) e IVA generado. Así siempre cuadra.
  -- El ingreso se reparte entre las cuentas de ingreso de cada línea de inventario en proporción a
  -- la base gravable (neta de IVA) de sus productos; los centavos de redondeo van a la de mayor valor.
  v_income := v_sale.total_amount - COALESCE(v_sale.tax_amount, 0);
  SELECT COALESCE(SUM(GREATEST(si.total - si.tax_amount, 0)), 0) INTO v_base_total
  FROM public.sale_items si WHERE si.sale_id = p_sale_id;

  IF v_base_total > 0 AND v_income > 0 THEN
    FOR v_grp IN
      SELECT public.fn_inventory_line_account(
               v_sale.company_id,
               public.fn_product_inventory_account(v_sale.company_id, si.product_id),
               'SALES_INCOME') AS account_id,
             SUM(GREATEST(si.total - si.tax_amount, 0)) AS base_amount
      FROM public.sale_items si
      WHERE si.sale_id = p_sale_id
      GROUP BY 1
      ORDER BY 2 DESC, 1
    LOOP
      v_amount := ROUND(v_income * v_grp.base_amount / v_base_total, 2);
      v_income_accounts := v_income_accounts || v_grp.account_id;
      v_income_amounts := v_income_amounts || v_amount;
      v_allocated := v_allocated + v_amount;
    END LOOP;
    v_income_amounts[1] := v_income_amounts[1] + (v_income - v_allocated);
  ELSE
    -- Sin base por líneas (venta sin ítems o de valor cero): una sola línea a la cuenta por defecto, como en 059.
    v_income_accounts := ARRAY[public.fn_get_default_account(v_sale.company_id, 'SALES_INCOME')];
    v_income_amounts := ARRAY[v_income];
  END IF;

  FOR i IN 1 .. COALESCE(array_length(v_income_accounts, 1), 0) LOOP
    CONTINUE WHEN i > 1 AND v_income_amounts[i] = 0;
    v_lines := v_lines || jsonb_build_object(
      'account_id', v_income_accounts[i],
      'debit_amount', 0, 'credit_amount', v_income_amounts[i],
      'third_party_doc', v_customer_doc, 'third_party_name', v_customer_name,
      'description', 'Ingreso venta ' || v_sale.sale_number);
  END LOOP;

  IF COALESCE(v_sale.tax_amount, 0) > 0 THEN
    v_lines := v_lines || jsonb_build_object(
      'account_id', public.fn_get_default_account(v_sale.company_id, 'VAT_GENERATED'),
      'debit_amount', 0, 'credit_amount', v_sale.tax_amount,
      'third_party_doc', v_customer_doc, 'third_party_name', v_customer_name,
      'description', 'IVA generado venta ' || v_sale.sale_number);
  END IF;

  -- COSTO DE VENTAS / INVENTARIO: un par por cuenta de inventario de los productos vendidos.
  FOR v_grp IN
    SELECT public.fn_product_inventory_account(v_sale.company_id, si.product_id) AS inventory_account_id,
           ROUND(SUM(si.quantity * si.unit_cost), 2) AS cost_amount
    FROM public.sale_items si
    WHERE si.sale_id = p_sale_id
    GROUP BY 1
    ORDER BY 2 DESC, 1
  LOOP
    CONTINUE WHEN v_grp.cost_amount <= 0;
    v_inventory_account := COALESCE(v_grp.inventory_account_id,
                                    public.fn_get_default_account(v_sale.company_id, 'INVENTORY'));
    v_lines := v_lines || jsonb_build_object(
      'account_id', public.fn_inventory_line_account(v_sale.company_id, v_inventory_account, 'COST_OF_SALES'),
      'debit_amount', v_grp.cost_amount, 'credit_amount', 0,
      'description', 'Costo de ventas ' || v_sale.sale_number);
    v_lines := v_lines || jsonb_build_object(
      'account_id', v_inventory_account,
      'debit_amount', 0, 'credit_amount', v_grp.cost_amount,
      'description', 'Salida de inventario venta ' || v_sale.sale_number);
  END LOOP;

  RETURN public.fn_create_accounting_entry(
    p_date := (v_sale.created_at AT TIME ZONE 'America/Bogota')::DATE,
    p_concept := 'Causación automática venta ' || v_sale.sale_number || ' - ' || COALESCE(v_customer_name, 'Consumidor Final'),
    p_document_type := 'SALE',
    p_document_reference := v_sale.sale_number,
    p_lines := v_lines,
    p_location_id := v_sale.location_id,
    p_auto_post := true,
    p_company_id := v_sale.company_id
  ) || jsonb_build_object('already_caused', false);
END;
$function$;

-- ------------------------------------------------------------------------------
-- 9. Cartera: el saldo de la venta es total - retenciones - pagado
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_register_customer_payment(p_sale_id uuid, p_amount numeric, p_payment_date date DEFAULT CURRENT_DATE, p_payment_method character varying DEFAULT 'EFECTIVO'::character varying, p_transaction_reference character varying DEFAULT NULL::character varying, p_notes text DEFAULT NULL::text, p_bank_account_id uuid DEFAULT NULL::uuid, p_cash_session_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_user_id UUID;
    v_user_name VARCHAR(150);
    v_company_id UUID;
    v_sale RECORD;
    v_customer RECORD;
    v_customer_name VARCHAR(250);
    v_pending_balance NUMERIC(15,2);
    v_payment_id UUID;
    v_payment_number VARCHAR(50);
    v_new_paid_amount NUMERIC(15,2);
    v_new_payment_status VARCHAR(30);
    v_normalized_method VARCHAR(30);

    -- Variables financieras
    v_bank_row RECORD;
    v_new_bank_balance NUMERIC(15,2);
    v_bm_seq INT;
    v_bm_number VARCHAR(50);
    v_bank_movement_id UUID := NULL;
    v_cash_session RECORD;
    v_cash_movement_id UUID := NULL;
    v_final_bank_account_id UUID := NULL;
    v_final_cash_session_id UUID := NULL;
    v_new_customer_balance NUMERIC(15,2);
BEGIN
    -- 3.1 Identificación de usuario y empresa
    v_user_id := auth.uid();
    v_company_id := public.get_auth_company_id();

    -- Fallback administrativo si se invoca desde scripts autenticados vía service_role
    IF v_company_id IS NULL THEN
        SELECT company_id INTO v_company_id FROM public.sales WHERE id = p_sale_id;
    END IF;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'No se pudo resolver la empresa para procesar el recaudo.'
            USING ERRCODE = '42501';
    END IF;

    -- 3.2 Control de permisos RBAC
    IF NOT (public.has_permission('sales.create') OR public.has_permission('treasury.create') OR public.has_permission('customers.write') OR public.is_admin()) THEN
        RAISE EXCEPTION 'No tienes permisos suficientes para registrar recaudos de clientes.'
            USING ERRCODE = '42501';
    END IF;

    -- Resolver nombre de usuario para auditoría
    IF v_user_id IS NOT NULL THEN
        SELECT full_name INTO v_user_name FROM public.users WHERE id = v_user_id;
    END IF;
    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Usuario Sistema';
    END IF;

    -- 3.3 Candado transaccional consultivo sobre la venta
    PERFORM pg_advisory_xact_lock(hashtext('sale_customer_payment_' || p_sale_id::text));

    -- 3.4 Bloqueo pesimista y lectura de la venta (FOR UPDATE)
    SELECT 
        id, 
        company_id, 
        location_id, 
        customer_id, 
        sale_number, 
        total_amount, 
        paid_amount, 
        withholding_amount,
        payment_status,
        UPPER(COALESCE(status::text, '')) AS sale_st
    INTO v_sale
    FROM public.sales
    WHERE id = p_sale_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La venta / cuenta por cobrar especificada no existe.'
            USING ERRCODE = '23503';
    END IF;

    -- 3.5 Validación de aislamiento multiempresa
    IF v_sale.company_id != v_company_id THEN
        RAISE EXCEPTION 'La cuenta por cobrar pertenece a otra empresa.'
            USING ERRCODE = '42501';
    END IF;

    -- 3.6 Validación de estados comerciales
    IF v_sale.sale_st = 'CANCELLED' OR v_sale.sale_st = 'ANULADA' THEN
        RAISE EXCEPTION 'No se pueden registrar pagos a una venta anulada.'
            USING ERRCODE = '42200';
    END IF;

    -- 3.7 Validación estricta del monto y sobrepago
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'El monto del recaudo debe ser estrictamente mayor a 0.'
            USING ERRCODE = '42200';
    END IF;

    v_pending_balance := v_sale.total_amount - COALESCE(v_sale.withholding_amount, 0) - v_sale.paid_amount;

    IF v_pending_balance <= 0 THEN
        RAISE EXCEPTION 'Esta venta ya se encuentra totalmente saldada (saldo pendiente: 0).'
            USING ERRCODE = '42200';
    END IF;

    IF p_amount > v_pending_balance THEN
        RAISE EXCEPTION 'El monto a recaudar (%) supera el saldo pendiente de la venta (%).', p_amount, v_pending_balance
            USING ERRCODE = '42200';
    END IF;

    -- 3.8 Obtener y bloquear registro del cliente
    SELECT id, company_id, current_balance, company_name, first_name, last_name
    INTO v_customer
    FROM public.customers
    WHERE id = v_sale.customer_id
    FOR UPDATE;

    v_customer_name := COALESCE(
        v_customer.company_name,
        NULLIF(TRIM(COALESCE(v_customer.first_name, '') || ' ' || COALESCE(v_customer.last_name, '')), ''),
        'Cliente'
    );

    -- 3.9 Normalización del medio de pago
    v_normalized_method := UPPER(TRIM(COALESCE(p_payment_method, 'EFECTIVO')));
    IF v_normalized_method IN ('EFECTIVO', 'CASH') THEN
        v_normalized_method := 'EFECTIVO';
    ELSIF v_normalized_method IN ('TRANSFERENCIA', 'BANK_TRANSFER', 'TRANSFER') THEN
        v_normalized_method := 'TRANSFERENCIA';
    ELSIF v_normalized_method IN ('TARJETA', 'CARD', 'DATAFONO') THEN
        v_normalized_method := 'TARJETA';
    ELSIF v_normalized_method IN ('CHEQUE', 'CHECK') THEN
        v_normalized_method := 'CHEQUE';
    END IF;

    -- Generar consecutivo oficial
    v_payment_number := public.fn_next_customer_payment_number(v_sale.company_id);
    v_payment_id := gen_random_uuid();

    -- 3.10 Afectación fiduciaria de Tesorería (Caja / Banco)
    IF v_normalized_method = 'EFECTIVO' THEN
        -- Validación y afectación de Sesión de Caja
        IF p_cash_session_id IS NOT NULL THEN
            SELECT id, company_id, location_id, status
            INTO v_cash_session
            FROM public.cash_sessions
            WHERE id = p_cash_session_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'La sesión de caja especificada no existe.'
                    USING ERRCODE = '23503';
            END IF;
        ELSE
            SELECT id, company_id, location_id, status
            INTO v_cash_session
            FROM public.cash_sessions
            WHERE company_id = v_sale.company_id
              AND (location_id = v_sale.location_id OR location_id IS NULL)
              AND status = 'OPEN'
            ORDER BY created_at DESC
            LIMIT 1
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'No existe una sesión de caja abierta para registrar el recaudo en efectivo.'
                    USING ERRCODE = '42200';
            END IF;
        END IF;

        IF v_cash_session.company_id != v_sale.company_id THEN
            RAISE EXCEPTION 'La sesión de caja pertenece a otra empresa.'
                USING ERRCODE = '42501';
        END IF;

        IF v_cash_session.status != 'OPEN' THEN
            RAISE EXCEPTION 'La sesión de caja no está abierta (estado actual: %).', v_cash_session.status
                USING ERRCODE = '42200';
        END IF;

        v_final_cash_session_id := v_cash_session.id;

        -- Registrar ingreso a caja
        INSERT INTO public.cash_movements (
            session_id,
            type,
            amount,
            reason,
            authorized_by_user_id,
            created_at
        ) VALUES (
            v_cash_session.id,
            'SALE_CASH',
            p_amount,
            'Recaudo cliente ' || v_customer_name || ' (Venta ' || v_sale.sale_number || ' - ' || v_payment_number || ')',
            v_user_id,
            NOW()
        ) RETURNING id INTO v_cash_movement_id;

    ELSIF v_normalized_method IN ('TRANSFERENCIA', 'TARJETA', 'CHEQUE') OR p_bank_account_id IS NOT NULL THEN
        -- Validación y afectación de Cuenta Bancaria
        IF p_bank_account_id IS NULL THEN
            SELECT id INTO p_bank_account_id
            FROM public.bank_accounts
            WHERE company_id = v_sale.company_id
              AND is_active = true
            ORDER BY created_at ASC
            LIMIT 1;
        END IF;

        IF p_bank_account_id IS NULL THEN
            RAISE EXCEPTION 'Debe especificar una cuenta bancaria activa para transferencias.'
                USING ERRCODE = '42200';
        END IF;

        SELECT id, company_id, location_id, bank_name, account_number, current_balance, is_active
        INTO v_bank_row
        FROM public.bank_accounts
        WHERE id = p_bank_account_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'La cuenta bancaria especificada no existe.'
                USING ERRCODE = '23503';
        END IF;

        v_final_bank_account_id := v_bank_row.id;

        IF v_bank_row.company_id != v_sale.company_id THEN
            RAISE EXCEPTION 'La cuenta bancaria pertenece a otra empresa.'
                USING ERRCODE = '42501';
        END IF;

        IF NOT v_bank_row.is_active THEN
            RAISE EXCEPTION 'La cuenta bancaria se encuentra inactiva.'
                USING ERRCODE = '42200';
        END IF;

        -- Aumentar saldo bancario (Ingreso / Crédito para extracto bancario de la empresa)
        v_new_bank_balance := v_bank_row.current_balance + p_amount;
        UPDATE public.bank_accounts
        SET current_balance = v_new_bank_balance,
            updated_at = NOW()
        WHERE id = v_bank_row.id;

        -- Generar consecutivo de extracto bancario
        SELECT COALESCE(MAX(NULLIF(SUBSTRING(movement_number FROM 'BM-([0-9]+)'), '')::INT), 0) + 1
        INTO v_bm_seq
        FROM public.bank_movements
        WHERE bank_account_id = v_bank_row.id;

        v_bm_number := 'BM-' || LPAD(v_bm_seq::TEXT, 6, '0');

        -- Registrar movimiento en extracto bancario (CREDIT = Entrada de dinero)
        INSERT INTO public.bank_movements (
            company_id,
            location_id,
            bank_account_id,
            movement_number,
            movement_date,
            movement_type,
            amount,
            balance_after,
            concept,
            reference,
            customer_payment_id,
            is_reconciled,
            created_by_user_id,
            created_at
        ) VALUES (
            v_sale.company_id,
            v_sale.location_id,
            v_bank_row.id,
            v_bm_number,
            p_payment_date,
            'CREDIT',
            p_amount,
            v_new_bank_balance,
            'Recaudo cliente ' || v_customer_name || ' (Venta ' || v_sale.sale_number || ' - ' || v_payment_number || ')',
            p_transaction_reference,
            NULL, -- se actualiza después de insertar el pago
            false,
            v_user_id,
            NOW()
        ) RETURNING id INTO v_bank_movement_id;
    END IF;

    -- 3.11 Insertar comprobante en public.customer_payments
    INSERT INTO public.customer_payments (
        id,
        company_id,
        location_id,
        sale_id,
        customer_id,
        payment_number,
        payment_date,
        amount,
        payment_method,
        transaction_reference,
        bank_account_id,
        cash_session_id,
        bank_movement_id,
        cash_movement_id,
        notes,
        created_by_user_id,
        created_at
    ) VALUES (
        v_payment_id,
        v_sale.company_id,
        v_sale.location_id,
        v_sale.id,
        v_sale.customer_id,
        v_payment_number,
        p_payment_date,
        p_amount,
        v_normalized_method,
        p_transaction_reference,
        v_final_bank_account_id,
        v_final_cash_session_id,
        v_bank_movement_id,
        v_cash_movement_id,
        p_notes,
        v_user_id,
        NOW()
    );

    -- Vincular extracto bancario y movimiento de caja con el pago oficial
    IF v_bank_movement_id IS NOT NULL THEN
        UPDATE public.bank_movements
        SET customer_payment_id = v_payment_id
        WHERE id = v_bank_movement_id;
    END IF;

    IF v_cash_movement_id IS NOT NULL THEN
        UPDATE public.cash_movements
        SET customer_payment_id = v_payment_id
        WHERE id = v_cash_movement_id;
    END IF;

    -- 3.12 Actualizar saldo y estado de la Venta (public.sales)
    v_new_paid_amount := v_sale.paid_amount + p_amount;
    v_new_payment_status := CASE
        WHEN v_new_paid_amount >= v_sale.total_amount - COALESCE(v_sale.withholding_amount, 0) THEN 'PAID'
        ELSE 'PARTIAL'
    END;

    UPDATE public.sales
    SET paid_amount = v_new_paid_amount,
        payment_status = v_new_payment_status,
        updated_at = NOW()
    WHERE id = v_sale.id;

    -- 3.13 Actualizar saldo de cartera del Cliente (public.customers)
    v_new_customer_balance := GREATEST(0.00, COALESCE(v_customer.current_balance, 0.00) - p_amount);
    UPDATE public.customers
    SET current_balance = v_new_customer_balance,
        updated_at = NOW()
    WHERE id = v_customer.id;

    -- 3.14 Registro de Auditoría Transaccional
    INSERT INTO public.audit_logs (
        id,
        company_id,
        user_id,
        user_name,
        action,
        module,
        entity_name,
        entity_id,
        location_id,
        previous_value,
        new_value,
        created_at
    ) VALUES (
        gen_random_uuid(),
        v_sale.company_id,
        v_user_id,
        v_user_name,
        'CUSTOMER_PAYMENT_CREATED',
        'SALES',
        'customer_payments',
        v_payment_id::TEXT,
        v_sale.location_id,
        jsonb_build_object(
            'sale_paid_amount', v_sale.paid_amount,
            'sale_payment_status', v_sale.payment_status,
            'customer_balance', v_customer.current_balance
        ),
        jsonb_build_object(
            'payment_id', v_payment_id,
            'payment_number', v_payment_number,
            'sale_id', v_sale.id,
            'sale_number', v_sale.sale_number,
            'customer_id', v_sale.customer_id,
            'customer_name', v_customer_name,
            'amount', p_amount,
            'payment_method', v_normalized_method,
            'transaction_reference', p_transaction_reference,
            'payment_date', p_payment_date,
            'new_sale_paid_amount', v_new_paid_amount,
            'new_sale_payment_status', v_new_payment_status,
            'remaining_sale_balance', v_sale.total_amount - COALESCE(v_sale.withholding_amount, 0) - v_new_paid_amount,
            'new_customer_balance', v_new_customer_balance,
            'bank_movement_id', v_bank_movement_id,
            'cash_movement_id', v_cash_movement_id
        ),
        NOW()
    );

    -- 3.15 Retornar payload consolidado
    RETURN jsonb_build_object(
        'payment_id', v_payment_id,
        'payment_number', v_payment_number,
        'sale_id', v_sale.id,
        'sale_number', v_sale.sale_number,
        'customer_id', v_customer.id,
        'customer_name', v_customer_name,
        'amount', p_amount,
        'payment_date', p_payment_date,
        'payment_method', v_normalized_method,
        'transaction_reference', p_transaction_reference,
        'total_amount', v_sale.total_amount,
        'paid_amount', v_new_paid_amount,
        'pending_balance', v_sale.total_amount - COALESCE(v_sale.withholding_amount, 0) - v_new_paid_amount,
        'payment_status', v_new_payment_status,
        'customer_balance', v_new_customer_balance,
        'bank_movement_id', v_bank_movement_id,
        'cash_movement_id', v_cash_movement_id
    );
END;
$function$;

-- ------------------------------------------------------------------------------
-- 10. Permisos de ejecución
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.fn_compute_withholdings_internal(UUID, TEXT, UUID, NUMERIC, NUMERIC, UUID[], DATE, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_store_document_withholdings_internal(UUID, TEXT, UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_apply_purchase_withholdings_internal(UUID, UUID[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_trg_recalculate_purchase_withholdings() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.fn_preview_withholdings(TEXT, UUID, NUMERIC, NUMERIC, UUID[], DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_preview_withholdings(TEXT, UUID, NUMERIC, NUMERIC, UUID[], DATE) TO authenticated;
REVOKE ALL ON FUNCTION public.fn_set_purchase_withholdings(UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_set_purchase_withholdings(UUID, UUID[]) TO authenticated;
REVOKE ALL ON FUNCTION public.fn_create_purchase_order_with_withholdings(UUID, UUID, CHARACTER VARYING, DATE, DATE, CHARACTER VARYING, TEXT, BOOLEAN, JSONB, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_create_purchase_order_with_withholdings(UUID, UUID, CHARACTER VARYING, DATE, DATE, CHARACTER VARYING, TEXT, BOOLEAN, JSONB, UUID[]) TO authenticated;
REVOKE ALL ON FUNCTION public.fn_update_purchase_order_with_withholdings(UUID, UUID, UUID, CHARACTER VARYING, DATE, DATE, CHARACTER VARYING, TEXT, BOOLEAN, JSONB, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_update_purchase_order_with_withholdings(UUID, UUID, UUID, CHARACTER VARYING, DATE, DATE, CHARACTER VARYING, TEXT, BOOLEAN, JSONB, UUID[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
