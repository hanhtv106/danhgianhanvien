import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

async function main() {
    console.log("Checking star_reasons table...");
    const { data, error } = await supabase.from('star_reasons').select('*').limit(1);
    if (error) {
        console.error("Error fetching star_reasons:", error);
    } else {
        console.log("Data sample:", data);
        if (data.length > 0) {
            console.log("Columns:", Object.keys(data[0]));
        } else {
            console.log("Table is empty, trying to get columns via query...");
            // Alternative: try to insert a dummy and see if it fails (not great)
            // Or use RPC if available. But usually people just select *.
        }
    }
}

main();
