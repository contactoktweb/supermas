import { z } from 'zod'

export const periodSchema = z.enum([
  'TODAY',
  '7_DAYS',
  '30_DAYS',
  'THIS_MONTH',
  'YEAR',
  'CUSTOM',
])

export const dashboardFilterSchema = z.object({
  period: periodSchema.default('TODAY'),
  locationId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

export type DashboardFilterParams = z.infer<typeof dashboardFilterSchema>
