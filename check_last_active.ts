import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function addColumn() {
  console.log("Adding last_active_at column to users table...");
  
  // Supabase JS client doesn't support ALTER TABLE.
  // We have to use the SQL editor or a more direct PG connection if possible.
  // However, we can try to check if it exists first.
  
  const { data, error } = await supabase
    .from('users')
    .select('last_active_at')
    .limit(1);

  if (error && error.code === '42703') { // Undefined column
    console.log("Column 'last_active_at' does not exist. Please run this SQL in your Supabase SQL Editor:");
    console.log("ALTER TABLE users ADD COLUMN last_active_at TIMESTAMPTZ;");
  } else if (error) {
    console.error("Error checking column:", error);
  } else {
    console.log("Column 'last_active_at' already exists.");
  }
}

addColumn();
