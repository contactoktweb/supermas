/**
 * SUPER MÁS ERP/POS - Repositorio de Exógena Tributaria
 *
 * Conecta con la capa centralizada lib/supabase/db.ts y mock-db
 * consolidando terceros, compras, ventas, facturas y asientos de contabilidad.
 */

import { db } from '@/lib/supabase/db'
import {
  ExogenaYearNormativa,
  ExogenaFormatConfig,
  ExogenaRecord,
  ExogenaStats,
  ExogenaConciliationItem,
  ExogenaGenerationRecord,
} from '../types'
import { exogenaValidator } from '../validators/exogena.validator'

class ExogenaRepository {
  /**
   * Obtiene la configuración normativa para un año gravable específico.
   */
  async getNormativaByYear(year: number): Promise<ExogenaYearNormativa | null> {
    const list = (db.exogenaNormativa as unknown as ExogenaYearNormativa[]) || []
    const found = list.find((item) => item.year === year)
    if (!found) return null
    return JSON.parse(JSON.stringify(found))
  }

  /**
   * Retorna la lista de años gravables parametrizados en el ERP.
   */
  async getAvailableYears(): Promise<Array<{ year: number; label: string; status: string }>> {
    const list = (db.exogenaNormativa as unknown as ExogenaYearNormativa[]) || []
    return list.map((n) => ({
      year: n.year,
      label: n.label,
      status: n.status,
    }))
  }

  /**
   * Actualiza la parametrización de formatos y obligado para un año gravable.
   */
  async updateNormativa(
    year: number,
    data: {
      obligadoType?: string
      responsibleName?: string
      dueDate?: string
      enabledFormats?: string[]
      grossRevenueThreshold?: number
    },
    user: { id: string; name: string }
  ): Promise<ExogenaYearNormativa> {
    const list = db.exogenaNormativa as any[]
    const index = list.findIndex((item) => item.year === year)
    if (index === -1) {
      throw new Error(`No existe normativa parametrizada para el año ${year}.`)
    }

    const current = list[index]
    const updated = {
      ...current,
      ...(data.obligadoType && { obligadoType: data.obligadoType }),
      ...(data.responsibleName && { responsibleName: data.responsibleName }),
      ...(data.dueDate && { dueDate: data.dueDate }),
      ...(data.grossRevenueThreshold !== undefined && {
        grossRevenueThreshold: data.grossRevenueThreshold,
      }),
      formats: current.formats.map((f: ExogenaFormatConfig) => ({
        ...f,
        isEnabled: data.enabledFormats
          ? data.enabledFormats.includes(f.formatNumber)
          : f.isEnabled,
      })),
    }

    list[index] = updated

    this.logAudit({
      action: 'EXOGENA_CONFIG_UPDATED',
      year,
      userId: user.id,
      userName: user.name,
      details: `Actualizada parametrización normativa para año gravable ${year}. Formatos habilitados: ${(data.enabledFormats || []).join(', ')}.`,
    })

    return JSON.parse(JSON.stringify(updated))
  }

