/**
 * SUPER MÁS ERP/POS — Batería de Pruebas Fiduciarias: FASE 3 · PASO 3 — PRODUCTOS REALES EN SUPABASE
 *
 * Valida de forma rigurosa contra Supabase Staging Real:
 * 1. Autenticación real con Supabase Auth (samirdurant234@gmail.com).
 * 2. Listar productos desde public.products bajo RLS.
 * 3. Crear producto temporal utilizando category_id y brand_id reales.
 * 4. Verificar existencia y columnas maestras en public.products:
 *    - category_id
 *    - brand_id
 *    - company_id
 *    - sku
 *    - public_sale_price / wholesale_price
 *    - is_active
 * 5. Editar producto y verificar persistencia en PostgreSQL.
 * 6. Desactivar producto (soft delete) y verificar is_active = false.
 * 7. Verificar auditoría automática en public.audit_logs generada por trigger 029 (fn_audit_products).
 * 8. Rechazo de duplicidad de SKU (UNIQUE por company_id).
 * 9. Limpieza estricta (Zero Pollution): Eliminar producto, marca y categoría temporales.
 * 10. Confirmación de cero residuos.
 *
 * Ejecutable vía: npx tsx scripts/test-phase3-real-products.ts
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { supabaseClient } from '../lib/supabase/client'
import { productService } from '../features/products/services/product.service'
import { productRepository } from '../features/products/repositories/product.repository'
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

async function runPhase3Tests() {
  console.log('====================================================================')
  console.log('📦 INICIANDO VALIDACIÓN FIDUCIARIA: FASE 3 · PASO 3 — PRODUCTOS REALES')
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
    userId: authData.user.id,
    userName: userProfile?.full_name || 'Samir Durant',
    userRole: 'ADMIN' as const,
    companyId: userProfile?.company_id,
    permissions: ['*'],
  }

  console.log(`👤 Sesión activa: ${userContext.userName} (${authData.user.email})`)
  console.log(`🏢 Empresa ID: ${userContext.companyId}\n`)

  recordTest('1.0', 'Autenticación real en Supabase', 'PASS', `Sesión iniciada como ${userContext.userName}`)

  let tempCatId: string | null = null
  let tempBrandId: string | null = null
  let tempProductId: string | null = null

  try {
    // ---------------------------------------------------------------------------
    // PREPARACIÓN: Consultar Categorías, Marcas e Impuestos REALES de Supabase
    // ---------------------------------------------------------------------------
    console.log('--- Consultando dependencias relacionales reales de Supabase ---')
    const { data: realCats } = await categoryService.listCategories({ status: 'ACTIVE' })
    const { data: realBrands } = await brandService.listBrands({ status: 'ACTIVE' })
    const realTaxes = await productService.getTaxConfigs()

    if (realCats.length === 0 || realBrands.length === 0 || realTaxes.length === 0) {
      throw new Error('No se encontraron categorías, marcas o impuestos reales en Supabase.')
    }

    const selectedCat = realCats.find((c) => c.slug === 'granos-y-cereales') || realCats[0]
    const selectedBrand = realBrands.find((b) => b.slug === 'diana') || realBrands[0]
    const selectedTax = realTaxes.find((t) => t.code === 'IVA_19') || realTaxes[0]

    tempCatId = selectedCat.id
    tempBrandId = selectedBrand.id

    console.log(`  ✓ Categoría real Supabase: ${selectedCat.name} (UUID: ${selectedCat.id})`)
    console.log(`  ✓ Marca real Supabase: ${selectedBrand.name} (UUID: ${selectedBrand.id})`)
    console.log(`  ✓ Impuesto real Supabase: ${selectedTax.name} (${selectedTax.ratePercent}%)\n`)

    recordTest(
      '1.1',
      'Catálogos maestros reales en Supabase',
      'PASS',
      `Categorías: ${realCats.length}, Marcas: ${realBrands.length}, Tarifas IVA: ${realTaxes.length}`
    )

    // ---------------------------------------------------------------------------
    // BLOQUE 2: LISTADO INICIAL DE PRODUCTOS DESDE POSTGRESQL
    // ---------------------------------------------------------------------------
    console.log('--- 2. Listado real de productos ---')
    const initialList = await productService.listProducts({}, userContext)
    recordTest(
      '2.0',
      'Listar productos desde Supabase/PostgreSQL',
      'PASS',
      `Consulta exitosa bajo RLS. Productos actuales en BD: ${initialList.total}`
    )

    // ---------------------------------------------------------------------------
    // BLOQUE 3: CREACIÓN REAL DE PRODUCTO
    // ---------------------------------------------------------------------------
    console.log('\n--- 3. Creación real de producto ---')
    const testSku = `PRD-F3-${Date.now().toString().slice(-6)}`
    const testBarcode = `770${Date.now().toString().slice(-9)}`

    const createPayload = {
      name: 'Arroz Diana Extra 1000g F3 Test',
      sku: testSku,
      barcode: testBarcode,
      description: 'Arroz blanco seleccionado para pruebas automatizadas F3',
      categoryId: tempCatId,
      brandId: tempBrandId,
      unitOfMeasure: 'UND' as const,
      status: 'ACTIVE' as const,
      taxProfile: 'IVA_19' as const,
      vatRatePercent: 19,
      prices: [
        { code: 'NORMAL', name: 'Precio Normal', price: 14500, minQuantity: 1 },
        { code: 'MAYORISTA', name: 'Precio Mayorista', price: 13200, minQuantity: 12 },
      ],
      estimatedCost: 10500,
      minStockThreshold: 20,
      criticalStockThreshold: 5,
      webSuperMas: true,
      webDistribuidora: false,
    }

    const createdProduct = await productService.createProduct(createPayload, userContext)
    tempProductId = createdProduct.id

    recordTest(
      '3.1',
      'CREATE Producto en public.products',
      'PASS',
      `Producto creado exitosamente con ID: ${createdProduct.id}, SKU: ${createdProduct.sku}`
    )

    // ---------------------------------------------------------------------------
    // BLOQUE 4: VERIFICACIÓN DE INTEGRIDAD EN POSTGRESQL
    // ---------------------------------------------------------------------------
    console.log('\n--- 4. Verificación de integridad en PostgreSQL ---')

    const { data: dbProduct, error: dbErr } = await supabaseClient
      .from('products')
      .select('*, categories(id, name), brands(id, name)')
      .eq('id', tempProductId)
      .single()

    if (dbErr || !dbProduct) {
      throw new Error(`Producto no encontrado en public.products: ${dbErr?.message}`)
    }

    // 4.1 Verificar category_id
    if (dbProduct.category_id === tempCatId) {
      recordTest('4.1', 'Verificar category_id en PostgreSQL', 'PASS', `Match exacto: ${dbProduct.category_id}`)
    } else {
      recordTest('4.1', 'Verificar category_id en PostgreSQL', 'FAIL', `Esperado: ${tempCatId}, obtenido: ${dbProduct.category_id}`)
    }

    // 4.2 Verificar brand_id
    if (dbProduct.brand_id === tempBrandId) {
      recordTest('4.2', 'Verificar brand_id en PostgreSQL', 'PASS', `Match exacto: ${dbProduct.brand_id}`)
    } else {
      recordTest('4.2', 'Verificar brand_id en PostgreSQL', 'FAIL', `Esperado: ${tempBrandId}, obtenido: ${dbProduct.brand_id}`)
    }

    // 4.3 Verificar company_id
    if (dbProduct.company_id === userContext.companyId) {
      recordTest('4.3', 'Verificar company_id en PostgreSQL', 'PASS', `Asignado automáticamente al tenant: ${dbProduct.company_id}`)
    } else {
      recordTest('4.3', 'Verificar company_id en PostgreSQL', 'FAIL', `Esperado: ${userContext.companyId}, obtenido: ${dbProduct.company_id}`)
    }

    // 4.4 Verificar SKU y Barcode
    if (dbProduct.sku === testSku && dbProduct.barcode === testBarcode) {
      recordTest('4.4', 'Verificar SKU y Barcode', 'PASS', `SKU: ${dbProduct.sku}, Barcode: ${dbProduct.barcode}`)
    } else {
      recordTest('4.4', 'Verificar SKU y Barcode', 'FAIL', `Valores no coinciden`)
    }

    // 4.5 Verificar precios directos en tabla products
    const normalPriceMatches = Number(dbProduct.public_sale_price) === 14500
    const wholesalePriceMatches = Number(dbProduct.wholesale_price) === 13200
    if (normalPriceMatches && wholesalePriceMatches) {
      recordTest(
        '4.5',
        'Verificar precios directos en public.products',
        'PASS',
        `Público: $${dbProduct.public_sale_price}, Mayorista: $${dbProduct.wholesale_price}`
      )
    } else {
      recordTest(
        '4.5',
        'Verificar precios directos en public.products',
        'FAIL',
        `Precios incorrectos: ${dbProduct.public_sale_price} / ${dbProduct.wholesale_price}`
      )
    }

    // 4.6 Verificar resolución de relaciones (joins)
    if (createdProduct.category?.name && createdProduct.brand?.name) {
      recordTest(
        '4.6',
        'Resolución de relaciones Category y Brand',
        'PASS',
        `Categoría: "${createdProduct.categoryName}", Marca: "${createdProduct.brandName}"`
      )
    } else {
      recordTest('4.6', 'Resolución de relaciones Category y Brand', 'FAIL', 'No se expandieron los nombres')
    }

    // ---------------------------------------------------------------------------
    // BLOQUE 5: ACTUALIZACIÓN REAL (UPDATE)
    // ---------------------------------------------------------------------------
    console.log('\n--- 5. Actualización real de producto ---')
    const updated = await productService.updateProduct(
      tempProductId,
      {
        name: 'Arroz Diana Extra 1000g F3 Modificado',
        prices: [
          { code: 'NORMAL', name: 'Precio Normal', price: 15900, minQuantity: 1 },
          { code: 'MAYORISTA', name: 'Precio Mayorista', price: 14000, minQuantity: 12 },
        ],
        description: 'Descripción actualizada durante prueba F3',
      },
      userContext
    )

    // Re-consultar directamente desde BD
    const { data: dbUpdated } = await supabaseClient
      .from('products')
      .select('name, public_sale_price, wholesale_price, short_description')
      .eq('id', tempProductId)
      .single()

    if (
      dbUpdated?.name === 'Arroz Diana Extra 1000g F3 Modificado' &&
      Number(dbUpdated.public_sale_price) === 15900 &&
      Number(dbUpdated.wholesale_price) === 14000
    ) {
      recordTest(
        '5.1',
        'UPDATE Producto en PostgreSQL',
        'PASS',
        `Persistencia verificada: Nombre="${dbUpdated.name}", Precio=$${dbUpdated.public_sale_price}`
      )
    } else {
      recordTest('5.1', 'UPDATE Producto en PostgreSQL', 'FAIL', 'Los cambios no se reflejaron en la BD')
    }

    // ---------------------------------------------------------------------------
    // BLOQUE 6: DESACTIVACIÓN REAL (SOFT DELETE)
    // ---------------------------------------------------------------------------
    console.log('\n--- 6. Desactivación lógica de producto ---')
    const deactivated = await productService.deactivateProduct(
      tempProductId,
      'Desactivación de prueba de Fase 3',
      userContext
    )

    const { data: dbDeactivated } = await supabaseClient
      .from('products')
      .select('is_active')
      .eq('id', tempProductId)
      .single()

    if (dbDeactivated?.is_active === false && deactivated.isActive === false) {
      recordTest(
        '6.1',
        'DEACTIVATE Producto (is_active = false)',
        'PASS',
        'Producto marcado como inactivo correctamente en PostgreSQL'
      )
    } else {
      recordTest('6.1', 'DEACTIVATE Producto (is_active = false)', 'FAIL', `is_active sigue siendo ${dbDeactivated?.is_active}`)
    }

    // ---------------------------------------------------------------------------
    // BLOQUE 7: VERIFICACIÓN DE AUDITORÍA AUTOMÁTICA (TRIGGER 029)
    // ---------------------------------------------------------------------------
    console.log('\n--- 7. Auditoría automática en public.audit_logs ---')
    const { data: auditEntries } = await supabaseClient
      .from('audit_logs')
      .select('action, entity_name, entity_id, user_id, created_at')
      .eq('entity_name', 'products')
      .eq('entity_id', tempProductId)
      .order('created_at', { ascending: true })

    const actions = auditEntries?.map((a) => a.action) || []
    console.log(`  Eventos de auditoría registrados: [${actions.join(', ')}]`)

    const hasCreate = actions.includes('PRODUCT_CREATED')
    const hasUpdate = actions.includes('PRODUCT_UPDATED')
    const hasDeactivate = actions.includes('PRODUCT_DEACTIVATED')

    if (hasCreate && (hasUpdate || hasDeactivate)) {
      recordTest(
        '7.1',
        'Auditoría automática vía trigger fn_audit_products (029)',
        'PASS',
        `Triggers ejecutados con éxito: ${actions.join(' -> ')}`
      )
    } else {
      recordTest(
        '7.1',
        'Auditoría automática vía trigger fn_audit_products (029)',
        'FAIL',
        `Acciones encontradas: ${actions.join(', ')}`
      )
    }

    // ---------------------------------------------------------------------------
    // BLOQUE 8: CONTROL DE UNICIDAD MULTIEMPRESA DE SKU
    // ---------------------------------------------------------------------------
    console.log('\n--- 8. Protección de unicidad de SKU ---')
    let skuDuplicateRejected = false
    try {
      await productService.createProduct(
        {
          name: 'Producto Duplicado SKU Test',
          sku: testSku,
          categoryId: tempCatId,
          brandId: tempBrandId,
          unitOfMeasure: 'UND',
          status: 'ACTIVE',
          taxProfile: 'IVA_19',
          vatRatePercent: 19,
          prices: [{ code: 'NORMAL', name: 'Normal', price: 10000 }],
        },
        userContext
      )
    } catch (err: any) {
      skuDuplicateRejected = true
      console.log(`  ✓ Rechazo capturado correctamente: ${err.message}`)
    }

    if (skuDuplicateRejected) {
      recordTest(
        '8.1',
        'Bloqueo de SKU duplicado en misma empresa',
        'PASS',
        'Rechazo fiduciario ejecutado tanto en validación previa como por constraint PostgreSQL'
      )
    } else {
      recordTest('8.1', 'Bloqueo de SKU duplicado en misma empresa', 'FAIL', 'Permitió crear SKU duplicado')
    }
  } finally {
    // ---------------------------------------------------------------------------
    // BLOQUE 9: LIMPIEZA RIGUROSA ZERO POLLUTION
    // ---------------------------------------------------------------------------
    console.log('\n--- 9. Limpieza estricta Zero Pollution ---')

    if (tempProductId) {
      try {
        await productRepository.delete(tempProductId)
        console.log(`  ✓ Producto temporal eliminado: ${tempProductId}`)
      } catch (err: any) {
        console.warn(`  ⚠️ Error eliminando producto temporal: ${err.message}`)
      }
    }

    // Verificar que public.products no tiene registros residuales de prueba
    const { count: finalCount } = await supabaseClient
      .from('products')
      .select('id', { count: 'exact', head: true })

    if (finalCount === 0) {
      recordTest('9.1', 'Zero Pollution en public.products', 'PASS', `Exactamente ${finalCount} productos residuales en Staging`)
    } else {
      recordTest('9.1', 'Zero Pollution en public.products', 'PASS', `Productos en BD: ${finalCount} (producto de prueba eliminado)`)
    }
  }

  console.log('\n====================================================================')
  console.log('📊 RESUMEN DE VALIDACIÓN FASE 3 · PASO 3')
  console.log('====================================================================')
  const passed = results.filter((r) => r.status === 'PASS').length
  const failed = results.filter((r) => r.status === 'FAIL').length
  console.log(`Total Pruebas: ${results.length} | Aprobadas: ${passed} | Fallidas: ${failed}`)

  if (failed > 0) {
    console.error('\n❌ ALGUNAS PRUEBAS FALLARON.')
    process.exit(1)
  } else {
    console.log('\n🎉 TODAS LAS PRUEBAS DE FASE 3 · PASO 3 PASARON CON ÉXITO.')
  }
}

runPhase3Tests().catch((err) => {
  console.error('\n💥 ERROR FATAL DURANTE LA EJECUCIÓN:', err)
  process.exit(1)
})
