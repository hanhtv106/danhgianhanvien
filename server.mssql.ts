import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

const config: sql.config = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '123456',
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'EmployeeEvaluation',
  options: {
    encrypt: false, // Set to false for local SQL Server
    trustServerCertificate: true
  }
};

export async function connectDB() {
  try {
    const pool = await sql.connect(config);
    console.log('Connected to SQL Server');
    return pool;
  } catch (err) {
    console.error('Database connection failed:', err);
    throw err;
  }
}

/**
 * Example of an API route using SQL Server
 * 
 * app.get('/api/employees', async (req, res) => {
 *   try {
 *     const pool = await connectDB();
 *     const result = await pool.request()
 *       .query('SELECT * FROM Employees WHERE IsResigned = 0');
 *     res.json(result.recordset);
 *   } catch (err) {
 *     res.status(500).json({ error: 'Internal Server Error' });
 *   }
 * });
 */
