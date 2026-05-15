import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/[^\x20-\x7E]/g, '').trim()
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.replace(/[^\x20-\x7E]/g, '').trim()

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseKey)
}