  /**
   * Consolida la información tributaria de terceros cruzando contabilidad, compras y ventas.
   */
  async consolidateRecords(
    year: number,
    formatNumbers?: string[]
  ): Promise<ExogenaRecord[]> {
    const records: ExogenaRecord[] = []
    const customers = db.customers || []
    const suppliers = db.suppliers || []
    const purchases = db.purchases || []
    const sales = db.sales || []
    const accounting = db.accountingEntries || []

    const normativa = await this.getNormativaByYear(year)
    if (!normativa) return []

    const activeFormats = normativa.formats.filter((f) =>
      formatNumbers && formatNumbers.length > 0
        ? formatNumbers.includes(f.formatNumber)
        : f.isEnabled
    )

    // Mapa de terceros para enriquecer direcciones y códigos DANE
    const thirdPartyMap = new Map<string, any>()
    for (const c of customers) {
      thirdPartyMap.set(c.documentNumber?.replace(/\D/g, ''), {
        type: c.documentType || 'NIT',
        doc: c.documentNumber,
        name: c.businessName || c.displayName,
        address: c.address || 'Calle Principal 10',
        city: c.city || 'Cali',
        cityCode: '001',
        department: c.department || 'Valle del Cauca',
        departmentCode: '76',
        country: c.country || 'Colombia',
        countryCode: '169',
      })
    }
    for (const s of suppliers) {
      thirdPartyMap.set((s.documentNumber || s.nit)?.replace(/\D/g, ''), {
        type: s.documentType || 'NIT',
        doc: s.documentNumber || s.nit,
        name: s.businessName || s.supplierName,
        address: s.address || 'Zona Industrial',
        city: s.city || 'Cali',
        cityCode: '001',
        department: s.department || 'Valle del Cauca',
        departmentCode: '76',
        country: s.country || 'Colombia',
        countryCode: '169',
      })
    }

    // Procesar cada formato habilitado
    for (const fmt of activeFormats) {
      if (fmt.formatNumber === '1001') {
        // FORMATO 1001: Pagos o abonos en cuenta a proveedores (Compras)
        for (const pur of purchases) {
          const rawDoc = pur.supplierNit || pur.supplierId || ''
          const cleanDoc = rawDoc.replace(/\D/g, '')
          const third = thirdPartyMap.get(cleanDoc) || {
            type: 'NIT',
            doc: rawDoc,
            name: pur.supplierName,
            address: 'Calle 14 # 85-30, Acopi',
            city: 'Cali',
            cityCode: '001',
            department: 'Valle del Cauca',
            departmentCode: '76',
            country: 'Colombia',
            countryCode: '169',
          }

          const baseAmount = pur.subtotal || pur.total || 0
          const vatAmount = pur.taxTotal || 0

          records.push({
            id: `exo-1001-${pur.id}`,
            year,
            formatNumber: '1001',
            formatVersion: fmt.version,
            conceptCode: '5002', // Compras activos movibles (inventario)
            conceptName: 'Compras de activos movibles para comercio',
            thirdPartyType: third.type,
            documentNumber: third.doc,
            verificationDigit: exogenaValidator.calculateVerificationDigit(cleanDoc),
            businessName: third.name,
            address: third.address,
            city: third.city,
            cityCode: third.cityCode,
            department: third.department,
            departmentCode: third.departmentCode,
            country: third.country,
            countryCode: third.countryCode,
            baseAmount,
            vatAmount,
            withholdingAmount: 0,
            sourceType: 'PURCHASE',
            sourceId: pur.id,
            documentReference: pur.purchaseNumber || pur.invoiceNumber || 'COM',
            validationStatus: 'VALID',
          })
        }
      } else if (fmt.formatNumber === '1005') {
        // FORMATO 1005: IVA Descontable en compras
        for (const pur of purchases) {
          if ((pur.taxTotal || 0) > 0) {
            const rawDoc = pur.supplierNit || ''
            const cleanDoc = rawDoc.replace(/\D/g, '')
            const third = thirdPartyMap.get(cleanDoc) || {
              type: 'NIT',
              doc: rawDoc,
              name: pur.supplierName,
              address: 'Calle 14 # 85-30',
              city: 'Cali',
              cityCode: '001',
              department: 'Valle del Cauca',
              departmentCode: '76',
              country: 'Colombia',
              countryCode: '169',
            }

            records.push({
              id: `exo-1005-${pur.id}`,
              year,
              formatNumber: '1005',
              formatVersion: fmt.version,
              conceptCode: '2401', // IVA descontable compras
              conceptName: 'IVA descontable compras tarifa 19%',
              thirdPartyType: third.type,
              documentNumber: third.doc,
              verificationDigit: exogenaValidator.calculateVerificationDigit(cleanDoc),
              businessName: third.name,
              address: third.address,
              city: third.city,
              cityCode: third.cityCode,
              department: third.department,
              departmentCode: third.departmentCode,
              country: third.country,
              countryCode: third.countryCode,
              baseAmount: pur.taxTotal || 0,
              vatAmount: pur.taxTotal || 0,
              sourceType: 'PURCHASE',
              sourceId: pur.id,
              documentReference: pur.purchaseNumber,
              validationStatus: 'VALID',
            })
          }
        }
      } else if (fmt.formatNumber === '1006') {
        // FORMATO 1006: IVA Generado en ventas
        for (const sale of sales) {
          if ((sale.taxTotal || 0) > 0) {
            const rawDoc = sale.customerDoc || ''
            const cleanDoc = rawDoc.replace(/\D/g, '')
            const third = thirdPartyMap.get(cleanDoc) || {
              type: 'NIT',
              doc: rawDoc,
              name: sale.customerName,
              address: 'Av 6N # 28N-45',
              city: 'Cali',
              cityCode: '001',
              department: 'Valle del Cauca',
              departmentCode: '76',
              country: 'Colombia',
              countryCode: '169',
            }

            records.push({
              id: `exo-1006-${sale.id}`,
              year,
              formatNumber: '1006',
              formatVersion: fmt.version,
              conceptCode: '2405',
              conceptName: 'IVA generado en ventas y servicios 19%',
              thirdPartyType: third.type,
              documentNumber: third.doc,
              verificationDigit: exogenaValidator.calculateVerificationDigit(cleanDoc),
              businessName: third.name,
              address: third.address,
              city: third.city,
              cityCode: third.cityCode,
              department: third.department,
              departmentCode: third.departmentCode,
              country: third.country,
              countryCode: third.countryCode,
              baseAmount: sale.subtotal || 0,
              vatAmount: sale.taxTotal || 0,
              sourceType: 'SALE',
              sourceId: sale.id,
              documentReference: sale.saleNumber,
              validationStatus: 'VALID',
            })
          }
        }
      } else if (fmt.formatNumber === '1007') {
        // FORMATO 1007: Ingresos operacionales recibidos de clientes
        for (const sale of sales) {
          const rawDoc = sale.customerDoc || ''
          const cleanDoc = rawDoc.replace(/\D/g, '')
          const third = thirdPartyMap.get(cleanDoc) || {
            type: 'NIT',
            doc: rawDoc,
            name: sale.customerName,
            address: 'Cra 15 # 45-20',
            city: 'Cali',
            cityCode: '001',
            department: 'Valle del Cauca',
            departmentCode: '76',
            country: 'Colombia',
            countryCode: '169',
          }

          records.push({
            id: `exo-1007-${sale.id}`,
            year,
            formatNumber: '1007',
            formatVersion: fmt.version,
            conceptCode: '4001',
            conceptName: 'Ingresos brutos operacionales por ventas comerciales',
            thirdPartyType: third.type,
            documentNumber: third.doc,
            verificationDigit: exogenaValidator.calculateVerificationDigit(cleanDoc),
            businessName: third.name,
            address: third.address,
            city: third.city,
            cityCode: third.cityCode,
            department: third.department,
            departmentCode: third.departmentCode,
            country: third.country,
            countryCode: third.countryCode,
            baseAmount: sale.subtotal || 0,
            vatAmount: sale.taxTotal || 0,
            sourceType: 'SALE',
            sourceId: sale.id,
            documentReference: sale.saleNumber,
            validationStatus: 'VALID',
          })
        }
      } else if (fmt.formatNumber === '1008') {
        // FORMATO 1008: Cuentas por cobrar a clientes a 31 de diciembre
        for (const cust of customers) {
          if ((cust.currentBalance || 0) > 0) {
            const cleanDoc = cust.documentNumber.replace(/\D/g, '')
            records.push({
              id: `exo-1008-${cust.id}`,
              year,
              formatNumber: '1008',
              formatVersion: fmt.version,
              conceptCode: '1315',
              conceptName: 'Cuentas por cobrar a clientes comerciales',
              thirdPartyType: (cust.documentType as 'NIT' | 'CC' | 'CE' | 'PASAPORTE' | 'EXTRANJERO') || 'NIT',
              documentNumber: cust.documentNumber,
              verificationDigit: exogenaValidator.calculateVerificationDigit(cleanDoc),
              businessName: cust.businessName || cust.displayName,
              address: cust.address || '',
              city: cust.city || 'Cali',
              cityCode: '001',
              department: cust.department || 'Valle del Cauca',
              departmentCode: '76',
              country: cust.country || 'Colombia',
              countryCode: '169',
              baseAmount: cust.currentBalance,
              sourceType: 'CUSTOMER',
              sourceId: cust.id,
              documentReference: `Saldo CxC Cliente ${cust.displayName}`,
              validationStatus: 'VALID',
            })
          }
        }
      } else if (fmt.formatNumber === '1009') {
        // FORMATO 1009: Cuentas por pagar a proveedores a 31 de diciembre
        for (const sup of suppliers) {
          if ((sup.currentBalance || 0) > 0) {
            const rawDoc = sup.documentNumber || sup.nit || ''
            const cleanDoc = rawDoc.replace(/\D/g, '')
            records.push({
              id: `exo-1009-${sup.id}`,
              year,
              formatNumber: '1009',
              formatVersion: fmt.version,
              conceptCode: '2201',
              conceptName: 'Cuentas por pagar a proveedores nacionales',
              thirdPartyType: (sup.documentType as 'NIT' | 'CC' | 'CE' | 'PASAPORTE' | 'EXTRANJERO') || 'NIT',
              documentNumber: rawDoc,
              verificationDigit: exogenaValidator.calculateVerificationDigit(cleanDoc),
              businessName: sup.businessName || sup.supplierName,
              address: sup.address || '',
              city: sup.city || 'Cali',
              cityCode: '001',
              department: sup.department || 'Valle del Cauca',
              departmentCode: '76',
              country: sup.country || 'Colombia',
              countryCode: '169',
              baseAmount: sup.currentBalance,
              sourceType: 'SUPPLIER',
              sourceId: sup.id,
              documentReference: `Saldo CxP Proveedor ${sup.supplierName}`,
              validationStatus: 'VALID',
            })
          }
        }
      }
    }

    return records
  }

