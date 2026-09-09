import ExcelJS from "exceljs";
import Papa from "papaparse";

export type ExportFormat = "csv" | "xls";

function downloadBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * Writes plain-text records to a CSV or XLSX file and triggers a browser
 * download. Shared by the admin Users/Apps export flows (no AG Grid).
 */
export async function exportRecordsToFile(
  rows: Record<string, string>[],
  headers: readonly string[],
  sheetName: string,
  fileName: string,
  format: ExportFormat,
): Promise<void> {
  const name = fileName || `openbb_pro_${sheetName.toLowerCase()}`;

  if (format === "csv") {
    const csv = Papa.unparse(rows, { columns: [...headers], delimiter: ";" });
    // `sep=;` prefix tells Excel to use ";" as the column separator (locale-safe).
    const blob = new Blob([`sep=;\n${csv}`], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `${name}.csv`);
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRow([...headers]);
  for (const row of rows) sheet.addRow(headers.map((header) => row[header] ?? ""));

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, `${name}.xlsx`);
}
