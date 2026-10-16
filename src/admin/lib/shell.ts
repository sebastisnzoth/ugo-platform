import type { AdminRole, AdminSectionId } from '../../lib/supabaseAdmin'
import type { MetricsSnapshot } from './data'
import type { ToastTone } from '../ui/kit'

export type ShellApi = {
  role: AdminRole
  displayName: string
  session: { user: { id: string; email?: string | null } }
  refreshToken: number
  lastRefresh: Date | null
  refresh: () => void
  navigate: (section: AdminSectionId, filter?: string) => void
  notify: (message: string, tone?: ToastTone) => void
  metrics: MetricsSnapshot
  metricsLoading: boolean
  metricsError: string | null
}

export type SectionProps = {
  shell: ShellApi
  filter: string | null
}
