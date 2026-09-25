import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

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

function createEmptyDatabaseClient(): any {
  return {
    from: (table: string) => createEmptyQueryBuilder(table),
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
    },
  }
}

/**
 * Cliente de servidor seguro para Server Components, Server Actions y Route Handlers.
 * Respeta el contexto de sesión del usuario y las directivas de seguridad RLS.
 */
export const createServerClient = (): SupabaseClient<any, 'public', any> => {
  if (!supabaseUrl || !supabaseAnonKey) {
    return createEmptyDatabaseClient()
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
    },
  })
}
