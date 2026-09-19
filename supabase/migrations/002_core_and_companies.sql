-- ==============================================================================
-- 002_CORE_AND_COMPANIES.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- ==============================================================================

-- 1. Tabla: companies (Multiempresa / Matriz)
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_name TEXT NOT NULL,
    trade_name TEXT NOT NULL,
    tax_id VARCHAR(20) NOT NULL UNIQUE,
    verification_digit VARCHAR(1) NOT NULL,
    tax_regime VARCHAR(50) NOT NULL DEFAULT 'RESPONSABLE_DE_IVA',
    economic_activity_code VARCHAR(10) DEFAULT '4711',
    legal_representative_name TEXT,
    legal_representative_doc VARCHAR(30),
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL,
    country VARCHAR(50) NOT NULL DEFAULT 'Colombia',
    phone VARCHAR(50),
    email VARCHAR(150),
    invoice_email VARCHAR(150),
    logo_url TEXT,
    currency VARCHAR(5) NOT NULL DEFAULT 'COP',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabla: locations (Bodegas, Tiendas, CEDI)
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    type location_type NOT NULL DEFAULT 'WAREHOUSE',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL DEFAULT 'Antioquia',
    phone VARCHAR(50),
    email VARCHAR(150),
    manager_name VARCHAR(150),
    manager_email VARCHAR(150),
    manager_phone VARCHAR(50),
    description TEXT,
    is_ecommerce_source BOOLEAN NOT NULL DEFAULT false,
    is_store_point BOOLEAN NOT NULL DEFAULT false,
    allow_inventory_ops BOOLEAN NOT NULL DEFAULT true,
    allow_sales BOOLEAN NOT NULL DEFAULT true,
    allow_purchases BOOLEAN NOT NULL DEFAULT true,
    allow_transfers BOOLEAN NOT NULL DEFAULT true,
    auto_block_zero_stock BOOLEAN NOT NULL DEFAULT true,
    low_stock_threshold_percent NUMERIC(5,2) NOT NULL DEFAULT 15.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de búsqueda y relaciones para locations
CREATE INDEX IF NOT EXISTS idx_locations_company_id ON public.locations(company_id);
CREATE INDEX IF NOT EXISTS idx_locations_code ON public.locations(code);
CREATE INDEX IF NOT EXISTS idx_locations_type ON public.locations(type);
CREATE INDEX IF NOT EXISTS idx_locations_status ON public.locations(status);

-- 3. Tabla: roles (Roles predefinidos inmutables)
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    scope VARCHAR(30) NOT NULL DEFAULT 'ALL_LOCATIONS', -- 'ALL_LOCATIONS' | 'ASSIGNED_LOCATION'
    is_system BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Tabla: permissions (Matriz de permisos atómicos)
CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) NOT NULL UNIQUE, -- ej: 'warehouse.read', 'cost.read'
    module VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Tabla intermedia: role_permissions
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- 6. Tabla: users (Perfiles públicos vinculados a Supabase Auth)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
    email VARCHAR(150) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(50),
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Tabla intermedia: user_locations (Asignación de sedes autorizadas para cada usuario)
CREATE TABLE IF NOT EXISTS public.user_locations (
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_user_locations_user ON public.user_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_locations_location ON public.user_locations(location_id);
