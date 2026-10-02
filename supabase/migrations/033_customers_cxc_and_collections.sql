-- ==============================================================================
-- 033_CUSTOMERS_CXC_AND_COLLECTIONS.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Hardening fiduciario para Clientes, Cuentas por Cobrar (CxC) y Recaudos:
-- 1. Campos completos en customers (person_type, commercial_name, contact_name, credit_days, notes).
-- 2. Obligatoriedad estricta de company_id y unicidad multiempresa en document_number.
-- 3. Campos de control de pagos, vencimiento y términos en sales.
-- 4. Creación de public.customer_payments (Abonos / Recaudos CxC) con RLS y multi-tenancy.
-- 5. Triggers de auditoría automática SECURITY DEFINER hacia public.audit_logs:
--    - CLIENT_CREATED, CLIENT_UPDATED, CLIENT_DEACTIVATED
--    - RECEIVABLE_CREATED, RECEIVABLE_PAYMENT, RECEIVABLE_PAID
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HARDENING DE CLIENTES (public.customers)
-- ------------------------------------------------------------------------------

-- 1.1 Agregar columnas faltantes para perfil fiduciario de cliente
ALTER TABLE public.customers 
    ADD COLUMN IF NOT EXISTS person_type VARCHAR(20) NOT NULL DEFAULT 'NATURAL',
    ADD COLUMN IF NOT EXISTS commercial_name VARCHAR(200),
    ADD COLUMN IF NOT EXISTS contact_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS credit_days INTEGER NOT NULL DEFAULT 0 CHECK (credit_days >= 0),
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- 1.2 Asegurar que credit_limit y current_balance tengan constraints no negativos
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_customers_credit_limit'
    ) THEN
        ALTER TABLE public.customers 
            ADD CONSTRAINT chk_customers_credit_limit CHECK (credit_limit >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_customers_current_balance'
    ) THEN
        ALTER TABLE public.customers 
            ADD CONSTRAINT chk_customers_current_balance CHECK (current_balance >= 0);
    END IF;
END $$;

-- 1.3 Asignar company_id por defecto si existen filas huérfanas antes de forzar NOT NULL
UPDATE public.customers
SET company_id = (SELECT id FROM public.companies ORDER BY created_at ASC LIMIT 1)
WHERE company_id IS NULL;

ALTER TABLE public.customers ALTER COLUMN company_id SET NOT NULL;

-- 1.4 Reemplazar unicidad global de document_number por unicidad multiempresa
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_document_number_key;
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_company_id_document_number_key;
ALTER TABLE public.customers 
    ADD CONSTRAINT customers_company_id_document_number_key UNIQUE (company_id, document_number);

CREATE INDEX IF NOT EXISTS idx_customers_company ON public.customers(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company_doc ON public.customers(company_id, document_number);
CREATE INDEX IF NOT EXISTS idx_customers_balance ON public.customers(company_id, current_balance);

-- ------------------------------------------------------------------------------
-- 2. HARDENING DE VENTAS (public.sales) PARA CUENTAS POR COBRAR
-- ------------------------------------------------------------------------------

-- 2.1 Agregar columnas de control de pagos, vencimiento y términos
ALTER TABLE public.sales 
    ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
    ADD COLUMN IF NOT EXISTS due_date DATE,
    ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(50) DEFAULT 'CONTADO';

-- 2.2 Asignar company_id por defecto si existen ventas huérfanas
UPDATE public.sales
SET company_id = (SELECT id FROM public.companies ORDER BY created_at ASC LIMIT 1)
WHERE company_id IS NULL;

ALTER TABLE public.sales ALTER COLUMN company_id SET NOT NULL;

-- 2.3 Reemplazar unicidad global de sale_number por unicidad multiempresa
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_sale_number_key;
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_company_id_sale_number_key;
ALTER TABLE public.sales 
    ADD CONSTRAINT sales_company_id_sale_number_key UNIQUE (company_id, sale_number);

CREATE INDEX IF NOT EXISTS idx_sales_company_status ON public.sales(company_id, payment_status, status);
CREATE INDEX IF NOT EXISTS idx_sales_customer_cxc ON public.sales(company_id, customer_id, due_date);

-- ------------------------------------------------------------------------------
-- 3. TABLA DE RECAUDOS / ABONOS DE CLIENTES (public.customer_payments)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.customer_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    payment_number VARCHAR(50) NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(50) NOT NULL DEFAULT 'EFECTIVO',
    transaction_reference VARCHAR(100),
    bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
    cash_session_id UUID REFERENCES public.cash_sessions(id) ON DELETE SET NULL,
    notes TEXT,
    created_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT customer_payments_company_payment_number_key UNIQUE (company_id, payment_number)
);

