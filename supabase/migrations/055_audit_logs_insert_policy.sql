-- ==============================================================================
-- 055_AUDIT_LOGS_INSERT_POLICY.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Habilitar inserción auditada para usuarios autenticados en public.audit_logs
-- ==============================================================================

-- 1. Permitir que usuarios autenticados registren eventos de auditoría para su empresa
DROP POLICY IF EXISTS "Allow authenticated users to insert audit log" ON public.audit_logs;
CREATE POLICY "Allow authenticated users to insert audit log" ON public.audit_logs
FOR INSERT TO authenticated
WITH CHECK (
    company_id IS NULL
    OR company_id = public.get_auth_company_id()
    OR public.is_admin()
);
