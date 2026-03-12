import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

async function main() {
    console.log("Checking users...");
    const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, username, role, department_id');
    
    if (userError) console.error(userError);
    else console.log("Users:", users);
}

main();
