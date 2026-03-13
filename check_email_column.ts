
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  console.log('Adding email column to employees table...')
  // We use RPC if available or just try a sample insert to see if it works, 
  // but to add a column we usually need the SQL editor.
  // However, I can try to use a dummy query to 'alter table' if I had a postgres client.
  // Since I only have the anon key, I might not be able to do 'alter table' via supabase-js.
  
  // Let's try to check if it's already there first
  const { data, error } = await supabase.from('employees').select('email').limit(1)
  if (error) {
    if (error.message.includes('column "email" does not exist')) {
        console.log('Column "email" does not exist. You need to add it via Supabase SQL Editor:')
        console.log('ALTER TABLE employees ADD COLUMN email TEXT;')
    } else {
        console.error('Error checking column:', error.message)
    }
  } else {
    console.log('Column "email" already exists.')
  }
}

run()
