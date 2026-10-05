'use client'

import { useState, useEffect, useCallback } from 'react'
import { treasuryService } from '../services/treasury.service'
import { useAuth } from '@/features/auth/hooks/useAuth'
import {
  BankAccount,
  TreasuryPayment,
  TreasuryReceipt,
  TreasuryStats,
  BankMovement,
} from '../types'

export type TreasuryTab = 'banks' | 'payments' | 'receipts' | 'flow' | 'movements'

export function useTreasury() {
  const { user: authUser } = useAuth()
  const [activeTab, setActiveTab] = useState<TreasuryTab>('banks')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [stats, setStats] = useState<TreasuryStats>({
    totalCashAndBanks: 0,
    scheduledPaymentsTotal: 0,
    scheduledPaymentsCount: 0,
    paidThisMonthTotal: 0,
    collectedThisMonthTotal: 0,
    activeAccountsCount: 0,
  })

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [payments, setPayments] = useState<TreasuryPayment[]>([])
  const [receipts, setReceipts] = useState<TreasuryReceipt[]>([])
  const [bankMovements, setBankMovements] = useState<BankMovement[]>([])

  const [filters, setFilters] = useState<{
    status?: string
    bankAccountId?: string
    query?: string
  }>({
    status: 'ALL',
    bankAccountId: 'ALL',
    query: '',
  })

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const [statsData, accountsData, paymentsData, receiptsData, movementsData] = await Promise.all([
        treasuryService.getStats(),
        treasuryService.getBankAccounts(),
        treasuryService.getPayments(filters),
        treasuryService.getReceipts(filters),
        treasuryService.getBankMovements(filters.bankAccountId),
      ])

      setStats(statsData)
      setBankAccounts(accountsData)
      setPayments(paymentsData)
      setReceipts(receiptsData)
      setBankMovements(movementsData)
    } catch (err: any) {
      setError(err.message || 'Error al cargar datos de tesorería')
    } finally {
      setIsLoading(false)
    }
  }, [filters])

  useEffect(() => {
    loadData()
  }, [loadData])

  const executePayment = async (
    paymentId: string,
    executionData: {
      paymentDate: string
      bankAccountId: string
      referenceNumber: string
      supportDocumentUrl?: string
    }
  ) => {
    const user = {
      id: authUser?.id || 'usr-system',
      name: authUser?.fullName || 'Administrador',
      role: authUser?.roleCode || 'SUPERADMIN',
    }
    const result = await treasuryService.executePayment(paymentId, executionData, user)
    await loadData()
    return result
  }

  const executeCustomerCollection = async (data: {
    customerId: string
    customerName: string
    customerDoc: string
    invoiceId?: string
    invoiceNumber?: string
    bankAccountId: string
    amount: number
    receiptDate: string
    paymentMethod?: 'TRANSFERENCIA' | 'CONSIGNACION' | 'EFECTIVO' | 'TARJETA'
    referenceNumber?: string
    notes?: string
  }) => {
    const user = {
      id: authUser?.id || 'usr-system',
      name: authUser?.fullName || 'Administrador',
      role: authUser?.roleCode || 'SUPERADMIN',
    }
    const result = await treasuryService.executeCustomerCollection(data, user)
    await loadData()
    return result
  }

  const createBankAccount = async (data: {
    bankName: string
    accountNumber: string
    accountType?: string
    currency?: string
    initialBalance?: number
    locationId?: string
    description?: string
  }) => {
    const user = {
      id: authUser?.id || 'usr-system',
      name: authUser?.fullName || 'Administrador',
      role: authUser?.roleCode || 'SUPERADMIN',
    }
    const result = await treasuryService.createBankAccount(data, user)
    await loadData()
    return result
  }

  const reconcileMovement = async (movementId: string, reconciled: boolean = true) => {
    const user = {
      id: authUser?.id || 'usr-system',
      name: authUser?.fullName || 'Administrador',
      role: authUser?.roleCode || 'SUPERADMIN',
    }
    const result = await treasuryService.reconcileMovement(movementId, reconciled, user)
    await loadData()
    return result
  }

  return {
    activeTab,
    setActiveTab,
    isLoading,
    error,
    stats,
    bankAccounts,
    payments,
    receipts,
    bankMovements,
    filters,
    setFilters,
    loadData,
    executePayment,
    executeCustomerCollection,
    createBankAccount,
    reconcileMovement,
  }
}

