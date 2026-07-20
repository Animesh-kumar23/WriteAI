const MarkdownIt = require("markdown-it");
const PDFDocument = require("pdfkit");

const markdown = new MarkdownIt();

const PDF_CONFIG = {
  fonts: {
    heading: "Helvetica-Bold",
    body: "Helvetica",
    code: "Courier",
  },
  sizes: {
    title: 32,
    subtitle: 20,
    headings: { h1: 18, h2: 16, h3: 14, h4: 12, h5: 11, h6: 11 },
    body: 11,
    code: 9,
  },
  colors: {
    title: "#1a202c",
    subtitle: "#4a5568",
    body: "#000000",
    code: "#334155",
  },
  margins: { top: 72, bottom: 72, left: 72, right: 72 },
};

function inlineText(token) {
  if (!token) return "";
  if (!token.children) return token.content || "";

  return token.children
    .map((child) => {
      if (child.type === "softbreak" || child.type === "hardbreak") return "\n";
      if (child.type === "text" || child.type === "code_inline" || child.type === "image") {
        return child.content;
      }
      return child.children ? inlineText(child) : "";
    })
    .join("");
}

function writeParagraph(doc, text, options = {}) {
  if (!text.trim()) return;

  doc
    .font(PDF_CONFIG.fonts.body)
    .fontSize(PDF_CONFIG.sizes.body)
    .fillColor(PDF_CONFIG.colors.body)
    .text(text, { lineGap: 2, ...options });
  doc.moveDown(0.6);
}

function renderMarkdown(doc, source) {
  const tokens = markdown.parse(source || "", {});
  const lists = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token.type === "bullet_list_open") {
      lists.push({ type: "bullet", markerPending: false });
      continue;
    }

    if (token.type === "ordered_list_open") {
      lists.push({
        type: "ordered",
        next: Number(token.attrGet("start") || 1),
        markerPending: false,
      });
      continue;
    }

    if (token.type === "bullet_list_close" || token.type === "ordered_list_close") {
      lists.pop();
      doc.moveDown(0.25);
      continue;
    }

    if (token.type === "list_item_open" && lists.length) {
      lists.at(-1).markerPending = true;
      continue;
    }

    if (token.type === "heading_open") {
      const inline = tokens[index + 1];
      const level = token.tag.toLowerCase();

      doc
        .font(PDF_CONFIG.fonts.heading)
        .fontSize(PDF_CONFIG.sizes.headings[level] || PDF_CONFIG.sizes.headings.h3)
        .fillColor(PDF_CONFIG.colors.title)
        .text(inlineText(inline), { lineGap: 2 });
      doc.moveDown(0.5);
      continue;
    }

    if (token.type === "paragraph_open") {
      const inline = tokens[index + 1];
      const list = lists.at(-1);
      let prefix = "";

      if (list?.markerPending) {
        prefix = list.type === "ordered" ? `${list.next}. ` : "• ";
        list.markerPending = false;
        if (list.type === "ordered") list.next += 1;
      }

      writeParagraph(doc, `${prefix}${inlineText(inline)}`, {
        indent: lists.length * 18,
      });
      continue;
    }

    if (token.type === "fence" || token.type === "code_block") {
      doc
        .font(PDF_CONFIG.fonts.code)
        .fontSize(PDF_CONFIG.sizes.code)
        .fillColor(PDF_CONFIG.colors.code)
        .text(token.content.replace(/\n$/, ""), {
          indent: lists.length * 18,
          lineGap: 2,
        });
      doc.moveDown(0.75);
    }
  }
}

function renderPdfContent(doc, document) {
  doc.moveDown(8);
  doc
    .font(PDF_CONFIG.fonts.heading)
    .fontSize(PDF_CONFIG.sizes.title)
    .fillColor(PDF_CONFIG.colors.title)
    .text(document.title, { align: "center" });

  if (document.subtitle?.trim()) {
    doc.moveDown(1);
    doc
      .font(PDF_CONFIG.fonts.body)
      .fontSize(PDF_CONFIG.sizes.subtitle)
      .fillColor(PDF_CONFIG.colors.subtitle)
      .text(document.subtitle, { align: "center" });
  }

  doc.addPage();
  renderMarkdown(doc, document.content);
}

function generatePdfBuffer(document) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margins: PDF_CONFIG.margins });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      renderPdfContent(doc, document);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generatePdfBuffer };
