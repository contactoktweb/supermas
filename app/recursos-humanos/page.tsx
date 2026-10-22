import { redirect } from 'next/navigation'
import { HR_ROUTES } from '@/features/hr/constants'

export default function RecursosHumanosIndexPage() {
  redirect(HR_ROUTES.panel)
}
