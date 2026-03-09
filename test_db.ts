import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL || "", SUPABASE_KEY || "");

async function checkColumns() {
    const { data, error } = await supabase.from('employees').select('created_at').limit(1);
    if (error) {
        console.log("Error selecting created_at:", error.message);
    } else {
        console.log("created_at exists!");
    }

    const { data: evalData, error: evalError } = await supabase.from('evaluations').select('note').limit(1);
    if (evalError) {
        console.log("Error selecting note from evaluations:", evalError.message);
    } else {
        console.log("note exists in evaluations!");
    }
}

checkColumns();
