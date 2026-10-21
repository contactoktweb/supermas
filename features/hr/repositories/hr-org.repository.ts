/**
 * Recursos Humanos — estructura organizacional (hr_areas, hr_positions) y catálogos de apoyo.
 * Opera bajo RLS: lectura con hr.read y escritura con hr.manage. La empresa la fija la base.
 */
import { supabaseClient } from '@/lib/supabase/client'
import { resolveUserCompanyId } from '@/lib/supabase/tenant'
import { toHrError } from '../utils/hr-errors'
import type { HrArea, HrOption, HrPosition, HrUserOption } from '../types'
import type { AreaFormData, PositionFormData } from '../schemas/hr.schema'

interface AreaRow {
  id: string
  code: string | null
  name: string
  description: string | null
  is_active: boolean
}

interface PositionRow extends AreaRow {
  area_id: string | null
  arl_risk_class: number | null
  area: { name: string | null } | { name: string | null }[] | null
}

interface EmployeeAssignmentRow {
  area_id: string | null
  position_id: string
}

const areaName = (relation: PositionRow['area']) =>
  (Array.isArray(relation) ? relation[0]?.name : relation?.name) ?? null

export class HrOrgRepository {
  private async activeAssignments(): Promise<EmployeeAssignmentRow[]> {
    const { data, error } = await supabaseClient
      .from('hr_employees')
      .select('area_id, position_id')
      .neq('status', 'RETIRADO')
    if (error) throw toHrError(error, 'No se pudo consultar la asignación de empleados.')
    return (data ?? []) as EmployeeAssignmentRow[]
  }

  async listAreas(): Promise<HrArea[]> {
    const [areasResult, positionsResult, assignments] = await Promise.all([
      supabaseClient.from('hr_areas').select('id, code, name, description, is_active').order('name'),
      supabaseClient.from('hr_positions').select('area_id'),
      this.activeAssignments(),
    ])
    if (areasResult.error) throw toHrError(areasResult.error, 'No se pudieron cargar las áreas.')
    if (positionsResult.error) throw toHrError(positionsResult.error, 'No se pudieron cargar los cargos.')

    const positionsByArea = new Map<string, number>()
    for (const row of (positionsResult.data ?? []) as { area_id: string | null }[]) {
      if (row.area_id) positionsByArea.set(row.area_id, (positionsByArea.get(row.area_id) ?? 0) + 1)
    }
    const employeesByArea = new Map<string, number>()
    for (const row of assignments) {
      if (row.area_id) employeesByArea.set(row.area_id, (employeesByArea.get(row.area_id) ?? 0) + 1)
    }

    return ((areasResult.data ?? []) as AreaRow[]).map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      isActive: row.is_active,
      positionsCount: positionsByArea.get(row.id) ?? 0,
      employeesCount: employeesByArea.get(row.id) ?? 0,
    }))
  }

  async listPositions(): Promise<HrPosition[]> {
    const [positionsResult, assignments] = await Promise.all([
      supabaseClient
        .from('hr_positions')
        .select('id, code, name, description, is_active, area_id, arl_risk_class, area:hr_areas(name)')
        .order('name'),
      this.activeAssignments(),
    ])
    if (positionsResult.error) throw toHrError(positionsResult.error, 'No se pudieron cargar los cargos.')

    const employeesByPosition = new Map<string, number>()
    for (const row of assignments) {
      employeesByPosition.set(row.position_id, (employeesByPosition.get(row.position_id) ?? 0) + 1)
    }

    return ((positionsResult.data ?? []) as unknown as PositionRow[]).map((row) => ({
      id: row.id,
      areaId: row.area_id,
      areaName: areaName(row.area),
      code: row.code,
      name: row.name,
      description: row.description,
      arlRiskClass: row.arl_risk_class,
      isActive: row.is_active,
      employeesCount: employeesByPosition.get(row.id) ?? 0,
    }))
  }

  async createArea(data: AreaFormData): Promise<void> {
    const companyId = await resolveUserCompanyId(supabaseClient)
    const { error } = await supabaseClient.from('hr_areas').insert({
      company_id: companyId,
      name: data.name,
      code: data.code,
      description: data.description,
      is_active: data.isActive,
    })
    if (error) throw toHrError(error, 'No se pudo crear el área.')
  }

  async updateArea(id: string, data: AreaFormData): Promise<void> {
    const { error } = await supabaseClient
      .from('hr_areas')
      .update({ name: data.name, code: data.code, description: data.description, is_active: data.isActive })
      .eq('id', id)
    if (error) throw toHrError(error, 'No se pudo actualizar el área.')
  }

  async createPosition(data: PositionFormData): Promise<void> {
    const companyId = await resolveUserCompanyId(supabaseClient)
    const { error } = await supabaseClient.from('hr_positions').insert({
      company_id: companyId,
      name: data.name,
      code: data.code,
      area_id: data.areaId,
      description: data.description,
      arl_risk_class: data.arlRiskClass,
      is_active: data.isActive,
    })
    if (error) throw toHrError(error, 'No se pudo crear el cargo.')
  }

  async updatePosition(id: string, data: PositionFormData): Promise<void> {
    const { error } = await supabaseClient
      .from('hr_positions')
      .update({
        name: data.name,
        code: data.code,
        area_id: data.areaId,
        description: data.description,
        arl_risk_class: data.arlRiskClass,
        is_active: data.isActive,
      })
      .eq('id', id)
    if (error) throw toHrError(error, 'No se pudo actualizar el cargo.')
  }

  /** Sedes (bodegas y puntos de venta) de la empresa. */
  async listLocations(): Promise<HrOption[]> {
    const { data, error } = await supabaseClient.from('locations').select('id, name').order('name')
    if (error) throw toHrError(error, 'No se pudieron cargar las sedes.')
    return (data ?? []) as HrOption[]
  }

  /** Usuarios del ERP visibles para el rol (solo lectura, para vincular un empleado). */
  async listErpUsers(): Promise<HrUserOption[]> {
    const { data, error } = await supabaseClient
      .from('users')
      .select('id, full_name, email')
      .eq('is_active', true)
      .order('full_name')
    if (error) return []
    return ((data ?? []) as { id: string; full_name: string; email: string }[]).map((row) => ({
      id: row.id,
      name: row.full_name,
      email: row.email,
    }))
  }

  /** Empleados vigentes para selectores (jefe inmediato, novedades, vacaciones). */
  async listEmployeeOptions(): Promise<HrOption[]> {
    const { data, error } = await supabaseClient
      .from('hr_employees')
      .select('id, employee_code, first_name, last_name')
      .neq('status', 'RETIRADO')
      .order('first_name')
    if (error) throw toHrError(error, 'No se pudieron cargar los empleados.')
    return ((data ?? []) as { id: string; employee_code: string; first_name: string; last_name: string }[]).map((row) => ({
      id: row.id,
      name: `${row.first_name} ${row.last_name} (${row.employee_code})`,
    }))
  }
}

export const hrOrgRepository = new HrOrgRepository()
