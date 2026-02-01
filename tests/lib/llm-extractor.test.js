const { extractTransactionsFromText } = require('../../lib/llm-extractor');
const axios = require('axios');

// Mock axios
jest.mock('axios');

describe('LLM Transaction Extraction', () => {
  beforeEach(() => {
    // Set mock API key for tests
    process.env.OPENROUTER_API_KEY = 'test-api-key';
    jest.clearAllMocks();
  });

  it('should extract transactions from bank statement text', async () => {
    const mockResponse = {
      data: {
        choices: [{
          message: {
            content: JSON.stringify({
              transactions: [
                {
                  date: '2025-01-15',
                  amount: -45.50,
                  merchant: 'Tesco',
                  description: 'Grocery shopping',
                  transaction_type: 'debit'
                },
                {
                  date: '2025-01-16',
                  amount: 3500.00,
                  merchant: 'Employer',
                  description: 'Salary',
                  transaction_type: 'credit'
                },
                {
                  date: '2025-01-17',
                  amount: -25.00,
                  merchant: 'Transport',
                  description: 'Bus fare',
                  transaction_type: 'debit'
                }
              ],
              bank_detected: 'HSBC',
              account_type: 'checking',
              confidence: 0.95
            })
          }
        }]
      }
    };

    axios.post.mockResolvedValue(mockResponse);

    const sampleText = `
      HSBC Bank Statement
      Date: January 2025

      15 Jan  Tesco       -45.50   GBP
      16 Jan  Salary      +3500.00 GBP
      17 Jan  Transport   -25.00   GBP
    `;

    const result = await extractTransactionsFromText(sampleText);

    expect(result).toBeDefined();
    expect(result.transactions).toBeInstanceOf(Array);
    expect(result.transactions.length).toBeGreaterThan(0);
    expect(result.bank_detected).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should return structured format', async () => {
    const mockResponse = {
      data: {
        choices: [{
          message: {
            content: JSON.stringify({
              transactions: [],
              bank_detected: 'Unknown',
              account_type: 'checking',
              confidence: 0.5
            })
          }
        }]
      }
    };

    axios.post.mockResolvedValue(mockResponse);

    const sampleText = 'Bank statement text';
    const result = await extractTransactionsFromText(sampleText);

    expect(result).toHaveProperty('transactions');
    expect(result).toHaveProperty('bank_detected');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('account_type');
  });

  it('should throw error when OPENROUTER_API_KEY is not configured', async () => {
    delete process.env.OPENROUTER_API_KEY;

    // Need to clear the module cache and reimport
    jest.resetModules();
    const { extractTransactionsFromText: extract } = require('../../lib/llm-extractor');

    await expect(extract('test')).rejects.toThrow('OPENROUTER_API_KEY not configured');
  });
});
