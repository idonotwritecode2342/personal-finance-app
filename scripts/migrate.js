require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../db/connection');

async function runMigrations() {
  try {
    console.log('Running database migrations...');

    const schemaPath = path.join(__dirname, '../db/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    await pool.query(schema);

    console.log('✅ Database migrations completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

runMigrations();
