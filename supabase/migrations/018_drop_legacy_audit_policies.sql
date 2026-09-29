-- ==============================================================================
-- 018_DROP_LEGACY_AUDIT_POLICIES.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Eliminar políticas heredadas de migración 009 en audit_logs para cumplir con 014
-- ==============================================================================

-- 1. Eliminar política legacy que permitía a usuarios autenticados insertar registros directamente en audit_logs
DROP POLICY IF EXISTS "Allow authenticated users to insert audit log" ON public.audit_logs;

-- 2. Eliminar política legacy redundante de SELECT para superadmin (ya cubierta por Tenant isolation select audit_logs)
DROP POLICY IF EXISTS "Superadmin full access audit" ON public.audit_logs;
