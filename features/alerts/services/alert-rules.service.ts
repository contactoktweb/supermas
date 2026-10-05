/**
 * SUPER MÁS ERP/POS - Motor de Reglas Automáticas (AlertRulesService)
 *
 * Escanea periódicamente o bajo demanda los registros reales en PostgreSQL de todos los módulos
 * del ERP, evaluando anomalías y creando alertas sin generar duplicados.
 */

import { supabaseClient } from '@/lib/supabase/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveUserCompanyId } from '@/lib/supabase/tenant'
import { alertRepository } from '../repositories/alert.repository'
import { AlertDefinitions, AlertCandidate } from '../rules/alert-definitions'
import { RuleEvaluationResult, AlertItem } from '../types'
import { auditService } from '@/features/audit/services/audit.service'

function getDbClient() {
  if (typeof window === 'undefined' && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return supabaseAdmin
  }
  return supabaseClient
}

export class AlertRulesService {
  /**
   * Resuelve el company_id desde el contexto o parámetro
   */
  private async resolveCompanyId(preferredCompanyId?: string): Promise<string> {
    if (preferredCompanyId) return preferredCompanyId
    const resolved = await resolveUserCompanyId()
    if (resolved) return resolved

    const client = getDbClient()
    const {
      data: { user },
    } = await client.auth.getUser()
    const appMetadata = user?.app_metadata
    if (appMetadata?.company_id) return appMetadata.company_id

    throw new Error('No se pudo resolver el company_id para el motor de reglas de alertas.')
  }

