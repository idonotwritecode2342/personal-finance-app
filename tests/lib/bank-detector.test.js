const { detectBank } = require('../../lib/bank-detector');

describe('Bank Detection', () => {
  const supportedBanks = {
    UK: ['HSBC', 'Revolut', 'AMEX'],
    India: ['ICICI', 'HSBC']
  };

  it('should detect HSBC UK', () => {
    const text = 'HSBC Bank UK\nStatement for account ending 1234';
    const result = detectBank(text);

    expect(result).toBeDefined();
    expect(result.bank).toBe('HSBC');
    expect(result.country).toBe('UK');
  });

  it('should detect ICICI India', () => {
    const text = 'ICICI Bank Limited\nAccount Statement';
    const result = detectBank(text);

    expect(result).toBeDefined();
    expect(result.bank).toBe('ICICI');
    expect(result.country).toBe('India');
  });

  it('should detect Revolut', () => {
    const text = 'Revolut Statement\nTransaction History';
    const result = detectBank(text);

    expect(result.bank).toBe('Revolut');
  });

  it('should return null for unknown bank', () => {
    const text = 'Unknown Bank Statement';
    const result = detectBank(text);

    expect(result).toBeNull();
  });
});
