const axios = require('axios');
const { getModel } = require('./model-config');

const BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

async function chatCompletion({ messages, tools = [], temperature = 0.2 }) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }

  const model = await getModel();

  const payload = {
    model,
    messages,
    tools,
    tool_choice: tools.length ? 'auto' : undefined,
    temperature,
  };

  const headers = {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
  };

  const response = await axios.post(`${BASE_URL}/chat/completions`, payload, { headers });
  const choice = response.data.choices?.[0];
  if (!choice || !choice.message) {
    throw new Error('No message returned from OpenRouter');
  }
  return choice.message;
}

module.exports = { chatCompletion };
