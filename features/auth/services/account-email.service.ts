/**
 * Envío de los correos de cuenta con Resend. Solo servidor.
 * Un fallo de envío se registra en el log y no interrumpe la operación que lo originó.
 */
import path from 'path'
import { readFileSync } from 'fs'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccountEmailConfig, resendClient } from '@/lib/email/resend-client'
import {
  ACCOUNT_EMAIL_LOGO_CID,
  AccountEmailCompany,
  passwordChangedEmail,
  passwordRecoveryEmail,
} from './account-email.template'

const LOGO_PATH = path.join(process.cwd(), 'public', 'logo-super-correo.png')

/** Dominio público del ERP: los enlaces de los correos nunca se arman con el Host de la petición. */
const PRODUCTION_APP_URL = 'https://www.supermas.co'

/** Vigencia del enlace de recuperación (tiempo de expiración de OTP configurado en Supabase Auth). */
export const RECOVERY_LINK_EXPIRY_MINUTES = 60

export function getAppBaseUrl(): string {
  const configured = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/$/, '')
  const isLocal = !configured || /localhost|127\.0\.0\.1/.test(configured)
  if (process.env.NODE_ENV === 'production' && isLocal) return PRODUCTION_APP_URL
  return configured || 'http://localhost:3000'
}

const FALLBACK_COMPANY: AccountEmailCompany = {
  legalName: 'Distribuidora Super Más S.A.S.',
  nit: null,
  address: null,
  city: null,
  phone: null,
}

async function loadCompany(companyId: string | null): Promise<AccountEmailCompany> {
  if (!companyId) return FALLBACK_COMPANY
  const { data } = await createAdminClient()
    .from('companies')
    .select('business_name, trade_name, tax_id, verification_digit, address, city, phone')
    .eq('id', companyId)
    .maybeSingle()
  if (!data) return FALLBACK_COMPANY
  return {
    legalName: data.business_name || data.trade_name || FALLBACK_COMPANY.legalName,
    nit: data.tax_id ? `${data.tax_id}${data.verification_digit ? `-${data.verification_digit}` : ''}` : null,
    address: data.address || null,
    city: data.city || null,
    phone: data.phone || null,
  }
}

async function send(to: string, email: { subject: string; html: string; text: string }): Promise<boolean> {
  const config = getAccountEmailConfig()
  if (!config) {
    console.error('[correo-cuenta] Falta RESEND_API_KEY o el remitente: no se envió el correo.')
    return false
  }
  const { error } = await resendClient(config).emails.send({
    from: config.from,
    to,
    subject: email.subject,
    html: email.html,
    text: email.text,
    attachments: [{ filename: 'logo.png', content: readFileSync(LOGO_PATH), contentId: ACCOUNT_EMAIL_LOGO_CID }],
  })
  if (error) {
    console.error('[correo-cuenta] Resend rechazó el envío:', error.message)
    return false
  }
  return true
}

export async function sendPasswordRecoveryEmail(params: {
  to: string
  userName: string
  companyId: string | null
  link: string
}): Promise<boolean> {
  const company = await loadCompany(params.companyId)
  return send(
    params.to,
    passwordRecoveryEmail({
      userName: params.userName,
      link: params.link,
      expiresInMinutes: RECOVERY_LINK_EXPIRY_MINUTES,
      company,
    })
  )
}

export async function sendPasswordChangedEmail(params: {
  to: string
  userName: string
  companyId: string | null
  ip: string | null
}): Promise<boolean> {
  const company = await loadCompany(params.companyId)
  const changedAt = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date())
  return send(
    params.to,
    passwordChangedEmail({
      userName: params.userName || params.to,
      changedAt,
      ip: params.ip,
      loginUrl: `${getAppBaseUrl()}/login`,
      company,
    })
  )
}
