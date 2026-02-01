const { extractTextFromPDF } = require('../../lib/pdf-extractor');
const fs = require('fs');
const path = require('path');

describe('PDF Text Extraction', () => {
  it('should extract text from valid PDF', async () => {
    const pdfPath = '/Users/tanveer/Downloads/2025-11-09_Statement (1).pdf';
    const text = await extractTextFromPDF(pdfPath);

    expect(text).toBeDefined();
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  });

  it('should throw error for non-existent file', async () => {
    const pdfPath = '/nonexistent/file.pdf';

    await expect(extractTextFromPDF(pdfPath)).rejects.toThrow();
  });
});
