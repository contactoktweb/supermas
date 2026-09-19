-- ==============================================================================
-- 007_ALERTS_AND_AUDIT.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- ==============================================================================

-- 1. Tabla: system_settings (Parámetros Dinámicos Globales)
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL,
    value JSONB NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'STRING',
    description TEXT,
    is_critical BOOLEAN NOT NULL DEFAULT false,
    requires_audit BOOLEAN NOT NULL DEFAULT true,
    updated_by_user_id UUID REFERENCES public.users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tablas: alert_rules y system_alerts (Supervisión Proactiva)
CREATE TABLE IF NOT EXISTS public.alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    module VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'MEDIA', -- 'CRITICA', 'ALTA', 'MEDIA', 'BAJA'
    description TEXT,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    threshold_value NUMERIC(15,2),
    config_params JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID REFERENCES public.alert_rules(id) ON DELETE SET NULL,
    location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIA',
    status VARCHAR(20) NOT NULL DEFAULT 'NEW', -- 'NEW', 'READ', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'
    module VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    entity_id VARCHAR(100),
    assigned_user_id UUID REFERENCES public.users(id),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_location ON public.system_alerts(location_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON public.system_alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_priority ON public.system_alerts(priority);

-- 3. Tabla: audit_logs (Trazabilidad e Inmutabilidad de Operaciones)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    user_name VARCHAR(150) NOT NULL,
    action VARCHAR(50) NOT NULL,
    module VARCHAR(50) NOT NULL,
    entity_name VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    previous_value JSONB,
    new_value JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_name, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_date ON public.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON public.audit_logs(module);

-- Prohibir actualizaciones y eliminaciones físicas en auditoría
CREATE OR REPLACE RULE no_update_audit_logs AS ON UPDATE TO public.audit_logs DO INSTEAD NOTHING;
CREATE OR REPLACE RULE no_delete_audit_logs AS ON DELETE TO public.audit_logs DO INSTEAD NOTHING;
