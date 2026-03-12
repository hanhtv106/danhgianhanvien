import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

async function checkSchema() {
    const tables = ['employees', 'branches', 'departments', 'star_reasons', 'evaluations', 'users'];
    for (const table of tables) {
        console.log(`--- Table: ${table} ---`);
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            console.error(`Error fetching ${table}:`, error.message);
        } else if (data && data.length > 0) {
            console.log('Columns:', Object.keys(data[0]));
        } else {
            console.log('Table is empty or could not fetch columns.');
        }
    }
}

checkSchema();
