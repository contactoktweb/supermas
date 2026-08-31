'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  LayoutDashboard,
  Boxes,
  ClipboardList,
  CircleDollarSign,
  ShoppingCart,
  Users,
  Building2,
  Truck,
  UserCheck,
  Settings,
} from 'lucide-react'
import {
  LocationWithMetrics,
  WarehouseInventoryItem,
  WarehouseMovement,
  WarehouseSaleRecord,
  WarehousePurchaseRecord,
  CustomerLocationRelation,
  SupplierLocationRelation,
  WarehouseTransfer,
  WarehouseUserAssignment,
  PeriodFilter,
  LocationSettings,
} from '../../types'
import { warehouseService } from '../../services/warehouse.service'
import { useWarehousePermissions } from '../../hooks/useWarehousePermissions'
import { WarehouseDetailHeader } from './WarehouseDetailHeader'
import { WarehouseDetailStats } from './WarehouseDetailStats'
import { WarehouseOverviewTab } from './tabs/WarehouseOverviewTab'
import { WarehouseInventoryTab } from './tabs/WarehouseInventoryTab'
import { WarehouseMovementsTab } from './tabs/WarehouseMovementsTab'
import { WarehouseSalesTab } from './tabs/WarehouseSalesTab'
import { WarehousePurchasesTab } from './tabs/WarehousePurchasesTab'
import { WarehouseCustomersTab } from './tabs/WarehouseCustomersTab'
import { WarehouseSuppliersTab } from './tabs/WarehouseSuppliersTab'
import { WarehouseTransfersTab } from './tabs/WarehouseTransfersTab'
import { WarehouseUsersTab } from './tabs/WarehouseUsersTab'
import { WarehouseSettingsTab } from './tabs/WarehouseSettingsTab'
import { WarehouseFormDrawer } from '../WarehouseFormDrawer'
import { WarehouseDeactivateDialog } from '../WarehouseDeactivateDialog'
import { WarehouseAdjustStockModal } from '../WarehouseAdjustStockModal'
import { WarehouseTransferModal } from '../WarehouseTransferModal'
import { WarehouseDetailSkeleton } from '../WarehouseSkeleton'
import { WarehouseErrorState } from '../WarehouseErrorState'
import { WarehouseToastContainer, ToastMessage } from '../WarehouseToast'
import { StockAdjustmentFormData, CreateTransferFormData, WarehouseFormData } from '../../schemas/warehouse.schema'

interface WarehouseDetailPageProps {
  warehouseId: string
  onBack: () => void
}

