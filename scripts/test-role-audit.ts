import { Client } from 'pg';

async function testRolesAndPolicies() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('--- TEST ROLES Y POLÍTICAS (BEGIN / ROLLBACK) ---');

  await client.query('BEGIN;');

  try {
    const resComp = await client.query('SELECT id FROM public.companies LIMIT 1;');
    const compId = resComp.rows[0].id;
    const resLoc = await client.query('SELECT id FROM public.locations WHERE company_id = $1 LIMIT 1;', [compId]);
    const locId = resLoc.rows[0].id;
    const rolesRes = await client.query('SELECT id, code FROM public.roles;');
    const roles = new Map(rolesRes.rows.map((r: any) => [r.code, r.id]));

    // Crear usuario temporal CAJERO
    const cashierId = 'c0000000-0000-0000-0000-000000000001';
    await client.query(`
      INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
      VALUES ($1, 'cashier.test@supermas.com.co', jsonb_build_object('role', 'CASHIER', 'company_id', $2::text), '{}'::jsonb);
    `, [cashierId, compId]);

    await client.query(`
      INSERT INTO public.users (id, company_id, email, full_name, role_id, is_active)
      VALUES ($1, $2, 'cashier.test@supermas.com.co', 'Cajero Test', $3, true)
      ON CONFLICT (id) DO UPDATE
      SET company_id = EXCLUDED.company_id, role_id = EXCLUDED.role_id;
    `, [cashierId, compId, roles.get('CASHIER')]);

    await client.query(`
      INSERT INTO public.user_locations (user_id, location_id, is_primary)
      VALUES ($1, $2, true);
    `, [cashierId, locId]);

    // Insertar 1 categoría y 1 marca con superusuario
    const catRes = await client.query(`
      INSERT INTO public.categories (company_id, name, slug)
      VALUES ($1, 'Abarrotes Audit', 'abarrotes-audit') RETURNING id;
    `, [compId]);
    const catId = catRes.rows[0].id;

    // Ahora simular Cajero con SET LOCAL ROLE authenticated
    await client.query(`SET LOCAL ROLE authenticated;`);
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${cashierId}';`);

    // Intentar consultar categories
    const testCat = await client.query(`SELECT COUNT(*)::int as cnt FROM public.categories;`);
    console.log(`[CASHIER] Filas visibles en categories: ${testCat.rows[0].cnt} (Esperado con bug RLS: 0, pues no hay política SELECT)`);

    // Intentar consultar users
    const testUsers = await client.query(`SELECT COUNT(*)::int as cnt FROM public.users;`);
    console.log(`[CASHIER] Filas visibles en users: ${testUsers.rows[0].cnt} (Esperado con bug RLS: 0, pues no hay política SELECT)`);

    // Volver a superuser
    await client.query(`RESET ROLE;`);

    console.log('✓ Prueba empírica ejecutada exitosamente.');
  } finally {
    await client.query('ROLLBACK;');
    console.log('🔒 ROLLBACK ejecutado — 0 datos residuales.');
    await client.end();
  }
}

testRolesAndPolicies().catch(console.error);
