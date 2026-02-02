require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../db/connection');

const MIGRATIONS_DIR = path.join(__dirname, '../db/migrations');

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

async function getExecutedMigrations() {
  const result = await pool.query('SELECT name FROM migrations ORDER BY name');
  return result.rows.map(row => row.name);
}

async function markMigrationExecuted(name) {
  await pool.query('INSERT INTO migrations (name) VALUES ($1)', [name]);
}

async function runMigrations() {
  try {
    console.log('🔄 Running database migrations...\n');

    // Ensure migrations tracking table exists
    await ensureMigrationsTable();

    // Get already executed migrations
    const executed = await getExecutedMigrations();
    console.log(`📋 Previously executed: ${executed.length} migration(s)`);

    // Get all migration files
    const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`📁 Found ${migrationFiles.length} migration file(s)\n`);

    let newMigrations = 0;

    for (const file of migrationFiles) {
      const migrationName = file.replace('.sql', '');
      
      if (executed.includes(migrationName)) {
        console.log(`⏭️  Skipping ${file} (already executed)`);
        continue;
      }

      console.log(`▶️  Running ${file}...`);
      
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      await pool.query(sql);
      await markMigrationExecuted(migrationName);
      
      console.log(`✅ Completed ${file}`);
      newMigrations++;
    }

    console.log(`\n✅ Database migrations completed: ${newMigrations} new migration(s) applied`);
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

// Also support running legacy schema.sql for backwards compatibility
async function runLegacySchema() {
  try {
    console.log('Running legacy schema.sql...');
    const schemaPath = path.join(__dirname, '../db/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    await pool.query(schema);
    console.log('✅ Legacy schema applied');
  } catch (err) {
    console.error('❌ Legacy schema failed:', err.message);
    throw err;
  }
}

// Check command line args
const args = process.argv.slice(2);
if (args.includes('--legacy')) {
  runLegacySchema().then(() => process.exit(0)).catch(() => process.exit(1));
} else {
  runMigrations();
}
