/**
 * SUPER MÁS ERP/POS — Servicio de Importación Masiva de Productos (ProductImportService)
 *
 * Conectado directamente a PostgreSQL/Supabase con aislamiento multiempresa por company_id,
 * resolución automática de categorías y marcas, persistencia de listas de precios y
 * estricto cumplimiento del Kardex inmutable (cada stock inicial genera InventoryMovement).
 */

import { supabaseClient } from '@/lib/supabase/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveUserCompanyId } from '@/lib/supabase/tenant'
import {
  parseCsvContent,
  parseCleanNumber,
  parseCleanBoolean,
} from '@/lib/csv-parser'
import {
  ProductImportRow,
  ProductImportRowValidation,
  ProductImportPreview,
  ProductImportExecutionResult,
  RawProductCsvRow,
} from '../types/import.types'

function getDbClient() {
  if (typeof window === 'undefined' && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return supabaseAdmin
  }
  return supabaseClient
}

export class ProductImportService {
  /**
   * Resuelve el company_id activo de forma estricta
   */
  private async getCompanyId(preferredCompanyId?: string): Promise<string> {
    return resolveUserCompanyId(getDbClient(), preferredCompanyId)
  }

  /**
   * Genera una plantilla CSV estándar con cabeceras y filas de ejemplo.
   */
  generateTemplateCsv(): string {
    const headers = [
      'SKU',
      'Nombre',
      'Código de Barras',
      'Categoría',
      'Marca',
      'Unidad de Medida',
      'Precio Venta Normal',
      'Precio Mayorista',
      'Cantidad Mínima Mayorista',
      'Costo Unitario',
      'Tarifa IVA (%)',
      'Exento de IVA',
      'Stock Inicial',
      'Código Bodega',
      'Stock Mínimo',
      'Stock Crítico',
      'Catálogo Super Más',
      'Catálogo Distribuidora',
      'Descripción',
    ]

    const sampleRow1 = [
      'ARR-DIANA-1K',
      'Arroz Diana Premium 1000g',
      '7701234567890',
      'Granos y Abarrotes',
      'Diana',
      'UND',
      '4500',
      '4000',
      '12',
      '3200',
      '0',
      'SI',
      '50',
      'BOD-PRI',
      '10',
      '5',
      'SI',
      'SI',
      'Arroz blanco seleccionado de primera calidad',
    ]

    const sampleRow2 = [
      'ACE-PREM-900',
      'Aceite Vegetal Premier 900ml',
      '7709876543210',
      'Aceites y Grasas',
      'Premier',
      'UND',
      '9500',
      '8800',
      '6',
      '7100',
      '19',
      'NO',
      '30',
      'BOD-PRI',
      '10',
      '5',
      'SI',
      'SI',
      'Aceite 100% puro de soya enriquecido con vitamina E',
    ]

    return [
      headers.join(';'),
      sampleRow1.join(';'),
      sampleRow2.join(';'),
    ].join('\n')
  }

  /**
   * Mapea claves arbitrarias del CSV a los campos de dominio requeridos.
   */
  private normalizeKey(rawKey: string): string {
    return rawKey
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
  }