export function WarehouseDetailPage({ warehouseId, onBack }: WarehouseDetailPageProps) {
  const permissions = useWarehousePermissions('SUPERADMIN')
  const [warehouse, setWarehouse] = useState<LocationWithMetrics | null>(null)
  const [allWarehouses, setAllWarehouses] = useState<LocationWithMetrics[]>([])
  const [activeTab, setActiveTab] = useState<
    | 'RESUMEN'
    | 'INVENTARIO'
    | 'MOVIMIENTOS'
    | 'VENTAS'
    | 'COMPRAS'
    | 'CLIENTES'
    | 'PROVEEDORES'
    | 'TRANSFERENCIAS'
    | 'USUARIOS'
    | 'CONFIGURACION'
  >('RESUMEN')

  const [period, setPeriod] = useState<PeriodFilter>('TODAY')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Sub-resources
  const [inventory, setInventory] = useState<WarehouseInventoryItem[]>([])
  const [movements, setMovements] = useState<WarehouseMovement[]>([])
  const [sales, setSales] = useState<WarehouseSaleRecord[]>([])
  const [purchases, setPurchases] = useState<WarehousePurchaseRecord[]>([])
  const [customers, setCustomers] = useState<CustomerLocationRelation[]>([])
  const [suppliers, setSuppliers] = useState<SupplierLocationRelation[]>([])
  const [transfers, setTransfers] = useState<WarehouseTransfer[]>([])
  const [users, setUsers] = useState<WarehouseUserAssignment[]>([])

  // Modal / Drawer states
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false)
  const [adjustItem, setAdjustItem] = useState<WarehouseInventoryItem | null>(null)
  const [isTransferOpen, setIsTransferOpen] = useState(false)
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = useCallback((type: 'success' | 'error' | 'info', title: string, description?: string) => {
    setToasts((prev) => [
      ...prev,
      { id: `toast-${Date.now()}-${Math.random()}`, type, title, description },
    ])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const loadWarehouseData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const loc = await warehouseService.getWarehouse(warehouseId)
      if (!loc) {
        setError(`No se encontró la bodega solicitada (ID: ${warehouseId})`)
        return
      }
      setWarehouse(loc)

      const [
        allWhs,
        inv,
        movs,
        sal,
        pur,
        cust,
        supp,
        trns,
        usrs,
      ] = await Promise.all([
        warehouseService.listWarehouses({ pageSize: 100 }),
        warehouseService.getWarehouseInventory(warehouseId),
        warehouseService.getWarehouseMovements(warehouseId),
        warehouseService.getWarehouseSales(warehouseId, period),
        warehouseService.getWarehousePurchases(warehouseId, period),
        warehouseService.getWarehouseCustomers(warehouseId),
        warehouseService.getWarehouseSuppliers(warehouseId),
        warehouseService.getWarehouseTransfers(warehouseId),
        warehouseService.getWarehouseUsers(warehouseId),
      ])

      setAllWarehouses(allWhs.data)
      setInventory(inv)
      setMovements(movs)
      setSales(sal)
      setPurchases(pur)
      setCustomers(cust)
      setSuppliers(supp)
      setTransfers(trns)
      setUsers(usrs)
    } catch (err: any) {
      setError(err.message || 'Error al cargar los detalles de la bodega')
    } finally {
      setIsLoading(false)
    }
  }, [warehouseId, period])

  useEffect(() => {
    loadWarehouseData()
  }, [loadWarehouseData])

  const handleEditSubmit = async (data: WarehouseFormData) => {
    if (!warehouse) return
    const updated = await warehouseService.updateWarehouse(warehouse.id, data, {
      id: 'usr-admin',
      name: 'Admin Mauricio',
    })
    setWarehouse(updated)
    addToast('success', 'Cambios guardados', `Bodega ${updated.name} actualizada correctamente.`)
  }

  const handleDeactivateConfirm = async (id: string) => {
    const deactivated = await warehouseService.deactivateWarehouse(id, {
      id: 'usr-admin',
      name: 'Admin Mauricio',
    })
    setWarehouse(deactivated)
    addToast('info', 'Bodega desactivada', `La bodega ${deactivated.name} ha sido desactivada.`)
  }

  const handleAdjustStock = async (data: StockAdjustmentFormData) => {
    const { movement, updatedItem } = await warehouseService.adjustStock(data, {
      id: 'usr-admin',
      name: 'Admin Mauricio',
    })

    setInventory((prev) =>
      prev.map((i) => (i.productId === updatedItem.productId ? updatedItem : i))
    )
    setMovements((prev) => [movement, ...prev])

    // Update parent metrics
    const updatedWh = await warehouseService.getWarehouse(warehouseId)
    if (updatedWh) setWarehouse(updatedWh)

    addToast(
      'success',
      'Ajuste en Kardex registrado',
      `${data.type === 'AJUSTE_POSITIVO' ? '+' : '-'}${data.quantity} uds registradas con doc ${movement.documentRef}`
    )
  }

  const handleCreateTransfer = async (data: CreateTransferFormData) => {
    const newTr = await warehouseService.createTransfer(data, {
      id: 'usr-admin',
      name: 'Admin Mauricio',
    })
    setTransfers((prev) => [newTr, ...prev])
    addToast('success', 'Transferencia creada', `Transferencia ${newTr.code} generada en estado pendiente.`)
  }

  const handleUpdateSettings = async (settings: LocationSettings) => {
    if (!warehouse) return
    const updated = await warehouseService.updateWarehouse(
      warehouse.id,
      {
        name: warehouse.name,
        code: warehouse.code,
        type: warehouse.type,
        status: warehouse.status,
        address: warehouse.address,
        city: warehouse.city,
        department: warehouse.department,
        phone: warehouse.phone,
        email: warehouse.email,
        managerName: warehouse.managerName,
        managerEmail: warehouse.managerEmail,
        managerPhone: warehouse.managerPhone,
        description: warehouse.description,
        settings,
      },
      { id: 'usr-admin', name: 'Admin Mauricio' }
    )
    setWarehouse(updated)
    addToast('success', 'Configuración actualizada', 'Los parámetros de la bodega fueron guardados.')
  }

  const handleAssignUser = async (u: {
    name: string
    email: string
    role: WarehouseUserAssignment['userRole']
  }) => {
    if (!warehouse) return
    const newAssn = await warehouseService.assignUser(
      warehouse.id,
      `usr-${Date.now()}`,
      u.name,
      u.email,
      u.role,
      { id: 'usr-admin', name: 'Admin Mauricio' }
    )
    setUsers((prev) => [newAssn, ...prev])
    addToast('success', 'Usuario asignado', `${u.name} fue vinculado como ${u.role}.`)
  }

  const handleUnassignUser = async (userId: string) => {
    if (!warehouse) return
    await warehouseService.unassignUser(warehouse.id, userId, {
      id: 'usr-admin',
      name: 'Admin Mauricio',
    })
    setUsers((prev) => prev.filter((u) => u.userId !== userId))
    addToast('info', 'Usuario desvinculado', 'Se retiró la asignación del usuario en esta sede.')
  }

  if (isLoading && !warehouse) {
    return <WarehouseDetailSkeleton />
  }

  if (error || !warehouse) {
    return (
      <div className="page-enter">
        <WarehouseErrorState message={error || 'No se pudo cargar la información.'} onRetry={loadWarehouseData} />
      </div>
    )
  }

  const tabsList = [
    { key: 'RESUMEN', label: 'Resumen', icon: LayoutDashboard },
    { key: 'INVENTARIO', label: 'Inventario', icon: Boxes },
    { key: 'MOVIMIENTOS', label: 'Movimientos', icon: ClipboardList },
    { key: 'VENTAS', label: 'Ventas', icon: CircleDollarSign },
    { key: 'COMPRAS', label: 'Compras', icon: ShoppingCart },
    { key: 'CLIENTES', label: 'Clientes', icon: Users },
    { key: 'PROVEEDORES', label: 'Proveedores', icon: Building2 },
    { key: 'TRANSFERENCIAS', label: 'Transferencias', icon: Truck },
    { key: 'USUARIOS', label: 'Usuarios', icon: UserCheck },
    { key: 'CONFIGURACION', label: 'Configuración', icon: Settings },
  ] as const

  return (
    <div className="warehouse-detail-page page-enter">
      <WarehouseToastContainer toasts={toasts} onDismiss={removeToast} />

      <WarehouseDetailHeader
        warehouse={warehouse}
        permissions={permissions}
        onBack={onBack}
        onEdit={() => setIsEditOpen(true)}
        onTransfer={() => setIsTransferOpen(true)}
        onOpenKardexTab={() => setActiveTab('MOVIMIENTOS')}
        onDeactivate={() => setIsDeactivateOpen(true)}
      />

      <WarehouseDetailStats
        warehouse={warehouse}
        period={period}
        onPeriodChange={setPeriod}
        canReadCost={permissions.canReadCost}
      />

      {/* 10 Navigation Tabs */}
      <div className="tabs warehouse-detail-tabs" role="tablist">
        {tabsList.map((t) => {
          const Icon = t.icon
          const isActive = activeTab === t.key
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={isActive ? 'active' : ''}
              onClick={() => setActiveTab(t.key)}
            >
              <Icon size={14} />
              <span>{t.label}</span>
              {t.key === 'TRANSFERENCIAS' && warehouse.pendingTransfersCount > 0 && (
                <span className="tab-pill">{warehouse.pendingTransfersCount}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab Panels */}
      <div className="tab-panel-container">
        {activeTab === 'RESUMEN' && (
          <WarehouseOverviewTab
            warehouse={warehouse}
            inventory={inventory}
            transfers={transfers}
            movements={movements}
            canReadCost={permissions.canReadCost}
            onNavigateTab={(tabKey) => setActiveTab(tabKey as any)}
          />
        )}

        {activeTab === 'INVENTARIO' && (
          <WarehouseInventoryTab
            warehouse={warehouse}
            inventory={inventory}
            permissions={permissions}
            canReadCost={permissions.canReadCost}
            onAdjustStock={(item) => setAdjustItem(item)}
            onTransferStock={(item) => setIsTransferOpen(true)}
            onViewKardex={(productId) => setActiveTab('MOVIMIENTOS')}
          />
        )}

        {activeTab === 'MOVIMIENTOS' && (
          <WarehouseMovementsTab movements={movements} locationName={warehouse.name} />
        )}

        {activeTab === 'VENTAS' && (
          <WarehouseSalesTab sales={sales} canReadCost={permissions.canReadCost} />
        )}

        {activeTab === 'COMPRAS' && (
          <WarehousePurchasesTab purchases={purchases} canReadCost={permissions.canReadCost} />
        )}

        {activeTab === 'CLIENTES' && <WarehouseCustomersTab customers={customers} />}

        {activeTab === 'PROVEEDORES' && (
          <WarehouseSuppliersTab suppliers={suppliers} canReadCost={permissions.canReadCost} />
        )}

        {activeTab === 'TRANSFERENCIAS' && (
          <WarehouseTransfersTab
            transfers={transfers}
            currentWarehouse={warehouse}
            canCreateTransfer={permissions.canTransferStock}
            onOpenNewTransfer={() => setIsTransferOpen(true)}
          />
        )}

        {activeTab === 'USUARIOS' && (
          <WarehouseUsersTab
            users={users}
            warehouse={warehouse}
            canManageUsers={permissions.canManageUsers}
            onAssignUser={handleAssignUser}
            onUnassignUser={handleUnassignUser}
          />
        )}

        {activeTab === 'CONFIGURACION' && (
          <WarehouseSettingsTab
            warehouse={warehouse}
            onUpdateSettings={handleUpdateSettings}
          />
        )}
      </div>

      {/* Modals & Drawers */}
      <WarehouseFormDrawer
        mode="edit"
        warehouse={warehouse}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSubmit={handleEditSubmit}
      />

      <WarehouseDeactivateDialog
        warehouse={warehouse}
        isOpen={isDeactivateOpen}
        onClose={() => setIsDeactivateOpen(false)}
        onConfirm={handleDeactivateConfirm}
      />

      <WarehouseAdjustStockModal
        locationId={warehouse.id}
        locationName={warehouse.name}
        item={adjustItem}
        isOpen={Boolean(adjustItem)}
        onClose={() => setAdjustItem(null)}
        onSubmit={handleAdjustStock}
      />

      <WarehouseTransferModal
        originWarehouse={warehouse}
        allWarehouses={allWarehouses}
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        onSubmit={handleCreateTransfer}
      />
    </div>
  )
}
