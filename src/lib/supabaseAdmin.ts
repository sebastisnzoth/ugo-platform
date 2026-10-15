import { createClient } from '@supabase/supabase-js'

// UGO TEST — proyecto compartido tmossnqfwfwjrtzwcbmm.
// Solo clave publicable en el navegador: nunca service_role ni claves privadas.
export const UGO_TEST_URL = import.meta.env.VITE_SUPABASE_URL || 'https://tmossnqfwfwjrtzwcbmm.supabase.co'
export const UGO_TEST_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_meCpkMt79S25M0nHgVv1aQ_V9AMPZEl'

export const UGO_TEST_REF = (() => {
  try {
    return new URL(UGO_TEST_URL).hostname.split('.')[0]
  } catch {
    return 'tmossnqfwfwjrtzwcbmm'
  }
})()

// Sesión Admin aislada del resto de la plataforma (no comparte storageKey con cliente/profesional).
export const supabaseAdmin = createClient(UGO_TEST_URL, UGO_TEST_KEY, {
  auth: {
    storageKey: 'ugo-platform-admin-auth',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  realtime: { params: { eventsPerSecond: 10 } },
})

export const ADMIN_ROLES = ['admin', 'superadmin'] as const
export type AdminRole = (typeof ADMIN_ROLES)[number]

export const ADMIN_SECTION_IDS = [
  'overview',
  'services',
  'people',
  'providers',
  'finance',
  'disputes',
  'audit',
  'system',
] as const
export type AdminSectionId = (typeof ADMIN_SECTION_IDS)[number]

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && (ADMIN_ROLES as readonly string[]).includes(value)
}
