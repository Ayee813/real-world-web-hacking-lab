const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function runSeed() {
  try {
    const schemaPath = path.join(__dirname, '../schema.sql');
    console.log('Reading schema.sql from:', schemaPath);
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Executing schema.sql on database...');
    await pool.query(sql);
    console.log('Success! Database seeded successfully.');
  } catch (err) {
    console.error('Error seeding database:');
    console.error(err);
  } finally {
    await pool.end();
  }
}

runSeed();
