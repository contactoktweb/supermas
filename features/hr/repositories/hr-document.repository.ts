/**
 * Recursos Humanos — documentos del empleado. Archivo en el bucket privado hr-documents
 * (ruta empresa/empleado/uuid.ext) y metadatos en hr_documents. Acceso por URL firmada corta,
 * registrado en auditoría.
 */
import { supabaseClient } from '@/lib/supabase/client'
import { resolveUserCompanyId } from '@/lib/supabase/tenant'
import { toHrError } from '../utils/hr-errors'
import { HR_DOCUMENTS_BUCKET, HR_SIGNED_URL_SECONDS } from '../constants'
import { DocumentRow, mapDocument } from './hr-mappers'
import type { HrDocument } from '../types'
import type { DocumentUploadData } from '../schemas/hr.schema'

const DOCUMENT_SELECT =
  'id, employee_id, document_type, name, description, issue_date, expires_at, mime_type, size_bytes, is_archived, created_at, employee:hr_employees(first_name, last_name)'

const EXTENSION_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
}

export class HrDocumentRepository {
  async listByEmployee(employeeId: string, includeArchived: boolean): Promise<HrDocument[]> {
    let query = supabaseClient.from('hr_documents').select(DOCUMENT_SELECT).eq('employee_id', employeeId)
    if (!includeArchived) query = query.eq('is_archived', false)
    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw toHrError(error, 'No se pudieron cargar los documentos.')
    return ((data ?? []) as unknown as DocumentRow[]).map(mapDocument)
  }

  /** Documentos vigentes con vencimiento hasta la fecha indicada (incluye vencidos). */
  async listExpiringUntil(untilIso: string): Promise<HrDocument[]> {
    const { data, error } = await supabaseClient
      .from('hr_documents')
      .select(DOCUMENT_SELECT)
      .eq('is_archived', false)
      .not('expires_at', 'is', null)
      .lte('expires_at', untilIso)
      .order('expires_at')
      .limit(200)
    if (error) throw toHrError(error, 'No se pudieron consultar los documentos por vencer.')
    return ((data ?? []) as unknown as DocumentRow[]).map(mapDocument)
  }

  async upload(employeeId: string, data: DocumentUploadData): Promise<void> {
    const companyId = await resolveUserCompanyId(supabaseClient)
    const extension = EXTENSION_BY_MIME[data.file.type]
    if (!extension) throw new Error('Formato no permitido: use PDF, JPG o PNG.')

    const storagePath = `${companyId}/${employeeId}/${crypto.randomUUID()}.${extension}`
    const storage = supabaseClient.storage.from(HR_DOCUMENTS_BUCKET)

    const { error: uploadError } = await storage.upload(storagePath, data.file, {
      contentType: data.file.type,
      upsert: false,
      cacheControl: '0',
    })
    if (uploadError) throw toHrError(uploadError, 'No se pudo cargar el archivo.')

    const { error } = await supabaseClient.from('hr_documents').insert({
      company_id: companyId,
      employee_id: employeeId,
      document_type: data.documentType,
      name: data.name,
      description: data.description,
      issue_date: data.issueDate,
      expires_at: data.expiresAt,
      storage_path: storagePath,
      mime_type: data.file.type,
      size_bytes: data.file.size,
    })

    if (error) {
      // El archivo quedó sin registro: se retira para no dejar huérfanos en el bucket
      await storage.remove([storagePath])
      throw toHrError(error, 'No se pudo registrar el documento.')
    }
  }

  async createSignedUrl(documentId: string): Promise<string> {
    const { data: path, error } = await supabaseClient.rpc('fn_hr_log_document_access', { p_document_id: documentId })
    if (error || typeof path !== 'string') throw toHrError(error, 'No se pudo abrir el documento.')

    const { data, error: signError } = await supabaseClient.storage
      .from(HR_DOCUMENTS_BUCKET)
      .createSignedUrl(path, HR_SIGNED_URL_SECONDS)
    if (signError || !data?.signedUrl) throw toHrError(signError, 'No se pudo generar el enlace temporal del documento.')
    return data.signedUrl
  }

  async archive(documentId: string): Promise<void> {
    const { error } = await supabaseClient.from('hr_documents').update({ is_archived: true }).eq('id', documentId)
    if (error) throw toHrError(error, 'No se pudo archivar el documento.')
  }
}

export const hrDocumentRepository = new HrDocumentRepository()
