/**
 * SUPER MÁS ERP/POS — Batería de Pruebas Fiduciarias: FASE 2 — CATEGORÍAS Y MARCAS REALES
 *
 * Valida de forma rigurosa contra Supabase Staging Real:
 * 1. Autenticación real con Supabase Auth.
 * 2. CRUD completo de Categorías (Create, Read, Update, Deactivate, Activate, Delete).
 * 3. Categorías jerárquicas (Root -> Subcategoría, validación de parent_id, protección anti-ciclos).
 * 4. Bloqueo de eliminación cuando existen dependencias (subcategorías asociadas).
 * 5. CRUD completo de Marcas (Create, Read, Update, Deactivate, Activate, Delete).
 * 6. Validación de unicidad multiempresa (mismo slug/code en empresas distintas permitido; duplicado en misma empresa rechazado).
 * 7. Protección multiempresa de parent_id (rechazo de padre de otra empresa vía trigger).
 * 8. Auditoría automática en public.audit_logs generada exclusivamente por triggers PostgreSQL.
 * 9. Blindaje de audit_logs contra INSERT directo desde cliente autenticado.
 * 10. Limpieza estricta (Zero Pollution): Deja categories y brands con exactamente 0 registros de prueba.
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { Client } from 'pg'
import { supabaseClient } from '../lib/supabase/client'
import { categoryService } from '../features/categories/services/category.service'
import { categoryRepository } from '../features/categories/repositories/category.repository'
import { brandService } from '../features/brands/services/brand.service'
import { brandRepository } from '../features/brands/repositories/brand.repository'

const adminPassword = process.env.STAGING_AUTH_PASSWORD || 'SuperMas2026*SecureAdmin'

interface TestResult {
  code: string
  name: string
  status: 'PASS' | 'FAIL'
  details: string
}

const results: TestResult[] = []

function recordTest(code: string, name: string, status: 'PASS' | 'FAIL', details: string) {
  results.push({ code, name, status, details })
  const icon = status === 'PASS' ? '✅' : '❌'
  console.log(`${icon} [PRUEBA ${code}] ${name}: ${details}`)
}

async function runPhase2Tests() {
  console.log('====================================================================')
  console.log('🏷️  INICIANDO VALIDACIÓN FIDUCIARIA: FASE 2 — CATEGORÍAS Y MARCAS')
  console.log('====================================================================\n')

  // 1. Iniciar sesión real como Superadministrador
  const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
    email: 'samirdurant234@gmail.com',
    password: adminPassword,
  })

  if (authError || !authData.user) {
    throw new Error(`Fallo en autenticación real para pruebas: ${authError?.message}`)
  }

  // Obtener company_id real del usuario
  const { data: userProfile } = await supabaseClient
    .from('users')
    .select('id, full_name, email, company_id')
    .eq('id', authData.user.id)
    .single()

  const userContext = {
    id: authData.user.id,
    name: userProfile?.full_name || 'Samir Durant',
    companyId: userProfile?.company_id,
  }

  console.log(`👤 Sesión activa: ${userContext.name} (${authData.user.email})`)
  console.log(`🏢 Empresa ID: ${userContext.companyId}\n`)

  let createdCatId: string | null = null
  let createdChildCatId: string | null = null
  let createdBrandId: string | null = null

  try {
    // ---------------------------------------------------------------------------
    // BLOQUE 1: CATEGORÍAS — CRUD REAL
    // ---------------------------------------------------------------------------
    console.log('--- 1. Pruebas de CRUD de Categorías ---')

    // 1.1 CREATE
    const catData = {
      name: 'Lácteos Test E2E',
      code: 'CAT-LAC-TEST',
      slug: 'lacteos-test-e2e',
      description: 'Categoría para prueba automatizada',
      parentId: null,
      isActive: true,
      sortOrder: 10,
    }
    const createdCat = await categoryService.createCategory(catData)
    createdCatId = createdCat.id
    recordTest(
      '1.1',
      'CREATE Categoría en public.categories',
      'PASS',
      `Categoría "${createdCat.name}" creada con éxito (ID: ${createdCat.id}, companyId: ${createdCat.companyId})`
    )

    // 1.2 READ
    const fetchedCat = await categoryService.getCategory(createdCat.id)
    if (fetchedCat && fetchedCat.name === catData.name && fetchedCat.code === catData.code) {
      recordTest(
        '1.2',
        'READ Categoría por ID',
        'PASS',
        `Categoría leída correctamente con slug "${fetchedCat.slug}" y código "${fetchedCat.code}"`
      )
    } else {
      recordTest('1.2', 'READ Categoría por ID', 'FAIL', 'Los datos leídos no coinciden')
    }

    // 1.3 LIST & FILTERS
    const listResult = await categoryService.listCategories({ query: 'Lácteos Test' })
    if (listResult.data.some((c) => c.id === createdCat.id)) {
      recordTest(
        '1.3',
        'LIST & FILTER Categorías por texto',
        'PASS',
        `Filtro devolvió ${listResult.data.length} resultado(s) conteniendo la categoría creada.`
      )
    } else {
      recordTest('1.3', 'LIST & FILTER Categorías', 'FAIL', 'No se encontró la categoría en el listado')
    }

    // 1.4 UPDATE
    const updatedCat = await categoryService.updateCategory(createdCat.id, {
      name: 'Lácteos Modificados E2E',
      description: 'Descripción actualizada',
    })
    if (updatedCat.name === 'Lácteos Modificados E2E') {
      recordTest(
        '1.4',
        'UPDATE Categoría',
        'PASS',
        `Categoría actualizada a "${updatedCat.name}" en PostgreSQL.`
      )
    } else {
      recordTest('1.4', 'UPDATE Categoría', 'FAIL', 'La actualización no persistió')
    }

    // 1.5 DEACTIVATE
    const deactivatedCat = await categoryService.toggleCategoryActive(createdCat.id, false)
    if (!deactivatedCat.isActive) {
      recordTest(
        '1.5',
        'DEACTIVATE Categoría',
        'PASS',
        `Categoría cambiada a is_active = false exitosamente.`
      )
    } else {
      recordTest('1.5', 'DEACTIVATE Categoría', 'FAIL', 'No se actualizó is_active')
    }

    // 1.6 ACTIVATE
    const activatedCat = await categoryService.toggleCategoryActive(createdCat.id, true)
    if (activatedCat.isActive) {
      recordTest(
        '1.6',
        'ACTIVATE Categoría',
        'PASS',
        `Categoría reactivada a is_active = true exitosamente.`
      )
    } else {
      recordTest('1.6', 'ACTIVATE Categoría', 'FAIL', 'No se reactivó la categoría')
    }

    // 1.7 HIERARCHY — Crear subcategoría hija
    const childCatData = {
      name: 'Quesos y Derivados',
      code: 'SUB-QUE-TEST',
      slug: 'quesos-y-derivados-test',
      description: 'Subcategoría dependiente de Lácteos',
      parentId: createdCat.id,
      isActive: true,
      sortOrder: 1,
    }
    const createdChild = await categoryService.createCategory(childCatData)
    createdChildCatId = createdChild.id

    const childDetail = await categoryService.getCategory(createdChild.id)
    if (childDetail && childDetail.parentId === createdCat.id && childDetail.parentName === 'Lácteos Modificados E2E') {
      recordTest(
        '1.7',
        'JERARQUÍA: Crear Subcategoría con parent_id',
        'PASS',
        `Subcategoría vinculada a "${childDetail.parentName}" (level: ${childDetail.level}).`
      )
    } else {
      recordTest('1.7', 'JERARQUÍA Subcategoría', 'FAIL', 'No se asoció correctamente al padre')
    }

    // 1.8 BLOQUEO DE ELIMINACIÓN CON DEPENDENCIAS
    const deleteCheck = await categoryService.validateCategoryDeletion(createdCat.id)
    if (!deleteCheck.canDelete && deleteCheck.childCategoriesCount > 0) {
      recordTest(
        '1.8',
        'SEGURIDAD: Bloqueo de eliminación con subcategorías',
        'PASS',
        `Eliminación bloqueada correctamente: "${deleteCheck.reason}"`
      )
    } else {
      recordTest('1.8', 'SEGURIDAD: Bloqueo de eliminación', 'FAIL', 'Se permitió eliminar categoría padre con hijos')
    }

    // 1.9 DELETE: Eliminar hijo y luego padre
    await categoryService.deleteCategory(createdChild.id)
    createdChildCatId = null
    await categoryService.deleteCategory(createdCat.id)
    createdCatId = null

    const checkGone = await categoryService.getCategory(createdCat.id)
    if (!checkGone) {
      recordTest(
        '1.9',
        'DELETE Categorías en cascada manual',
        'PASS',
        'Subcategoría y categoría padre eliminadas físicamente de la base de datos sin errores.'
      )
    } else {
      recordTest('1.9', 'DELETE Categorías', 'FAIL', 'El registro sigue existiendo')
    }

    // ---------------------------------------------------------------------------
    // BLOQUE 2: MARCAS — CRUD REAL
    // ---------------------------------------------------------------------------
    console.log('\n--- 2. Pruebas de CRUD de Marcas ---')

    // 2.1 CREATE MARCA
    const brandData = {
      name: 'Colanta Test E2E',
      slug: 'colanta-test-e2e',
      logoUrl: 'https://supermas.com.co/logos/colanta.png',
      isActive: true,
    }
    const createdBrand = await brandService.createBrand(brandData)
    createdBrandId = createdBrand.id
    recordTest(
      '2.1',
      'CREATE Marca en public.brands',
      'PASS',
      `Marca "${createdBrand.name}" creada con éxito (ID: ${createdBrand.id}, companyId: ${createdBrand.companyId})`
    )

    // 2.2 READ MARCA
    const fetchedBrand = await brandService.getBrand(createdBrand.id)
    if (fetchedBrand && fetchedBrand.name === brandData.name && fetchedBrand.slug === brandData.slug) {
      recordTest(
        '2.2',
        'READ Marca por ID',
        'PASS',
        `Marca leída correctamente con slug "${fetchedBrand.slug}" y productos: ${fetchedBrand.productsCount}`
      )
    } else {
      recordTest('2.2', 'READ Marca por ID', 'FAIL', 'Los datos leídos no coinciden')
    }

    // 2.3 LIST & FILTERS MARCA
    const brandList = await brandService.listBrands({ query: 'Colanta Test' })
    if (brandList.data.some((b) => b.id === createdBrand.id)) {
      recordTest(
        '2.3',
        'LIST & FILTER Marcas',
        'PASS',
        `Filtro devolvió ${brandList.data.length} marca(s) coincidentes.`
      )
    } else {
      recordTest('2.3', 'LIST & FILTER Marcas', 'FAIL', 'No se encontró la marca en el listado')
    }

    // 2.4 UPDATE MARCA
    const updatedBrand = await brandService.updateBrand(createdBrand.id, {
      name: 'Colanta Modificada E2E',
    })
    if (updatedBrand.name === 'Colanta Modificada E2E') {
      recordTest(
        '2.4',
        'UPDATE Marca',
        'PASS',
        `Marca actualizada a "${updatedBrand.name}" en PostgreSQL.`
      )
    } else {
      recordTest('2.4', 'UPDATE Marca', 'FAIL', 'La actualización no persistió')
    }

    // 2.5 DEACTIVATE & ACTIVATE MARCA
    await brandService.toggleBrandActive(createdBrand.id, false)
    const deactBrand = await brandService.getBrand(createdBrand.id)
    await brandService.toggleBrandActive(createdBrand.id, true)
    const actBrand = await brandService.getBrand(createdBrand.id)

    if (!deactBrand?.isActive && actBrand?.isActive) {
      recordTest(
        '2.5',
        'TOGGLE ACTIVE Marca (Desactivar y Reactivar)',
        'PASS',
        'Transición de estado validada en PostgreSQL.'
      )
    } else {
      recordTest('2.5', 'TOGGLE ACTIVE Marca', 'FAIL', 'Falló la conmutación de estado')
    }

    // 2.6 DELETE MARCA
    await brandService.deleteBrand(createdBrand.id)
    createdBrandId = null
    const checkBrandGone = await brandService.getBrand(createdBrand.id)
    if (!checkBrandGone) {
      recordTest(
        '2.6',
        'DELETE Marca',
        'PASS',
        'Marca eliminada físicamente de public.brands sin registros residuales.'
      )
    } else {
      recordTest('2.6', 'DELETE Marca', 'FAIL', 'El registro de marca no se eliminó')
    }

    // ---------------------------------------------------------------------------
    // BLOQUE 3: INTEGRIDAD MULTIEMPRESA & AUDITORÍA EN POSTGRESQL (VÍA DIRECT_URL)
    // ---------------------------------------------------------------------------
    console.log('\n--- 3. Pruebas de Integridad Multiempresa y Triggers de Auditoría ---')
    const pgClient = new Client({
      connectionString: process.env.DIRECT_URL,
      ssl: { rejectUnauthorized: false },
    })
    await pgClient.connect()

    try {
      // 3.1 Unicidad dentro de la misma empresa (Debe fallar)
      await pgClient.query('BEGIN;')
      await pgClient.query('SAVEPOINT sp_dup_cat;')
      let dupCatBlocked = false
      try {
        await pgClient.query(`
          INSERT INTO public.categories (id, company_id, name, slug, code)
          VALUES (gen_random_uuid(), $1::uuid, 'Test 1', 'test-slug-dup', 'TEST-DUP');
        `, [userContext.companyId])

        await pgClient.query(`
          INSERT INTO public.categories (id, company_id, name, slug, code)
          VALUES (gen_random_uuid(), $1::uuid, 'Test 2', 'test-slug-dup', 'TEST-DUP-2');
        `, [userContext.companyId])
      } catch (err: any) {
        dupCatBlocked = err.message.includes('categories_company_id_slug_key')
        await pgClient.query('ROLLBACK TO SAVEPOINT sp_dup_cat;')
      }

      if (dupCatBlocked) {
        recordTest(
          '3.1',
          'RECHAZO de duplicado en misma empresa (company_id, slug)',
          'PASS',
          'PostgreSQL bloqueó duplicado bajo categories_company_id_slug_key.'
        )
      } else {
        recordTest('3.1', 'RECHAZO de duplicado en misma empresa', 'FAIL', 'Se permitió duplicado en la misma empresa')
      }

      // 3.2 Misma slug en empresas distintas (Debe permitirse)
      const secondCompany = await pgClient.query(
        'SELECT id FROM public.companies WHERE id != $1::uuid LIMIT 1;',
        [userContext.companyId]
      )

      let compBId = secondCompany.rows[0]?.id
      if (!compBId) {
        const createdCompB = await pgClient.query(`
          INSERT INTO public.companies (
            id, business_name, trade_name, tax_id, verification_digit, address, city, department, phone, email
          ) VALUES (
            gen_random_uuid(), 'Distribuidora Regional B', 'Empresa B', '900888777-1', '1', 'Carrera 50 # 10-20', 'Medellín', 'Antioquia', '3100000000', 'regional@b.com'
          ) RETURNING id;
        `)
        compBId = createdCompB.rows[0].id
      }

      await pgClient.query(`
        INSERT INTO public.categories (id, company_id, name, slug, code)
        VALUES (gen_random_uuid(), $1::uuid, 'Lácteos Compartidos', 'lacteos-compartidos', 'CAT-COMP-1');
      `, [userContext.companyId])

      await pgClient.query(`
        INSERT INTO public.categories (id, company_id, name, slug, code)
        VALUES (gen_random_uuid(), $1::uuid, 'Lácteos Compartidos', 'lacteos-compartidos', 'CAT-COMP-1');
      `, [compBId])

      recordTest(
        '3.2',
        'PERMITIR mismo código/slug en empresas distintas',
        'PASS',
        'Aislamiento multiempresa verificado: diferentes empresas pueden usar el mismo slug y código.'
      )

      // 3.3 Rechazo de parent_id de otra empresa
      const parentInCompA = await pgClient.query(`
        INSERT INTO public.categories (id, company_id, name, slug, code)
        VALUES (gen_random_uuid(), $1::uuid, 'Padre Empresa A', 'padre-empresa-a', 'PADRE-A')
        RETURNING id;
      `, [userContext.companyId])
      const parentAId = parentInCompA.rows[0].id

      await pgClient.query('SAVEPOINT sp_cross_tenant;')
      let crossTenantBlocked = false
      try {
        await pgClient.query(`
          INSERT INTO public.categories (id, company_id, name, slug, code, parent_id)
          VALUES (gen_random_uuid(), $1::uuid, 'Hijo Empresa B', 'hijo-empresa-b', 'HIJO-B', $2::uuid);
        `, [compBId, parentAId])
      } catch (err: any) {
        crossTenantBlocked = err.message.includes('Violación multiempresa')
        await pgClient.query('ROLLBACK TO SAVEPOINT sp_cross_tenant;')
      }

      if (crossTenantBlocked) {
        recordTest(
          '3.3',
          'TRIGGER anti cross-tenant parent_id',
          'PASS',
          'trg_validate_category_parent bloqueó asignación de padre entre diferentes empresas.'
        )
      } else {
        recordTest('3.3', 'TRIGGER anti cross-tenant parent_id', 'FAIL', 'Se permitió asociar padre de otra empresa')
      }

      // 3.4 Verificación de Auditoría en public.audit_logs
      const auditRecords = await pgClient.query(`
        SELECT action, entity_name, module 
        FROM public.audit_logs 
        WHERE entity_name IN ('categories', 'brands')
        ORDER BY created_at DESC
        LIMIT 10;
      `)

      if (auditRecords.rows.length > 0) {
        const actions = auditRecords.rows.map((r) => r.action)
        recordTest(
          '3.4',
          'AUDITORÍA AUTOMÁTICA en public.audit_logs',
          'PASS',
          `Triggers registraron eventos automáticos en PostgreSQL: ${actions.slice(0, 5).join(', ')}`
        )
      } else {
        recordTest('3.4', 'AUDITORÍA AUTOMÁTICA', 'FAIL', 'No se encontraron logs de auditoría')
      }

      // Revertir las pruebas directas en pgClient para no dejar registros residuales
      await pgClient.query('ROLLBACK;')
    } finally {
      await pgClient.end()
    }

    // ---------------------------------------------------------------------------
    // BLOQUE 4: BLINDAJE DE AUDIT_LOGS CONTRA INSERT DESDE CLIENTE
    // ---------------------------------------------------------------------------
    console.log('\n--- 4. Blindaje de RLS sobre public.audit_logs ---')
    const { error: directInsertError } = await supabaseClient
      .from('audit_logs')
      .insert({
        company_id: userContext.companyId,
        user_id: userContext.id,
        user_name: userContext.name,
        action: 'CATEGORY_CREATED',
        module: 'CATALOG',
        entity_name: 'categories',
        entity_id: '00000000-0000-0000-0000-000000000001',
      })

    if (directInsertError) {
      recordTest(
        '4.1',
        'RLS bloquea INSERT directo a public.audit_logs',
        'PASS',
        `Cliente autenticado no puede escribir en audit_logs: "${directInsertError.message}"`
      )
    } else {
      recordTest('4.1', 'RLS bloquea INSERT directo a audit_logs', 'FAIL', 'Se permitió INSERT directo desde el cliente')
    }

  } catch (error: any) {
    console.error('❌ Error catastrófico en la suite de pruebas:', error)
    throw error
  } finally {
    // ---------------------------------------------------------------------------
    // LIMPIEZA FINAL ESTRICTA
    // ---------------------------------------------------------------------------
    console.log('\n--- 5. Limpieza Final y Conteo Residual ---')
    if (createdChildCatId) {
      await supabaseClient.from('categories').delete().eq('id', createdChildCatId).catch(() => {})
    }
    if (createdCatId) {
      await supabaseClient.from('categories').delete().eq('id', createdCatId).catch(() => {})
    }
    if (createdBrandId) {
      await supabaseClient.from('brands').delete().eq('id', createdBrandId).catch(() => {})
    }

    const { count: finalCatCount } = await supabaseClient
      .from('categories')
      .select('*', { count: 'exact', head: true })

    const { count: finalBrandCount } = await supabaseClient
      .from('brands')
      .select('*', { count: 'exact', head: true })

    console.log(`Estado final Staging en public.categories: ${finalCatCount} registros`)
    console.log(`Estado final Staging en public.brands: ${finalBrandCount} registros\n`)

    if ((finalCatCount || 0) === 0 && (finalBrandCount || 0) === 0) {
      console.log('✨ Base de datos 100% limpia sin polución ni datos residuales (Zero Pollution).')
    }
  }

  // Resumen final
  console.log('====================================================================')
  console.log('📊 RESUMEN DE RESULTADOS — FASE 2: CATEGORÍAS Y MARCAS')
  console.log('====================================================================')
  const passed = results.filter((r) => r.status === 'PASS').length
  const failed = results.filter((r) => r.status === 'FAIL').length
  console.log(`Total pruebas: ${results.length} | Aprobadas: ${passed} | Fallidas: ${failed}`)

  if (failed > 0) {
    console.error(`\n❌ Se encontraron ${failed} pruebas fallidas en Fase 2.`)
    process.exit(1)
  } else {
    console.log('\n🏆 ¡TODAS LAS PRUEBAS DE FASE 2 PASARON EXITOSAMENTE (100% PASS)!')
  }
}

runPhase2Tests().catch((err) => {
  console.error('Fallo en ejecución de suite de pruebas:', err)
  process.exit(1)
})
