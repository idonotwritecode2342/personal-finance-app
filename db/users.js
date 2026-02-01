const pool = require('./connection');
const bcrypt = require('bcryptjs');

// Create a new user
async function createUser(email, password) {
  const hashedPassword = await bcrypt.hash(password, 10);

  const result = await pool.query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
    [email, hashedPassword]
  );

  return result.rows[0];
}

// Get user by email
async function getUserByEmail(email) {
  const result = await pool.query(
    'SELECT id, email, password_hash FROM users WHERE email = $1',
    [email]
  );

  return result.rows[0];
}

// Get user by ID
async function getUserById(id) {
  const result = await pool.query(
    'SELECT id, email, created_at FROM users WHERE id = $1',
    [id]
  );

  return result.rows[0];
}

// Verify password
async function verifyPassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}

module.exports = {
  createUser,
  getUserByEmail,
  getUserById,
  verifyPassword,
};