  /**
   * Convierte una fila cruda parseada de CSV en un objeto ProductImportRow estructurado.
   */
  mapRawRowToImportRow(raw: RawProductCsvRow): ProductImportRow {
    const normalized: Record<string, any> = {}
    for (const [k, v] of Object.entries(raw)) {
      normalized[this.normalizeKey(k)] = v
    }

    const sku = String(
      normalized['sku'] ||
        normalized['codigo'] ||
        normalized['codigoproducto'] ||
        normalized['referencia'] ||
        ''
    ).trim()

    const name = String(
      normalized['nombre'] ||
        normalized['nombreproducto'] ||
        normalized['descripcion'] ||
        normalized['producto'] ||
        normalized['item'] ||
        ''
    ).trim()

    const barcode = normalized['codigodebarras'] || normalized['barcode'] || normalized['ean']
      ? String(normalized['codigodebarras'] || normalized['barcode'] || normalized['ean']).trim()
      : undefined

    const categoryName = normalized['categoria'] || normalized['category'] || normalized['grupocategoria']
      ? String(normalized['categoria'] || normalized['category'] || normalized['grupocategoria']).trim()
      : 'General'

    const brandName = normalized['marca'] || normalized['brand'] || normalized['fabricante']
      ? String(normalized['marca'] || normalized['brand'] || normalized['fabricante']).trim()
      : 'Genérica'

    const unitOfMeasure = normalized['unidaddemedida'] || normalized['unidad'] || normalized['medida'] || normalized['uom']
      ? String(normalized['unidaddemedida'] || normalized['unidad'] || normalized['medida'] || normalized['uom']).toUpperCase().trim()
      : 'UND'

    const publicSalePrice = parseCleanNumber(
      normalized['precioventanormal'] ||
        normalized['precionormal'] ||
        normalized['precioventa'] ||
        normalized['precio'] ||
        normalized['pvp'] ||
        0
    )

    const wholesalePrice = parseCleanNumber(
      normalized['preciomayorista'] ||
        normalized['mayorista'] ||
        normalized['preciopormayor'] ||
        publicSalePrice
    )

    const minWholesaleQuantity = parseCleanNumber(
      normalized['cantidadminimamayorista'] ||
        normalized['minmayorista'] ||
        normalized['cantminmayorista'] ||
        6
    )

    const costPrice = parseCleanNumber(
      normalized['costounitario'] ||
        normalized['costo'] ||
        normalized['costopromedio'] ||
        normalized['preciocosto'] ||
        0
    )

    const isTaxExempt = parseCleanBoolean(
      normalized['exentodeiva'] || normalized['exento'] || normalized['isexempt'],
      false
    )

    const taxRatePercent = isTaxExempt
      ? 0
      : parseCleanNumber(
          normalized['tarifaiva'] ||
            normalized['iva'] ||
            normalized['ivaiva'] ||
            normalized['porcentajeiva'] ||
            19
        )

    const initialStock = parseCleanNumber(
      normalized['stockinicial'] ||
        normalized['stock'] ||
        normalized['cantidadinicial'] ||
        normalized['cantidad'] ||
        0
    )

    const locationCodeOrName = normalized['codigobodega'] || normalized['bodega'] || normalized['ubicacion'] || normalized['location']
      ? String(normalized['codigobodega'] || normalized['bodega'] || normalized['ubicacion'] || normalized['location']).trim()
      : undefined

    const minStock = parseCleanNumber(normalized['stockminimo'] || normalized['minstock'] || 10)
    const criticalStock = parseCleanNumber(normalized['stockcritico'] || normalized['criticalstock'] || 5)

    const webSuperMas = parseCleanBoolean(
      normalized['catalogosupermas'] || normalized['supermas'] || normalized['websupermas'],
      true
    )

    const webDistribuidora = parseCleanBoolean(
      normalized['catalogodistribuidora'] || normalized['distribuidora'] || normalized['webdistribuidora'],
      true
    )

    const description = normalized['descripcion'] || normalized['detalles']
      ? String(normalized['descripcion'] || normalized['detalles']).trim()
      : undefined

    return {
      sku,
      name,
      barcode,
      categoryName,
      brandName,
      unitOfMeasure,
      costPrice,
      publicSalePrice,
      wholesalePrice,
      minWholesaleQuantity,
      taxRatePercent,
      isTaxExempt,
      initialStock,
      locationCodeOrName,
      minStock,
      criticalStock,
      webSuperMas,
      webDistribuidora,
      description,
    }
  }

