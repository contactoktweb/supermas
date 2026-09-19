import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

/**
 * Cliente público de Supabase para su uso en navegadores y componentes cliente ("use client").
 * Solo opera con permisos restringidos por Row Level Security (RLS) y la clave anónima.
 */
export const createBrowserClient = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }
  return createClient(supabaseUrl, supabaseAnonKey)
}

export const supabaseClient = createBrowserClient()
