import { hrOrgRepository } from '../repositories/hr-org.repository'
import {
  areaFormSchema,
  positionFormSchema,
  type AreaFormInput,
  type PositionFormInput,
} from '../schemas/hr.schema'
import type { HrArea, HrOption, HrPosition, HrUserOption } from '../types'

export interface HrCatalogs {
  areas: HrArea[]
  positions: HrPosition[]
  locations: HrOption[]
}

export class HrOrgService {
  async getCatalogs(): Promise<HrCatalogs> {
    const [areas, positions, locations] = await Promise.all([
      hrOrgRepository.listAreas(),
      hrOrgRepository.listPositions(),
      hrOrgRepository.listLocations(),
    ])
    return { areas, positions, locations }
  }

  saveArea(id: string | null, input: AreaFormInput): Promise<void> {
    const data = areaFormSchema.parse(input)
    return id ? hrOrgRepository.updateArea(id, data) : hrOrgRepository.createArea(data)
  }

  savePosition(id: string | null, input: PositionFormInput): Promise<void> {
    const data = positionFormSchema.parse(input)
    return id ? hrOrgRepository.updatePosition(id, data) : hrOrgRepository.createPosition(data)
  }

  listErpUsers(): Promise<HrUserOption[]> {
    return hrOrgRepository.listErpUsers()
  }

  listEmployeeOptions(): Promise<HrOption[]> {
    return hrOrgRepository.listEmployeeOptions()
  }
}

export const hrOrgService = new HrOrgService()
