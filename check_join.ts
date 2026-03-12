import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

async function main() {
    console.log("Checking join between star_reasons and departments...");
    const { data, error } = await supabase
        .from('star_reasons')
        .select('id, department_id, departments(name)')
        .limit(5);
    
    if (error) console.error(error);
    else {
        console.log("Join result:", JSON.stringify(data, null, 2));
    }
}

main();
