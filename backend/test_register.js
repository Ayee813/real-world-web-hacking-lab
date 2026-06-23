const { Pool } = require('pg');
require('dotenv').config();
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function run() {
  try {
    const email = `diagnostic_${Date.now()}@example.com`;
    const username = 'diag';
    const hash = await bcrypt.hash('Password123', 10);
    
    console.log('Attempting INSERT...');
    const result = await pool.query(
      'INSERT INTO users (email, username, password, role) VALUES ($1, $2, $3, $4) RETURNING id, email, username, role',
      [email, username, hash, 'user']
    );
    console.log('Insert success! Result:', result.rows[0]);

    // Clean it up immediately
    await pool.query('DELETE FROM users WHERE id = $1', [result.rows[0].id]);
    console.log('Cleanup success!');
  } catch (err) {
    console.error('Insert query failed!');
    console.error('Error Code:', err.code);
    console.error('Error Message:', err.message);
    console.error('Full Error:', err);
  } finally {
    await pool.end();
  }
}

run();