CREATE INDEX IF NOT EXISTS idx_customer_payments_company ON public.customer_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_sale ON public.customer_payments(company_id, sale_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_customer ON public.customer_payments(company_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_date ON public.customer_payments(payment_date);

-- RLS para customer_payments
ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation select customer_payments" ON public.customer_payments;
CREATE POLICY "Tenant isolation select customer_payments" ON public.customer_payments
FOR SELECT TO authenticated
USING (
    company_id = public.get_auth_company_id()
    OR EXISTS (
        SELECT 1 FROM public.sales s
        WHERE s.id = sale_id
          AND s.company_id = public.get_auth_company_id()
    )
);

DROP POLICY IF EXISTS "Tenant isolation insert customer_payments" ON public.customer_payments;
CREATE POLICY "Tenant isolation insert customer_payments" ON public.customer_payments
FOR INSERT TO authenticated
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND (
        public.has_permission('sales.create') 
        OR public.has_permission('treasury.create') 
        OR public.has_permission('customers.write')
        OR public.is_admin()
    )
);

-- ------------------------------------------------------------------------------
-- 4. DISPARADORES DE AUDITORÍA AUTOMÁTICA SECURITY DEFINER
-- ------------------------------------------------------------------------------

-- 4.1 Auditoría para Clientes (public.customers)
CREATE OR REPLACE FUNCTION public.fn_audit_customers()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_user_name VARCHAR(150);
    v_company_id UUID;
    v_action VARCHAR(50);
    v_prev JSONB;
    v_new JSONB;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NOT NULL THEN
        SELECT u.full_name
        INTO v_user_name
        FROM public.users u
        WHERE u.id = v_user_id;

        IF NOT FOUND THEN
            v_user_id := NULL;
        END IF;
    END IF;

    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Sistema';
    END IF;

    IF TG_OP = 'INSERT' THEN
        v_action := 'CLIENT_CREATED';
        v_company_id := NEW.company_id;
        v_prev := NULL;
        v_new := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        v_company_id := NEW.company_id;
        v_prev := to_jsonb(OLD);
        v_new := to_jsonb(NEW);

        IF (OLD.is_active IS DISTINCT FROM NEW.is_active) AND NEW.is_active = false THEN
            v_action := 'CLIENT_DEACTIVATED';
        ELSIF (OLD.is_active IS DISTINCT FROM NEW.is_active) AND NEW.is_active = true THEN
            v_action := 'CLIENT_UPDATED';
        ELSE
            v_action := 'CLIENT_UPDATED';
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'CLIENT_DEACTIVATED';
        v_company_id := OLD.company_id;
        v_prev := to_jsonb(OLD);
        v_new := NULL;
    END IF;

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
        v_company_id,
        v_user_id,
        v_user_name,
        v_action,
        'SALES',
        'customers',
        COALESCE(NEW.id, OLD.id)::TEXT,
        NULL,
        v_prev,
        v_new,
        NOW()
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE ALL ON FUNCTION public.fn_audit_customers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_audit_customers() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_audit_customers ON public.customers;
CREATE TRIGGER trg_audit_customers
AFTER INSERT OR UPDATE OR DELETE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_customers();

-- 4.2 Auditoría para CxC al emitir venta a crédito (public.sales)
CREATE OR REPLACE FUNCTION public.fn_audit_credit_sales()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_user_name VARCHAR(150);
BEGIN
    IF TG_OP = 'INSERT' AND (NEW.payment_method::text = 'CREDIT' OR NEW.payment_status = 'PENDING' OR NEW.payment_terms = 'CREDITO') THEN
        v_user_id := auth.uid();
        IF v_user_id IS NOT NULL THEN
            SELECT u.full_name INTO v_user_name FROM public.users u WHERE u.id = v_user_id;
        END IF;
        IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
            v_user_name := 'Sistema';
        END IF;

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
            NEW.company_id,
            v_user_id,
            v_user_name,
            'RECEIVABLE_CREATED',
            'SALES',
            'sales',
            NEW.id::TEXT,
            NEW.location_id,
            NULL,
            to_jsonb(NEW),
            NOW()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE ALL ON FUNCTION public.fn_audit_credit_sales() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_audit_credit_sales() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_audit_credit_sales ON public.sales;
CREATE TRIGGER trg_audit_credit_sales
AFTER INSERT ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_credit_sales();

-- 4.3 Auditoría para Recaudos / Abonos de Clientes (public.customer_payments)
CREATE OR REPLACE FUNCTION public.fn_audit_customer_payments()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_user_name VARCHAR(150);
    v_company_id UUID;
    v_sale_total NUMERIC;
    v_sale_paid NUMERIC;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NOT NULL THEN
        SELECT u.full_name
        INTO v_user_name
        FROM public.users u
        WHERE u.id = v_user_id;

        IF NOT FOUND THEN
            v_user_id := NULL;
        END IF;
    END IF;

    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Sistema';
    END IF;

    v_company_id := NEW.company_id;

    -- Registrar RECEIVABLE_PAYMENT
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
        v_company_id,
        v_user_id,
        v_user_name,
        'RECEIVABLE_PAYMENT',
        'SALES',
        'customer_payments',
        NEW.id::TEXT,
        NEW.location_id,
        NULL,
        to_jsonb(NEW),
        NOW()
    );

    -- Comprobar si la venta quedó saldada para registrar RECEIVABLE_PAID
    SELECT total_amount, paid_amount
    INTO v_sale_total, v_sale_paid
    FROM public.sales
    WHERE id = NEW.sale_id;

    IF v_sale_total IS NOT NULL AND v_sale_paid IS NOT NULL AND (v_sale_paid >= v_sale_total) THEN
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
            v_company_id,
            v_user_id,
            v_user_name,
            'RECEIVABLE_PAID',
            'SALES',
            'sales',
            NEW.sale_id::TEXT,
            NEW.location_id,
            NULL,
            jsonb_build_object('sale_id', NEW.sale_id, 'total_amount', v_sale_total, 'paid_amount', v_sale_paid),
            NOW()
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE ALL ON FUNCTION public.fn_audit_customer_payments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_audit_customer_payments() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_audit_customer_payments ON public.customer_payments;
CREATE TRIGGER trg_audit_customer_payments
AFTER INSERT ON public.customer_payments
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_customer_payments();

