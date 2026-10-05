-- ============================================================================
-- MIGRACIÓN 050: ENDURECIMIENTO DE CATÁLOGOS WEB Y PEDIDOS WEB MULTIEMPRESA
-- ============================================================================

DO $$
BEGIN
    -- 1. Agregar company_id a public.web_orders si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'web_orders' 
          AND column_name = 'company_id'
    ) THEN
        ALTER TABLE public.web_orders 
        ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

        -- Intentar poblar company_id a partir de dispatch_location_id si hay registros
        UPDATE public.web_orders wo
        SET company_id = loc.company_id
        FROM public.locations loc
        WHERE wo.dispatch_location_id = loc.id
          AND wo.company_id IS NULL;
    END IF;

    -- 2. Agregar company_id a public.web_order_items si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'web_order_items' 
          AND column_name = 'company_id'
    ) THEN
        ALTER TABLE public.web_order_items 
        ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

        -- Intentar poblar company_id a partir de web_orders
        UPDATE public.web_order_items woi
        SET company_id = wo.company_id
        FROM public.web_orders wo
        WHERE woi.order_id = wo.id
          AND woi.company_id IS NULL;
    END IF;

    -- 3. Índices de optimización para catálogos y canales web
    CREATE INDEX IF NOT EXISTS idx_products_published_supermas 
    ON public.products (company_id, is_published_supermas) 
    WHERE is_published_supermas = true;

    CREATE INDEX IF NOT EXISTS idx_products_published_distributor 
    ON public.products (company_id, is_published_distributor) 
    WHERE is_published_distributor = true;

    CREATE INDEX IF NOT EXISTS idx_web_orders_company_channel 
    ON public.web_orders (company_id, channel, fulfillment_status);

END $$;
