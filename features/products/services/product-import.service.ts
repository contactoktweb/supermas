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
import { getSessionUserId } from '@/lib/supabase/session-context'
import {
  parseCsvContent,
  parseColombianNumber,
  parseCleanBoolean,
} from '@/lib/csv-parser'
import {
  ProductImportRow,
  ProductImportRowValidation,
  ProductImportPreview,
  ProductImportExecutionResult,
  ProductImportAction,
  ProductImportIvaTreatment,
  RawProductCsvRow,
} from '../types/import.types'
import type { PriceChangeInput, PriceChangeSubmissionResult, UserPermissionContext } from '../types'
import { productRepository } from '../repositories/product.repository'
import { formatImportIva, formatImportNumber } from '../utils/import-format'
import { getRuntimeSettings } from '@/features/settings/services/runtime-settings'

const NORMAL_PRICE_LIST = { code: 'NORMAL', name: 'Precio Normal (Público)' }
const WHOLESALE_PRICE_LIST = { code: 'MAYORISTA', name: 'Precio Mayorista' }
const IMPORT_PRICE_REASON = 'Actualización por importación de plantilla'
const IVA_RATES_ALLOWED = [5, 19]
const EXISTING_PRODUCTS_PAGE_SIZE = 1000

const EXISTING_PRODUCT_COLUMNS = `id, sku, name, barcode, unit_of_measure, cost_price, public_sale_price, wholesale_price,
  min_wholesale_quantity, tax_rate_percent, iva_treatment, min_stock_threshold, critical_stock_threshold,
  is_published_supermas, is_published_distributor, short_description, categories ( name ), brands ( name )`

interface ReadRowResult {
  row: ProductImportRow
  errors: string[]
  warnings: string[]
}

const nameKey = (value: string) => value.trim().toLowerCase()

function getDbClient() {
  if (typeof window === 'undefined' && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return supabaseAdmin
  }
  return supabaseClient
}

/** Contexto de quien importa; sin permisos explícitos se asume acceso completo, como en ProductService. */
type ImportUserContext = Partial<Pick<UserPermissionContext, 'userId' | 'userName' | 'userRole' | 'permissions'>>

