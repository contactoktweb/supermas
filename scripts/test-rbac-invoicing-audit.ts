/**
 * SUPER MÁS ERP/POS — SUITE DE AUDITORÍA Y VERIFICACIÓN RBAC: 7 ROLES RESPECTO A FACTURACIÓN Y DIAN
 */

import { supabaseAdmin } from '../lib/supabase/admin'
import * as fs from 'fs'

// Cargar .env.local
if (fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx !== -1) {
      const k = trimmed.substring(0, idx).trim()
      let v = trimmed.substring(idx + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      process.env[k] = v
    }
  }
}

async function runRbacInvoicingAudit() {
  console.log('================================================================================')
  console.log('🛡️ AUDITORÍA RBAC: 7 ROLES DEFINITIVOS RESPECTO A FACTURACIÓN ELECTRÓNICA Y DIAN')
  console.log('================================================================================\n')

  const { data: roles, error: rolesErr } = await supabaseAdmin
    .from('roles')
    .select(`
      id,
      code,
      name,
      description,
      scope,
      role_permissions (
        permissions (
          id,
          code,
          module,
          description
        )
      )
    `)
    .in('code', [
      'ADMIN',
      'JEFE_INGRESOS_SALIDAS',
      'FACTURACION_POS',
      'ENCARGADA_VENTA',
      'VENDEDORES',
      'JEFE_BODEGA',
      'RECURSOS_HUMANOS',
    ])
    .order('code')

  if (rolesErr || !roles) {
    throw new Error(`Error consultando roles: ${rolesErr?.message}`)
  }

  const roleMap = new Map(roles.map((r: any) => [r.code, r]))

  const requiredRoles = [
    'ADMIN',
    'JEFE_INGRESOS_SALIDAS',
    'FACTURACION_POS',
    'ENCARGADA_VENTA',
    'VENDEDORES',
    'JEFE_BODEGA',
    'RECURSOS_HUMANOS',
  ]

  for (const code of requiredRoles) {
    const role = roleMap.get(code)
    if (!role) {
      throw new Error(`Rol requerido ${code} no fue encontrado en public.roles.`)
    }
    const perms: string[] = (role.role_permissions || [])
      .map((rp: any) => rp.permissions?.code)
      .filter(Boolean)

    console.log(`📌 ROL: [${code}] ${role.name}`)
    console.log(`   Alcance: ${role.scope}`)
    console.log(`   Total Permisos: ${perms.length}`)

    // Evaluaciones de seguridad de facturación y configuración
    const canManageSettings = perms.includes('settings.manage') || perms.includes('*')
    const canCreateInvoice = perms.includes('invoices.create') || perms.includes('*')
    const canReadInvoice = perms.includes('invoices.read') || perms.includes('*')
    const canCancelInvoice = perms.includes('invoices.cancel') || perms.includes('*')
    const canCreateSale = perms.includes('sales.create') || perms.includes('*')
    const canOperateCash = perms.includes('pos.cash_register') || perms.includes('*')
    const canAccessPos = perms.includes('pos.access') || perms.includes('*')

    console.log(`   - ¿Puede configurar parámetros / DIAN (settings.manage)?: ${canManageSettings ? 'SÍ (Privilegio administrativo)' : 'NO (Denegado)'}`)
    console.log(`   - ¿Puede emitir facturas (invoices.create)?: ${canCreateInvoice ? 'SÍ' : 'NO'}`)
    console.log(`   - ¿Puede consultar facturas (invoices.read)?: ${canReadInvoice ? 'SÍ' : 'NO'}`)
    console.log(`   - ¿Puede anular facturas / nota crédito (invoices.cancel)?: ${canCancelInvoice ? 'SÍ' : 'NO'}`)
    console.log(`   - ¿Puede crear / cobrar ventas (sales.create)?: ${canCreateSale ? 'SÍ' : 'NO'}`)
    console.log(`   - ¿Puede operar caja (pos.cash_register)?: ${canOperateCash ? 'SÍ' : 'NO'}`)
    console.log(`   - ¿Tiene acceso a terminal POS (pos.access)?: ${canAccessPos ? 'SÍ' : 'NO'}`)

    // Verificaciones específicas por rol
    if (code === 'ADMIN') {
      if (!canManageSettings) throw new Error('ADMIN debe tener settings.manage.')
      if (!canCreateInvoice) throw new Error('ADMIN debe tener invoices.create.')
    } else {
      // NINGÚN rol operativo debe tener settings.manage (control de secretos y configuración)
      if (canManageSettings) throw new Error(`Vulnerabilidad: Rol ${code} tiene settings.manage asignado.`)
    }

    if (code === 'FACTURACION_POS') {
      if (!canAccessPos || !canCreateSale || !canReadInvoice) {
        throw new Error('FACTURACION_POS debe poder acceder a POS, crear venta y leer facturas.')
      }
      if (canManageSettings || canCancelInvoice) {
        throw new Error('FACTURACION_POS no debe poder configurar sistema ni anular facturas.')
      }
    }

    if (code === 'ENCARGADA_VENTA') {
      if (!canOperateCash || !canCreateSale) {
        throw new Error('ENCARGADA_VENTA debe poder operar caja y realizar el cobro.')
      }
      if (canManageSettings) {
        throw new Error('ENCARGADA_VENTA no debe poder configurar parámetros del sistema.')
      }
    }

    if (code === 'VENDEDORES') {
      if (!canCreateSale) throw new Error('VENDEDORES debe poder crear venta/ticket.')
      if (canOperateCash) throw new Error('VENDEDORES no debe poder operar caja (cobro exclusivo de Encargada).')
      if (canManageSettings) throw new Error('VENDEDORES no debe acceder a configuración.')
    }

    if (code === 'JEFE_BODEGA' || code === 'RECURSOS_HUMANOS') {
      if (canManageSettings || canCreateInvoice || canAccessPos) {
        throw new Error(`Violación de mínimo privilegio en rol ${code}.`)
      }
    }

    console.log('   ✅ Validaciones de seguridad de este rol cumplidas al 100%.\n')
  }

  console.log('🎉 AUDITORÍA RBAC DE LOS 7 ROLES COMPLETADA CON ÉXITO: CERO VULNERABILIDADES FISCALES.')
}

runRbacInvoicingAudit().catch((e) => {
  console.error(e)
  process.exit(1)
})
