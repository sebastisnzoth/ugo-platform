import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || 'https://tmossnqfwfwjrtzwcbmm.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_meCpkMt79S25M0nHgVv1aQ_V9AMPZEl'

// Navegador: solo clave publicable. Nunca incluir service_role en el frontend.
export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'ugo-platform-auth' },
})