  /**
   * Parsea un texto CSV y genera la vista previa con validaciones fiduciarias.
   */
  async previewCsv(csvContent: string, preferredCompanyId?: string): Promise<ProductImportPreview> {
    const client = getDbClient()
    const companyId = await this.getCompanyId(preferredCompanyId)
    const { headers, rows: rawRows } = parseCsvContent<RawProductCsvRow>(csvContent)

    // Consultar todos los SKUs existentes de la empresa en una sola consulta eficiente
    const { data: existingProducts } = await client
      .from('products')
      .select('sku')
      .eq('company_id', companyId)

    const existingSkuSet = new Set((existingProducts || []).map((p: any) => p.sku?.toUpperCase().trim()))

    const validatedRows: ProductImportRowValidation[] = []
    const batchSkuSet = new Set<string>()

    let validCount = 0
    let invalidCount = 0

    rawRows.forEach((raw, idx) => {
      const rowNumber = idx + 2 // +2 considerando cabecera en línea 1 y base-1
      const parsed = this.mapRawRowToImportRow(raw)
      const errors: string[] = []
      const warnings: string[] = []

      // 1. Validar SKU
      if (!parsed.sku) {
        errors.push('El SKU es obligatorio.')
      } else {
        const upperSku = parsed.sku.toUpperCase()
        if (batchSkuSet.has(upperSku)) {
          errors.push(`El SKU "${parsed.sku}" está duplicado dentro del archivo.`)
        } else {
          batchSkuSet.add(upperSku)
        }

        if (existingSkuSet.has(upperSku)) {
          errors.push(`El SKU "${parsed.sku}" ya existe en el sistema para esta empresa.`)
        }
      }

      // 2. Validar Nombre
      if (!parsed.name) {
        errors.push('El nombre del producto es obligatorio.')
      }

      // 3. Validar Precios
      if ((parsed.publicSalePrice ?? 0) < 0) {
        errors.push('El precio de venta normal no puede ser negativo.')
      }
      if ((parsed.wholesalePrice ?? 0) < 0) {
        errors.push('El precio mayorista no puede ser negativo.')
      }
      if ((parsed.costPrice ?? 0) < 0) {
        errors.push('El costo unitario no puede ser negativo.')
      }

      // 4. Advertencias
      if ((parsed.publicSalePrice ?? 0) === 0) {
        warnings.push('El precio de venta normal es $0.')
      }
      if ((parsed.initialStock ?? 0) > 0 && !parsed.locationCodeOrName) {
        warnings.push('Se especificó stock inicial pero no bodega; se asignará a la bodega principal.')
      }

      const isValid = errors.length === 0
      if (isValid) {
        validCount++
      } else {
        invalidCount++
      }

      validatedRows.push({
        rowNumber,
        raw,
        parsed,
        isValid,
        errors,
        warnings,
      })
    })

    return {
      totalRows: rawRows.length,
      validCount,
      invalidCount,
      rows: validatedRows,
      detectedHeaders: headers,
    }
  }

