const pool = require('./connection');

async function createConversation(userId, { title, pageRoute }) {
  const result = await pool.query(
    `INSERT INTO ai_conversations (user_id, title, page_route)
     VALUES ($1, $2, $3)
     RETURNING id, user_id as "userId", title, page_route as "pageRoute", created_at as "createdAt", updated_at as "updatedAt"`,
    [userId, title || null, pageRoute || null]
  );
  return result.rows[0];
}

async function getConversation(userId, conversationId) {
  const result = await pool.query(
    `SELECT id, user_id as "userId", title, page_route as "pageRoute", created_at as "createdAt", updated_at as "updatedAt"
     FROM ai_conversations
     WHERE id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
  return result.rows[0] || null;
}

async function listConversations(userId, limit = 20) {
  const result = await pool.query(
    `SELECT id, user_id as "userId", title, page_route as "pageRoute", created_at as "createdAt", updated_at as "updatedAt"
     FROM ai_conversations
     WHERE user_id = $1
     ORDER BY updated_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

async function touchConversation(conversationId) {
  await pool.query(
    `UPDATE ai_conversations SET updated_at = NOW() WHERE id = $1`,
    [conversationId]
  );
}

async function renameConversation(conversationId, userId, title) {
  const result = await pool.query(
    `UPDATE ai_conversations
     SET title = $3, updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING id, user_id as "userId", title, page_route as "pageRoute", created_at as "createdAt", updated_at as "updatedAt"`,
    [conversationId, userId, title]
  );
  return result.rows[0] || null;
}

module.exports = {
  createConversation,
  getConversation,
  listConversations,
  touchConversation,
  renameConversation,
};
