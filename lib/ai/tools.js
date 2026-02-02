const dashboardDb = require('../../db/dashboard');
const pool = require('../../db/connection');

const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'get_spend_summary',
      description: 'Return total debit spend for the last N days for the given country code (UK or IN).',
      parameters: {
        type: 'object',
        properties: {
          countryCode: { type: 'string', enum: ['UK', 'IN'] },
          days: { type: 'integer', minimum: 7, maximum: 90, default: 30 }
        },
        required: ['countryCode'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_income_summary',
      description: 'Return total credit income for the last N days for the given country code (UK or IN).',
      parameters: {
        type: 'object',
        properties: {
          countryCode: { type: 'string', enum: ['UK', 'IN'] },
          days: { type: 'integer', minimum: 7, maximum: 90, default: 30 }
        },
        required: ['countryCode'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_recent_transactions',
      description: 'Fetch the most recent transactions for a country code.',
      parameters: {
        type: 'object',
        properties: {
          countryCode: { type: 'string', enum: ['UK', 'IN'] },
          limit: { type: 'integer', minimum: 1, maximum: 25, default: 10 }
        },
        required: ['countryCode'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_category_breakdown',
      description: 'Return spend by category for a country within a date range.',
      parameters: {
        type: 'object',
        properties: {
          countryCode: { type: 'string', enum: ['UK', 'IN'] },
          fromDate: { type: 'string', description: 'YYYY-MM-DD' },
          toDate: { type: 'string', description: 'YYYY-MM-DD' }
        },
        required: ['countryCode'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_accounts',
      description: 'List bank accounts for the user filtered by country code.',
      parameters: {
        type: 'object',
        properties: {
          countryCode: { type: 'string', enum: ['UK', 'IN'] }
        },
        required: ['countryCode'],
        additionalProperties: false
      }
    }
  }
];

function sanitizeCountry(countryCode) {
  return countryCode === 'IN' ? 'IN' : 'UK';
}

async function runTool(name, args, userId) {
  switch (name) {
    case 'get_spend_summary': {
      const countryCode = sanitizeCountry(args.countryCode);
      const days = Math.min(Math.max(args.days || 30, 7), 90);
      const result = await pool.query(
        `SELECT COALESCE(SUM(t.amount), 0) AS total
         FROM transactions t
         JOIN bank_accounts ba ON t.bank_account_id = ba.id
         JOIN countries c ON ba.country_id = c.id
         WHERE t.user_id = $1
           AND c.code = $2
           AND t.transaction_type = 'debit'
           AND t.transaction_date >= CURRENT_DATE - ($3 || ' days')::INTERVAL`,
        [userId, countryCode, days]
      );
      return { countryCode, days, total: Number(result.rows[0].total) };
    }
    case 'get_income_summary': {
      const countryCode = sanitizeCountry(args.countryCode);
      const days = Math.min(Math.max(args.days || 30, 7), 90);
      const result = await pool.query(
        `SELECT COALESCE(SUM(t.amount), 0) AS total
         FROM transactions t
         JOIN bank_accounts ba ON t.bank_account_id = ba.id
         JOIN countries c ON ba.country_id = c.id
         WHERE t.user_id = $1
           AND c.code = $2
           AND t.transaction_type = 'credit'
           AND t.transaction_date >= CURRENT_DATE - ($3 || ' days')::INTERVAL`,
        [userId, countryCode, days]
      );
      return { countryCode, days, total: Number(result.rows[0].total) };
    }
    case 'get_recent_transactions': {
      const countryCode = sanitizeCountry(args.countryCode);
      const limit = Math.min(Math.max(args.limit || 10, 1), 25);
      const rows = await dashboardDb.getRecentTransactions(userId, countryCode, limit);
      return { countryCode, limit, transactions: rows };
    }
    case 'get_category_breakdown': {
      const countryCode = sanitizeCountry(args.countryCode);
      const { fromDate, toDate } = args;
      const result = await pool.query(
        `SELECT tc.name as category, COALESCE(SUM(CASE WHEN t.transaction_type = 'debit' THEN t.amount ELSE 0 END), 0) AS spend
         FROM transactions t
         JOIN bank_accounts ba ON t.bank_account_id = ba.id
         JOIN countries c ON ba.country_id = c.id
         LEFT JOIN transaction_categories tc ON t.category_id = tc.id
         WHERE t.user_id = $1
           AND c.code = $2
           AND ($3::DATE IS NULL OR t.transaction_date >= $3)
           AND ($4::DATE IS NULL OR t.transaction_date <= $4)
         GROUP BY tc.name
         ORDER BY spend DESC NULLS LAST`,
        [userId, countryCode, fromDate || null, toDate || null]
      );
      return { countryCode, fromDate: fromDate || null, toDate: toDate || null, categories: result.rows };
    }
    case 'get_accounts': {
      const countryCode = sanitizeCountry(args.countryCode);
      const result = await pool.query(
        `SELECT ba.id, ba.account_name, ba.bank_name, ba.account_type, ba.currency, ba.confirmed, ba.is_active
         FROM bank_accounts ba
         JOIN countries c ON ba.country_id = c.id
         WHERE ba.user_id = $1 AND c.code = $2
         ORDER BY ba.created_at DESC`,
        [userId, countryCode]
      );
      return { countryCode, accounts: result.rows };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

module.exports = {
  toolDefinitions,
  runTool,
};
