const { chatCompletion } = require('./openrouter-client');
const { buildSystemPrompt } = require('./prompts');
const { toolDefinitions, runTool } = require('./tools');
const conversationsDb = require('../../db/ai-conversations');
const messagesDb = require('../../db/ai-messages');

const MAX_HISTORY_MESSAGES = parseInt(process.env.AI_MAX_HISTORY_MESSAGES || '20', 10);
const MAX_INPUT_CHARS = parseInt(process.env.AI_MAX_INPUT_CHARS || '4000', 10);

function trimHistory(history) {
  if (history.length <= MAX_HISTORY_MESSAGES) return history;
  return history.slice(history.length - MAX_HISTORY_MESSAGES);
}

function toOpenAIMessages(history) {
  return history.map(msg => {
    if (msg.role === 'tool') {
      return {
        role: 'tool',
        name: msg.toolName || undefined,
        tool_call_id: msg.toolCallId,
        content: msg.content,
      };
    }
    return { role: msg.role, content: msg.content };
  });
}

async function ensureConversation(userId, conversationId, pageRoute, firstUserMessage) {
  if (conversationId) {
    const existing = await conversationsDb.getConversation(userId, conversationId);
    if (!existing) throw new Error('Conversation not found');
    return existing;
  }
  const title = (firstUserMessage || '').slice(0, 60) || 'New Conversation';
  return conversationsDb.createConversation(userId, { title, pageRoute });
}

async function loadHistory(conversationId) {
  const history = await messagesDb.getRecentMessages(conversationId, MAX_HISTORY_MESSAGES);
  return trimHistory(history);
}

async function saveUserMessage(conversationId, content) {
  return messagesDb.addMessage(conversationId, 'user', content);
}

async function saveAssistantMessage(conversationId, content) {
  return messagesDb.addMessage(conversationId, 'assistant', content);
}

async function saveToolMessage(conversationId, toolName, toolPayload, content) {
  return messagesDb.addMessage(conversationId, 'tool', content, toolName, toolPayload);
}

async function handleChat({ userId, message, pageContext = {}, conversationId }) {
  if (!message || typeof message !== 'string' || !message.trim()) {
    throw new Error('Message is required');
  }
  if (message.length > MAX_INPUT_CHARS) {
    throw new Error(`Message too long (max ${MAX_INPUT_CHARS} chars)`);
  }

  const conversation = await ensureConversation(userId, conversationId, pageContext.route, message);

  // Load past history before adding the new user message to avoid duplicates in prompt
  const history = await loadHistory(conversation.id);
  const openaiHistory = toOpenAIMessages(history);
  await saveUserMessage(conversation.id, message.trim());
  const systemPrompt = buildSystemPrompt(pageContext);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...openaiHistory,
    { role: 'user', content: message.trim() },
  ];

  let iterations = 0;
  let assistantMessage = null;
  let workingMessages = [...messages];

  while (iterations < 3) {
    iterations += 1;
    const aiMessage = await chatCompletion({ messages: workingMessages, tools: toolDefinitions });

    // If tool calls are present, execute and loop
    if (aiMessage.tool_calls && aiMessage.tool_calls.length) {
      // Persist assistant tool request (content may be null)
      await saveAssistantMessage(conversation.id, aiMessage.content || '[tool calls issued]');

      // Push assistant message with tool_calls once
      workingMessages.push({
        role: 'assistant',
        content: aiMessage.content,
        tool_calls: aiMessage.tool_calls,
      });

      for (const call of aiMessage.tool_calls) {
        const args = safeParseArgs(call.function?.arguments);
        const toolResult = await runTool(call.function?.name, args, userId);
        await saveToolMessage(conversation.id, call.function?.name, toolResult, JSON.stringify(toolResult));

        workingMessages.push({
          role: 'tool',
          name: call.function?.name,
          tool_call_id: call.id,
          content: JSON.stringify(toolResult),
        });
      }
      continue; // re-query model with tool outputs
    }

    assistantMessage = aiMessage;
    break;
  }

  const finalContent = assistantMessage?.content || 'Sorry, I could not generate a response.';
  await saveAssistantMessage(conversation.id, finalContent);
  await conversationsDb.touchConversation(conversation.id);

  return {
    conversationId: conversation.id,
    message: finalContent,
  };
}

function safeParseArgs(args) {
  if (!args) return {};
  try {
    return JSON.parse(args);
  } catch (err) {
    return {};
  }
}

module.exports = {
  handleChat,
};
