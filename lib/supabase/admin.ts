import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

/**
 * Cliente administrativo de Supabase con privilegios elevados (service_role).
 * ADVERTENCIA: NUNCA usar en el frontend ni en componentes cliente.
 * Se utiliza exclusivamente en scripts de migración, cron jobs y endpoints administrativos protegidos.
 */
export const createAdminClient = () => {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return null
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export const supabaseAdmin = createAdminClient()
