const mammoth = require("mammoth");
const { PDFParse } = require("pdf-parse");
const AdmZip = require("adm-zip");

const MAX_UNCOMPRESSED_MB = 50;

function checkDocxZipBomb(buffer) {
  try {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    let totalUncompressed = 0;

    for (const entry of entries) {
      totalUncompressed += entry.header.size;
      if (totalUncompressed > MAX_UNCOMPRESSED_MB * 1024 * 1024) {
        throw new Error("DOCX file is too large when extracted (possible zip bomb).");
      }
    }
  } catch (err) {
    if (err.message.includes("zip bomb") || err.message.includes("too large")) {
      throw err;
    }
    // Corrupt zip — let mammoth handle the error downstream
  }
}

async function parseDocxBuffer(buffer) {
  checkDocxZipBomb(buffer);
  const result = await mammoth.extractRawText({ buffer });
  return result.value || "";
}

async function parsePdfBuffer(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text || "";
  } finally {
    await parser.destroy();
  }
}

module.exports = { parseDocxBuffer, parsePdfBuffer };
