import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnon) {
  console.error('Missing Supabase environment variables. Copy .env.example to .env and fill in values.')
}

export const supabase = createClient(supabaseUrl, supabaseAnon)
