const express = require('express');
const { handleChat } = require('../lib/ai/chat-orchestrator');
const conversationsDb = require('../db/ai-conversations');
const messagesDb = require('../db/ai-messages');

const router = express.Router();

// POST /api/ai/chat
router.post('/chat', async (req, res) => {
  try {
    const userId = req.session.userId;
    const { message, conversationId, pageContext } = req.body || {};
    let context = pageContext || {};
    if (!context.route && req.headers.referer) {
      try {
        context.route = new URL(req.headers.referer).pathname;
      } catch (err) {
        context.route = '/';
      }
    }

    const result = await handleChat({
      userId,
      message,
      pageContext: context,
      conversationId,
    });

    res.json({ ok: true, conversationId: result.conversationId, message: result.message });
  } catch (err) {
    console.error('AI chat error:', err.message);
    res.status(400).json({ ok: false, error: err.message });
  }
});

// GET /api/ai/conversations
router.get('/conversations', async (req, res) => {
  try {
    const userId = req.session.userId;
    const conversations = await conversationsDb.listConversations(userId, 50);
    res.json({ ok: true, conversations });
  } catch (err) {
    console.error('AI conversations error:', err.message);
    res.status(500).json({ ok: false, error: 'Unable to load conversations' });
  }
});

// GET /api/ai/conversations/:id/messages
router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const userId = req.session.userId;
    const conversationId = parseInt(req.params.id, 10);
    const conversation = await conversationsDb.getConversation(userId, conversationId);
    if (!conversation) {
      return res.status(404).json({ ok: false, error: 'Conversation not found' });
    }
    const messages = await messagesDb.getMessages(conversationId);
    res.json({ ok: true, conversation, messages });
  } catch (err) {
    console.error('AI messages error:', err.message);
    res.status(500).json({ ok: false, error: 'Unable to load messages' });
  }
});

module.exports = router;
