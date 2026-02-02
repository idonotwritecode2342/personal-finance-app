const pool = require('./connection');

async function getSetting(key) {
  const result = await pool.query('SELECT value FROM global_settings WHERE key = $1', [key]);
  return result.rows[0]?.value || null;
}

async function setSetting(key, value) {
  await pool.query(
    `INSERT INTO global_settings (key, value)
     VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, value]
  );
  return value;
}

module.exports = { getSetting, setSetting };
