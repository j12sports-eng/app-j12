const { jsPDF } = require("jspdf");

function exportFinancialReportCsv(report) {
  const rows = reportToRows(report);
  const headers = collectHeaders(rows);
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) lines.push(headers.map((header) => csvCell(row[header])).join(","));
  return Buffer.from(`\uFEFF${lines.join("\r\n")}`, "utf8");
}

function exportFinancialReportPdf(report) {
  const document = new jsPDF({ format: "a4", unit: "pt" });
  const rows = reportToRows(report);
  document.setFontSize(14);
  document.text(`J12 - Relatorio ${report.report || "financeiro"}`, 40, 45);
  document.setFontSize(8);
  let y = 65;
  for (const row of rows.slice(0, 300)) {
    const line = Object.entries(row)
      .map(([key, value]) => `${key}: ${formatScalar(value)}`)
      .join(" | ");
    const wrapped = document.splitTextToSize(line, 515);
    if (y + wrapped.length * 10 > 800) {
      document.addPage();
      y = 40;
    }
    document.text(wrapped, 40, y);
    y += wrapped.length * 10 + 4;
  }
  return Buffer.from(document.output("arraybuffer"));
}

function exportFinancialReportXlsx(report) {
  const rows = reportToRows(report);
  const headers = collectHeaders(rows);
  const sheetRows = [headers, ...rows.map((row) => headers.map((header) => row[header]))];
  const files = {
    "[Content_Types].xml": contentTypesXml(),
    "_rels/.rels": rootRelationshipsXml(),
    "docProps/app.xml": appPropertiesXml(),
    "docProps/core.xml": corePropertiesXml(),
    "xl/_rels/workbook.xml.rels": workbookRelationshipsXml(),
    "xl/styles.xml": stylesXml(),
    "xl/workbook.xml": workbookXml(),
    "xl/worksheets/sheet1.xml": worksheetXml(sheetRows),
  };
  return createZip(files);
}

function reportToRows(report) {
  const rows = [];
  walk(report, "", rows);
  return rows.length > 0 ? rows : [{ report: report?.report || "financeiro", value: "sem_dados" }];
}

function walk(value, path, rows) {
  if (Array.isArray(value)) {
    if (value.length === 0) rows.push({ section: path, value: "[]" });
    for (const item of value) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        rows.push({ section: path, ...flattenObject(item) });
      } else rows.push({ section: path, value: formatScalar(item) });
    }
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      const next = path ? `${path}.${key}` : key;
      if (Array.isArray(item)) walk(item, next, rows);
      else if (item && typeof item === "object") walk(item, next, rows);
      else if (!["generatedAt"].includes(key))
        rows.push({ section: path || "summary", metric: key, value: item });
    }
  }
}

function flattenObject(value, prefix = "", output = {}) {
  for (const [key, item] of Object.entries(value || {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (item && typeof item === "object" && !Array.isArray(item)) flattenObject(item, path, output);
    else output[path] = Array.isArray(item) ? JSON.stringify(item) : item;
  }
  return output;
}

function collectHeaders(rows) {
  return [...new Set(rows.flatMap((row) => Object.keys(row)))];
}

function csvCell(value) {
  return `"${spreadsheetSafe(formatScalar(value)).replace(/"/g, '""')}"`;
}

function formatScalar(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function worksheetXml(rows) {
  const body = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, columnIndex) => cellXml(value, columnName(columnIndex), rowIndex + 1))
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");
  return xml(`
    <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
      <sheetData>${body}</sheetData>
    </worksheet>`);
}

function cellXml(value, column, row) {
  const reference = `${column}${row}`;
  if (typeof value === "number" && Number.isFinite(value))
    return `<c r="${reference}"><v>${value}</v></c>`;
  return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(spreadsheetSafe(formatScalar(value)))}</t></is></c>`;
}

function columnName(index) {
  let current = index + 1;
  let name = "";
  while (current > 0) {
    current -= 1;
    name = String.fromCharCode(65 + (current % 26)) + name;
    current = Math.floor(current / 26);
  }
  return name;
}

function contentTypesXml() {
  return xml(
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
  );
}
function rootRelationshipsXml() {
  return xml(
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
  );
}
function workbookXml() {
  return xml(
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Relatorio" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  );
}
function workbookRelationshipsXml() {
  return xml(
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  );
}
function stylesXml() {
  return xml(
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="1"><xf xfId="0"/></cellXfs></styleSheet>`,
  );
}
function appPropertiesXml() {
  return xml(
    `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>J12 Sports Hub</Application></Properties>`,
  );
}
function corePropertiesXml() {
  return xml(
    `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Relatorio Financeiro J12</dc:title><dc:creator>J12 Sports Hub</dc:creator></cp:coreProperties>`,
  );
}
function xml(value) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${value.replace(/>\s+</g, "><").trim()}`;
}
function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function spreadsheetSafe(value) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function createZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBuffer = Buffer.from(name);
    const data = Buffer.from(content);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    localParts.push(local, nameBuffer, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + data.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  const count = Object.keys(files).length;
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(count, 8);
  end.writeUInt16LE(count, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, number) => {
  let crc = number;
  for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

module.exports = {
  exportFinancialReportCsv,
  exportFinancialReportPdf,
  exportFinancialReportXlsx,
  reportToRows,
};
