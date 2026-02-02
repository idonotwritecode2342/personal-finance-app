const pool = require('./connection');

async function addMessage(conversationId, role, content, toolName = null, toolPayload = null) {
  const result = await pool.query(
    `INSERT INTO ai_messages (conversation_id, role, content, tool_name, tool_payload)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, conversation_id as "conversationId", role, content, tool_name as "toolName", tool_payload as "toolPayload", created_at as "createdAt"`,
    [conversationId, role, content, toolName, toolPayload]
  );
  return result.rows[0];
}

async function getMessages(conversationId) {
  const result = await pool.query(
    `SELECT id, conversation_id as "conversationId", role, content, tool_name as "toolName", tool_payload as "toolPayload", created_at as "createdAt"
     FROM ai_messages
     WHERE conversation_id = $1
     ORDER BY created_at ASC`,
    [conversationId]
  );
  return result.rows;
}

async function getRecentMessages(conversationId, limit = 20) {
  const result = await pool.query(
    `SELECT id, conversation_id as "conversationId", role, content, tool_name as "toolName", tool_payload as "toolPayload", created_at as "createdAt"
     FROM ai_messages
     WHERE conversation_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [conversationId, limit]
  );
  // reverse to chronological order
  return result.rows.reverse();
}

module.exports = {
  addMessage,
  getMessages,
  getRecentMessages,
};
