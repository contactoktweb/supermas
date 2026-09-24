-- ==============================================================================
-- 013_PRE_SUPABASE_AUDIT_AND_MODEL_FIXES.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Normalización de Identificadores, Multiempresa, Multibodega, Precios y Partida Doble
-- ==============================================================================

-- 1. EXTENSIÓN MULTIEMPRESA (company_id UUID en todas las tablas operativas y maestras)
-- Asegura el aislamiento de datos por inquilino/empresa para Row Level Security (RLS)

DO $$
BEGIN
    -- Categorías
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'company_id') THEN
        ALTER TABLE public.categories ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT;
        CREATE INDEX IF NOT EXISTS idx_categories_company ON public.categories(company_id);
    END IF;

    -- Marcas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brands' AND column_name = 'company_id') THEN
        ALTER TABLE public.brands ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT;
        CREATE INDEX IF NOT EXISTS idx_brands_company ON public.brands(company_id);
    END IF;

    -- Productos maestros
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'company_id') THEN
        ALTER TABLE public.products ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT;
        CREATE INDEX IF NOT EXISTS idx_products_company ON public.products(company_id);
    END IF;

    -- Clientes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'company_id') THEN
        ALTER TABLE public.customers ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT;
        CREATE INDEX IF NOT EXISTS idx_customers_company ON public.customers(company_id);
    END IF;

    -- Proveedores
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'company_id') THEN
        ALTER TABLE public.suppliers ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT;
        CREATE INDEX IF NOT EXISTS idx_suppliers_company ON public.suppliers(company_id);
    END IF;

    -- Ventas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'company_id') THEN
        ALTER TABLE public.sales ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT;
        CREATE INDEX IF NOT EXISTS idx_sales_company ON public.sales(company_id);
    END IF;

    -- Líneas de venta
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sale_items' AND column_name = 'company_id') THEN
        ALTER TABLE public.sale_items ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT;
        CREATE INDEX IF NOT EXISTS idx_sale_items_company ON public.sale_items(company_id);
    END IF;

    -- Compras
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'company_id') THEN
        ALTER TABLE public.purchases ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT;
        CREATE INDEX IF NOT EXISTS idx_purchases_company ON public.purchases(company_id);
    END IF;

    -- Líneas de compra
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_items' AND column_name = 'company_id') THEN
        ALTER TABLE public.purchase_items ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT;
        CREATE INDEX IF NOT EXISTS idx_purchase_items_company ON public.purchase_items(company_id);
    END IF;

    -- Existencias agregadas (stock_levels)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_levels' AND column_name = 'company_id') THEN
        ALTER TABLE public.stock_levels ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT;
        CREATE INDEX IF NOT EXISTS idx_stock_levels_company ON public.stock_levels(company_id);
    END IF;

    -- Movimientos Kardex
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'company_id') THEN
        ALTER TABLE public.inventory_movements ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT;
        CREATE INDEX IF NOT EXISTS idx_inventory_movements_company ON public.inventory_movements(company_id);
    END IF;

    -- Transferencias
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transfers' AND column_name = 'company_id') THEN
        ALTER TABLE public.transfers ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT;
        CREATE INDEX IF NOT EXISTS idx_transfers_company ON public.transfers(company_id);
    END IF;

    -- Líneas de transferencias
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transfer_items' AND column_name = 'company_id') THEN
        ALTER TABLE public.transfer_items ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT;
        CREATE INDEX IF NOT EXISTS idx_transfer_items_company ON public.transfer_items(company_id);
    END IF;

    -- Remisiones
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'remissions' AND column_name = 'company_id') THEN
        ALTER TABLE public.remissions ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT;
        CREATE INDEX IF NOT EXISTS idx_remissions_company ON public.remissions(company_id);
    END IF;

    -- Líneas de remisiones
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'remission_items' AND column_name = 'company_id') THEN
        ALTER TABLE public.remission_items ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT;
        CREATE INDEX IF NOT EXISTS idx_remission_items_company ON public.remission_items(company_id);
    END IF;

    -- Asientos contables
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounting_entries' AND column_name = 'company_id') THEN
        ALTER TABLE public.accounting_entries ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT;
        CREATE INDEX IF NOT EXISTS idx_accounting_entries_company ON public.accounting_entries(company_id);
    END IF;

    -- Cajas físicas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cash_registers' AND column_name = 'company_id') THEN
        ALTER TABLE public.cash_registers ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT;
        CREATE INDEX IF NOT EXISTS idx_cash_registers_company ON public.cash_registers(company_id);
    END IF;

    -- Turnos / Sesiones de caja
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cash_sessions' AND column_name = 'company_id') THEN
        ALTER TABLE public.cash_sessions ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT;
        CREATE INDEX IF NOT EXISTS idx_cash_sessions_company ON public.cash_sessions(company_id);
    END IF;

    -- Ubicación directa en sesiones de caja para rapidez de consulta POS
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cash_sessions' AND column_name = 'location_id') THEN
        ALTER TABLE public.cash_sessions ADD COLUMN location_id UUID REFERENCES public.locations(id) ON DELETE RESTRICT;
        CREATE INDEX IF NOT EXISTS idx_cash_sessions_location ON public.cash_sessions(location_id);
    END IF;
