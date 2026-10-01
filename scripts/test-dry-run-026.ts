import { Client } from 'pg';

async function testDryRun026() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('--- TEST DRY-RUN: MIGRACIÓN 026 (BEGIN / ROLLBACK) ---');
  await client.query('BEGIN;');

  try {
    const sql = `
      -- 1. Función y trigger para vincular automáticamente al superadmin creador
      CREATE OR REPLACE FUNCTION public.fn_on_company_created_link_superadmin()
      RETURNS TRIGGER AS $$
      BEGIN
          IF auth.uid() IS NOT NULL AND public.is_admin() AND public.get_auth_company_id() IS NULL THEN
              UPDATE public.users
              SET company_id = NEW.id,
                  updated_at = NOW()
              WHERE id = auth.uid();
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

      DROP TRIGGER IF EXISTS trg_link_superadmin_on_company_create ON public.companies;
      CREATE TRIGGER trg_link_superadmin_on_company_create
      AFTER INSERT ON public.companies
      FOR EACH ROW
      EXECUTE FUNCTION public.fn_on_company_created_link_superadmin();

      -- 2. Política SELECT refinada para permitir consulta durante onboarding del superadmin
      DROP POLICY IF EXISTS "Tenant isolation select company" ON public.companies;
      CREATE POLICY "Tenant isolation select company" ON public.companies
      FOR SELECT TO authenticated
      USING (
          id = public.get_auth_company_id()
          OR (public.get_auth_company_id() IS NULL AND public.is_admin())
      );
    `;

    await client.query(sql);
    console.log('✅ DRY-RUN 026 EXITOSO: DDL y políticas de PostgreSQL ejecutadas sin errores.');
  } catch (err) {
    console.error('❌ Error en dry-run 026:', err);
    throw err;
  } finally {
    await client.query('ROLLBACK;');
    console.log('🔒 Transacción revertida con ROLLBACK (Cero cambios en BD).');
    await client.end();
  }
}

testDryRun026().catch(() => process.exit(1));
