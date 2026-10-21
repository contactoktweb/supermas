/**
 * GET /api/dian/config — Diagnóstico seguro de la configuración DIAN (sin secretos).
 * Permiso: ADMIN o dian.manage.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireServerUser, requireAnyPermission } from '@/lib/auth/server-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDianSafeSummary, maskIdentifier, getDianConfig } from '@/features/invoices/services/dian/dian.config'
import { loadSigningCertificate, describeCertificate } from '@/features/invoices/services/dian/dian-certificate'
import { dianErrorResponse } from '../_shared'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const user = await requireServerUser(req)
    await requireAnyPermission(user, ['dian.manage'])
    const summary = getDianSafeSummary()
    const admin = createAdminClient()

    const [{ data: software }, { data: resolutions }, { data: company }] = await Promise.all([
      admin.from('dian_software_config').select('software_id, test_set_id, environment, is_active').eq('company_id', user.companyId),
      admin
        .from('dian_resolutions')
        .select('dian_prefix, resolution_number, resolution_date, valid_from, valid_to, initial_range, final_range, last_assigned_number, environment, is_active, document_type')
        .eq('company_id', user.companyId),
      admin
        .from('companies')
        .select('business_name, tax_id, verification_digit, address, city, department, dian_municipality_code, dian_department_code, dian_tax_level_codes, dian_tax_scheme_code, rut_responsibilities')
        .eq('id', user.companyId)
        .maybeSingle(),
    ])

    let certificate: any = null
    if (summary.secrets.isCertificateConfigured) {
      try {
        const cfg = getDianConfig()
        certificate = describeCertificate(loadSigningCertificate(cfg.secrets.certificateBase64, cfg.secrets.certificatePassword))
      } catch (e: any) {
        certificate = { error: e?.message || 'No se pudo leer el certificado.' }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...summary,
        certificate,
        company,
        software: (software || []).map((s: any) => ({ ...s, software_id: maskIdentifier(s.software_id), test_set_id: maskIdentifier(s.test_set_id) })),
        resolutions: resolutions || [],
      },
    })
  } catch (e) {
    return dianErrorResponse(e)
  }
}
