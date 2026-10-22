/**
 * Expediente documental del cliente. Archivo en el bucket privado customer-documents
 * (ruta empresa/cliente/uuid.ext) y metadatos en customer_documents (migración 080).
 * Los archivos se abren con URL firmada de corta duración.
 */
import { supabaseClient } from '@/lib/supabase/client'
import { resolveUserCompanyId } from '@/lib/supabase/tenant'
import type { CustomerDocumentDTO, CustomerDocumentSummary } from '../types'

export const CUSTOMER_DOCUMENTS_BUCKET = 'customer-documents'
const SIGNED_URL_SECONDS = 60

const EXTENSION_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
}

const DOCUMENT_SELECT =
  'id, customer_id, category, name, notes, mime_type, size_bytes, created_at, uploader:users!customer_documents_uploaded_by_fkey(full_name)'

interface CustomerDocumentRow {
  id: string
  customer_id: string
  category: CustomerDocumentSummary['category']
  name: string
  notes: string | null
  mime_type: string
  size_bytes: number
  created_at: string
  uploader: { full_name: string | null } | null
}

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(2)} MB`

const mapRow = (row: CustomerDocumentRow): CustomerDocumentSummary => ({
  id: row.id,
  customerId: row.customer_id,
  fileName: row.name,
  fileType: row.mime_type,
  fileSize: formatSize(row.size_bytes),
  category: row.category,
  uploadedAt: row.created_at,
  uploadedBy: row.uploader?.full_name || 'Usuario del sistema',
  notes: row.notes ?? undefined,
})

export class CustomerDocumentRepository {
  async listByCustomer(customerId: string): Promise<CustomerDocumentSummary[]> {
    const { data, error } = await supabaseClient
      .from('customer_documents')
      .select(DOCUMENT_SELECT)
      .eq('customer_id', customerId)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
    if (error) throw new Error('No se pudieron cargar los documentos del cliente.')
    return ((data ?? []) as unknown as CustomerDocumentRow[]).map(mapRow)
  }

  async upload(dto: CustomerDocumentDTO): Promise<void> {
    const extension = EXTENSION_BY_MIME[dto.file.type]
    if (!extension) throw new Error('Formato no permitido: use PDF, JPG o PNG.')

    const companyId = await resolveUserCompanyId(supabaseClient)
    const storagePath = `${companyId}/${dto.customerId}/${crypto.randomUUID()}.${extension}`
    const storage = supabaseClient.storage.from(CUSTOMER_DOCUMENTS_BUCKET)

    const { error: uploadError } = await storage.upload(storagePath, dto.file, {
      contentType: dto.file.type,
      upsert: false,
      cacheControl: '0',
    })
    if (uploadError) throw new Error('No se pudo cargar el archivo. Verifique el formato y el tamaño.')

    const { error } = await supabaseClient.from('customer_documents').insert({
      company_id: companyId,
      customer_id: dto.customerId,
      category: dto.category,
      name: dto.name,
      notes: dto.notes || null,
      storage_path: storagePath,
      mime_type: dto.file.type,
      size_bytes: dto.file.size,
    })

    if (error) {
      // El archivo quedó sin registro: se retira para no dejar huérfanos en el bucket.
      await storage.remove([storagePath])
      throw new Error('No se pudo registrar el documento del cliente.')
    }
  }

  async createSignedUrl(documentId: string): Promise<string> {
    const { data, error } = await supabaseClient
      .from('customer_documents')
      .select('storage_path')
      .eq('id', documentId)
      .single()
    if (error || !data?.storage_path) throw new Error('No se encontró el documento.')

    const { data: signed, error: signError } = await supabaseClient.storage
      .from(CUSTOMER_DOCUMENTS_BUCKET)
      .createSignedUrl(data.storage_path, SIGNED_URL_SECONDS)
    if (signError || !signed?.signedUrl) throw new Error('No se pudo generar el enlace temporal del documento.')
    return signed.signedUrl
  }
}

export const customerDocumentRepository = new CustomerDocumentRepository()
