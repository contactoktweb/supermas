const { Client } = require('pg');

async function verify() {
  const client = new Client({ connectionString: process.env.DATABASE_URL || process.env.DIRECT_URL });
  await client.connect();

  const roleCodes = [
    'ADMIN',
    'JEFE_INGRESOS_SALIDAS',
    'FACTURACION_POS',
    'ENCARGADA_VENTA',
    'VENDEDORES',
    'JEFE_BODEGA',
    'RECURSOS_HUMANOS'
  ];

  for (const rc of roleCodes) {
    const res = await client.query(
      `SELECT p.code 
       FROM public.role_permissions rp 
       JOIN public.roles r ON rp.role_id = r.id 
       JOIN public.permissions p ON rp.permission_id = p.id 
       WHERE r.code = $1 
       ORDER BY p.code`,
      [rc]
    );
    console.log(rc, 'count:', res.rows.length, '->', res.rows.map(r => r.code).join(', '));
  }

  const users = await client.query('SELECT u.id, u.email, u.full_name, r.code as role_code FROM public.users u JOIN public.roles r ON u.role_id = r.id ORDER BY u.full_name');
  console.log('\nUsers check (MUST REMAIN EXACTLY AS BEFORE):');
  console.table(users.rows);

  await client.end();
}

verify().catch(console.error);
