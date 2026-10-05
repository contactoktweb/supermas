/**
 * SUPER MÁS ERP/POS — Servicio de Importación Masiva de Clientes (CustomerImportService)
 *
 * Conectado directamente a PostgreSQL/Supabase con aislamiento multiempresa por company_id,
 * validación de unicidad de documento de identidad y auditoría inmutable.
 */

import { supabaseClient } from '@/lib/supabase/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveUserCompanyId } from '@/lib/supabase/tenant'
import {
  parseCsvContent,
  parseCleanNumber,
} from '@/lib/csv-parser'
import {
  CustomerImportRow,
  CustomerImportRowValidation,
  CustomerImportPreview,
  CustomerImportExecutionResult,
  RawCustomerCsvRow,
} from '../types/import.types'

function getDbClient() {
  if (typeof window === 'undefined' && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return supabaseAdmin
  }
  return supabaseClient
}

export class CustomerImportService {
  /**
   * Resuelve el company_id activo de forma estricta
   */
  private async getCompanyId(preferredCompanyId?: string): Promise<string> {
    return resolveUserCompanyId(getDbClient(), preferredCompanyId)
  }

  /**
   * Genera plantilla CSV estándar para clientes.
   */
  generateTemplateCsv(): string {
    const headers = [
      'Tipo Documento',
      'Número Documento',
      'Dígito Verificación',
      'Nombre o Razón Social',
      'Nombre Comercial',
      'Tipo Persona',
      'Categoría',
      'Persona Contacto',
      'Teléfono / Celular',
      'Correo Electrónico',
      'Dirección',
      'Ciudad',
      'Departamento',
      'Cupo Crédito COP',
      'Días Crédito',
      'Observaciones',
    ]

    const sampleRow1 = [
      'NIT',
      '901234567',
      '8',
      'Supertiendas El Triunfo S.A.S.',
      'Supertiendas El Triunfo',
      'JURIDICA',
      'WHOLESALE',
      'Carlos Rodríguez',
      '3101234567',
      'compras@eltriunfo.com',
      'Calle 45 # 23-10',
      'Medellín',
      'Antioquia',
      '10000000',
      '30',
      'Cliente mayorista con facturación quincenal',
    ]

    const sampleRow2 = [
      'CC',
      '1020304050',
      '',
      'María Fernanda Gómez',
      '',
      'NATURAL',
      'RETAIL',
      'María Gómez',
      '3159876543',
      'maria.gomez@gmail.com',
      'Carrera 70 # 12-40',
      'Medellín',
      'Antioquia',
      '500000',
      '15',
      'Cliente frecuente mostrador',
    ]

    return [
      headers.join(';'),
      sampleRow1.join(';'),
      sampleRow2.join(';'),
    ].join('\n')
  }

  private normalizeKey(rawKey: string): string {
    return rawKey
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
  }

