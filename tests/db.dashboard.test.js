const {
  getCurrentSpend,
  getCurrentIncome,
  getSavingsBalance,
  getInvestmentBalance,
  getRecentTransactions
} = require('../db/dashboard');
const pool = require('../db/connection');

jest.mock('../db/connection', () => ({
  query: jest.fn()
}));

describe('Dashboard Database Functions', () => {
  const userId = 1;
  const countryCode = 'UK';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCurrentSpend', () => {
    it('should return total spend for the month', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ total_spend: '150.00' }]
      });

      const result = await getCurrentSpend(userId, countryCode);

      expect(pool.query).toHaveBeenCalled();
      expect(result).toBe(150.00);
    });

    it('should return 0 if no transactions', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ total_spend: '0' }]
      });

      const result = await getCurrentSpend(userId, countryCode);
      expect(result).toBe(0);
    });
  });

  describe('getCurrentIncome', () => {
    it('should return total income for the month', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ total_income: '3000.00' }]
      });

      const result = await getCurrentIncome(userId, countryCode);

      expect(result).toBe(3000.00);
    });
  });

  describe('getSavingsBalance', () => {
    it('should return savings account balance', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ savings_balance: '5000.00' }]
      });

      const result = await getSavingsBalance(userId, countryCode);

      expect(result).toBe(5000.00);
    });
  });

  describe('getInvestmentBalance', () => {
    it('should return investment account balance', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ investment_balance: '15000.00' }]
      });

      const result = await getInvestmentBalance(userId, countryCode);

      expect(result).toBe(15000.00);
    });
  });

  describe('getRecentTransactions', () => {
    it('should return recent transactions with limit', async () => {
      const mockTransactions = [
        {
          id: 1,
          transaction_date: '2024-02-01',
          amount: '50.00',
          merchant: 'Tesco',
          category: 'Groceries',
          bank_name: 'Barclays',
          transaction_type: 'debit'
        }
      ];

      pool.query.mockResolvedValueOnce({
        rows: mockTransactions
      });

      const result = await getRecentTransactions(userId, countryCode, 10);

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        [userId, countryCode, 10]
      );
      expect(result).toEqual(mockTransactions);
    });

    it('should default to limit of 10', async () => {
      pool.query.mockResolvedValueOnce({
        rows: []
      });

      await getRecentTransactions(userId, countryCode);

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        [userId, countryCode, 10]
      );
    });
  });
});
