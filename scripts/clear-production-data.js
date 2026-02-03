#!/usr/bin/env node

/**
 * Clear all transaction and PDF upload data from production database
 * Usage: railway run node scripts/clear-production-data.js
 */

// Do NOT load .env in this script - use Railway's environment
const { Pool } = require('pg');

// Verify we have a DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment');
  console.error('Run with: railway run node scripts/clear-production-data.js');
  process.exit(1);
}

console.log('📡 Connecting to database:', process.env.DATABASE_URL.substring(0, 30) + '...');

async function clearData() {
  // Use DATABASE_URL from Railway environment
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    console.log('🔴 Starting data deletion from production...\n');

    await client.query('BEGIN');

    // Delete transaction category history first (references transactions)
    const historyResult = await client.query('DELETE FROM transaction_category_history');
    console.log(`✅ Deleted ${historyResult.rowCount} transaction category history records`);

    // Delete all transactions
    const txResult = await client.query('DELETE FROM transactions');
    console.log(`✅ Deleted ${txResult.rowCount} transactions`);

    // Delete all PDF uploads
    const pdfResult = await client.query('DELETE FROM pdf_uploads');
    console.log(`✅ Deleted ${pdfResult.rowCount} PDF uploads`);

    // Delete extracted transactions (staging table)
    const extractedResult = await client.query('DELETE FROM extracted_transactions');
    console.log(`✅ Deleted ${extractedResult.rowCount} extracted transactions`);

    await client.query('COMMIT');

    console.log(`\n🎯 All transaction data cleared from production!`);
    console.log(`\nSummary:`);
    console.log(`  - Transaction history: ${historyResult.rowCount} deleted`);
    console.log(`  - Transactions: ${txResult.rowCount} deleted`);
    console.log(`  - PDF uploads: ${pdfResult.rowCount} deleted`);
    console.log(`  - Extracted transactions: ${extractedResult.rowCount} deleted`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

clearData().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