  /**
   * Ejecuta la evaluación completa de todas las reglas habilitadas del ERP contra PostgreSQL.
   * Aplica estricta deduplicación para no crear alertas redundantes.
   */
  async evaluateAllRules(preferredCompanyId?: string): Promise<RuleEvaluationResult> {
    const client = getDbClient()
    const companyId = await this.resolveCompanyId(preferredCompanyId)

    const rules = await alertRepository.getRules(companyId)
    const enabledRules = rules.filter((r) => r.enabled)
    const now = new Date()

    // 1. Cargar datos reales de PostgreSQL para evaluación
    // A. Inventario (stock_levels + products)
    const { data: dbProducts } = await client
      .from('products')
      .select('id, sku, barcode, name, min_stock_threshold, critical_stock_threshold')
      .eq('company_id', companyId)
      .eq('is_active', true)

    const { data: dbStockLevels } = await client
      .from('stock_levels')
      .select('product_id, location_id, quantity, locations:location_id(id, name)')
      .eq('company_id', companyId)

    const stockMapped = (dbStockLevels || []).map((s: any) => ({
      productId: s.product_id,
      locationId: s.location_id,
      locationName: s.locations?.name || 'Bodega',
      currentStock: Number(s.quantity) || 0,
    }))

    const productsMapped = (dbProducts || []).map((p: any) => ({
      id: p.id,
      sku: p.sku,
      barcode: p.barcode,
      name: p.name,
      minStockThreshold: p.min_stock_threshold,
      criticalStockThreshold: p.critical_stock_threshold,
    }))

    // B. Compras pendientes
    const { data: dbPurchases } = await client
      .from('purchases')
      .select(
        'id, purchase_number, supplier_invoice_number, due_date, pending_balance, status, destination_location_id, suppliers:supplier_id(name), locations:destination_location_id(name)'
      )
      .eq('company_id', companyId)
      .neq('status', 'PAID')
      .gt('pending_balance', 0)

    const purchasesMapped = (dbPurchases || []).map((p: any) => ({
      id: p.id,
      purchaseNumber: p.purchase_number,
      supplierInvoiceNumber: p.supplier_invoice_number,
      supplierName: p.suppliers?.name || 'Proveedor',
      dueDate: p.due_date,
      pendingBalance: Number(p.pending_balance) || 0,
      destinationLocationId: p.destination_location_id,
      destinationLocationName: p.locations?.name || 'Bodega Principal',
      status: p.status,
    }))

    // C. Pedidos Web
    const { data: dbWebOrders } = await client
      .from('web_orders')
      .select(
        'id, order_number, channel, customer_name, fulfillment_status, total, subtotal, created_at, dispatch_location_id, locations:dispatch_location_id(name)'
      )
      .eq('company_id', companyId)
      .eq('fulfillment_status', 'PENDING')

    const webOrdersMapped = (dbWebOrders || []).map((w: any) => ({
      id: w.id,
      orderNumber: w.order_number,
      customerName: w.customer_name,
      status: 'PENDING',
      totalAmount: Number(w.total) || Number(w.subtotal) || 0,
      createdAt: w.created_at,
      assignedLocationId: w.dispatch_location_id,
      assignedLocationName: w.locations?.name || 'Bodega Ecommerce',
    }))

    // D. Transferencias en tránsito
    const { data: dbTransfers } = await client
      .from('transfers')
      .select(
        'id, transfer_number, status, origin_location_id, destination_location_id, shipped_at, created_at, origin:origin_location_id(name), dest:destination_location_id(name)'
      )
      .eq('company_id', companyId)
      .eq('status', 'IN_TRANSIT')

    const transfersMapped = (dbTransfers || []).map((t: any) => ({
      id: t.id,
      code: t.transfer_number,
      status: 'IN_TRANSIT',
      dispatchedAt: t.shipped_at || t.created_at,
      createdAt: t.created_at,
      originLocationName: t.origin?.name || 'Bodega Origen',
      destinationLocationId: t.destination_location_id,
      destinationLocationName: t.dest?.name || 'Bodega Destino',
    }))

    // E. Cajas registradoras / Sesiones abiertas
    const { data: dbSessions } = await client
      .from('cash_sessions')
      .select(
        'id, session_number, register_id, difference_amount, opened_at, closed_at, status, users:cashier_user_id(full_name)'
      )
      .eq('company_id', companyId)
      .eq('status', 'OPEN')

    const cashMapped = (dbSessions || []).map((s: any) => {
      const opened = new Date(s.opened_at).getTime()
      const openHours = (now.getTime() - opened) / (1000 * 60 * 60)
      const cashierName = s.users?.full_name || 'Cajero'
      return {
        id: s.id,
        code: s.session_number,
        name: `Caja ${s.session_number}`,
        difference: Number(s.difference_amount) || 0,
        openHours,
        cashierName,
      }
    })

    // F. Facturas rechazadas
    const { data: dbInvoices } = await client
      .from('invoices')
      .select('id, invoice_number, dian_status, total, location_id, customers:customer_id(first_name, last_name, company_name)')
      .eq('company_id', companyId)
      .eq('dian_status', 'RECHAZADA_DIAN')

    const invoicesMapped = (dbInvoices || []).map((i: any) => ({
      id: i.id,
      invoiceNumber: i.invoice_number,
      customerName:
        i.customers?.company_name ||
        `${i.customers?.first_name || ''} ${i.customers?.last_name || ''}`.trim() ||
        'Cliente',
      total: Number(i.total) || 0,
      dianStatus: i.dian_status,
      locationId: i.location_id,
    }))

    // G. Asientos contables
    const { data: dbEntries } = await client
      .from('accounting_entries')
      .select('id, entry_number, location_id, accounting_entry_lines(debit_amount, credit_amount)')
      .eq('company_id', companyId)
      .limit(50)

    const accountingMapped = (dbEntries || []).map((e: any) => ({
      id: e.id,
      entryNumber: e.entry_number,
      locationId: e.location_id,
      lines: (e.accounting_entry_lines || []).map((l: any) => ({
        debit: Number(l.debit_amount) || 0,
        credit: Number(l.credit_amount) || 0,
      })),
    }))

    // 2. Recopilar candidatos de todos los evaluadores de dominio
    const candidates: AlertCandidate[] = [
      ...AlertDefinitions.evaluateInventory({
        stockLevels: stockMapped,
        products: productsMapped,
        rules: enabledRules,
      }),
      ...AlertDefinitions.evaluatePurchases({
        purchases: purchasesMapped,
        rules: enabledRules,
        now,
      }),
      ...AlertDefinitions.evaluateInvoicing({
        invoices: invoicesMapped,
        rules: enabledRules,
      }),
      ...AlertDefinitions.evaluateCashRegisters({
        cashRegisters: cashMapped,
        rules: enabledRules,
        now,
      }),
      ...AlertDefinitions.evaluateWebOrders({
        webOrders: webOrdersMapped,
        rules: enabledRules,
        now,
      }),
      ...AlertDefinitions.evaluateTransfers({
        transfers: transfersMapped,
        rules: enabledRules,
        now,
      }),
      ...AlertDefinitions.evaluateAccounting({
        accountingEntries: accountingMapped,
        rules: enabledRules,
      }),
    ]

    // 3. Obtener alertas actualmente activas para deduplicación
    const activeAlerts = await alertRepository.getActiveAlerts(companyId)

    let newAlertsCreated = 0

    // 4. Crear únicamente aquellas que no tengan alerta activa para la misma entidad y regla
    for (const candidate of candidates) {
      const alreadyExists = activeAlerts.some(
        (active) =>
          (active.ruleId === candidate.ruleId || active.code.includes(candidate.module.slice(0, 3))) &&
          active.entityType === candidate.entityType &&
          active.entityId === candidate.entityId &&
          (!candidate.locationId || active.locationId === candidate.locationId)
      )

      if (!alreadyExists) {
        const created = await alertRepository.createAlert(
          {
            ruleId: candidate.ruleId,
            title: candidate.title,
            description: candidate.description,
            module: candidate.module,
            priority: candidate.priority,
            status: 'NEW',
            entityType: candidate.entityType,
            entityId: candidate.entityId,
            entityReference: candidate.entityReference,
            locationId: candidate.locationId,
            locationName: candidate.locationName,
            assignedRole: candidate.assignedRole,
            assignedUserId: null,
            assignedUserName: null,
            readAt: null,
            readByUserId: null,
            attendedAt: null,
            attendedByUserId: null,
            attendedByUserName: null,
            attendedComment: null,
            resolvedAt: null,
            resolvedByUserId: null,
            resolvedByUserName: null,
            solutionNotes: null,
            closedAt: null,
            closedByUserId: null,
            metadata: candidate.metadata,
          },
          companyId
        )

        // Registrar en auditoría inmutable
        await auditService.log({
          companyId,
          action: 'ALERT_CREATED',
          module: 'ALERTS',
          entityType: candidate.entityType,
          entityId: created.id,
          entityReference: created.code,
          userId: 'system',
          userName: 'Sistema de Reglas Automáticas',
          userRole: 'SYSTEM',
          locationId: candidate.locationId || undefined,
          locationName: candidate.locationName || undefined,
          level: candidate.priority === 'CRITICA' ? 'CRITICAL' : 'INFO',
          details: `Alerta automática generada (${candidate.title}) bajo regla ${candidate.ruleId}.`,
        })

        newAlertsCreated++
        activeAlerts.push(created)
      }
    }

    return {
      evaluatedRules: enabledRules.length,
      newAlertsCreated,
      activeAlertsCount: activeAlerts.length,
      timestamp: now.toISOString(),
    }
  }
}

export const alertRulesService = new AlertRulesService()
