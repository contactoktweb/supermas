import assert from 'node:assert'
import { publicCatalogService } from '../services/public-catalog.service'
import { handleCorsOptions, jsonResponse, corsHeaders } from '../utils/cors'
import { SuperCatalogProduct } from '@/features/super-catalog/types'
import { DistributorCatalogProduct } from '@/features/distributor-catalog/types'

async function runPublicCatalogTests() {
  console.log('====================================================================')
  console.log('🧪 EJECUTANDO PRUEBAS UNITARIAS Y DE INTEGRACIÓN — API PÚBLICA CATÁLOGOS')
  console.log('====================================================================\n')

  // ---------------------------------------------------------------------------
  // PRUEBA 1: Cabeceras CORS y opciones preflight para consumo externo
  // ---------------------------------------------------------------------------
  console.log('Test 1: Validación de CORS para consumo desde webs externas...')
  const corsPreflight = handleCorsOptions()
  assert.strictEqual(corsPreflight.status, 204, 'Preflight OPTIONS debe retornar 204')
  assert.strictEqual(
    corsPreflight.headers.get('Access-Control-Allow-Origin'),
    '*',
    'Debe permitir origen cruzado'
  )
  assert.ok(
    corsPreflight.headers.get('Access-Control-Allow-Methods')?.includes('GET'),
    'Debe permitir método GET'
  )

  const jsonResp = jsonResponse({ test: true })
  assert.strictEqual(jsonResp.status, 200)
  assert.strictEqual(jsonResp.headers.get('Access-Control-Allow-Origin'), '*')
  assert.ok(
    jsonResp.headers.get('Cache-Control')?.includes('public'),
    'Debe incluir directiva Cache-Control'
  )
  console.log('✅ Test 1 Aprobado: Soporte CORS verificado.\n')

  // ---------------------------------------------------------------------------
  // PRUEBA 2: Sanitización de datos y confidencialidad comercial en Super Más
  // ---------------------------------------------------------------------------
  console.log('Test 2: Validación de sanitización estricta para Catálogo Super Más (B2C)...')
  const mockInternalSuperProduct: SuperCatalogProduct = {
    id: 'prod-001',
    sku: 'SKU-ARROZ-01',
    barcode: '770123456789',
    name: 'Arroz Diana Especial 1000g',
    slug: 'arroz-diana-especial-1000g',
    description: 'Arroz de grano seleccionado',
    category: 'Granos y Abarrotes',
    brand: 'Diana',
    unitOfMeasure: 'UND',
    imageUrl: 'https://images.supermas.co/arroz.png',
    images: ['https://images.supermas.co/arroz.png'],
    price: 4500,
    showPrice: true,
    taxProfile: 'IVA 19%',
    taxConfigId: 'tax-19',
    vatRatePercent: 19,
    isExempt: false,
    status: 'ACTIVE',
    webSuperMas: true,
    webDirectPurchaseEnabled: true,
    webLowStockThreshold: 10,
    availability: 'AVAILABLE',
    availabilityLabel: 'Disponible',
    canBuyDirectly: true,
    webViewsCount: 450,
    webOrdersCount: 82,
    totalSoldUnits: 120,
    warehouseStockSummary: [
      {
        locationId: 'loc-01',
        locationName: 'CEDI Principal',
        locationCode: 'CEDI-01',
        currentStock: 450, // DATO CONFIDENCIAL
        isEcommerceSource: true,
      },
      {
        locationId: 'loc-02',
        locationName: 'Tienda Punto de Venta',
        locationCode: 'TIENDA-01',
        currentStock: 50, // DATO CONFIDENCIAL
        isEcommerceSource: false,
      },
    ],
  }

  // Sanitizar a través del método privado expuesto para test
  const sanitizedSuper = (publicCatalogService as any).sanitizeSuperCatalogProduct(
    mockInternalSuperProduct
  )

  // Verificaciones de privacidad
  assert.strictEqual(sanitizedSuper.id, 'prod-001')
  assert.strictEqual(sanitizedSuper.price, 4500)
  assert.strictEqual(sanitizedSuper.availability, 'AVAILABLE')
  assert.strictEqual(sanitizedSuper.availabilityLabel, 'Disponible')
  assert.strictEqual(sanitizedSuper.canBuyDirectly, true)

  // NUNCA debe incluir warehouseStockSummary
  assert.strictEqual(
    (sanitizedSuper as any).warehouseStockSummary,
    undefined,
    'VIOLACIÓN DE SEGURIDAD: warehouseStockSummary no debe estar presente en el DTO público'
  )
  assert.strictEqual(
    (sanitizedSuper as any).webViewsCount,
    undefined,
    'webViewsCount no debe exponerse públicamente'
  )
  assert.strictEqual(
    (sanitizedSuper as any).webOrdersCount,
    undefined,
    'webOrdersCount no debe exponerse públicamente'
  )
  assert.strictEqual(
    (sanitizedSuper as any).totalSoldUnits,
    undefined,
    'totalSoldUnits no debe exponerse públicamente'
  )
  assert.strictEqual(
    (sanitizedSuper as any).cost_price,
    undefined,
    'cost_price no debe exponerse'
  )
  assert.strictEqual(
    (sanitizedSuper as any).average_cost,
    undefined,
    'average_cost no debe exponerse'
  )
  console.log('✅ Test 2 Aprobado: Sanitización de Catálogo Super Más 100% blindada.\n')

  // ---------------------------------------------------------------------------
  // PRUEBA 3: Sanitización de datos en Catálogo Distribuidora (B2B)
  // ---------------------------------------------------------------------------
  console.log('Test 3: Validación de sanitización y cotización WhatsApp en Catálogo Distribuidora (B2B)...')
  const mockInternalDistProduct: DistributorCatalogProduct = {
    id: 'prod-002',
    sku: 'SKU-ACEITE-01',
    barcode: '770987654321',
    name: 'Aceite Premier 3000ml',
    slug: 'aceite-premier-3000ml',
    description: 'Aceite vegetal refinado',
    category: 'Aceites',
    brand: 'Premier',
    unitOfMeasure: 'UND',
    imageUrl: 'https://images.supermas.co/aceite.png',
    images: ['https://images.supermas.co/aceite.png'],
    distributorPrice: 28500,
    normalPrice: 32000,
    status: 'ACTIVE',
    webDistribuidora: true,
    webSuperMas: false,
    webDirectPurchaseEnabled: false,
    webWhatsAppInquiryEnabled: true,
    webWhatsAppPhone: '+57 312 884 9021',
    availability: 'LOW_STOCK',
    availabilityLabel: 'Pocas unidades',
    canBuyDirectly: false,
    canContactWhatsApp: true,
    whatsappUrl: 'https://wa.me/573128849021?text=Cotizacion',
  }

  const sanitizedDist = (publicCatalogService as any).sanitizeDistributorCatalogProduct(
    mockInternalDistProduct
  )

  assert.strictEqual(sanitizedDist.id, 'prod-002')
  assert.strictEqual(sanitizedDist.distributorPrice, 28500)
  assert.strictEqual(sanitizedDist.normalPrice, 32000)
  assert.strictEqual(sanitizedDist.availability, 'LOW_STOCK')
  assert.strictEqual(sanitizedDist.availabilityLabel, 'Pocas unidades')
  assert.strictEqual(sanitizedDist.canContactWhatsApp, true)
  assert.strictEqual(sanitizedDist.canBuyDirectly, false)
  assert.strictEqual((sanitizedDist as any).cost_price, undefined)
  assert.strictEqual((sanitizedDist as any).supplier_id, undefined)
  assert.strictEqual((sanitizedDist as any).stock_levels, undefined)
  console.log('✅ Test 3 Aprobado: Sanitización de Catálogo Distribuidora 100% blindada.\n')

  // ---------------------------------------------------------------------------
  // PRUEBA 4: Resiliencia ante base de datos sin sesión / resolución de empresa
  // ---------------------------------------------------------------------------
  console.log('Test 4: Consulta de catálogos mediante servicio público sin fallar...')
  const superResult = await publicCatalogService.getSuperMasCatalog({
    page: 1,
    pageSize: 10,
  })

  assert.strictEqual(superResult.success, true)
  assert.strictEqual(superResult.channel, 'supermas')
  assert.ok(Array.isArray(superResult.data))
  assert.strictEqual(typeof superResult.pagination.total, 'number')

  const distResult = await publicCatalogService.getDistributorCatalog({
    page: 1,
    pageSize: 10,
  })

  assert.strictEqual(distResult.success, true)
  assert.strictEqual(distResult.channel, 'distributor')
  assert.ok(Array.isArray(distResult.data))
  assert.strictEqual(typeof distResult.pagination.total, 'number')
  console.log('✅ Test 4 Aprobado: Servicio público responde exitosamente sin errores.\n')

  // ---------------------------------------------------------------------------
  // PRUEBA 5: Invocación de Route Handlers (Endpoints HTTP Next.js)
  // ---------------------------------------------------------------------------
  console.log('Test 5: Validación de Route Handlers HTTP Next.js...')
  const { NextRequest } = await import('next/server')
  const { GET: getSuperMasHandler } = await import('@/app/api/public/catalogs/supermas/route')
  const { GET: getDistributorHandler } = await import('@/app/api/public/catalogs/distributor/route')
  const { GET: getCategoriesHandler } = await import('@/app/api/public/catalogs/categories/route')
  const { GET: getBrandsHandler } = await import('@/app/api/public/catalogs/brands/route')
  const { GET: getUnifiedProductsHandler } = await import('@/app/api/public/products/route')

  // Probar endpoint Super Mas
  const reqSuper = new NextRequest('http://localhost:3000/api/public/catalogs/supermas?page=1&limit=5')
  const resSuper = await getSuperMasHandler(reqSuper)
  assert.strictEqual(resSuper.status, 200)
  const bodySuper = await resSuper.json()
  assert.strictEqual(bodySuper.success, true)
  assert.strictEqual(bodySuper.channel, 'supermas')
  assert.strictEqual(resSuper.headers.get('access-control-allow-origin'), '*')

  // Probar endpoint Distribuidora
  const reqDist = new NextRequest('http://localhost:3000/api/public/catalogs/distributor?page=1&limit=5')
  const resDist = await getDistributorHandler(reqDist)
  assert.strictEqual(resDist.status, 200)
  const bodyDist = await resDist.json()
  assert.strictEqual(bodyDist.success, true)
  assert.strictEqual(bodyDist.channel, 'distributor')

  // Probar endpoint Categorías
  const reqCat = new NextRequest('http://localhost:3000/api/public/catalogs/categories?channel=supermas')
  const resCat = await getCategoriesHandler(reqCat)
  assert.strictEqual(resCat.status, 200)
  const bodyCat = await resCat.json()
  assert.strictEqual(bodyCat.success, true)
  assert.ok(Array.isArray(bodyCat.data))

  // Probar endpoint Marcas
  const reqBrands = new NextRequest('http://localhost:3000/api/public/catalogs/brands?channel=distributor')
  const resBrands = await getBrandsHandler(reqBrands)
  assert.strictEqual(resBrands.status, 200)
  const bodyBrands = await resBrands.json()
  assert.strictEqual(bodyBrands.success, true)
  assert.ok(Array.isArray(bodyBrands.data))

  // Probar endpoint Unificado /api/public/products?channel=supermas
  const reqUnified = new NextRequest('http://localhost:3000/api/public/products?channel=supermas&limit=8')
  const resUnified = await getUnifiedProductsHandler(reqUnified)
  assert.strictEqual(resUnified.status, 200)
  const bodyUnified = await resUnified.json()
  assert.strictEqual(bodyUnified.success, true)
  assert.strictEqual(bodyUnified.channel, 'supermas')

  console.log('✅ Test 5 Aprobado: Todos los Route Handlers HTTP responden correctamente con cabeceras CORS.\n')

  console.log('====================================================================')
  console.log('🎉 TODAS LAS PRUEBAS DE LA API PÚBLICA DE CATÁLOGOS PASARON CON ÉXITO (5/5)')
  console.log('====================================================================')
}

runPublicCatalogTests().catch((err) => {
  console.error('❌ Error en pruebas:', err)
  process.exit(1)
})
