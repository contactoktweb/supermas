-- ==============================================================================
-- 004_SALES_POS_REMISSIONS.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- ==============================================================================

-- 1. Tabla: customers
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type VARCHAR(20) NOT NULL DEFAULT 'CC', -- 'CC', 'NIT', 'CE', 'PASSPORT'
    document_number VARCHAR(30) NOT NULL UNIQUE,
    verification_digit VARCHAR(1),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    company_name VARCHAR(200),
    customer_type VARCHAR(20) NOT NULL DEFAULT 'INDIVIDUAL', -- 'INDIVIDUAL', 'COMPANY'
    customer_category VARCHAR(30) NOT NULL DEFAULT 'RETAIL', -- 'RETAIL', 'WHOLESALE', 'VIP'
    email VARCHAR(150),
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100) DEFAULT 'Medellín',
    department VARCHAR(100) DEFAULT 'Antioquia',
    credit_limit NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    current_balance NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_doc ON public.customers(document_number);
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers(company_name, first_name, last_name);

-- 2. Tablas: cash_registers, cash_sessions, cash_movements (POS)
CREATE TABLE IF NOT EXISTS public.cash_registers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    current_status VARCHAR(20) NOT NULL DEFAULT 'CLOSED', -- 'OPEN', 'CLOSED'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cash_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cash_register_id UUID NOT NULL REFERENCES public.cash_registers(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    opening_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closing_time TIMESTAMPTZ,
    opening_float NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    expected_cash_amount NUMERIC(15,2),
    counted_cash_amount NUMERIC(15,2),
    difference_amount NUMERIC(15,2),
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'CLOSED'
    supervisor_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cash_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL, -- 'DEPOSIT', 'WITHDRAWAL', 'SALE_CASH', 'REFUND'
    amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL,
    authorized_by_user_id UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tablas: sales y sale_items
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    seller_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    cash_session_id UUID REFERENCES public.cash_sessions(id) ON DELETE SET NULL,
    sale_number VARCHAR(50) NOT NULL UNIQUE,
    subtotal_amount NUMERIC(15,2) NOT NULL CHECK (subtotal_amount >= 0),
    discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    total_amount NUMERIC(15,2) NOT NULL CHECK (total_amount >= 0),
    total_cost_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (total_cost_amount >= 0),
    estimated_profit_amount NUMERIC(15,2) GENERATED ALWAYS AS (total_amount - tax_amount - total_cost_amount) STORED,
    payment_method payment_method_type NOT NULL DEFAULT 'CASH',
    status sale_status NOT NULL DEFAULT 'ISSUED',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    unit_price NUMERIC(15,2) NOT NULL CHECK (unit_price >= 0),
    discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    tax_rate_percent NUMERIC(5,2) NOT NULL DEFAULT 19.00,
    tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    subtotal NUMERIC(15,2) NOT NULL,
    total NUMERIC(15,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_location ON public.sales(location_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON public.sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON public.sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_number ON public.sales(sale_number);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON public.sale_items(product_id);

-- 4. Tablas: remissions y remission_items (Logística de despacho)
CREATE TABLE IF NOT EXISTS public.remissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(30) NOT NULL UNIQUE,
    sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    origin_location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
    status remission_status NOT NULL DEFAULT 'CREATED',
    driver_name VARCHAR(150),
    driver_license VARCHAR(50),
    vehicle_plate VARCHAR(20),
    dispatch_date TIMESTAMPTZ,
    delivery_date TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.remission_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    remission_id UUID NOT NULL REFERENCES public.remissions(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    unit_price NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Tablas: web_orders y web_order_items (Ecommerce Super Más & Distribuidora)
CREATE TABLE IF NOT EXISTS public.web_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(40) NOT NULL UNIQUE,
    channel VARCHAR(30) NOT NULL DEFAULT 'SUPERMAS_B2C', -- 'SUPERMAS_B2C', 'DISTRIBUTOR_B2B'
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(150) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    customer_email VARCHAR(150),
    shipping_address TEXT NOT NULL,
    shipping_city VARCHAR(100) NOT NULL,
    dispatch_location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
    subtotal NUMERIC(15,2) NOT NULL,
    shipping_fee NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    total NUMERIC(15,2) NOT NULL,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    fulfillment_status web_order_fulfillment_status NOT NULL DEFAULT 'PENDING',
    sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.web_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.web_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(15,2) NOT NULL,
    subtotal NUMERIC(15,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_web_orders_channel ON public.web_orders(channel);
CREATE INDEX IF NOT EXISTS idx_web_orders_status ON public.web_orders(fulfillment_status);