  mapRawRowToImportRow(raw: RawCustomerCsvRow): CustomerImportRow {
    const normalized: Record<string, any> = {}
    for (const [k, v] of Object.entries(raw)) {
      normalized[this.normalizeKey(k)] = v
    }

    const documentType = String(
      normalized['tipodocumento'] ||
        normalized['tipodoc'] ||
        normalized['tipoidentificacion'] ||
        'CC'
    ).toUpperCase().trim()

    const documentNumber = String(
      normalized['numerodocumento'] ||
        normalized['documento'] ||
        normalized['nit'] ||
        normalized['cedula'] ||
        normalized['identificacion'] ||
        ''
    ).trim()

    const verificationDigit = normalized['digitoverificacion'] || normalized['dv']
      ? String(normalized['digitoverificacion'] || normalized['dv']).trim()
      : undefined

    const name = String(
      normalized['nombreorazonsocial'] ||
        normalized['nombre'] ||
        normalized['razonsocial'] ||
        normalized['cliente'] ||
        ''
    ).trim()

    const commercialName = normalized['nombrecomercial'] || normalized['comercial']
      ? String(normalized['nombrecomercial'] || normalized['comercial']).trim()
      : undefined

    const rawPersonType = String(
      normalized['tipopersona'] || normalized['persona'] || (documentType === 'NIT' ? 'JURIDICA' : 'NATURAL')
    ).toUpperCase()

    const personType: 'NATURAL' | 'COMPANY' =
      rawPersonType.includes('JUR') || rawPersonType.includes('EMP') || rawPersonType.includes('COMP')
        ? 'COMPANY'
        : 'NATURAL'

    const rawCategory = String(normalized['categoria'] || normalized['tipocliente'] || 'RETAIL').toUpperCase()
    const category: 'RETAIL' | 'WHOLESALE' | 'SPECIAL' | 'FREQUENT' =
      rawCategory.includes('MAYOR') || rawCategory.includes('WHOLE')
        ? 'WHOLESALE'
        : rawCategory.includes('ESP')
        ? 'SPECIAL'
        : rawCategory.includes('FREC')
        ? 'FREQUENT'
        : 'RETAIL'

    const contactPerson = normalized['personacontacto'] || normalized['contacto']
      ? String(normalized['personacontacto'] || normalized['contacto']).trim()
      : undefined

    const phone = normalized['telefono'] || normalized['celular'] || normalized['movil'] || normalized['tel']
      ? String(normalized['telefono'] || normalized['celular'] || normalized['movil'] || normalized['tel']).trim()
      : undefined

    const email = normalized['correoelectronico'] || normalized['correo'] || normalized['email']
      ? String(normalized['correoelectronico'] || normalized['correo'] || normalized['email']).toLowerCase().trim()
      : undefined

    const address = normalized['direccion'] || normalized['dir']
      ? String(normalized['direccion'] || normalized['dir']).trim()
      : undefined

    const city = normalized['ciudad'] || normalized['municipio']
      ? String(normalized['ciudad'] || normalized['municipio']).trim()
      : 'Medellín'

    const department = normalized['departamento'] || normalized['depto']
      ? String(normalized['departamento'] || normalized['depto']).trim()
      : 'Antioquia'

    const creditLimit = parseCleanNumber(normalized['cupocredito'] || normalized['cupo'] || 0)
    const creditDays = parseCleanNumber(normalized['diascredito'] || normalized['dias'] || 0)

    const notes = normalized['observaciones'] || normalized['notas']
      ? String(normalized['observaciones'] || normalized['notas']).trim()
      : undefined

    return {
      documentType,
      documentNumber,
      verificationDigit,
      name,
      commercialName,
      personType,
      category,
      contactPerson,
      phone,
      email,
      address,
      city,
      department,
      creditLimit,
      creditDays,
      notes,
    }
  }

