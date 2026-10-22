'use client'

import React, { useEffect, useState } from 'react'
import { SelectField } from '@/components/ui/SelectField'
import type { CompanySettings } from '../../types'
import {
  SettingsField,
  SettingsNotice,
  SettingsSaveButton,
  SettingsSection,
  SettingsTextInput,
} from './SettingsFormParts'

const EMPTY_COMPANY: CompanySettings = {
  companyName: '',
  legalName: '',
  nit: '',
  dv: '',
  fiscalRegime: 'RESPONSABLE_DE_IVA',
  economicActivityCode: '',
  legalRepresentative: '',
  legalRepresentativeDoc: '',
  address: '',
  city: '',
  department: '',
  country: 'Colombia',
  postalCode: '',
  phone: '',
  email: '',
  billingEmail: '',
  currency: 'COP',
  status: 'ACTIVE',
  dianDepartmentCode: '',
  dianMunicipalityCode: '',
  dianOrganizationType: '1',
  rutResponsibilities: '',
  dianTaxLevelCodes: '',
  dianTaxSchemeCode: '01',
  updatedAt: '',
}

interface CompanySettingsPanelProps {
  company: CompanySettings | null
  isSaving?: boolean
  onSave: (value: CompanySettings) => Promise<boolean>
}

export function CompanySettingsPanel({ company, isSaving, onSave }: CompanySettingsPanelProps) {
  const [form, setForm] = useState<CompanySettings>(company ?? EMPTY_COMPANY)
  useEffect(() => setForm(company ?? EMPTY_COMPANY), [company])

  const set = <K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  return (
    <div className="settings-panel">
      {!company?.id && (
        <SettingsNotice tone="warning">
          Registra los datos legales de la empresa. Son los que aparecen en facturas, recibos y reportes.
        </SettingsNotice>
      )}

      <SettingsSection title="Identificación">
        <div className="settings-grid-2">
          <SettingsField label="Nombre comercial" required>
            {(id) => <SettingsTextInput id={id} value={form.companyName} onChange={(v) => set('companyName', v)} placeholder="Super Más" />}
          </SettingsField>
          <SettingsField label="Razón social" required>
            {(id) => <SettingsTextInput id={id} value={form.legalName} onChange={(v) => set('legalName', v)} placeholder="Super Más S.A.S." />}
          </SettingsField>
        </div>
        <div className="settings-grid-3">
          <SettingsField label="NIT (sin DV)" required>
            {(id) => <SettingsTextInput id={id} value={form.nit} onChange={(v) => set('nit', v.replace(/\D/g, ''))} inputMode="numeric" maxLength={15} mono />}
          </SettingsField>
          <SettingsField label="DV" required>
            {(id) => <SettingsTextInput id={id} value={form.dv} onChange={(v) => set('dv', v.replace(/\D/g, '').slice(0, 1))} inputMode="numeric" maxLength={1} mono />}
          </SettingsField>
          <SettingsField label="Actividad CIIU" required>
            {(id) => <SettingsTextInput id={id} value={form.economicActivityCode} onChange={(v) => set('economicActivityCode', v.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" maxLength={4} mono />}
          </SettingsField>
        </div>
        <div className="settings-grid-2">
          <SettingsField label="Representante legal">
            {(id) => <SettingsTextInput id={id} value={form.legalRepresentative} onChange={(v) => set('legalRepresentative', v)} />}
          </SettingsField>
          <SettingsField label="Documento del representante">
            {(id) => <SettingsTextInput id={id} value={form.legalRepresentativeDoc} onChange={(v) => set('legalRepresentativeDoc', v)} mono />}
          </SettingsField>
        </div>
      </SettingsSection>

      <SettingsSection title="Ubicación y contacto">
        <SettingsField label="Dirección principal" required>
          {(id) => <SettingsTextInput id={id} value={form.address} onChange={(v) => set('address', v)} />}
        </SettingsField>
        <div className="settings-grid-3">
          <SettingsField label="Ciudad" required>
            {(id) => <SettingsTextInput id={id} value={form.city} onChange={(v) => set('city', v)} />}
          </SettingsField>
          <SettingsField label="Departamento" required>
            {(id) => <SettingsTextInput id={id} value={form.department} onChange={(v) => set('department', v)} />}
          </SettingsField>
          <SettingsField label="Código postal">
            {(id) => <SettingsTextInput id={id} value={form.postalCode} onChange={(v) => set('postalCode', v.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" maxLength={6} mono />}
          </SettingsField>
        </div>
        <div className="settings-grid-3">
          <SettingsField label="Teléfono" required>
            {(id) => <SettingsTextInput id={id} type="tel" value={form.phone} onChange={(v) => set('phone', v)} />}
          </SettingsField>
          <SettingsField label="Correo general" required>
            {(id) => <SettingsTextInput id={id} type="email" value={form.email} onChange={(v) => set('email', v)} />}
          </SettingsField>
          <SettingsField label="Correo de facturación" hint="Recibe las respuestas de la DIAN.">
            {(id) => <SettingsTextInput id={id} type="email" value={form.billingEmail} onChange={(v) => set('billingEmail', v)} />}
          </SettingsField>
        </div>
      </SettingsSection>

      <SettingsSection title="Datos fiscales para la DIAN">
        <div className="settings-grid-2">
          <SettingsField label="Régimen tributario" required>
            {(id) => (
              <SelectField id={id} value={form.fiscalRegime} onChange={(v) => set('fiscalRegime', v)} size="md">
                <option value="RESPONSABLE_DE_IVA">Responsable de IVA</option>
                <option value="NO_RESPONSABLE_DE_IVA">No responsable de IVA</option>
                <option value="REGIMEN_SIMPLE">Régimen Simple de Tributación</option>
                <option value="GRAN_CONTRIBUYENTE">Gran contribuyente</option>
              </SelectField>
            )}
          </SettingsField>
          <SettingsField label="Tipo de persona" required>
            {(id) => (
              <SelectField id={id} value={form.dianOrganizationType} onChange={(v) => set('dianOrganizationType', v as '1' | '2')} size="md">
                <option value="1">Persona jurídica</option>
                <option value="2">Persona natural</option>
              </SelectField>
            )}
          </SettingsField>
        </div>
        <div className="settings-grid-3">
          <SettingsField label="Código departamento" required hint="DIVIPOLA, 2 dígitos.">
            {(id) => <SettingsTextInput id={id} value={form.dianDepartmentCode} onChange={(v) => set('dianDepartmentCode', v.replace(/\D/g, '').slice(0, 2))} inputMode="numeric" maxLength={2} mono />}
          </SettingsField>
          <SettingsField label="Código municipio" required hint="DIVIPOLA, 5 dígitos.">
            {(id) => <SettingsTextInput id={id} value={form.dianMunicipalityCode} onChange={(v) => set('dianMunicipalityCode', v.replace(/\D/g, '').slice(0, 5))} inputMode="numeric" maxLength={5} mono />}
          </SettingsField>
          <SettingsField label="Esquema tributario" required>
            {(id) => (
              <SelectField id={id} value={form.dianTaxSchemeCode} onChange={(v) => set('dianTaxSchemeCode', v)} size="md">
                <option value="01">01 · IVA</option>
                <option value="04">04 · INC</option>
                <option value="ZA">ZA · IVA e INC</option>
                <option value="ZZ">ZZ · No aplica</option>
              </SelectField>
            )}
          </SettingsField>
        </div>
        <div className="settings-grid-2">
          <SettingsField label="Responsabilidades del RUT" required hint="Casilla 53 del RUT, separadas por punto y coma.">
            {(id) => <SettingsTextInput id={id} value={form.rutResponsibilities} onChange={(v) => set('rutResponsibilities', v.toUpperCase().replace(/\s/g, ''))} placeholder="05;07;48" mono />}
          </SettingsField>
          <SettingsField label="Responsabilidad fiscal en factura" required hint="Código que se informa en la factura electrónica.">
            {(id) => <SettingsTextInput id={id} value={form.dianTaxLevelCodes} onChange={(v) => set('dianTaxLevelCodes', v.toUpperCase().replace(/\s/g, ''))} placeholder="R-99-PN" mono />}
          </SettingsField>
        </div>
      </SettingsSection>

      <SettingsSaveButton
        isSaving={isSaving}
        label={company?.id ? 'Guardar información de la empresa' : 'Registrar empresa'}
        onClick={() => void onSave(form)}
      />
    </div>
  )
}
