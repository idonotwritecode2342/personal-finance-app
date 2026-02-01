const BANK_PATTERNS = {
  HSBC: {
    patterns: [/HSBC\s+(Bank|UK|India)/i, /hsbc\.co\.uk/i],
    countries: ['UK', 'India']
  },
  Revolut: {
    patterns: [/Revolut/i, /revolut\.com/i],
    countries: ['UK']
  },
  AMEX: {
    patterns: [/American\s+Express|AMEX|amex\.com/i],
    countries: ['UK']
  },
  ICICI: {
    patterns: [/ICICI\s+Bank|icicibank\.com/i],
    countries: ['India']
  }
};

function detectBank(statementText) {
  for (const [bankName, config] of Object.entries(BANK_PATTERNS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(statementText)) {
        const country = config.countries.length === 1 ? config.countries[0] : inferCountry(statementText, config.countries);
        return {
          bank: bankName,
          country: country,
          confidence: 0.95
        };
      }
    }
  }
  return null;
}

function inferCountry(text, possibleCountries) {
  if (possibleCountries.length === 1) return possibleCountries[0];

  if (/£|GBP|UK|United Kingdom|London/i.test(text)) return 'UK';
  if (/₹|INR|India|Mumbai|Bangalore/i.test(text)) return 'India';

  return possibleCountries[0];
}

module.exports = { detectBank };
