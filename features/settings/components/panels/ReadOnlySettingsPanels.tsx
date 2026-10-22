'use client'

import React from 'react'
import type { AccountingOverview, CompanySettings, FiscalOverview } from '../../types'
import { SettingsModuleLink, SettingsNotice, SettingsReadOnlyList, SettingsSection } from './SettingsFormParts'

const formatDate = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('es-CO') : '—')

const ENVIRONMENT_LABELS: Record<string, string> = {
  HABILITACION: 'Habilitación (pruebas)',
  PRODUCCION: 'Producción',
}

const OPERATION_MODE_LABELS: Record<string, string> = {
  SOFTWARE_PROPIO: 'Software propio',
  PROVEEDOR_TECNOLOGICO: 'Proveedor tecnológico',
}

const REGIME_LABELS: Record<string, string> = {
  RESPONSABLE_DE_IVA: 'Responsable de IVA',
  NO_RESPONSABLE_DE_IVA: 'No responsable de IVA',
  REGIMEN_SIMPLE: 'Régimen Simple de Tributación',
  GRAN_CONTRIBUYENTE: 'Gran contribuyente',
}

export function BillingSettingsPanel({ fiscal }: { fiscal: FiscalOverview }) {
  const { resolution, software } = fiscal
  const available = resolution ? Math.max(resolution.finalRange - Math.max(resolution.lastAssignedNumber, resolution.initialRange - 1), 0) : 0
  return (
    <div className="settings-panel">
      <SettingsSection title="Resolución de numeración activa">
        {resolution ? (
          <SettingsReadOnlyList
            rows={[
              { label: 'Prefijo', value: resolution.prefix },
              { label: 'Resolución', value: resolution.resolutionNumber },
              { label: 'Rango autorizado', value: `${resolution.initialRange.toLocaleString('es-CO')} – ${resolution.finalRange.toLocaleString('es-CO')}` },
              { label: 'Último número usado', value: resolution.lastAssignedNumber ? resolution.lastAssignedNumber.toLocaleString('es-CO') : 'Ninguno' },
              { label: 'Números disponibles', value: available.toLocaleString('es-CO') },
              { label: 'Vigencia', value: `${formatDate(resolution.validFrom)} – ${formatDate(resolution.validTo)}` },
            ]}
          />
        ) : (
          <SettingsNotice tone="warning">No hay una resolución de numeración activa.</SettingsNotice>
        )}
      </SettingsSection>

      <SettingsSection title="Facturación electrónica">
        {software ? (
          <SettingsReadOnlyList
            rows={[
              { label: 'Software', value: software.softwareName },
              { label: 'Modalidad', value: OPERATION_MODE_LABELS[software.operationMode] || software.operationMode },
              { label: 'Ambiente', value: ENVIRONMENT_LABELS[software.environment] || software.environment },
              { label: 'Certificado digital', value: software.certificateExpiration ? `Vence ${formatDate(software.certificateExpiration)}` : 'Pendiente de cargar' },
            ]}
          />
        ) : (
          <SettingsNotice tone="warning">La facturación electrónica aún no está configurada.</SettingsNotice>
        )}
      </SettingsSection>

      <SettingsModuleLink href="/facturacion" icon="invoices" label="Ir a Facturación" />
    </div>
  )
}

export function TaxSettingsPanel({ company }: { company: CompanySettings | null }) {
  const responsibilities = company?.rutResponsibilities ? company.rutResponsibilities.split(';').join(', ') : '—'
  const isWithholdingAgent = company?.rutResponsibilities.split(';').includes('15') ?? false
  return (
    <div className="settings-panel">
      <SettingsSection title="Perfil tributario de la empresa">
        <SettingsReadOnlyList
          rows={[
            { label: 'Régimen', value: REGIME_LABELS[company?.fiscalRegime ?? ''] || company?.fiscalRegime || '—' },
            { label: 'Responsabilidades RUT', value: responsibilities },
            { label: 'Autorretenedor (15)', value: isWithholdingAgent ? 'Sí' : 'No' },
            { label: 'Responsabilidad en factura', value: company?.dianTaxLevelCodes || '—' },
          ]}
        />
        <SettingsNotice>El perfil se edita en Empresa → Datos fiscales para la DIAN.</SettingsNotice>
      </SettingsSection>
      <SettingsModuleLink href="/impuestos" icon="taxes" label="Ir a Impuestos y tarifas" />
    </div>
  )
}

export function AccountingSettingsPanel({ accounting }: { accounting: AccountingOverview }) {
  return (
    <div className="settings-panel">
      <SettingsSection title="Periodos contables abiertos">
        {accounting.openPeriods.length > 0 ? (
          <SettingsReadOnlyList rows={accounting.openPeriods.map((p) => ({ label: p.code, value: p.label }))} />
        ) : (
          <SettingsNotice tone="warning">No hay periodos contables abiertos.</SettingsNotice>
        )}
      </SettingsSection>
      <SettingsSection title="Cuentas de enlace PUC">
        <SettingsReadOnlyList
          rows={accounting.defaultAccounts.map((a) => ({ label: a.purpose, value: `${a.code} · ${a.name}` }))}
        />
      </SettingsSection>
      <SettingsModuleLink href="/contabilidad" icon="accounting" label="Ir a Contabilidad" />
    </div>
  )
}
