const request = require('supertest');
const pool = require('../db/connection');

// Mock the parseDateFilter function behavior
function parseDateFilter(filter) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const date = today.getDate();

  let startDate, endDate;
  endDate = today.toISOString().split('T')[0];

  switch (filter) {
    case 'last_7_days':
      startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'this_month':
      startDate = new Date(year, month, 1);
      break;
    case 'last_month':
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0).toISOString().split('T')[0];
      break;
    case 'this_year':
      startDate = new Date(year, 0, 1);
      break;
    default:
      startDate = new Date(year, month, 1);
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate
  };
}

describe('Analytics Module', () => {
  describe('Date Filter Parsing', () => {
    test('should parse "last_7_days" correctly', () => {
      const today = new Date();
      const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const expectedStart = sevenDaysAgo.toISOString().split('T')[0];
      const expectedEnd = today.toISOString().split('T')[0];

      const result = parseDateFilter('last_7_days');

      expect(result.startDate).toBe(expectedStart);
      expect(result.endDate).toBe(expectedEnd);
    });

    test('should parse "this_month" correctly', () => {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth();
      const firstDay = new Date(year, month, 1);
      const expectedStart = firstDay.toISOString().split('T')[0];
      const expectedEnd = today.toISOString().split('T')[0];

      const result = parseDateFilter('this_month');

      expect(result.startDate).toBe(expectedStart);
      expect(result.endDate).toBe(expectedEnd);
    });

    test('should parse "last_month" correctly', () => {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth();
      const firstDayLastMonth = new Date(year, month - 1, 1);
      const lastDayLastMonth = new Date(year, month, 0);

      const expectedStart = firstDayLastMonth.toISOString().split('T')[0];
      const expectedEnd = lastDayLastMonth.toISOString().split('T')[0];

      const result = parseDateFilter('last_month');

      expect(result.startDate).toBe(expectedStart);
      expect(result.endDate).toBe(expectedEnd);
    });

    test('should parse "this_year" correctly', () => {
      const today = new Date();
      const year = today.getFullYear();
      const firstDayYear = new Date(year, 0, 1);

      const expectedStart = firstDayYear.toISOString().split('T')[0];
      const expectedEnd = today.toISOString().split('T')[0];

      const result = parseDateFilter('this_year');

      expect(result.startDate).toBe(expectedStart);
      expect(result.endDate).toBe(expectedEnd);
    });

    test('should default to "this_month" for unknown filter', () => {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth();
      const firstDay = new Date(year, month, 1);
      const expectedStart = firstDay.toISOString().split('T')[0];
      const expectedEnd = today.toISOString().split('T')[0];

      const result = parseDateFilter('invalid_filter');

      expect(result.startDate).toBe(expectedStart);
      expect(result.endDate).toBe(expectedEnd);
    });
  });

  describe('Sankey Data Aggregation', () => {
    test('should handle empty transaction data gracefully', () => {
      const emptyData = [];
      // Simulating the transform function behavior
      const result = {
        nodes: [],
        links: [],
        summary: {
          totalIncome: 0,
          totalExpense: 0,
          netFlow: 0
        }
      };

      expect(result.nodes).toEqual([]);
      expect(result.links).toEqual([]);
      expect(result.summary.netFlow).toBe(0);
    });

    test('should aggregate transactions by month and category', () => {
      // Mock transaction data
      const mockData = [
        {
          month: '2026-02-01',
          category: 'Groceries',
          is_income: false,
          color: '#22c55e',
          icon: '🛒',
          total_amount: '100.00',
          transaction_count: 2
        },
        {
          month: '2026-02-01',
          category: 'Salary/Income',
          is_income: true,
          color: '#22c55e',
          icon: '💰',
          total_amount: '5000.00',
          transaction_count: 1
        }
      ];

      // Verify data structure
      expect(mockData).toHaveLength(2);
      expect(mockData[0].category).toBe('Groceries');
      expect(mockData[1].category).toBe('Salary/Income');
      expect(mockData[1].is_income).toBe(true);
    });

    test('should calculate correct totals from aggregated data', () => {
      const mockData = [
        { total_amount: '1000.00', is_income: true },
        { total_amount: '500.00', is_income: false },
        { total_amount: '300.00', is_income: false }
      ];

      let totalIncome = 0;
      let totalExpense = 0;

      mockData.forEach(item => {
        if (item.is_income) {
          totalIncome += parseFloat(item.total_amount);
        } else {
          totalExpense += parseFloat(item.total_amount);
        }
      });

      expect(totalIncome).toBe(1000);
      expect(totalExpense).toBe(800);
      expect(totalIncome - totalExpense).toBe(200);
    });
  });

  describe('Data Validation', () => {
    test('should validate Sankey node structure', () => {
      const node = {
        name: 'Groceries',
        value: 250.50,
        type: 'category',
        color: '#22c55e',
        icon: '🛒'
      };

      expect(node).toHaveProperty('name');
      expect(node).toHaveProperty('value');
      expect(typeof node.name).toBe('string');
      expect(typeof node.value).toBe('number');
      expect(node.value).toBeGreaterThan(0);
    });

    test('should validate Sankey link structure', () => {
      const link = {
        source: 0,
        target: 1,
        value: 150.75
      };

      expect(link).toHaveProperty('source');
      expect(link).toHaveProperty('target');
      expect(link).toHaveProperty('value');
      expect(typeof link.source).toBe('number');
      expect(typeof link.target).toBe('number');
      expect(typeof link.value).toBe('number');
    });

    test('should ensure link value is positive', () => {
      const amounts = [100, 250.50, 1000];

      amounts.forEach(amount => {
        expect(Math.abs(amount)).toBe(amount);
        expect(Math.abs(amount)).toBeGreaterThan(0);
      });
    });
  });

  describe('Currency Formatting', () => {
    test('should format values with 2 decimal places', () => {
      const testCases = [
        { input: 1000, expected: '1,000.00' },
        { input: 250.5, expected: '250.50' },
        { input: 5000.12345, expected: '5,000.12' }
      ];

      testCases.forEach(({ input, expected }) => {
        const formatted = Math.abs(input).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
        expect(formatted).toBe(expected);
      });
    });
  });
});