  async previewCsv(csvContent: string, preferredCompanyId?: string): Promise<CustomerImportPreview> {
    const client = getDbClient()
    const companyId = await this.getCompanyId(preferredCompanyId)
    const { headers, rows: rawRows } = parseCsvContent<RawCustomerCsvRow>(csvContent)

    // Consultar documentos de clientes existentes en la empresa
    const { data: existingCustomers } = await client
      .from('customers')
      .select('document_number')
      .eq('company_id', companyId)

    const existingDocSet = new Set(
      (existingCustomers || []).map((c: any) => c.document_number?.toUpperCase().trim())
    )

    const validatedRows: CustomerImportRowValidation[] = []
    const batchDocSet = new Set<string>()

    let validCount = 0
    let invalidCount = 0

    rawRows.forEach((raw, idx) => {
      const rowNumber = idx + 2
      const parsed = this.mapRawRowToImportRow(raw)
      const errors: string[] = []
      const warnings: string[] = []

      // 1. Validar Documento
      if (!parsed.documentNumber) {
        errors.push('El número de documento es obligatorio.')
      } else {
        const cleanDoc = parsed.documentNumber.toUpperCase()
        if (batchDocSet.has(cleanDoc)) {
          errors.push(`El documento "${parsed.documentNumber}" está duplicado dentro del archivo.`)
        } else {
          batchDocSet.add(cleanDoc)
        }

        if (existingDocSet.has(cleanDoc)) {
          errors.push(`El documento "${parsed.documentNumber}" ya existe en el sistema para esta empresa.`)
        }
      }

      // 2. Validar Nombre
      if (!parsed.name) {
        errors.push('El nombre o razón social es obligatorio.')
      }

      // 3. Validar Email si se suministró
      if (parsed.email && !parsed.email.includes('@')) {
        warnings.push(`El correo "${parsed.email}" no parece tener un formato válido.`)
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

  async executeImport(
    rows: CustomerImportRow[],
    userContext?: { userId?: string; userName?: string },
    preferredCompanyId?: string
  ): Promise<CustomerImportExecutionResult> {
    const client = getDbClient()
    const companyId = await this.getCompanyId(preferredCompanyId)
    const userId = userContext?.userId || null
    const userName = userContext?.userName || 'Sistema'

    const createdCustomerIds: string[] = []
    const errors: Array<{ rowNumber: number; documentNumber?: string; message: string }> = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNumber = i + 2

      try {
        const doc = row.documentNumber?.trim()
        const name = row.name?.trim()

        if (!doc || !name) {
          errors.push({ rowNumber, documentNumber: doc, message: 'Documento y Nombre son requeridos.' })
          continue
        }

        const isCompany = row.personType === 'COMPANY'
        const firstName = !isCompany ? name.split(' ')[0] : null
        const lastName = !isCompany ? name.split(' ').slice(1).join(' ') : null

        const payload = {
          company_id: companyId,
          document_type: row.documentType || 'CC',
          document_number: doc,
          verification_digit: row.verificationDigit?.trim() || null,
          first_name: firstName,
          last_name: lastName,
          company_name: isCompany ? name : null,
          commercial_name: row.commercialName || name,
          person_type: isCompany ? 'COMPANY' : 'NATURAL',
          customer_type: isCompany ? 'COMPANY' : 'INDIVIDUAL',
          customer_category: row.category || 'RETAIL',
          contact_name: row.contactPerson || null,
          phone: row.phone || null,
          email: row.email || null,
          address: row.address || null,
          city: row.city || 'Medellín',
          department: row.department || 'Antioquia',
          credit_limit: Number(row.creditLimit || 0),
          credit_days: Number(row.creditDays || 0),
          current_balance: 0,
          is_active: true,
          notes: row.notes || null,
        }

        const { data: createdCustomer, error: insertErr } = await client
          .from('customers')
          .insert(payload)
          .select('id')
          .single()

        if (insertErr || !createdCustomer) {
          throw new Error(`Error insertando cliente ${doc}: ${insertErr?.message}`)
        }

        createdCustomerIds.push(createdCustomer.id)
      } catch (err: any) {
        errors.push({
          rowNumber,
          documentNumber: row.documentNumber,
          message: err.message || 'Error procesando registro.',
        })
      }
    }

    if (createdCustomerIds.length > 0) {
      await client.from('audit_logs').insert({
        id: crypto.randomUUID(),
        company_id: companyId,
        action: 'CUSTOMER_BULK_IMPORT',
        module: 'CUSTOMERS',
        entity_name: 'customers',
        entity_id: createdCustomerIds[0],
        user_id: userId,
        user_name: userName,
        new_value: {
          importedCount: createdCustomerIds.length,
          customerIds: createdCustomerIds,
        },
        created_at: new Date().toISOString(),
      })
    }

    return {
      success: createdCustomerIds.length > 0,
      totalProcessed: rows.length,
      importedCount: createdCustomerIds.length,
      failedCount: errors.length,
      skippedCount: 0,
      createdCustomerIds,
      errors,
    }
  }
}

export const customerImportService = new CustomerImportService()
