-- ==============================================================================
-- 056_PRODUCTS_ACCOUNTING_ACCOUNT_LINK.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Enlace de productos a cuentas contables del Plan Único de Cuentas (PUC)
-- ==============================================================================

-- 1. Agregar columna de enlace contable a public.products si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'products' 
          AND column_name = 'accounting_account_id'
    ) THEN
        ALTER TABLE public.products
        ADD COLUMN accounting_account_id UUID REFERENCES public.accounting_accounts(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2. Índice para consultas y joins de balance y kardex contable
CREATE INDEX IF NOT EXISTS idx_products_accounting_account_id ON public.products(accounting_account_id);
