import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

/**
 * Generador de respuestas vacías seguras para Supabase cuando se opera
 * en instalación limpia o sin variables de entorno configuradas aún.
 */
function createEmptyQueryBuilder(table: string) {
  const emptyResult = { data: [], error: null, count: 0 }
  const builder: any = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    upsert: () => builder,
    eq: () => builder,
    neq: () => builder,
    gt: () => builder,
    gte: () => builder,
    lt: () => builder,
    lte: () => builder,
    like: () => builder,
    ilike: () => builder,
    is: () => builder,
    in: () => builder,
    contains: () => builder,
    containedBy: () => builder,
    range: () => builder,
    order: () => builder,
    limit: () => builder,
    single: async () => ({ data: null, error: null }),
    maybeSingle: async () => ({ data: null, error: null }),
    then: (resolve: (val: any) => any) => Promise.resolve(emptyResult).then(resolve),
    catch: (reject: (err: any) => any) => Promise.resolve(emptyResult).catch(reject),
  }
  return builder
}

/**
 * Emulador de cliente Supabase para entornos limpios sin conexión a base de datos externa.
 */
function createEmptyDatabaseClient(): any {
  return {
    from: (table: string) => createEmptyQueryBuilder(table),
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      signInWithPassword: async () => ({ data: { user: null, session: null }, error: null }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
      }),
    },
  }
}

/**
 * Cliente público de Supabase para su uso en navegadores y componentes cliente ("use client").
 * Solo opera con permisos restringidos por Row Level Security (RLS) y la clave anónima.
 */
export const createBrowserClient = (): SupabaseClient<any, 'public', any> => {
  if (!supabaseUrl || !supabaseAnonKey) {
    return createEmptyDatabaseClient()
  }
  return createClient(supabaseUrl, supabaseAnonKey)
}

export const supabaseClient = createBrowserClient()
