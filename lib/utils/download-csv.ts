// Builds a tiny example CSV (header + one or more sample rows) and
// triggers a browser download — used by each bulk-import dialog's
// "Download example file" link so people don't have to guess column
// names/order.
export function downloadExampleCsv(
  filename: string,
  headers: string[],
  exampleRows: string[] | string[][],
) {
  const rows = Array.isArray(exampleRows[0]) ? (exampleRows as string[][]) : [exampleRows as string[]];
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const csv = [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
