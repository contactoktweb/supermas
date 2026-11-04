/**
 * Plantilla de los correos de cuenta: recuperación de contraseña y aviso de contraseña actualizada.
 * HTML en tablas con estilos en línea (Gmail, Outlook y móviles). El logo va embebido (cid).
 */

export const ACCOUNT_EMAIL_LOGO_CID = 'logo-super-mas'

export interface AccountEmailCompany {
  legalName: string
  nit: string | null
  address: string | null
  city: string | null
  phone: string | null
}

interface AccountEmailContent {
  preheader: string
  eyebrow: string
  title: string
  greetingName: string
  paragraphs: string[]
  action?: { label: string; url: string }
  /** Nota destacada bajo el botón (vigencia del enlace, qué hacer si no fue usted…). */
  notice: string
  company: AccountEmailCompany
}

const escapeHtml = (value: string) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

function accountEmailHtml(content: AccountEmailContent): string {
  const { company } = content
  const year = new Date().getFullYear()
  const companyLine = [company.nit ? `NIT ${company.nit}` : null, company.address, company.city].filter(Boolean).join(' · ')

  const button = content.action
    ? `
          <tr>
            <td align="center" style="padding:8px 32px 6px;">
              <a href="${escapeHtml(content.action.url)}" style="display:inline-block;background:#001b5c;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 30px;border-radius:10px;">${escapeHtml(content.action.label)}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 32px 0;font-size:11px;line-height:17px;color:#64748b;">
              Si el botón no funciona, copie y pegue este enlace en su navegador:<br>
              <span style="color:#001b5c;word-break:break-all;">${escapeHtml(content.action.url)}</span>
            </td>
          </tr>`
    : ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(content.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(content.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="padding:26px 32px 18px;border-bottom:4px solid #001b5c;">
              <img src="cid:${ACCOUNT_EMAIL_LOGO_CID}" alt="${escapeHtml(company.legalName)}" width="150" style="display:block;width:150px;max-width:150px;height:auto;border:0;">
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 6px;">
              <p style="margin:0 0 6px;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#dc2626;font-weight:700;">${escapeHtml(content.eyebrow)}</p>
              <h1 style="margin:0 0 18px;font-size:24px;line-height:30px;color:#001b5c;">${escapeHtml(content.title)}</h1>
              <p style="margin:0 0 14px;font-size:14px;line-height:22px;">Hola ${escapeHtml(content.greetingName)}:</p>
              ${content.paragraphs
                .map((p) => `<p style="margin:0 0 14px;font-size:14px;line-height:22px;color:#334155;">${escapeHtml(p)}</p>`)
                .join('\n              ')}
            </td>
          </tr>
          ${button}
          <tr>
            <td style="padding:20px 32px 26px;">
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;font-size:12px;line-height:19px;color:#475569;">
                ${escapeHtml(content.notice)}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px 22px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;line-height:17px;color:#64748b;text-align:center;">
              <strong style="color:#0f172a;">${escapeHtml(company.legalName)}</strong><br>
              ${companyLine ? `${escapeHtml(companyLine)}<br>` : ''}
              Este mensaje se generó automáticamente desde el ERP. No responda a este correo.<br>
              © ${year} ${escapeHtml(company.legalName)}. Todos los derechos reservados.<br>
              <a href="https://www.kytcode.lat" style="color:#0f172a;text-decoration:none;font-weight:600;">Desarrollado por K&amp;T <span style="color:#000000;">&#9829;</span></a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function accountEmailText(content: AccountEmailContent): string {
  return [
    `Hola ${content.greetingName}:`,
    '',
    ...content.paragraphs,
    ...(content.action ? ['', `${content.action.label}: ${content.action.url}`] : []),
    '',
    content.notice,
    '',
    content.company.legalName,
  ].join('\n')
}

export function passwordRecoveryEmail(params: {
  userName: string
  link: string
  expiresInMinutes: number
  company: AccountEmailCompany
}) {
  const content: AccountEmailContent = {
    preheader: 'Enlace para crear una nueva contraseña del ERP Super Más.',
    eyebrow: 'Recuperación de contraseña',
    title: 'Cree una nueva contraseña',
    greetingName: params.userName,
    paragraphs: [
      'Recibimos una solicitud para restablecer la contraseña de su cuenta en el ERP de Super Más.',
      'Pulse el botón para crear una contraseña nueva. Debe tener mínimo 10 caracteres, con mayúscula, minúscula, número y símbolo.',
    ],
    action: { label: 'Crear nueva contraseña', url: params.link },
    notice: `El enlace vence en ${params.expiresInMinutes} minutos y solo se puede usar una vez. Si usted no pidió este cambio, ignore este correo: su contraseña actual sigue funcionando.`,
    company: params.company,
  }
  return {
    subject: 'Recupere su contraseña del ERP Super Más',
    html: accountEmailHtml(content),
    text: accountEmailText(content),
  }
}

export function passwordChangedEmail(params: {
  userName: string
  changedAt: string
  ip: string | null
  loginUrl: string
  company: AccountEmailCompany
}) {
  const content: AccountEmailContent = {
    preheader: 'La contraseña de su cuenta del ERP Super Más fue actualizada.',
    eyebrow: 'Seguridad de la cuenta',
    title: 'Su contraseña fue actualizada',
    greetingName: params.userName,
    paragraphs: [
      `La contraseña de su cuenta en el ERP de Super Más se estableció correctamente el ${params.changedAt}${params.ip ? ` desde la dirección ${params.ip}` : ''}.`,
      'Desde ahora debe ingresar con la nueva contraseña.',
    ],
    action: { label: 'Ingresar al ERP', url: params.loginUrl },
    notice: 'Si usted no hizo este cambio, comuníquese de inmediato con el administrador del sistema para bloquear la cuenta.',
    company: params.company,
  }
  return {
    subject: 'Su contraseña del ERP Super Más fue actualizada',
    html: accountEmailHtml(content),
    text: accountEmailText(content),
  }
}
