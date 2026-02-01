const fs = require('fs');
const { PDFParse } = require('pdf-parse');

async function extractTextFromPDF(pdfPath) {
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF file not found: ${pdfPath}`);
  }

  const pdfBytes = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data: pdfBytes });
  const result = await parser.getText();

  // Extract text from all pages
  let fullText = '';
  if (result.text) {
    fullText = result.text;
  }

  return fullText;
}

module.exports = { extractTextFromPDF };
