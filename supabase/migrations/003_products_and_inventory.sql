-- ==============================================================================
-- 003_PRODUCTS_AND_INVENTORY.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- ==============================================================================

-- 1. Tabla: categories
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL UNIQUE,
    code VARCHAR(30) UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON public.categories(parent_id);

-- 2. Tabla: brands
CREATE TABLE IF NOT EXISTS public.brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(120) NOT NULL UNIQUE,
    logo_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabla: products (Catálogo Maestro Centralizado)
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES public.categories(id) ON DELETE RESTRICT,
    brand_id UUID REFERENCES public.brands(id) ON DELETE RESTRICT,
    sku VARCHAR(50) NOT NULL UNIQUE,
    barcode VARCHAR(50) UNIQUE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    short_description TEXT,
    full_description TEXT,
    unit_of_measure VARCHAR(20) NOT NULL DEFAULT 'UND',
    cost_price NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (cost_price >= 0),
    public_sale_price NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (public_sale_price >= 0),
    wholesale_price NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (wholesale_price >= 0),
    min_wholesale_quantity INTEGER NOT NULL DEFAULT 12,
    tax_rate_percent NUMERIC(5,2) NOT NULL DEFAULT 19.00,
    is_tax_exempt BOOLEAN NOT NULL DEFAULT false,
    primary_image_url TEXT,
    secondary_images JSONB DEFAULT '[]'::jsonb,
    min_stock_threshold INTEGER NOT NULL DEFAULT 10,
    critical_stock_threshold INTEGER NOT NULL DEFAULT 5,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_published_supermas BOOLEAN NOT NULL DEFAULT true,  -- Canal B2C web
    is_published_distributor BOOLEAN NOT NULL DEFAULT true, -- Canal B2B WhatsApp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_brand ON public.products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active);

-- 4. Tabla: stock_levels (Existencias agregadas por producto + bodega)
CREATE TABLE IF NOT EXISTS public.stock_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    quantity NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    reserved_quantity NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    available_quantity NUMERIC(12,2) GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
    average_cost NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    total_value_at_cost NUMERIC(15,2) GENERATED ALWAYS AS (quantity * average_cost) STORED,
    min_stock INTEGER NOT NULL DEFAULT 10,
    max_stock INTEGER NOT NULL DEFAULT 1000,
    health_status stock_health_status NOT NULL DEFAULT 'AVAILABLE',
    last_movement_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_product_location UNIQUE (product_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_levels_product ON public.stock_levels(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_levels_location ON public.stock_levels(location_id);
CREATE INDEX IF NOT EXISTS idx_stock_levels_health ON public.stock_levels(health_status);

-- 5. Tabla: inventory_movements (KARDEX INMUTABLE)
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consecutive BIGSERIAL,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
    movement_type inventory_movement_type NOT NULL,
    quantity_in NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (quantity_in >= 0),
    quantity_out NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (quantity_out >= 0),
    previous_stock NUMERIC(12,2) NOT NULL,
    new_stock NUMERIC(12,2) NOT NULL,
    unit_cost NUMERIC(15,2) NOT NULL,
    total_cost NUMERIC(15,2) NOT NULL,
    document_type VARCHAR(40) NOT NULL, -- 'PURCHASE_INVOICE', 'SALE', 'REMISSION', 'TRANSFER', 'ADJUSTMENT'
    document_reference VARCHAR(100) NOT NULL,
    reason TEXT,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movements_product ON public.inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_location ON public.inventory_movements(location_id);
CREATE INDEX IF NOT EXISTS idx_movements_date ON public.inventory_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_movements_type ON public.inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_movements_doc ON public.inventory_movements(document_reference);

-- 6. Tablas: transfers y transfer_items (Transferencias logísticas entre sedes)
CREATE TABLE IF NOT EXISTS public.transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(30) NOT NULL UNIQUE,
    origin_location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
    destination_location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'IN_TRANSIT', 'RECEIVED', 'REJECTED'
    dispatch_date TIMESTAMPTZ,
    receipt_date TIMESTAMPTZ,
    created_by_user_id UUID REFERENCES public.users(id),
    received_by_user_id UUID REFERENCES public.users(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_different_locations CHECK (origin_location_id <> destination_location_id)
);

CREATE TABLE IF NOT EXISTS public.transfer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID NOT NULL REFERENCES public.transfers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    requested_quantity NUMERIC(12,2) NOT NULL CHECK (requested_quantity > 0),
    sent_quantity NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (sent_quantity >= 0),
    received_quantity NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (received_quantity >= 0),
    unit_cost NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transfers_origin ON public.transfers(origin_location_id);
CREATE INDEX IF NOT EXISTS idx_transfers_destination ON public.transfers(destination_location_id);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON public.transfers(status);
CREATE INDEX IF NOT EXISTS idx_transfer_items_transfer ON public.transfer_items(transfer_id);
