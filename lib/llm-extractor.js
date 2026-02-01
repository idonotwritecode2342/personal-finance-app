const axios = require('axios');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function extractTransactionsFromText(statementText) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  const prompt = `You are a bank statement parser. Extract all transactions from the following bank statement text and return as JSON.

Bank Statement:
${statementText}

Return ONLY valid JSON (no markdown, no extra text) in this format:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "amount": number (positive for credit, negative for debit),
      "merchant": "merchant name",
      "description": "transaction description",
      "transaction_type": "debit" or "credit"
    }
  ],
  "bank_detected": "bank name",
  "account_type": "checking/savings/investment",
  "confidence": 0.0 to 1.0
}`;

  try {
    const response = await axios.post(OPENROUTER_URL, {
      model: 'mistralai/mistral-7b-instruct',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const content = response.data.choices[0].message.content;

    // Strip markdown code block if present (OpenRouter may wrap in ```json```)
    let jsonString = content.trim();

    // Remove opening markdown block (```json or ```)
    jsonString = jsonString.replace(/^```(?:json)?\s*\n?/, '');
    // Remove closing markdown block (```)
    jsonString = jsonString.replace(/\n?```\s*$/, '');
    // Final trim
    jsonString = jsonString.trim();

    // Log for debugging if parsing fails
    console.log('LLM Response (cleaned):', jsonString.substring(0, 200));

    const result = JSON.parse(jsonString);

    return result;
  } catch (err) {
    console.error('LLM extraction error - original content:', content.substring(0, 300));
    throw new Error(`LLM extraction failed: ${err.message}`);
  }
}

module.exports = { extractTransactionsFromText };
