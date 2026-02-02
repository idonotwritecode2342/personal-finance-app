/**
 * Sankey Analytics Utilities
 * Helper functions for analytics visualization and data transformation
 * This module is reserved for future enhancements and utility functions
 */

// Utility function to format large numbers for display
function formatLargeNumber(value) {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + 'M';
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + 'K';
  }
  return value.toFixed(0);
}

// Utility to get color based on category type
function getCategoryColor(categoryName, defaultColor = '#b0b0b0') {
  const colorMap = {
    'Groceries': '#22c55e',
    'Utilities': '#3b82f6',
    'Transport': '#f59e0b',
    'Entertainment': '#8b5cf6',
    'Dining': '#ef4444',
    'Healthcare': '#ec4899',
    'Subscriptions': '#6366f1',
    'Salary/Income': '#22c55e',
    'Savings': '#14b8a6',
    'Investments': '#0ea5e9',
    'Insurance': '#64748b',
    'Shopping': '#f97316',
    'Fees': '#94a3b8'
  };
  return colorMap[categoryName] || defaultColor;
}

// Export for modular usage if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    formatLargeNumber,
    getCategoryColor
  };
}
