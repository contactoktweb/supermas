import { hrDocumentRepository } from '../repositories/hr-document.repository'
import { documentUploadSchema } from '../schemas/hr.schema'
import type { HrDocument, HrDocumentType } from '../types'

export interface DocumentUploadInput {
  documentType: HrDocumentType
  name: string
  description: string
  issueDate: string
  expiresAt: string
  file: File | null
}

export class HrDocumentService {
  list(employeeId: string, includeArchived: boolean): Promise<HrDocument[]> {
    return hrDocumentRepository.listByEmployee(employeeId, includeArchived)
  }

  listExpiringUntil(untilIso: string): Promise<HrDocument[]> {
    return hrDocumentRepository.listExpiringUntil(untilIso)
  }

  upload(employeeId: string, input: DocumentUploadInput): Promise<void> {
    return hrDocumentRepository.upload(employeeId, documentUploadSchema.parse(input))
  }

  /** Abre el documento en una pestaña nueva con una URL firmada de corta duración. */
  async open(documentId: string): Promise<void> {
    const popup = window.open('about:blank', '_blank')
    try {
      const url = await hrDocumentRepository.createSignedUrl(documentId)
      if (popup) {
        popup.opener = null
        popup.location.href = url
      } else {
        window.location.assign(url)
      }
    } catch (error) {
      popup?.close()
      throw error
    }
  }

  archive(documentId: string): Promise<void> {
    return hrDocumentRepository.archive(documentId)
  }
}

export const hrDocumentService = new HrDocumentService()
