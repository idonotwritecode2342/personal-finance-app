const fs = require('fs');
const pdfParse = require('pdf-parse');

async function extractTextFromPDF(pdfPath) {
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF file not found: ${pdfPath}`);
  }

  const dataBuffer = fs.readFileSync(pdfPath);
  const result = await pdfParse(dataBuffer);

  return result.text || '';
}

module.exports = { extractTextFromPDF };