  /**
   * Obtiene las estadísticas generales de Exógena para un año gravable.
   */
  async getStats(year: number): Promise<ExogenaStats> {
    const normativa = await this.getNormativaByYear(year)
    if (!normativa) {
      return {
        recordsToReportCount: 0,
        identifiedThirdPartiesCount: 0,
        enabledFormatsCount: 0,
        recordsWithErrorsCount: 0,
        recordsWithWarningsCount: 0,
        lastGenerationDate: null,
        lastBatchCode: null,
        validationStatus: 'PENDING',
      }
    }

    const enabledFormatsCount = normativa.formats.filter((f) => f.isEnabled).length
    const rawRecords = await this.consolidateRecords(year)
    const validation = exogenaValidator.validateBatch(rawRecords)

    // Contar terceros únicos
    const uniqueThirds = new Set(
      rawRecords.map((r) => r.documentNumber.replace(/\D/g, ''))
    )

    // Consultar última generación para este año
    const generations = (db.exogenaGenerations as unknown as ExogenaGenerationRecord[]) || []
    const lastGen = generations
      .filter((g) => g.year === year)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]

    const validationStatus: 'VALIDATED' | 'HAS_ERRORS' | 'PENDING' | 'GENERATED' =
      lastGen && lastGen.status === 'GENERATED'
        ? 'GENERATED'
        : validation.totalErrors > 0
        ? 'HAS_ERRORS'
        : rawRecords.length > 0
        ? 'VALIDATED'
        : 'PENDING'

