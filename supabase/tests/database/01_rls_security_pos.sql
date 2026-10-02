-- ==============================================================================
-- 01_RLS_SECURITY_POS.sql
-- Test Suite de Seguridad RLS en PostgreSQL para Módulo POS y Tablas Críticas
-- ERP SUPER MÁS S.A.S.
-- ==============================================================================

BEGIN;

-- Validar que existan las tablas críticas
SELECT plan(10);

SELECT has_table('public', 'sales', 'Tabla public.sales existe');
SELECT has_table('public', 'sale_items', 'Tabla public.sale_items existe');
SELECT has_table('public', 'inventory_movements', 'Tabla public.inventory_movements existe');
SELECT has_table('public', 'cash_sessions', 'Tabla public.cash_sessions existe');
SELECT has_table('public', 'cash_movements', 'Tabla public.cash_movements existe');

-- Validar que RLS está habilitado en todas las tablas críticas
SELECT tests.rls_enabled('public', 'sales');
SELECT tests.rls_enabled('public', 'sale_items');
SELECT tests.rls_enabled('public', 'inventory_movements');
SELECT tests.rls_enabled('public', 'cash_sessions');
SELECT tests.rls_enabled('public', 'cash_movements');

SELECT * FROM finish();
ROLLBACK;