END $$;

-- 2. MODELO DE PRECIOS EXTENSIBLE (product_prices)
-- Sustituye precios quemados y permite listas de precios dinámicas (Público, Mayorista, Distribuidor, HORECA, Promociones)

CREATE TABLE IF NOT EXISTS public.product_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    price_list_code VARCHAR(30) NOT NULL, -- 'PUBLIC', 'WHOLESALE', 'DISTRIBUTOR', 'INSTITUTIONAL', 'PROMOTION'
    price_list_name VARCHAR(100) NOT NULL,
    price NUMERIC(15,2) NOT NULL CHECK (price >= 0),
    min_quantity INTEGER NOT NULL DEFAULT 1 CHECK (min_quantity >= 1),
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_product_pricelist UNIQUE (product_id, price_list_code)
);

CREATE INDEX IF NOT EXISTS idx_product_prices_product ON public.product_prices(product_id);
CREATE INDEX IF NOT EXISTS idx_product_prices_list ON public.product_prices(price_list_code);
CREATE INDEX IF NOT EXISTS idx_product_prices_company ON public.product_prices(company_id);

-- 3. TRIGGER AUTOMÁTICO: VALIDACIÓN DE PARTIDA DOBLE EN CONTABILIZACIÓN
-- Impide asentar comprobantes (status = 'POSTED') cuyos débitos y créditos no coincidan con precisión decimal.

CREATE OR REPLACE FUNCTION public.fn_enforce_accounting_double_entry()
RETURNS TRIGGER AS $$
DECLARE
    v_debit NUMERIC(15,2);
    v_credit NUMERIC(15,2);
BEGIN
    IF NEW.status = 'POSTED' THEN
        SELECT COALESCE(SUM(debit_amount), 0), COALESCE(SUM(credit_amount), 0)
        INTO v_debit, v_credit
        FROM public.accounting_entry_lines
        WHERE entry_id = NEW.id;

        IF v_debit = 0 AND v_credit = 0 THEN
            RAISE EXCEPTION 'El comprobante contable % no posee líneas de movimiento registradas. No es posible publicarlo.',
                NEW.entry_number;
        END IF;

        IF v_debit <> v_credit THEN
            RAISE EXCEPTION 'Descuadre contable detectado en comprobante % (Débito: %, Crédito: %). La partida doble es mandatoria por principios PUC y DIAN.',
                NEW.entry_number, v_debit, v_credit;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_double_entry ON public.accounting_entries;
CREATE TRIGGER trg_enforce_double_entry
    BEFORE INSERT OR UPDATE OF status ON public.accounting_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_enforce_accounting_double_entry();

-- 4. POLÍTICAS RLS MULTIEMPRESA PRE-CONFIGURADAS
-- Preparación formal de Row Level Security para Supabase Auth

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;

-- Política de aislamiento de inquilino por defecto (aplica cuando auth.uid() está configurado)
DROP POLICY IF EXISTS p_isolate_products_by_company ON public.products;
CREATE POLICY p_isolate_products_by_company ON public.products
    FOR ALL
    USING (
        company_id IS NULL OR 
        company_id = (auth.jwt()->>'company_id')::uuid OR 
        auth.role() = 'service_role'
    );

DROP POLICY IF EXISTS p_isolate_sales_by_company ON public.sales;
CREATE POLICY p_isolate_sales_by_company ON public.sales
    FOR ALL
    USING (
        company_id IS NULL OR 
        company_id = (auth.jwt()->>'company_id')::uuid OR 
        auth.role() = 'service_role'
    );
