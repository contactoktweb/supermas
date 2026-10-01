import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente público de Supabase para su uso en navegadores y componentes cliente ("use client").
 * Opera con permisos fiduciarios restringidos por Row Level Security (RLS) y la clave anónima.
 * La sesión se persiste fiduciariamente en el almacenamiento del navegador.
 */
export const createBrowserClient = (): SupabaseClient<any, 'public', any> => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Configuración incompleta: Faltan las variables de entorno NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    )
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: typeof window !== 'undefined',
      autoRefreshToken: typeof window !== 'undefined',
      detectSessionInUrl: typeof window !== 'undefined',
    },
  })
}

// Instancia singleton para el cliente del navegador
let _supabaseClientInstance: SupabaseClient<any, 'public', any> | null = null

export const getSupabaseClient = (): SupabaseClient<any, 'public', any> => {
  if (!_supabaseClientInstance) {
    _supabaseClientInstance = createBrowserClient()
  }
  return _supabaseClientInstance
}

/**
 * Instancia compartida de supabaseClient.
 * Implementada con acceso diferido (lazy proxy) para garantizar que las variables
 * de entorno estén disponibles tanto en tiempo de ejecución del navegador como en Node.js/tests.
 */
export const supabaseClient: SupabaseClient<any, 'public', any> = new Proxy({} as any, {
  get(_target, prop) {
    const client = getSupabaseClient()
    const value = (client as any)[prop]
    return typeof value === 'function' ? value.bind(client) : value
  },
})
