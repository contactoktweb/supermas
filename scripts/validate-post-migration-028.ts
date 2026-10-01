import { Client } from 'pg'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function validatePostMigration028() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()
  console.log('====================================================================')
  console.log('🔍 VALIDACIÓN POST-MIGRACIÓN 028: CATEGORÍAS Y MARCAS')
  console.log('====================================================================\n')

  try {
    // -------------------------------------------------------------------------
    // 1. VERIFICAR NULABILIDAD Y CONSTRAINTS EN CATEGORIES Y BRANDS
    // -------------------------------------------------------------------------
    console.log('--- 1. Nulabilidad de company_id y Constraints UNIQUE ---')
    const cols = await client.query(`
      SELECT table_name, column_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name IN ('categories', 'brands') 
        AND column_name = 'company_id'
      ORDER BY table_name;
    `)
    cols.rows.forEach(r => {
      console.log(`• ${r.table_name}.company_id: is_nullable = ${r.is_nullable}`)
      if (r.is_nullable !== 'NO') {
        throw new Error(`Fallo: ${r.table_name}.company_id debería ser NOT NULL`)
      }
    })

    const catCons = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public' AND c.conrelid = 'public.categories'::regclass
        AND c.contype = 'u';
    `)
    console.log('\nUnique constraints en public.categories:')
    catCons.rows.forEach(r => console.log(`• ${r.conname}: ${r.def}`))

    const brandCons = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public' AND c.conrelid = 'public.brands'::regclass
        AND c.contype = 'u';
    `)
    console.log('\nUnique constraints en public.brands:')
    brandCons.rows.forEach(r => console.log(`• ${r.conname}: ${r.def}`))

    // -------------------------------------------------------------------------
    // 2. VERIFICAR CONFIGURACIÓN DE FUNCIONES (SECURITY DEFINER & SEARCH PATH)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Funciones SECURITY DEFINER y ACLs ---')
    const funcs = await client.query(`
      SELECT proname, prosecdef, proconfig, proacl
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND proname IN ('fn_validate_category_parent_tenant', 'fn_audit_categories', 'fn_audit_brands');
    `)
    funcs.rows.forEach(f => {
      console.log(`• ${f.proname}: secdef=${f.prosecdef}, config=${JSON.stringify(f.proconfig)}, acl=${f.proacl}`)
      if (!f.prosecdef) throw new Error(`Fallo: ${f.proname} debe ser SECURITY DEFINER`)
      if (!f.proconfig || !f.proconfig.includes('search_path=public, pg_catalog')) {
        throw new Error(`Fallo: ${f.proname} debe tener search_path = public, pg_catalog`)
      }
    })

    // -------------------------------------------------------------------------
    // 3. PRUEBA FUNCIONAL: UNICIDAD MULTIEMPRESA (Diferentes empresas con mismo código)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Prueba de Unicidad Multiempresa ---')
    await client.query('BEGIN;')
    
    // Obtener 2 empresas existentes o crear 2 temporales dentro de la transacción
    const companies = await client.query('SELECT id FROM public.companies LIMIT 2;')
    let comp1 = companies.rows[0]?.id
    let comp2 = companies.rows[1]?.id

    if (!comp2) {
      const newComp = await client.query(`
        INSERT INTO public.companies (
          id, business_name, trade_name, tax_id, verification_digit, address, city, department, phone, email
        ) VALUES (
          gen_random_uuid(), 'Empresa Test B S.A.S.', 'Test B', '900999999-1', '1', 'Calle 10 # 20-30', 'Bogotá', 'Cundinamarca', '3000000000', 'testb@empresa.com'
        ) RETURNING id;
      `)
      comp2 = newComp.rows[0].id
    }

    // Insertar misma categoría y marca en Empresa 1 y Empresa 2 (Debe ser permitido)
    await client.query(`
      INSERT INTO public.categories (id, company_id, name, slug, code)
      VALUES (gen_random_uuid(), $1::uuid, 'Lácteos', 'lacteos', 'CAT-LAC');
    `, [comp1])

    await client.query(`
      INSERT INTO public.categories (id, company_id, name, slug, code)
      VALUES (gen_random_uuid(), $1::uuid, 'Lácteos', 'lacteos', 'CAT-LAC');
    `, [comp2])
    console.log('✅ Unicidad por empresa en categories: Misma slug/code en empresas distintas permitido con éxito.')

    await client.query(`
      INSERT INTO public.brands (id, company_id, name, slug)
      VALUES (gen_random_uuid(), $1::uuid, 'Colanta', 'colanta');
    `, [comp1])

    await client.query(`
      INSERT INTO public.brands (id, company_id, name, slug)
      VALUES (gen_random_uuid(), $1::uuid, 'Colanta', 'colanta');
    `, [comp2])
    console.log('✅ Unicidad por empresa en brands: Mismo name/slug en empresas distintas permitido con éxito.')

    // Intento de duplicado dentro de la MISMA empresa (Debe fallar)
    await client.query('SAVEPOINT sp_dup;')
    try {
      await client.query(`
        INSERT INTO public.categories (id, company_id, name, slug, code)
        VALUES (gen_random_uuid(), $1::uuid, 'Lácteos Duplicado', 'lacteos', 'CAT-OTRO');
      `, [comp1])
      throw new Error('FALLO: Se permitió slug duplicado en la misma empresa')
    } catch (err: any) {
      await client.query('ROLLBACK TO SAVEPOINT sp_dup;')
      if (err.message.includes('categories_company_id_slug_key')) {
        console.log('✅ Bloqueo de slug duplicado en la misma empresa verificado.')
      } else {
        throw err
      }
    }

    // -------------------------------------------------------------------------
    // 4. PRUEBA FUNCIONAL: INTEGRIDAD MULTIEMPRESA DE parent_id
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Prueba de Integridad de parent_id entre empresas ---')
    const parentCatComp1 = await client.query(`
      INSERT INTO public.categories (id, company_id, name, slug, code)
      VALUES (gen_random_uuid(), $1::uuid, 'Bebidas Padre', 'bebidas-padre', 'BEB-01')
      RETURNING id;
    `, [comp1])
    const parentId = parentCatComp1.rows[0].id

    // Intento de asignar categoría de comp1 como padre en comp2 (Debe ser rechazado por trigger)
    await client.query('SAVEPOINT sp_parent_cross;')
    try {
      await client.query(`
        INSERT INTO public.categories (id, company_id, name, slug, code, parent_id)
        VALUES (gen_random_uuid(), $1::uuid, 'Gaseosas Hijo Comp 2', 'gaseosas-hijo', 'BEB-02', $2::uuid);
      `, [comp2, parentId])
      throw new Error('FALLO: Se permitió asignar parent_id de otra empresa')
    } catch (err: any) {
      await client.query('ROLLBACK TO SAVEPOINT sp_parent_cross;')
      if (err.message.includes('Violación multiempresa')) {
        console.log('✅ Trigger trg_validate_category_parent bloqueó correctamente parent_id de otra empresa.')
      } else {
        throw err
      }
    }

    // Intento de auto-referencia cíclica (parent_id = id)
    const selfId = 'a0000000-0000-0000-0000-000000000001'
    await client.query('SAVEPOINT sp_parent_self;')
    try {
      await client.query(`
        INSERT INTO public.categories (id, company_id, name, slug, code, parent_id)
        VALUES ($1::uuid, $2::uuid, 'Auto Padre', 'auto-padre', 'AUTO-01', $1::uuid);
      `, [selfId, comp1])
      throw new Error('FALLO: Se permitió que una categoría sea su propio padre')
    } catch (err: any) {
      await client.query('ROLLBACK TO SAVEPOINT sp_parent_self;')
      if (err.message.includes('no puede ser su propia categoría padre')) {
        console.log('✅ Trigger trg_validate_category_parent bloqueó correctamente auto-referencia cíclica.')
      } else {
        throw err
      }
    }

    // -------------------------------------------------------------------------
    // 5. PRUEBA FUNCIONAL: AUDITORÍA AUTOMÁTICA EN public.audit_logs
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Prueba de Triggers de Auditoría Automática ---')
    // Creamos una categoría y una marca válidas en comp1
    const testCatId = 'b0000000-0000-0000-0000-000000000001'
    await client.query(`
      INSERT INTO public.categories (id, company_id, name, slug, code, is_active)
      VALUES ($1::uuid, $2::uuid, 'Auditoría Test Cat', 'audit-test-cat', 'AUD-01', true);
    `, [testCatId, comp1])

    // Modificamos
    await client.query(`
      UPDATE public.categories SET name = 'Auditoría Test Cat Modificada' WHERE id = $1::uuid;
    `, [testCatId])

    // Desactivamos
    await client.query(`
      UPDATE public.categories SET is_active = false WHERE id = $1::uuid;
    `, [testCatId])

    // Reactivamos
    await client.query(`
      UPDATE public.categories SET is_active = true WHERE id = $1::uuid;
    `, [testCatId])

    // Consultamos los logs generados para la categoría
    const catAudits = await client.query(`
      SELECT action, module, entity_name, entity_id, location_id
      FROM public.audit_logs
      WHERE entity_name = 'categories' AND entity_id = $1
      ORDER BY created_at ASC;
    `, [testCatId])

    console.log('Eventos de auditoría registrados para categories:', catAudits.rows.map(r => r.action))
    const expectedCatActions = ['CATEGORY_CREATED', 'CATEGORY_UPDATED', 'CATEGORY_DEACTIVATED', 'CATEGORY_ACTIVATED']
    const actualCatActions = catAudits.rows.map(r => r.action)
    if (!expectedCatActions.every(a => actualCatActions.includes(a))) {
      throw new Error(`Faltan eventos de auditoría en categories: ${JSON.stringify(actualCatActions)}`)
    }
    console.log('✅ Auditoría de categorías validada al 100%.')

    // Prueba para brands
    const testBrandId = 'c0000000-0000-0000-0000-000000000001'
    await client.query(`
      INSERT INTO public.brands (id, company_id, name, slug, is_active)
      VALUES ($1::uuid, $2::uuid, 'Marca Auditoría', 'marca-auditoria', true);
    `, [testBrandId, comp1])

    await client.query(`
      UPDATE public.brands SET is_active = false WHERE id = $1::uuid;
    `, [testBrandId])

    await client.query(`
      UPDATE public.brands SET is_active = true WHERE id = $1::uuid;
    `, [testBrandId])

    const brandAudits = await client.query(`
      SELECT action, module, entity_name, entity_id, location_id
      FROM public.audit_logs
      WHERE entity_name = 'brands' AND entity_id = $1
      ORDER BY created_at ASC;
    `, [testBrandId])

    console.log('Eventos de auditoría registrados para brands:', brandAudits.rows.map(r => r.action))
    const expectedBrandActions = ['BRAND_CREATED', 'BRAND_DEACTIVATED', 'BRAND_ACTIVATED']
    const actualBrandActions = brandAudits.rows.map(r => r.action)
    if (!expectedBrandActions.every(a => actualBrandActions.includes(a))) {
      throw new Error(`Faltan eventos de auditoría en brands: ${JSON.stringify(actualBrandActions)}`)
    }
    console.log('✅ Auditoría de marcas validada al 100%.')

    // Revertir toda la transacción para dejar la base de datos con CERO datos de prueba (Zero Pollution)
    await client.query('ROLLBACK;')
    console.log('\n✅ ROLLBACK ejecutado: Base de datos limpia sin datos residuales.')

    // Verificar que categories y brands siguen en 0 registros
    const finalCat = await client.query('SELECT count(*) FROM public.categories')
    const finalBrand = await client.query('SELECT count(*) FROM public.brands')
    console.log(`Estado final Staging: categories = ${finalCat.rows[0].count}, brands = ${finalBrand.rows[0].count}`)

  } catch (err) {
    await client.query('ROLLBACK;').catch(() => {})
    throw err
  } finally {
    await client.end()
  }
}

validatePostMigration028().catch(err => {
  console.error('❌ Error en validación post-migración 028:', err)
  process.exit(1)
})
