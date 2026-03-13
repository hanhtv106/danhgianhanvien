
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  console.log('Listing tables...')
  const { data, error } = await supabase.from('employees').select('id').limit(1)
  if (error) {
    console.error('Error selecting from employees:', error.message)
    
    // Try listing tables via a generic query if possible, 
    // but with anon key we can only access what's allowed by RLS.
    // Let's try to check other tables
    const tables = ['users', 'branches', 'departments', 'evaluations']
    for (const t of tables) {
        const { error: e } = await supabase.from(t).select('id').limit(1)
        console.log(`Table ${t}: ${e ? 'Error - ' + e.message : 'Exists'}`)
    }
  } else {
    console.log('Table "employees" exists and is accessible.')
  }
}

run()
