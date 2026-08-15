import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://hzgohcnktwbavqspkogm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6Z29oY25rdHdiYXZxc3Brb2dtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTgzNjczMywiZXhwIjoyMTAxNDEyNzMzfQ.G_8EGkyogRmFZY8MwJyQmZGmaxKs1xFA9lqDc14FZUs',
  { auth: { persistSession: false } }
)

async function test() {
  const { data, error } = await supabase.from('invoice_records').select('*').limit(1)
  console.log('Result:', data ? Object.keys(data[0]) : error)
}

test()
