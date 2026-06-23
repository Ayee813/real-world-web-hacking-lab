const { Pool } = require('pg');
require('dotenv').config();

console.log('Testing connection with URL:', process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@')); // Hide password in logs

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function test() {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('Success! Connection established. Database server time:', res.rows[0].now);

    // Let's also check if the users table exists and list its count
    try {
      const usersRes = await pool.query('SELECT count(*) FROM users');
      console.log('Success! "users" table exists. Count:', usersRes.rows[0].count);
    } catch (tblErr) {
      console.error('Error querying "users" table:', tblErr.message);
    }
  } catch (err) {
    console.error('Database connection failed!');
    console.error('Error Code:', err.code);
    console.error('Error Message:', err.message);
    console.error('Full Error:', err);
  } finally {
    await pool.end();
  }
}

test();
