import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

async function main() {
    const { data, error } = await supabase.from('employees').select('*').limit(1);
    console.log(error || data);
}

main();
