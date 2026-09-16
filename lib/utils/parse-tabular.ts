import Papa from "papaparse";
import ExcelJS from "exceljs";

export type TabularParseResult = {
  data: Record<string, string>[];
  error: string | null;
};

function isExcel(file: File) {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.type === "application/vnd.ms-excel"
  );
}

async function parseExcel(file: File): Promise<TabularParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) return { data: [], error: "The spreadsheet has no worksheets." };

  const rows: Record<string, string>[] = [];
  let headers: string[] = [];

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    if (rowNumber === 1) {
      headers = values.map((v) => String(v ?? "").trim().toLowerCase());
      return;
    }
    const record: Record<string, string> = {};
    headers.forEach((header, i) => {
      if (!header) return;
      const cell = values[i];
      record[header] = cell === null || cell === undefined ? "" : String(cell).trim();
    });
    rows.push(record);
  });

  return { data: rows, error: null };
}

function parseCsv(text: string): TabularParseResult {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  if (parsed.errors.length) {
    return { data: [], error: `CSV parse error: ${parsed.errors[0].message}` };
  }
  return { data: parsed.data, error: null };
}

// Accepts CSV or Excel (.xlsx/.xls) and normalizes to an array of
// lowercase-keyed row objects, so callers only ever deal with one shape
// regardless of which format was uploaded.
export async function parseTabularFile(file: File): Promise<TabularParseResult> {
  if (isExcel(file)) return parseExcel(file);
  const text = await file.text();
  return parseCsv(text);
}