/** Qué puede ver y cambiar del costo quien importa (cost.read y costs.manage). */
function resolveCostAccess(ctx?: ImportUserContext): { canReadCost: boolean; canManageCosts: boolean } {
  const permissions = ctx?.permissions
  if (!permissions || ctx?.userRole === 'ADMIN' || permissions.includes('*')) {
    return { canReadCost: true, canManageCosts: true }
  }
  return { canReadCost: permissions.includes('cost.read'), canManageCosts: permissions.includes('costs.manage') }
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
      'Costo Unitario con IVA',
      'Tarifa IVA (%)',
      'Tipo de IVA',
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
      '3200,50',
      '0',
      'EXCLUIDO',
      '50',
      '',
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
      '8800,75',
      '6',
      '7100',
      '19',
      'GRAVADO',
      '30',
      '',
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
    return this.readRow(raw).row
  }

  /** Lee la fila y reporta las celdas que no se pueden interpretar, sin convertirlas en otra cifra. */
  private readRow(raw: RawProductCsvRow): ReadRowResult {
    const normalized: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(raw)) {
      normalized[this.normalizeKey(k)] = v
    }

    const errors: string[] = []
    const warnings: string[] = []

    const pick = (keys: string[]): string => {
      for (const key of keys) {
        const value = String(normalized[key] ?? '').trim()
        if (value) return value
      }
      return ''
    }

    const readNumber = (label: string, keys: string[], options: { integer?: boolean; money?: boolean } = {}): number | undefined => {
      const cell = pick(keys)
      if (!cell) return undefined
      const parsed = parseColombianNumber(cell)
      if (!parsed.ok) {
        errors.push(`${label}: "${cell}" no es un número válido. Use coma para los decimales, por ejemplo 3200,50.`)
        return undefined
      }
      if (parsed.value < 0) {
        errors.push(`${label}: no puede ser negativo.`)
        return undefined
      }
      if (options.money && Math.round(parsed.value * 100) / 100 !== parsed.value) {
        errors.push(`${label}: "${cell}" tiene más de 2 decimales.`)
        return undefined
      }
      if (options.integer && !Number.isInteger(parsed.value)) {
        errors.push(`${label}: debe ser un número entero, sin decimales.`)
        return undefined
      }
      if (parsed.ambiguous) {
        warnings.push(`${label}: "${cell}" se leyó como ${formatImportNumber(parsed.value)} porque la coma es decimal. Si eran miles, escríbalo sin separador.`)
      }
      return parsed.value
    }

    const sku = pick(['sku', 'codigo', 'codigoproducto', 'referencia'])
    const explicitName = pick(['nombre', 'nombreproducto', 'producto', 'item'])
    const barcode = pick(['codigodebarras', 'barcode', 'ean'])
    if (/e\+?\d+$/i.test(barcode)) {
      errors.push(`Código de barras: "${barcode}" quedó en notación científica. En Excel, dé formato de texto o número sin decimales a esa columna.`)
    }
    const categoryName = pick(['categoria', 'category', 'grupocategoria'])
    const brandName = pick(['marca', 'brand', 'fabricante'])
    const unitOfMeasure = pick(['unidaddemedida', 'unidad', 'medida', 'uom']).toUpperCase()
    const locationCodeOrName = pick(['codigobodega', 'bodega', 'ubicacion', 'location'])
    const description = pick(['descripcion', 'detalles'])
    // Sin columna de nombre, un producto nuevo usa la descripción; en una actualización no renombra.
    const name = explicitName || description

    const publicSalePrice = readNumber('Precio de venta', ['precioventanormal', 'precionormal', 'precioventa', 'precio', 'pvp'], { money: true })
    const wholesalePrice = readNumber('Precio mayorista', ['preciomayorista', 'mayorista', 'preciopormayor'], { money: true })
    const minWholesaleQuantity = readNumber('Cantidad mínima mayorista', ['cantidadminimamayorista', 'minmayorista', 'cantminmayorista'], { integer: true })
    if (minWholesaleQuantity !== undefined && minWholesaleQuantity < 1) {
      errors.push('Cantidad mínima mayorista: debe ser 1 o más.')
    }
    const costPrice = readNumber('Costo unitario con IVA', ['costounitarioconiva', 'costoconiva', 'costounitario', 'costo', 'costopromedio', 'preciocosto'], { money: true })
    const initialStock = readNumber('Stock inicial', ['stockinicial', 'stock', 'cantidadinicial', 'cantidad'])
    const minStock = readNumber('Stock mínimo', ['stockminimo', 'minstock'], { integer: true })
    const criticalStock = readNumber('Stock crítico', ['stockcritico', 'criticalstock'], { integer: true })
    const iva = this.readIva(
      pick(['tipodeiva', 'tipoiva', 'tratamientoiva', 'clasificacioniva']),
      pick(['exentodeiva', 'exento', 'isexempt']),
      readNumber('Tarifa de IVA', ['tarifaiva', 'iva', 'ivaiva', 'porcentajeiva']),
      errors
    )

    const superMasCell = pick(['catalogosupermas', 'supermas', 'websupermas'])
    const distributorCell = pick(['catalogodistribuidora', 'distribuidora', 'webdistribuidora'])

    return {
      errors,
      warnings,
      row: {
        sku,
        name,
        barcode: barcode || undefined,
        categoryName: categoryName || 'General',
        brandName: brandName || 'Genérica',
        unitOfMeasure: unitOfMeasure || 'UND',
        costPrice: costPrice ?? 0,
        publicSalePrice: publicSalePrice ?? 0,
        wholesalePrice: wholesalePrice ?? publicSalePrice ?? 0,
        minWholesaleQuantity: minWholesaleQuantity ?? 6,
        taxRatePercent: iva.ratePercent,
        isTaxExempt: iva.treatment === 'EXENTO' || iva.treatment === 'EXCLUIDO',
        ivaTreatment: iva.treatment,
        initialStock: initialStock ?? 0,
        locationCodeOrName: locationCodeOrName || undefined,
        minStock,
        criticalStock,
        webSuperMas: parseCleanBoolean(superMasCell || undefined, true),
        webDistribuidora: parseCleanBoolean(distributorCell || undefined, true),
        description: description || undefined,
        provided: {
          name: Boolean(explicitName),
          barcode: Boolean(barcode),
          categoryName: Boolean(categoryName),
          brandName: Boolean(brandName),
          unitOfMeasure: Boolean(unitOfMeasure),
          costPrice: costPrice !== undefined,
          publicSalePrice: publicSalePrice !== undefined,
          wholesalePrice: wholesalePrice !== undefined,
          minWholesaleQuantity: minWholesaleQuantity !== undefined,
          ivaTreatment: iva.provided,
          minStock: minStock !== undefined,
          criticalStock: criticalStock !== undefined,
          webSuperMas: Boolean(superMasCell),
          webDistribuidora: Boolean(distributorCell),
          description: Boolean(description),
        },
      },
    }
  }

  /**
   * Clasifica el IVA de la fila: de él sale la cuenta de inventario del producto (migración 094).
   * Sin ningún dato de IVA, un producto nuevo se toma como gravado al 19 %.
   */
  private readIva(
    typeCell: string,
    exemptCell: string,
    rate: number | undefined,
    errors: string[]
  ): { treatment: ProductImportIvaTreatment | null; ratePercent: number; provided: boolean } {
    const type = typeCell.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
    if (type && !['GRAVADO', 'EXENTO', 'EXCLUIDO'].includes(type)) {
      errors.push(`Tipo de IVA: "${typeCell}" no es válido. Use GRAVADO, EXENTO o EXCLUIDO.`)
      return { treatment: null, ratePercent: 0, provided: false }
    }

    let treatment = (type || null) as ProductImportIvaTreatment | null
    if (!treatment && parseCleanBoolean(exemptCell || undefined, false)) treatment = 'EXENTO'

    if (treatment === 'EXENTO' || treatment === 'EXCLUIDO') {
      if ((rate ?? 0) > 0) errors.push(`Un producto ${treatment} no puede tener tarifa de IVA de ${formatImportNumber(rate!)} %.`)
      return { treatment, ratePercent: 0, provided: true }
    }

    if (rate === 0) {
      errors.push('Tarifa de IVA 0 %: indique en Tipo de IVA si el producto es EXENTO o EXCLUIDO.')
      return { treatment: null, ratePercent: 0, provided: false }
    }
    if (rate !== undefined && !IVA_RATES_ALLOWED.includes(rate)) {
      errors.push(`Tarifa de IVA: ${formatImportNumber(rate)} % no es válida. Use 5 o 19.`)
      return { treatment: null, ratePercent: 0, provided: false }
    }
    return { treatment: 'GRAVADO', ratePercent: rate ?? 19, provided: Boolean(treatment) || rate !== undefined }
  }

  /** Todos los productos de la empresa (la API entrega máximo 1000 filas por consulta). */
  private async loadExistingProducts(client: ReturnType<typeof getDbClient>, companyId: string): Promise<any[]> {
    const products: any[] = []
    for (let from = 0; ; from += EXISTING_PRODUCTS_PAGE_SIZE) {
      const { data, error } = await client
        .from('products')
        .select(EXISTING_PRODUCT_COLUMNS)
        .eq('company_id', companyId)
        .order('id', { ascending: true })
        .range(from, from + EXISTING_PRODUCTS_PAGE_SIZE - 1)
      if (error) throw new Error('No se pudieron consultar los productos actuales.')
      products.push(...(data || []))
      if ((data || []).length < EXISTING_PRODUCTS_PAGE_SIZE) return products
    }
  }

  /** Lista legible de lo que cambiaría en un producto existente. */
  private describeChanges(row: ProductImportRow, existing: any, canReadCost: boolean): string[] {
    const changes: string[] = []
    const provided = row.provided || {}
    const add = (label: string, isProvided: boolean | undefined, from: string | number | boolean | null, to: string | number | boolean | undefined) => {
      if (!isProvided || from === to || to === undefined) return
      const show = (v: string | number | boolean | null) =>
        typeof v === 'number' ? formatImportNumber(v) : typeof v === 'boolean' ? (v ? 'Sí' : 'No') : v || '(vacío)'
      changes.push(`${label}: ${show(from)} → ${show(to)}`)
    }
    const ivaBefore = formatImportIva(existing.iva_treatment, Number(existing.tax_rate_percent))
    const ivaAfter = formatImportIva(row.ivaTreatment, Number(row.taxRatePercent))

    add('Nombre', provided.name, existing.name, row.name)
    add('Código de barras', provided.barcode, existing.barcode, row.barcode)
    add('Categoría', provided.categoryName, existing.categories?.name ?? null, row.categoryName)
    add('Marca', provided.brandName, existing.brands?.name ?? null, row.brandName)
    add('Unidad', provided.unitOfMeasure, existing.unit_of_measure, row.unitOfMeasure)
    if (canReadCost) {
      add('Costo con IVA', provided.costPrice, Number(existing.cost_price), row.costPrice)
    } else if (provided.costPrice) {
      changes.push(`Costo con IVA: se actualiza a ${formatImportNumber(Number(row.costPrice))}`)
    }
    add('Precio de venta', provided.publicSalePrice, Number(existing.public_sale_price), row.publicSalePrice)
    add('Precio mayorista', provided.wholesalePrice, Number(existing.wholesale_price), row.wholesalePrice)
    add('Cantidad mayorista', provided.minWholesaleQuantity, Number(existing.min_wholesale_quantity), row.minWholesaleQuantity)
    add('IVA', provided.ivaTreatment, ivaBefore, ivaAfter)
    add('Stock mínimo', provided.minStock, Number(existing.min_stock_threshold), row.minStock)
    add('Stock crítico', provided.criticalStock, Number(existing.critical_stock_threshold), row.criticalStock)
    add('Catálogo Super Más', provided.webSuperMas, Boolean(existing.is_published_supermas), row.webSuperMas)
    add('Catálogo Distribuidora', provided.webDistribuidora, Boolean(existing.is_published_distributor), row.webDistribuidora)
    add('Descripción', provided.description, existing.short_description, row.description)
    return changes
  }

  /**
   * Parsea un texto CSV y genera la vista previa: qué filas se crean, cuáles actualizan y cuáles tienen error.
   * No escribe nada en la base de datos.
   */
  async previewCsv(
    csvContent: string,
    preferredCompanyId?: string,
    userContext?: ImportUserContext
  ): Promise<ProductImportPreview> {
    const { canReadCost, canManageCosts } = resolveCostAccess(userContext)
    const client = getDbClient()
    const companyId = await this.getCompanyId(preferredCompanyId)
    const { headers, rows: rawRows } = parseCsvContent<RawProductCsvRow>(csvContent)

    const headerKeys = headers.map((h) => this.normalizeKey(h))
    if (!headerKeys.some((k) => ['sku', 'codigo', 'codigoproducto', 'referencia'].includes(k))) {
      throw new Error('El archivo no tiene la columna SKU. Use la plantilla y guárdela como CSV.')
    }

    const [existingProducts, categoriesRes, brandsRes, locationsRes] = await Promise.all([
      this.loadExistingProducts(client, companyId),
      client.from('categories').select('name, slug').eq('company_id', companyId),
      client.from('brands').select('name, slug').eq('company_id', companyId),
      client.from('locations').select('name, code, type, status').eq('company_id', companyId).eq('status', 'ACTIVE').order('code', { ascending: true }),
    ])

    const existingBySku = new Map<string, any>(existingProducts.map((p) => [String(p.sku).toUpperCase().trim(), p]))
    const knownNames = (rows: any[] | null) => new Set((rows || []).flatMap((r) => [nameKey(r.name), nameKey(r.slug || '')]))
    const categories = knownNames(categoriesRes.data)
    const brands = knownNames(brandsRes.data)
    const locations: any[] = locationsRes.data || []
    const defaultLocation = this.defaultLocation(locations)

    const batchSkuSet = new Set<string>()
    const counts: Record<ProductImportAction, number> = { CREATE: 0, UPDATE: 0, UNCHANGED: 0, ERROR: 0 }

    const validatedRows = rawRows.map((raw, idx): ProductImportRowValidation => {
      const rowNumber = idx + 2 // +2 considerando cabecera en línea 1 y base-1
      const { row: parsed, errors, warnings } = this.readRow(raw)
      parsed.rowNumber = rowNumber
      const upperSku = parsed.sku.toUpperCase()
      const existing = existingBySku.get(upperSku)
      if (existing) parsed.existingProductId = existing.id

      if (!parsed.sku) {
        errors.push('El SKU es obligatorio.')
      } else if (batchSkuSet.has(upperSku)) {
        errors.push(`El SKU "${parsed.sku}" está duplicado dentro del archivo.`)
      } else {
        batchSkuSet.add(upperSku)
      }

      const provided = parsed.provided || {}
      if (existing) {
        // Un precio igual al actual no se envía: evita pedir aprobación o permisos de precio sin cambio.
        if (provided.publicSalePrice && Number(existing.public_sale_price) === parsed.publicSalePrice) provided.publicSalePrice = false
        if (provided.wholesalePrice && Number(existing.wholesale_price) === parsed.wholesalePrice) provided.wholesalePrice = false
      }
      if (!existing) {
        if (!parsed.name) errors.push('El nombre del producto es obligatorio.')
        if ((parsed.costPrice ?? 0) <= 0) errors.push('El costo unitario con IVA debe ser mayor a $0.')
      } else if (provided.costPrice && !canManageCosts) {
        // Sin costs.manage el costo de un producto existente no se toca: el resto de la fila sí se aplica.
        provided.costPrice = false
        warnings.push('No tiene permiso para modificar costos: el costo de este producto no se cambia.')
      } else if (provided.costPrice && (parsed.costPrice ?? 0) <= 0) {
        errors.push('El costo unitario con IVA debe ser mayor a $0.')
      }
      if ((provided.publicSalePrice || !existing) && (parsed.publicSalePrice ?? 0) === 0) {
        warnings.push('El precio de venta normal es $0.')
      }

      let locationName: string | undefined
      if ((parsed.initialStock ?? 0) > 0) {
        if (existing) {
          warnings.push('El stock no se cambia en productos existentes: use un ajuste de inventario.')
        } else if (parsed.locationCodeOrName) {
          const key = nameKey(parsed.locationCodeOrName)
          const location = locations.find((l) => nameKey(l.code || '') === key || nameKey(l.name) === key)
          if (location) locationName = location.name
          else errors.push(`La bodega "${parsed.locationCodeOrName}" no existe o está inactiva. Códigos válidos: ${locations.map((l) => l.code).join(', ')}.`)
        } else if (defaultLocation) {
          locationName = defaultLocation.name
          warnings.push(`Sin bodega en la fila: el stock entrará a ${defaultLocation.name}.`)
        } else {
          errors.push('No hay una bodega activa donde cargar el stock inicial.')
        }
      }

      if ((!existing || provided.categoryName) && !categories.has(nameKey(parsed.categoryName || ''))) {
        warnings.push(`Se creará la categoría "${parsed.categoryName}".`)
      }
      if ((!existing || provided.brandName) && !brands.has(nameKey(parsed.brandName || ''))) {
        warnings.push(`Se creará la marca "${parsed.brandName}".`)
      }

      const changes = existing && errors.length === 0 ? this.describeChanges(parsed, existing, canReadCost) : []
      const action: ProductImportAction = errors.length > 0 ? 'ERROR' : !existing ? 'CREATE' : changes.length > 0 ? 'UPDATE' : 'UNCHANGED'
      counts[action]++

      return { rowNumber, raw, parsed, isValid: action === 'CREATE' || action === 'UPDATE', action, changes, locationName, errors, warnings }
    })

    return {
      totalRows: rawRows.length,
      validCount: counts.CREATE + counts.UPDATE,
      createCount: counts.CREATE,
      updateCount: counts.UPDATE,
      unchangedCount: counts.UNCHANGED,
      invalidCount: counts.ERROR,
      rows: validatedRows,
      detectedHeaders: headers,
    }
  }

  /** Bodega para el stock inicial sin bodega indicada: primero una bodega, si no, cualquier sede activa. */
  private defaultLocation<T extends { type?: string }>(activeLocations: T[]): T | undefined {
    return activeLocations.find((l) => l.type === 'WAREHOUSE') || activeLocations[0]
  }

  /**
   * Actualiza un producto existente solo en las columnas que traen valor. Los precios pasan por
   * fn_submit_price_changes (069): se aplican si el usuario es aprobador; si no, quedan pendientes.
   */
  private async applyRowUpdate(
    client: ReturnType<typeof getDbClient>,
    companyId: string,
    row: ProductImportRow,
    refs: { categoryId?: string; brandId?: string }
  ): Promise<PriceChangeSubmissionResult['mode']> {
    const productId = row.existingProductId!
    const provided = row.provided || {}

    const priceChanges: PriceChangeInput[] = []
    if (provided.publicSalePrice) {
      priceChanges.push({ priceListCode: NORMAL_PRICE_LIST.code, priceListName: NORMAL_PRICE_LIST.name, proposedPrice: Number(row.publicSalePrice), minQuantity: 1 })
    }
    if (provided.wholesalePrice) {
      priceChanges.push({ priceListCode: WHOLESALE_PRICE_LIST.code, priceListName: WHOLESALE_PRICE_LIST.name, proposedPrice: Number(row.wholesalePrice), minQuantity: Number(row.minWholesaleQuantity) })
    }

    const patch: Record<string, unknown> = {}
    if (provided.name) patch.name = row.name.trim()
    if (provided.barcode) patch.barcode = row.barcode
    if (refs.categoryId) patch.category_id = refs.categoryId
    if (refs.brandId) patch.brand_id = refs.brandId
    if (provided.unitOfMeasure) patch.unit_of_measure = row.unitOfMeasure
    if (provided.costPrice) patch.cost_price = row.costPrice
    if (provided.minWholesaleQuantity) patch.min_wholesale_quantity = row.minWholesaleQuantity
    if (provided.ivaTreatment) {
      patch.iva_treatment = row.ivaTreatment
      patch.tax_rate_percent = row.taxRatePercent
      patch.is_tax_exempt = row.isTaxExempt
    }
    if (provided.minStock) patch.min_stock_threshold = row.minStock
    if (provided.criticalStock) patch.critical_stock_threshold = row.criticalStock
    if (provided.webSuperMas) patch.is_published_supermas = row.webSuperMas
    if (provided.webDistribuidora) patch.is_published_distributor = row.webDistribuidora
    if (provided.description) {
      patch.short_description = row.description
      patch.full_description = row.description
    }

    if (Object.keys(patch).length > 0) {
      const { data, error } = await client.from('products').update(patch).eq('id', productId).eq('company_id', companyId).select('id')
      if (error) throw new Error(`No se pudo actualizar el producto: ${error.message}`)
      if (!data?.length) throw new Error('No tiene permiso para actualizar este producto.')
    }
    if (provided.minWholesaleQuantity) {
      const { error } = await client
        .from('product_prices')
        .update({ min_quantity: row.minWholesaleQuantity })
        .eq('product_id', productId)
        .eq('price_list_code', WHOLESALE_PRICE_LIST.code)
      if (error) throw new Error(`No se pudo actualizar la cantidad mayorista: ${error.message}`)
    }
    // Los precios van al final: si la ficha falla (código de barras repetido, permisos), no se envían.
    return priceChanges.length
      ? (await productRepository.submitPriceChanges(productId, priceChanges, IMPORT_PRICE_REASON)).mode
      : 'NO_CHANGES'
  }

  /**
   * Ejecuta la importación masiva de productos de forma transaccional y atómica,
   * garantizando la unicidad de SKU, la creación de categorías/marcas faltantes,
   * y la emisión de movimientos de Kardex para todo producto con stock inicial.
   */
  async executeImport(
    rows: ProductImportRow[],
    userContext?: ImportUserContext,
    preferredCompanyId?: string
  ): Promise<ProductImportExecutionResult> {
    const { canManageCosts } = resolveCostAccess(userContext)
    const client = getDbClient()
    const companyId = await this.getCompanyId(preferredCompanyId)
    const userId = userContext?.userId || (await getSessionUserId(client))
    const userName = userContext?.userName || 'Sistema'

    // 1. Cargar datos maestros para resolver referencias en memoria
    const [categoriesRes, brandsRes, locationsRes, runtimeSettings] = await Promise.all([
      client.from('categories').select('id, name, slug').eq('company_id', companyId),
      client.from('brands').select('id, name, slug').eq('company_id', companyId),
      client.from('locations').select('id, name, code, type, status').eq('company_id', companyId).eq('status', 'ACTIVE').order('code', { ascending: true }),
      getRuntimeSettings(client),
    ])
    const stockDefaults = runtimeSettings.inventory

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
    ;(locationsRes.data || []).forEach((loc: any) => {
      if (loc.code) locationMap.set(loc.code.trim().toLowerCase(), loc.id)
      locationMap.set(loc.name.trim().toLowerCase(), loc.id)
    })
    const defaultLocationId: string | null = this.defaultLocation<any>(locationsRes.data || [])?.id ?? null

    const createdProductIds: string[] = []
    const updatedProductIds: string[] = []
    let pricePendingCount = 0
    const categoriesCreated: string[] = []
    const brandsCreated: string[] = []
    const errors: Array<{ rowNumber: number; sku?: string; message: string }> = []
    let kardexMovementsCreated = 0

    // 2. Procesar cada fila de producto
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNumber = row.rowNumber ?? i + 2
      const isUpdate = Boolean(row.existingProductId)
      // Se vuelve a aplicar aquí: la vista previa no es una garantía para quien llama directo al servicio.
      if (isUpdate && !canManageCosts && row.provided?.costPrice) {
        row.provided = { ...row.provided, costPrice: false }
      }

      try {
        const sku = row.sku?.trim().toUpperCase()
        const name = row.name?.trim()

        if (!sku || (!name && !isUpdate)) {
          errors.push({ rowNumber, sku, message: 'SKU y Nombre son requeridos.' })
          continue
        }

        // Resolver o crear Categoría
        const needsCategory = !isUpdate || Boolean(row.provided?.categoryName)
        const catKey = (row.categoryName || 'General').trim().toLowerCase()
        let categoryId = needsCategory ? categoryMap.get(catKey) : undefined
        if (needsCategory && !categoryId) {
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
        const needsBrand = !isUpdate || Boolean(row.provided?.brandName)
        const brandKey = (row.brandName || 'Genérica').trim().toLowerCase()
        let brandId = needsBrand ? brandMap.get(brandKey) : undefined
        if (needsBrand && !brandId) {
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

        if (isUpdate) {
          const priceMode = await this.applyRowUpdate(client, companyId, row, { categoryId, brandId })
          updatedProductIds.push(row.existingProductId!)
          if (priceMode === 'PENDING') pricePendingCount++
          continue
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
        const ivaTreatment = row.ivaTreatment ?? (isTaxExempt ? 'EXENTO' : taxRatePercent > 0 ? 'GRAVADO' : null)

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
          iva_treatment: ivaTreatment,
          short_description: row.description?.trim() || null,
          full_description: row.description?.trim() || null,
          min_stock_threshold: Number(row.minStock ?? stockDefaults.defaultMinStockThreshold),
          critical_stock_threshold: Number(row.criticalStock ?? stockDefaults.criticalLowStockThreshold),
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

            // El trigger trg_after_inventory_movement actualiza stock_levels.
            if (movErr) {
              throw new Error(`Producto "${sku}" creado, pero no se registró su stock inicial: ${movErr.message}`)
            }
            kardexMovementsCreated++
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
    if (createdProductIds.length + updatedProductIds.length > 0) {
      const nowIso = new Date().toISOString()
      await client.from('audit_logs').insert({
        id: crypto.randomUUID(),
        company_id: companyId,
        action: 'PRODUCT_BULK_IMPORT',
        module: 'PRODUCTS',
        entity_name: 'products',
        entity_id: createdProductIds[0] ?? updatedProductIds[0],
        user_id: userId,
        user_name: userName,
        new_value: {
          importedCount: createdProductIds.length,
          updatedCount: updatedProductIds.length,
          kardexMovementsCreated,
          productIds: createdProductIds,
          updatedProductIds,
          categoriesCreated,
          brandsCreated,
        },
        created_at: nowIso,
      })
    }

    return {
      success: createdProductIds.length + updatedProductIds.length > 0,
      totalProcessed: rows.length,
      importedCount: createdProductIds.length + updatedProductIds.length,
      createdCount: createdProductIds.length,
      updatedCount: updatedProductIds.length,
      pricePendingCount,
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