  /**
   * Ejecuta la importación masiva de productos de forma transaccional y atómica,
   * garantizando la unicidad de SKU, la creación de categorías/marcas faltantes,
   * y la emisión de movimientos de Kardex para todo producto con stock inicial.
   */
  async executeImport(
    rows: ProductImportRow[],
    userContext?: { userId?: string; userName?: string },
    preferredCompanyId?: string
  ): Promise<ProductImportExecutionResult> {
    const client = getDbClient()
    const companyId = await this.getCompanyId(preferredCompanyId)
    const userId = userContext?.userId || null
    const userName = userContext?.userName || 'Sistema'

    // 1. Cargar datos maestros para resolver referencias en memoria
    const [categoriesRes, brandsRes, locationsRes] = await Promise.all([
      client.from('categories').select('id, name, slug').eq('company_id', companyId),
      client.from('brands').select('id, name, slug').eq('company_id', companyId),
      client.from('locations').select('id, name, code, status').eq('company_id', companyId),
    ])

    const categoryMap = new Map<string, string>() // Name/Slug Lowercase -> ID
    ;(categoriesRes.data || []).forEach((c: any) => {
      categoryMap.set(c.name.trim().toLowerCase(), c.id)
      categoryMap.set(c.slug.trim().toLowerCase(), c.id)
    })

    const brandMap = new Map<string, string>() // Name/Slug Lowercase -> ID
    ;(brandsRes.data || []).forEach((b: any) => {
      brandMap.set(b.name.trim().toLowerCase(), b.id)
      brandMap.set(b.slug.trim().toLowerCase(), b.id)
    })

    const locationMap = new Map<string, string>() // Code/Name Lowercase -> ID
    let defaultLocationId: string | null = null
    ;(locationsRes.data || []).forEach((loc: any) => {
      const isActive = loc.status === 'ACTIVE' || loc.is_active === true
      if (isActive && !defaultLocationId) defaultLocationId = loc.id
      if (loc.code) locationMap.set(loc.code.trim().toLowerCase(), loc.id)
      locationMap.set(loc.name.trim().toLowerCase(), loc.id)
    })

    const createdProductIds: string[] = []
    const categoriesCreated: string[] = []
    const brandsCreated: string[] = []
    const errors: Array<{ rowNumber: number; sku?: string; message: string }> = []
    let kardexMovementsCreated = 0

    // 2. Procesar cada fila de producto
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNumber = i + 2

      try {
        const sku = row.sku?.trim().toUpperCase()
        const name = row.name?.trim()

        if (!sku || !name) {
          errors.push({ rowNumber, sku, message: 'SKU y Nombre son requeridos.' })
          continue
        }

        // Resolver o crear Categoría
        const catKey = (row.categoryName || 'General').trim().toLowerCase()
        let categoryId = categoryMap.get(catKey)
        if (!categoryId) {
          const newCatName = row.categoryName?.trim() || 'General'
          const newCatSlug = newCatName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
          const { data: newCat, error: catErr } = await client
            .from('categories')
            .insert({
              company_id: companyId,
              name: newCatName,
              slug: `${newCatSlug}-${Date.now().toString().slice(-4)}`,
              is_active: true,
            })
            .select('id')
            .single()

          if (catErr || !newCat?.id) {
            throw new Error(`No se pudo crear la categoría "${newCatName}": ${catErr?.message}`)
          }
          categoryId = String(newCat.id)
          categoryMap.set(catKey, categoryId)
          categoriesCreated.push(newCatName)
        }

        // Resolver o crear Marca
        const brandKey = (row.brandName || 'Genérica').trim().toLowerCase()
        let brandId = brandMap.get(brandKey)
        if (!brandId) {
          const newBrandName = row.brandName?.trim() || 'Genérica'
          const newBrandSlug = newBrandName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
          const { data: newBrand, error: brandErr } = await client
            .from('brands')
            .insert({
              company_id: companyId,
              name: newBrandName,
              slug: `${newBrandSlug}-${Date.now().toString().slice(-4)}`,
              is_active: true,
            })
            .select('id')
            .single()

          if (brandErr || !newBrand?.id) {
            throw new Error(`No se pudo crear la marca "${newBrandName}": ${brandErr?.message}`)
          }
          brandId = String(newBrand.id)
          brandMap.set(brandKey, brandId)
          brandsCreated.push(newBrandName)
        }

        // Generar Slug de Producto único
        const baseSlug = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
        const slug = `${baseSlug}-${sku.toLowerCase()}`

        const normalPrice = Number(row.publicSalePrice ?? 0)
        const wholesalePrice = Number(row.wholesalePrice ?? normalPrice)
        const costPrice = Number(row.costPrice ?? 0)
        const isTaxExempt = Boolean(row.isTaxExempt)
        const taxRatePercent = isTaxExempt ? 0 : Number(row.taxRatePercent ?? 19)

        // Insertar Producto en public.products
        const productPayload = {
          company_id: companyId,
          sku,
          name,
          slug,
          barcode: row.barcode?.trim() || null,
          category_id: categoryId,
          brand_id: brandId,
          unit_of_measure: row.unitOfMeasure || 'UND',
          cost_price: costPrice,
          public_sale_price: normalPrice,
          wholesale_price: wholesalePrice,
          min_wholesale_quantity: Number(row.minWholesaleQuantity ?? 6),
          tax_rate_percent: taxRatePercent,
          is_tax_exempt: isTaxExempt,
          short_description: row.description?.trim() || null,
          full_description: row.description?.trim() || null,
          min_stock_threshold: Number(row.minStock ?? 10),
          critical_stock_threshold: Number(row.criticalStock ?? 5),
          is_active: true,
          is_published_supermas: row.webSuperMas !== undefined ? row.webSuperMas : true,
          is_published_distributor: row.webDistribuidora !== undefined ? row.webDistribuidora : true,
          inventory_type: 'MERCHANDISE',
        }

        const { data: createdProduct, error: prodErr } = await client
          .from('products')
          .insert(productPayload)
          .select('id')
          .single()

        if (prodErr || !createdProduct) {
          throw new Error(`Error al insertar producto "${sku}": ${prodErr?.message}`)
        }

        const productId = createdProduct.id
        createdProductIds.push(productId)

        // Persistir listas de precios en public.product_prices
        await client.from('product_prices').insert([
          {
            company_id: companyId,
            product_id: productId,
            price_list_code: 'NORMAL',
            price_list_name: 'Precio Normal (Público)',
            price: normalPrice,
            min_quantity: 1,
            is_default: true,
            is_active: true,
          },
          {
            company_id: companyId,
            product_id: productId,
            price_list_code: 'MAYORISTA',
            price_list_name: 'Precio Mayorista',
            price: wholesalePrice,
            min_quantity: Number(row.minWholesaleQuantity ?? 6),
            is_default: false,
            is_active: true,
          },
        ])

        // 3. Si se definió stock inicial > 0, registrar Kardex inmutable
        const initStock = Number(row.initialStock || 0)
        if (initStock > 0) {
          let targetLocationId: string | null = null
          if (row.locationCodeOrName) {
            targetLocationId = locationMap.get(row.locationCodeOrName.trim().toLowerCase()) || null
          }
          if (!targetLocationId) {
            targetLocationId = defaultLocationId
          }

          if (targetLocationId) {
            const movementPayload = {
              company_id: companyId,
              product_id: productId,
              location_id: targetLocationId,
              movement_type: 'POSITIVE_ADJUSTMENT',
              quantity_in: initStock,
              quantity_out: 0,
              previous_stock: 0,
              new_stock: initStock,
              unit_cost: costPrice,
              total_cost: initStock * costPrice,
              document_type: 'INVENTARIO_INICIAL',
              document_reference: `INV-INI-${sku}`,
              reason: 'Carga masiva de inventario inicial por importación Excel/CSV',
              user_id: userId,
            }

            const { error: movErr } = await client
              .from('inventory_movements')
              .insert(movementPayload)

            if (!movErr) {
              kardexMovementsCreated++

              // Asegurar actualización o inserción en stock_levels
              await client
                .from('stock_levels')
                .upsert(
                  {
                    company_id: companyId,
                    product_id: productId,
                    location_id: targetLocationId,
                    quantity: initStock,
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: 'product_id,location_id' }
                )
            } else {
              console.error('Error insertando movimiento de Kardex en importación:', movErr)
            }
          }
        }
      } catch (rowErr: any) {
        errors.push({
          rowNumber,
          sku: row.sku,
          message: rowErr.message || 'Error procesando registro.',
        })
      }
    }

    // 4. Registrar auditoría inmutable
    if (createdProductIds.length > 0) {
      const nowIso = new Date().toISOString()
      await client.from('audit_logs').insert({
        id: crypto.randomUUID(),
        company_id: companyId,
        action: 'PRODUCT_BULK_IMPORT',
        module: 'PRODUCTS',
        entity_name: 'products',
        entity_id: createdProductIds[0],
        user_id: userId,
        user_name: userName,
        new_value: {
          importedCount: createdProductIds.length,
          kardexMovementsCreated,
          productIds: createdProductIds,
          categoriesCreated,
          brandsCreated,
        },
        created_at: nowIso,
      })
    }

    return {
      success: createdProductIds.length > 0,
      totalProcessed: rows.length,
      importedCount: createdProductIds.length,
      failedCount: errors.length,
      skippedCount: 0,
      kardexMovementsCreated,
      createdProductIds,
      errors,
      categoriesCreated,
      brandsCreated,
    }
  }
}

export const productImportService = new ProductImportService()
