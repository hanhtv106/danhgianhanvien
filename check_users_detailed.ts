import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

async function main() {
    console.log("Checking users with branch and department info...");
    const { data: users, error } = await supabase
        .from('users')
        .select('id, username, role, branch_id, department_id, branches(name)');
    
    if (error) console.error(error);
    else console.log("Users:", JSON.stringify(users, null, 2));
}

main();
