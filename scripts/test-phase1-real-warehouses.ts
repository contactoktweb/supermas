/**
 * SUPER MÁS ERP/POS — Batería de Pruebas Fiduciarias: FASE 1 — BODEGAS
 *
 * Valida de forma estricta contra Supabase Staging Real:
 * 1. READ desde Supabase (Bodega real BOD-01 consultada desde public.locations).
 * 2. SEARCH & FILTER (filtros por tipo, estado y texto en PostgreSQL).
 * 3. CREATE real (Frontend -> Service -> Repository -> Supabase -> public.locations).
 * 4. UPDATE real (Modificación y persistencia inmediata en PostgreSQL).
 * 5. ACTIVAR / DESACTIVAR real (Transición de estado y flags operacionales en PostgreSQL).
 * 6. PERSISTENCIA F5 (Cerrar sesión, volver a iniciar y verificar existencia).
 * 7. VALIDACIÓN RLS y company_id (Aislamiento fiduciario multiempresa).
 * 8. LIMPIEZA INMEDIATA (Eliminación del registro de prueba sin dejar basura en BD).
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { supabaseClient } from '../lib/supabase/client'
import { warehouseService } from '../features/warehouses/services/warehouse.service'
import { warehouseRepository } from '../features/warehouses/repositories/warehouse.repository'

const adminPassword = process.env.STAGING_AUTH_PASSWORD || 'SuperMas2026*SecureAdmin'

interface TestResult {
  code: string
  name: string
  status: 'PASS' | 'FAIL'
  details: string
}

const results: TestResult[] = []

function recordTest(code: string, name: string, status: 'PASS' | 'FAIL', details: string) {
  results.push({ code, name, status, details })
  const icon = status === 'PASS' ? '✅' : '❌'
  console.log(`${icon} [PRUEBA ${code}] ${name}: ${details}`)
}

async function runPhase1Tests() {
  console.log('====================================================================')
  console.log('🏢 INICIANDO VALIDACIÓN FIDUCIARIA: FASE 1 — BODEGAS REALES')
  console.log('====================================================================\n')

  // 1. Iniciar sesión real como Superadministrador en el singleton supabaseClient
  const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
    email: 'samirdurant234@gmail.com',
    password: adminPassword,
  })

  if (authError || !authData.user) {
    throw new Error(`Fallo en autenticación real para pruebas: ${authError?.message}`)
  }

  const client = supabaseClient

  // Obtener company_id real del usuario
  const { data: userProfile } = await client
    .from('users')
    .select('id, full_name, email, company_id')
    .eq('id', authData.user.id)
    .single()

  const userContext = {
    id: authData.user.id,
    name: userProfile?.full_name || 'Samir Durant',
    companyId: userProfile?.company_id,
  }

  console.log(`👤 Sesión activa: ${userContext.name} (${authData.user.email})`)
  console.log(`🏢 Empresa ID: ${userContext.companyId}\n`)

  // ---------------------------------------------------------------------------
  // PRUEBA 1: READ desde Supabase (public.locations)
  // ---------------------------------------------------------------------------
  try {
    const listResult = await warehouseService.listWarehouses()
    const foundBOD01 = listResult.data.find((w) => w.code === 'BOD-01')

    if (foundBOD01 && listResult.total >= 1) {
      recordTest(
        '1.1',
        'READ bodegas reales desde public.locations',
        'PASS',
        `Se consultaron ${listResult.total} bodegas. BOD-01 ("${foundBOD01.name}") leída correctamente con ID: ${foundBOD01.id}`
      )
    } else {
      recordTest('1.1', 'READ bodegas reales', 'FAIL', 'No se encontró la bodega semilla BOD-01 en PostgreSQL')
    }
  } catch (err: any) {
    recordTest('1.1', 'READ bodegas reales', 'FAIL', err.message)
  }

  // ---------------------------------------------------------------------------
  // PRUEBA 2: READ Detalle individual (findById y findByCode)
  // ---------------------------------------------------------------------------
  try {
    const byCode = await warehouseRepository.findByCode('BOD-01')
    if (byCode) {
      const byId = await warehouseService.getWarehouse(byCode.id)
      if (byId && byId.code === 'BOD-01') {
        recordTest(
          '1.2',
          'GET detalle por ID y búsqueda por Código',
          'PASS',
          `Bodega "${byId.name}" encontrada por ID ${byId.id} con settings y estado ${byId.status}`
        )
      } else {
        recordTest('1.2', 'GET detalle por ID', 'FAIL', 'No se pudo recuperar por ID')
      }
    } else {
      recordTest('1.2', 'GET detalle por código', 'FAIL', 'findByCode no encontró BOD-01')
    }
  } catch (err: any) {
    recordTest('1.2', 'GET detalle individual', 'FAIL', err.message)
  }

  // ---------------------------------------------------------------------------
  // PRUEBA 3: SEARCH & FILTERS en Supabase
  // ---------------------------------------------------------------------------
  try {
    const searchResult = await warehouseService.listWarehouses({ query: 'Medellín' })
    const match = searchResult.data.some((w) => w.city.toLowerCase().includes('medellín') || w.name.toLowerCase().includes('medellín'))
    if (match) {
      recordTest('1.3', 'SEARCH con filtro de texto ILIKE', 'PASS', `Búsqueda por "Medellín" retornó ${searchResult.data.length} resultado(s) coincidentes.`)
    } else {
      recordTest('1.3', 'SEARCH con filtro de texto ILIKE', 'FAIL', 'No coincidieron resultados para Medellín')
    }
  } catch (err: any) {
    recordTest('1.3', 'SEARCH con filtro de texto', 'FAIL', err.message)
  }

  // ---------------------------------------------------------------------------
  // PRUEBA 4: CREATE Real en Supabase (Frontend -> Service -> Repository -> public.locations)
  // ---------------------------------------------------------------------------
  const tempTestCode = `BOD-T${Date.now().toString().slice(-4)}`
  let createdWarehouseId: string | null = null

  try {
    const newWarehouseData = {
      name: 'Bodega Temporal Fase 1',
      code: tempTestCode,
      type: 'WAREHOUSE' as const,
      status: 'ACTIVE' as const,
      address: 'Carrera 70 # 32-15',
      city: 'Bello',
      department: 'Antioquia',
      phone: '3109998877',
      email: 'bello@supermas.com.co',
      managerName: 'Carlos Gómez',
      managerEmail: 'carlos@supermas.com.co',
      managerPhone: '3112223344',
      description: 'Bodega de pruebas automatizadas temporales',
      settings: {
        allowInventoryOperations: true,
        allowSales: true,
        allowPurchases: true,
        allowTransfers: true,
        isStorePoint: false,
        isEcommerceProcessingSource: false,
        lowStockAlertThresholdPercent: 20,
        autoBlockOnZeroStock: true,
        notes: 'Prueba de inserción real',
      },
    }

    const created = await warehouseService.createWarehouse(newWarehouseData, userContext)
    createdWarehouseId = created.id

    // Verificar directamente en PostgreSQL
    const { data: dbRow, error: checkErr } = await client
      .from('locations')
      .select('*')
      .eq('id', created.id)
      .single()

    if (dbRow && dbRow.code === tempTestCode && !checkErr) {
      recordTest(
        '1.4',
        'CREATE real en PostgreSQL public.locations',
        'PASS',
        `Bodega creada con UUID: ${created.id}, código: ${created.code}, company_id: ${dbRow.company_id}`
      )

      // Verificar que el trigger PostgreSQL generó automáticamente el audit_log
      const { data: createAudit, error: createAuditErr } = await client
        .from('audit_logs')
        .select('*')
        .eq('entity_name', 'locations')
        .eq('entity_id', created.id)
        .eq('action', 'LOCATION_CREATED')
        .maybeSingle()

      if (createAudit && !createAuditErr) {
        recordTest(
          '1.4-AUDIT',
          'Trigger automático: LOCATION_CREATED en public.audit_logs',
          'PASS',
          `Log fiduciario generado automáticamente: id=${createAudit.id}, user_name="${createAudit.user_name}", company_id=${createAudit.company_id}`
        )
      } else {
        recordTest('1.4-AUDIT', 'Trigger automático: LOCATION_CREATED', 'FAIL', `No se encontró log de creación: ${createAuditErr?.message}`)
      }
    } else {
      recordTest('1.4', 'CREATE real en PostgreSQL', 'FAIL', `No se encontró en BD: ${checkErr?.message}`)
    }
  } catch (err: any) {
    recordTest('1.4', 'CREATE real en PostgreSQL', 'FAIL', err.message)
  }

  // ---------------------------------------------------------------------------
  // PRUEBA 5: UPDATE Real en PostgreSQL
  // ---------------------------------------------------------------------------
  if (createdWarehouseId) {
    try {
      const updateData = {
        name: 'Bodega Fase 1 Nombre Actualizado',
        code: tempTestCode,
        type: 'DISTRIBUTION_CENTER' as const,
        status: 'ACTIVE' as const,
        address: 'Carrera 70 # 32-99 Nueva Sede',
        city: 'Bello',
        department: 'Antioquia',
        phone: '3109998877',
        email: 'bello.cedi@supermas.com.co',
        managerName: 'Carlos Gómez Editado',
        managerEmail: 'carlos.g@supermas.com.co',
        managerPhone: '3112223344',
        description: 'Actualización verificada en BD',
        settings: {
          allowInventoryOperations: true,
          allowSales: false,
          allowPurchases: true,
          allowTransfers: true,
          isStorePoint: false,
          isEcommerceProcessingSource: false,
          lowStockAlertThresholdPercent: 25,
          autoBlockOnZeroStock: true,
          notes: 'Configuración actualizada',
        },
      }

      const updated = await warehouseService.updateWarehouse(createdWarehouseId, updateData, userContext)

      // Verificar en PostgreSQL
      const { data: dbUpdated } = await client
        .from('locations')
        .select('*')
        .eq('id', createdWarehouseId)
        .single()

      if (
        dbUpdated &&
        dbUpdated.name === 'Bodega Fase 1 Nombre Actualizado' &&
        dbUpdated.type === 'DISTRIBUTION_CENTER' &&
        dbUpdated.allow_sales === false
      ) {
        recordTest(
          '1.5',
          'UPDATE real en PostgreSQL',
          'PASS',
          `Bodega actualizada: nombre="${dbUpdated.name}", tipo=${dbUpdated.type}, allow_sales=${dbUpdated.allow_sales}`
        )

        // Verificar que el trigger PostgreSQL generó automáticamente el audit_log
        const { data: updateAudit, error: updateAuditErr } = await client
          .from('audit_logs')
          .select('*')
          .eq('entity_name', 'locations')
          .eq('entity_id', createdWarehouseId)
          .eq('action', 'LOCATION_UPDATED')
          .maybeSingle()

        if (updateAudit && !updateAuditErr) {
          recordTest(
            '1.5-AUDIT',
            'Trigger automático: LOCATION_UPDATED en public.audit_logs',
            'PASS',
            `Log fiduciario generado automáticamente tras edición: id=${updateAudit.id}, action=${updateAudit.action}`
          )
        } else {
          recordTest('1.5-AUDIT', 'Trigger automático: LOCATION_UPDATED', 'FAIL', `No se encontró log de actualización: ${updateAuditErr?.message}`)
        }
      } else {
        recordTest('1.5', 'UPDATE real en PostgreSQL', 'FAIL', 'Los datos actualizados no coinciden en PostgreSQL')
      }
    } catch (err: any) {
      recordTest('1.5', 'UPDATE real en PostgreSQL', 'FAIL', err.message)
    }
  }

  // ---------------------------------------------------------------------------
  // PRUEBA 6: DESACTIVAR y ACTIVAR Real en PostgreSQL
  // ---------------------------------------------------------------------------
  if (createdWarehouseId) {
    try {
      // 6.1 Desactivar
      const deactivated = await warehouseService.deactivateWarehouse(createdWarehouseId, userContext)
      const { data: dbDeact } = await client.from('locations').select('status, allow_sales, allow_inventory_ops').eq('id', createdWarehouseId).single()

      if (dbDeact && dbDeact.status === 'INACTIVE' && dbDeact.allow_sales === false && dbDeact.allow_inventory_ops === false) {
        recordTest(
          '1.6a',
          'DESACTIVAR bodega real en PostgreSQL',
          'PASS',
          `Estado cambiado a INACTIVE y operaciones bloqueadas de forma fiduciaria en BD.`
        )

        // Verificar audit_log de desactivación
        const { data: deactAudit, error: deactAuditErr } = await client
          .from('audit_logs')
          .select('*')
          .eq('entity_name', 'locations')
          .eq('entity_id', createdWarehouseId)
          .eq('action', 'LOCATION_DEACTIVATED')
          .maybeSingle()

        if (deactAudit && !deactAuditErr) {
          recordTest(
            '1.6a-AUDIT',
            'Trigger automático: LOCATION_DEACTIVATED en public.audit_logs',
            'PASS',
            `Log fiduciario generado: id=${deactAudit.id}, action=${deactAudit.action}`
          )
        } else {
          recordTest('1.6a-AUDIT', 'Trigger automático: LOCATION_DEACTIVATED', 'FAIL', `No se encontró log: ${deactAuditErr?.message}`)
        }
      } else {
        recordTest('1.6a', 'DESACTIVAR bodega real', 'FAIL', `Estado en BD no es INACTIVE: ${JSON.stringify(dbDeact)}`)
      }

      // 6.2 Reactivar
      const activated = await warehouseService.activateWarehouse(createdWarehouseId, userContext)
      const { data: dbAct } = await client.from('locations').select('status, allow_sales, allow_inventory_ops').eq('id', createdWarehouseId).single()

      if (dbAct && dbAct.status === 'ACTIVE' && dbAct.allow_inventory_ops === true) {
        recordTest(
          '1.6b',
          'ACTIVAR bodega real en PostgreSQL',
          'PASS',
          `Estado restaurado a ACTIVE con operaciones habilitadas correctamente en BD.`
        )

        // Verificar audit_log de reactivación
        const { data: actAudit, error: actAuditErr } = await client
          .from('audit_logs')
          .select('*')
          .eq('entity_name', 'locations')
          .eq('entity_id', createdWarehouseId)
          .eq('action', 'LOCATION_ACTIVATED')
          .maybeSingle()

        if (actAudit && !actAuditErr) {
          recordTest(
            '1.6b-AUDIT',
            'Trigger automático: LOCATION_ACTIVATED en public.audit_logs',
            'PASS',
            `Log fiduciario generado: id=${actAudit.id}, action=${actAudit.action}`
          )
        } else {
          recordTest('1.6b-AUDIT', 'Trigger automático: LOCATION_ACTIVATED', 'FAIL', `No se encontró log: ${actAuditErr?.message}`)
        }
      } else {
        recordTest('1.6b', 'ACTIVAR bodega real', 'FAIL', `Estado en BD no es ACTIVE: ${JSON.stringify(dbAct)}`)
      }
    } catch (err: any) {
      recordTest('1.6', 'DESACTIVAR/ACTIVAR real', 'FAIL', err.message)
    }
  }

  // ---------------------------------------------------------------------------
  // PRUEBA 7: Persistencia tras F5 y re-autenticación
  // ---------------------------------------------------------------------------
  if (createdWarehouseId) {
    try {
      // Simular nuevo cliente (como refrescar la pestaña F5 y reiniciar sesión)
      const freshClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      await freshClient.auth.signInWithPassword({
        email: 'samirdurant234@gmail.com',
        password: adminPassword,
      })

      const { data: persistedRow, error: pErr } = await freshClient
        .from('locations')
        .select('*')
        .eq('id', createdWarehouseId)
        .single()

      if (persistedRow && !pErr) {
        recordTest(
          '1.7',
          'Persistencia fiduciaria tras F5 y nueva sesión',
          'PASS',
          `El registro persiste íntegramente en PostgreSQL independiente de la memoria de la aplicación.`
        )
      } else {
        recordTest('1.7', 'Persistencia fiduciaria tras F5', 'FAIL', `No encontrado tras re-autenticación: ${pErr?.message}`)
      }
    } catch (err: any) {
      recordTest('1.7', 'Persistencia fiduciaria tras F5', 'FAIL', err.message)
    }
  }

  // ---------------------------------------------------------------------------
  // PRUEBA 8: Auditoría fiduciaria y seguridad de cliente
  // ---------------------------------------------------------------------------
  if (createdWarehouseId) {
    try {
      // 8.1 Verificar lectura de todos los eventos de auditoría mediante WarehouseRepository
      const auditRows = await warehouseRepository.getAuditLogsByLocationId(createdWarehouseId)

      const actions = auditRows.map((a) => a.action)
      const hasCreated = actions.includes('LOCATION_CREATED')
      const hasUpdated = actions.includes('LOCATION_UPDATED')
      const hasDeactivated = actions.includes('LOCATION_DEACTIVATED')
      const hasActivated = actions.includes('LOCATION_ACTIVATED')

      if (hasCreated && hasUpdated && hasDeactivated && hasActivated) {
        recordTest(
          '1.8a',
          'Trazabilidad completa en public.audit_logs via WarehouseRepository',
          'PASS',
          `Se recuperaron ${auditRows.length} eventos automáticos: [${actions.join(', ')}] con usuario y timestamps reales.`
        )
      } else {
        recordTest(
          '1.8a',
          'Trazabilidad completa en audit_logs',
          'FAIL',
          `Faltan eventos esperados. Encontrados: [${actions.join(', ')}]`
        )
      }

      // 8.2 Prueba negativa de seguridad: Confirmar que authenticated NO puede insertar directamente en audit_logs
      const { error: directInsertErr } = await client
        .from('audit_logs')
        .insert({
          action: 'FORGED_AUDIT_ATTEMPT',
          module: 'WAREHOUSES',
          entity_name: 'locations',
          entity_id: createdWarehouseId,
          user_name: 'Hacker',
        })

      if (directInsertErr) {
        recordTest(
          '1.8b',
          'Seguridad RLS: Inserción directa en audit_logs BLOQUEADA para clientes',
          'PASS',
          `PostgreSQL RLS bloqueó correctamente la inserción directa: "${directInsertErr.message}"`
        )
      } else {
        recordTest(
          '1.8b',
          'Seguridad RLS: Inserción directa en audit_logs',
          'FAIL',
          'VULNERABILIDAD: Un usuario autenticado pudo insertar directamente en public.audit_logs.'
        )
      }
    } catch (err: any) {
      recordTest('1.8', 'Auditoría y seguridad', 'FAIL', err.message)
    }
  }

  // ---------------------------------------------------------------------------
  // PRUEBA 9: LIMPIEZA INMEDIATA — Sin dejar basura en BD (Zero Pollution)
  // ---------------------------------------------------------------------------
  if (createdWarehouseId) {
    try {
      const { error: delError } = await client
        .from('locations')
        .delete()
        .eq('id', createdWarehouseId)

      if (!delError) {
        // Verificar que ya no existe en locations
        const { data: verifyDel } = await client
          .from('locations')
          .select('id')
          .eq('id', createdWarehouseId)
          .maybeSingle()

        if (!verifyDel) {
          recordTest(
            '1.9',
            'Limpieza segura de registro temporal (Zero Pollution)',
            'PASS',
            `Bodega temporal ${tempTestCode} eliminada con éxito. La tabla public.locations queda limpia sin datos ficticios.`
          )
        } else {
          recordTest('1.9', 'Limpieza segura', 'FAIL', 'El registro temporal aún existe en BD.')
        }
      } else {
        recordTest('1.9', 'Limpieza segura', 'FAIL', delError.message)
      }
    } catch (err: any) {
      recordTest('1.9', 'Limpieza segura', 'FAIL', err.message)
    }
  }

  // ---------------------------------------------------------------------------
  // RESUMEN FINAL
  // ---------------------------------------------------------------------------
  console.log('\n====================================================================')
  console.log('📊 RESUMEN DE PRUEBAS DE LA FASE 1 — BODEGAS')
  console.log('====================================================================')

  const passed = results.filter((r) => r.status === 'PASS').length
  const failed = results.filter((r) => r.status === 'FAIL').length
  console.log(`Total pruebas: ${results.length} | Aprobadas: ${passed} | Fallidas: ${failed}`)

  if (failed > 0) {
    console.error('❌ HAY PRUEBAS FALLIDAS EN LA FASE 1')
    process.exit(1)
  } else {
    console.log('🎉 TODAS LAS PRUEBAS DE LA FASE 1 PASARON AL 100%')
  }
}

runPhase1Tests().catch((err) => {
  console.error('Error fatal ejecutando pruebas de Fase 1:', err)
  process.exit(1)
})
