import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

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
      admin: {
        listUsers: async () => ({ data: { users: [] }, error: null }),
      },
    },
  }
}

let _adminClientInstance: SupabaseClient<any, 'public', any> | null = null

/**
 * Cliente administrativo de Supabase con privilegios elevados (service_role).
 * ADVERTENCIA: NUNCA usar en el frontend ni en componentes cliente.
 * Se utiliza exclusivamente en scripts de migración, cron jobs y endpoints administrativos protegidos.
 */
export const createAdminClient = (): SupabaseClient<any, 'public', any> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) {
    return createEmptyDatabaseClient()
  }
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export const getSupabaseAdmin = (): SupabaseClient<any, 'public', any> => {
  if (!_adminClientInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    if (!url || !key) {
      return createEmptyDatabaseClient()
    }
    _adminClientInstance = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }
  return _adminClientInstance
}

export const supabaseAdmin: SupabaseClient<any, 'public', any> = new Proxy({} as any, {
  get(_target, prop) {
    const client = getSupabaseAdmin()
    const value = (client as any)[prop]
    return typeof value === 'function' ? value.bind(client) : value
  },
})
