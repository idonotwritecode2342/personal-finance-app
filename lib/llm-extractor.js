const axios = require('axios');
const pool = require('../db/connection');

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
      model: 'openai/gpt-oss-120b',
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
    console.error('LLM extraction error - original content:', content?.substring(0, 300) || 'No content');
    throw new Error(`LLM extraction failed: ${err.message}`);
  }
}

// Auto-assign categories to transactions based on merchant names
async function assignCategoriesToTransactions(transactions) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  // Get all available categories from database
  const categoriesResult = await pool.query(
    'SELECT id, name FROM transaction_categories ORDER BY name ASC'
  );
  const categories = categoriesResult.rows;
  const categoryList = categories.map(c => c.name).join(', ');

  // Create a mapping of merchant to category for batch assignment
  const transactionSummary = transactions.map(tx => ({
    merchant: tx.merchant,
    description: tx.description,
    amount: tx.amount,
    type: tx.transaction_type
  }));

  const prompt = `You are a financial transaction categorizer. Assign each transaction to the most appropriate category.

Available categories: ${categoryList}

Transactions to categorize:
${JSON.stringify(transactionSummary, null, 2)}

Return ONLY valid JSON (no markdown, no extra text) mapping merchant names to categories:
{
  "categorizations": [
    {
      "merchant": "merchant name",
      "category": "category name"
    }
  ]
}`;

  try {
    const response = await axios.post(OPENROUTER_URL, {
      model: 'openai/gpt-oss-20b',
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
    let jsonString = content.trim();

    // Remove markdown blocks
    jsonString = jsonString.replace(/^```(?:json)?\s*\n?/, '');
    jsonString = jsonString.replace(/\n?```\s*$/, '');
    jsonString = jsonString.trim();

    const result = JSON.parse(jsonString);
    const categorizations = result.categorizations || [];

    // Create merchant -> category_id mapping
    const merchantToCategoryId = {};
    categorizations.forEach(cat => {
      const categoryObj = categories.find(c => c.name.toLowerCase() === cat.category.toLowerCase());
      if (categoryObj) {
        merchantToCategoryId[cat.merchant.toLowerCase()] = categoryObj.id;
      }
    });

    // Assign category_id to each transaction
    const transactionsWithCategories = transactions.map(tx => ({
      ...tx,
      category_id: merchantToCategoryId[tx.merchant.toLowerCase()] || null
    }));

    return transactionsWithCategories;
  } catch (err) {
    console.error('Category assignment error:', err.message);
    // Return transactions without category_id if assignment fails
    return transactions.map(tx => ({ ...tx, category_id: null }));
  }
}

module.exports = { extractTransactionsFromText, assignCategoriesToTransactions };
