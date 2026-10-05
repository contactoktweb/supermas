-- ==============================================================================
-- 051_ALERTS_AND_REPLENISHMENT_HARDENING.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Hardening multiempresa de alertas de supervisión, reglas y reabastecimiento
-- ==============================================================================

-- 1. Hardening de public.alert_rules
ALTER TABLE public.alert_rules
    ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS default_priority VARCHAR(20) DEFAULT 'MEDIA',
    ADD COLUMN IF NOT EXISTS target_roles JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS auto_resolve BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS thresholds JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_by VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_alert_rules_company ON public.alert_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_code ON public.alert_rules(code);

-- 2. Hardening de public.system_alerts
ALTER TABLE public.system_alerts
    ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS code VARCHAR(50),
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS entity_reference VARCHAR(255),
    ADD COLUMN IF NOT EXISTS assigned_role VARCHAR(100),
    ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS read_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS attended_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS attended_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS attended_by_user_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS attended_comment TEXT,
    ADD COLUMN IF NOT EXISTS resolved_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS resolved_by_user_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS solution_notes TEXT,
    ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS closed_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS history JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_system_alerts_company ON public.system_alerts(company_id);
CREATE INDEX IF NOT EXISTS idx_system_alerts_company_status ON public.system_alerts(company_id, status);
CREATE INDEX IF NOT EXISTS idx_system_alerts_company_priority ON public.system_alerts(company_id, priority);
CREATE INDEX IF NOT EXISTS idx_system_alerts_dedup ON public.system_alerts(company_id, entity_type, entity_id, status);

-- 3. Habilitar RLS en ambas tablas
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Empresas pueden ver sus reglas de alerta" ON public.alert_rules;
CREATE POLICY "Empresas pueden ver sus reglas de alerta"
    ON public.alert_rules
    FOR ALL
    USING (
        company_id IS NULL OR
        company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid
    )
    WITH CHECK (
        company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid
    );

DROP POLICY IF EXISTS "Aislamiento multiempresa para system_alerts" ON public.system_alerts;
CREATE POLICY "Aislamiento multiempresa para system_alerts"
    ON public.system_alerts
    FOR ALL
    USING (
        company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid
    )
    WITH CHECK (
        company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid
    );