    return {
      recordsToReportCount: rawRecords.length,
      identifiedThirdPartiesCount: uniqueThirds.size,
      enabledFormatsCount,
      recordsWithErrorsCount: validation.totalErrors,
      recordsWithWarningsCount: validation.totalWarnings,
      lastGenerationDate: lastGen ? lastGen.date : null,
      lastBatchCode: lastGen ? lastGen.batchCode : null,
      validationStatus,
    }
  }

  /**
   * Ejecuta la conciliación contable entre saldos contables y datos Exógena consolidados.
   */
  async getConciliation(year: number): Promise<ExogenaConciliationItem[]> {
    const records = await this.consolidateRecords(year)
    const accounting = db.accountingEntries || []

    // Totales desde Asientos Contables
    let totalSalesAccounting = 0
    let totalIvaGeneradoAccounting = 0
    let totalPurchasesAccounting = 0
    let totalIvaDescontableAccounting = 0
    let totalCxcAccounting = 0
    let totalCxpAccounting = 0

    for (const entry of accounting) {
      for (const line of entry.lines || []) {
        const code = line.accountCode
        if (code.startsWith('4135')) totalSalesAccounting += line.credit || 0
        if (code.startsWith('240805') || code.startsWith('240806')) totalIvaGeneradoAccounting += line.credit || 0
        if (code.startsWith('1435') || code.startsWith('6205')) totalPurchasesAccounting += line.debit || 0
        if (code.startsWith('240810') || code.startsWith('240811')) totalIvaDescontableAccounting += line.debit || 0
        if (code.startsWith('1305')) totalCxcAccounting += (line.debit || 0) - (line.credit || 0)
        if (code.startsWith('2205')) totalCxpAccounting += (line.credit || 0) - (line.debit || 0)
      }
    }

    // Totales desde Exógena
    const exogenaF1007 = records
      .filter((r) => r.formatNumber === '1007')
      .reduce((sum, r) => sum + r.baseAmount, 0)

    const exogenaF1006 = records
      .filter((r) => r.formatNumber === '1006')
      .reduce((sum, r) => sum + (r.vatAmount || 0), 0)

    const exogenaF1001 = records
      .filter((r) => r.formatNumber === '1001')
      .reduce((sum, r) => sum + r.baseAmount, 0)

    const exogenaF1005 = records
      .filter((r) => r.formatNumber === '1005')
      .reduce((sum, r) => sum + (r.vatAmount || 0), 0)

    const exogenaF1008 = records
      .filter((r) => r.formatNumber === '1008')
      .reduce((sum, r) => sum + r.baseAmount, 0)

    const exogenaF1009 = records
      .filter((r) => r.formatNumber === '1009')
      .reduce((sum, r) => sum + r.baseAmount, 0)

    return [
      {
        id: 'conc-01',
        concept: 'Ingresos Operacionales (Ventas vs F1007)',
        accountingAccountCode: '4135 - Comercio al por mayor',
        accountingTotalCOP: totalSalesAccounting,
        exogenaTotalCOP: exogenaF1007,
        differenceCOP: totalSalesAccounting - exogenaF1007,
        status: Math.abs(totalSalesAccounting - exogenaF1007) === 0 ? 'CONCILIATED' : 'DISCREPANCY',
        notes: 'Compara el saldo crédito de la cuenta de ingresos comerciales frente al acumulado del Formato 1007.',
      },
      {
        id: 'conc-02',
        concept: 'IVA Generado en Ventas (Cuenta 2408 vs F1006)',
        accountingAccountCode: '240805 / 240806 - IVA Generado',
        accountingTotalCOP: totalIvaGeneradoAccounting,
        exogenaTotalCOP: exogenaF1006,
        differenceCOP: totalIvaGeneradoAccounting - exogenaF1006,
        status: Math.abs(totalIvaGeneradoAccounting - exogenaF1006) === 0 ? 'CONCILIATED' : 'DISCREPANCY',
        notes: 'Verifica la concordancia del IVA liquidado en libros contra el valor a declarar en el Formato 1006.',
      },
      {
        id: 'conc-03',
        concept: 'Compras e Inventarios (Cuenta 1435 vs F1001)',
        accountingAccountCode: '1435 - Mercancías no fabricadas',
        accountingTotalCOP: totalPurchasesAccounting,
        exogenaTotalCOP: exogenaF1001,
        differenceCOP: totalPurchasesAccounting - exogenaF1001,
        status: Math.abs(totalPurchasesAccounting - exogenaF1001) === 0 ? 'CONCILIATED' : 'DISCREPANCY',
        notes: 'Compara las entradas a costo de adquisición de proveedores con el Formato 1001 (Concepto 5002).',
      },
      {
        id: 'conc-04',
        concept: 'IVA Descontable en Compras (Cuenta 240810 vs F1005)',
        accountingAccountCode: '240810 - IVA Descontable',
        accountingTotalCOP: totalIvaDescontableAccounting,
        exogenaTotalCOP: exogenaF1005,
        differenceCOP: totalIvaDescontableAccounting - exogenaF1005,
        status: Math.abs(totalIvaDescontableAccounting - exogenaF1005) === 0 ? 'CONCILIATED' : 'DISCREPANCY',
        notes: 'Verifica la integridad de las deducciones fiscales de IVA frente al Formato 1005.',
      },
      {
        id: 'conc-05',
        concept: 'Cartera Clientes a 31 Dic (Cuenta 1305 vs F1008)',
        accountingAccountCode: '1305 - Clientes Nacionales',
        accountingTotalCOP: totalCxcAccounting,
        exogenaTotalCOP: exogenaF1008,
        differenceCOP: totalCxcAccounting - exogenaF1008,
        status: Math.abs(totalCxcAccounting - exogenaF1008) === 0 ? 'CONCILIATED' : 'DISCREPANCY',
        notes: 'Control de consistencia de cuentas por cobrar.',
      },
      {
        id: 'conc-06',
        concept: 'Proveedores Nacionales a 31 Dic (Cuenta 2205 vs F1009)',
        accountingAccountCode: '2205 - Proveedores Nacionales',
        accountingTotalCOP: totalCxpAccounting,
        exogenaTotalCOP: exogenaF1009,
        differenceCOP: totalCxpAccounting - exogenaF1009,
        status: Math.abs(totalCxpAccounting - exogenaF1009) === 0 ? 'CONCILIATED' : 'DISCREPANCY',
        notes: 'Control de consistencia de cuentas por pagar.',
      },
    ]
  }

  /**
   * Obtiene el historial de generaciones de Exógena.
   */
  async getGenerationsHistory(year?: number): Promise<ExogenaGenerationRecord[]> {
    const list = (db.exogenaGenerations as unknown as ExogenaGenerationRecord[]) || []
    let result = [...list]
    if (year) {
      result = result.filter((g) => g.year === year)
    }
    result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return JSON.parse(JSON.stringify(result))
  }

  /**
   * Registra un nuevo paquete de generación en exogena_generations.json y audit_logs.json.
   */
  async saveGeneration(
    generation: ExogenaGenerationRecord,
    user: { id: string; name: string }
  ): Promise<ExogenaGenerationRecord> {
    const generations = db.exogenaGenerations as any[]
    generations.unshift(generation)

    this.logAudit({
      action: 'EXOGENA_PACKAGE_GENERATED',
      year: generation.year,
      userId: user.id,
      userName: user.name,
      details: `Generado paquete de Medios Magnéticos ${generation.batchCode} (${generation.fileFormat}) con ${generation.totalRecords} registros en ${generation.formatsIncluded.length} formatos.`,
    })

    return JSON.parse(JSON.stringify(generation))
  }

  /**
   * Registra un evento en audit_logs.json.
   */
  logAudit(entry: {
    action: string
    year: number
    userId: string
    userName: string
    details: string
  }): void {
    const auditRecord = {
      id: `aud-exo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      action: entry.action,
      locationId: 'loc-001',
      locationName: 'Sede Principal (CEDI)',
      userId: entry.userId,
      userName: entry.userName,
      timestamp: 'Justo ahora',
      changes: {
        field: 'exogena',
        newValue: { year: entry.year },
        details: entry.details,
      },
    }
    ;(db.auditLogs as any[]).unshift(auditRecord)
  }
}

export const exogenaRepository = new ExogenaRepository()
