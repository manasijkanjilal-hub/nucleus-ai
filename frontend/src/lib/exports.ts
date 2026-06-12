// =============================================================================
// Nucleus AI — Client-side data export helpers
// -----------------------------------------------------------------------------
// Simple, dependency-light exporters used by the analytics page. Both functions
// run in the browser and trigger a file download.
//   • exportToCSV(rows, filename)   — native CSV (no external dependency)
//   • exportToExcel(rows, filename) — .xlsx via exceljs
//
// `rows` is an array of flat objects. Column headers are derived from the keys
// of the first row (or an explicit `columns` list).
// =============================================================================

'use client';

export type ExportRow = Record<string, string | number | boolean | null | undefined>;

function resolveColumns(rows: ExportRow[], columns?: string[]): string[] {
  if (columns && columns.length) return columns;
  if (!rows.length) return [];
  return Object.keys(rows[0]);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after a tick so the download can start.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Escape a single CSV cell per RFC 4180. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Export an array of objects to a CSV file and trigger a download.
 */
export function exportToCSV(rows: ExportRow[], filename: string, columns?: string[]): void {
  const cols = resolveColumns(rows, columns);
  const header = cols.map(csvCell).join(',');
  const body = rows.map((row) => cols.map((c) => csvCell(row[c])).join(',')).join('\r\n');
  const csv = `${header}\r\n${body}`;
  // Prepend BOM so Excel opens UTF-8 correctly.
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

/**
 * Export an array of objects to an .xlsx file and trigger a download.
 * Uses exceljs (loaded dynamically to keep it out of the initial bundle).
 */
export async function exportToExcel(
  rows: ExportRow[],
  filename: string,
  options?: { sheetName?: string; columns?: string[] },
): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const cols = resolveColumns(rows, options?.columns);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Nucleus AI';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(options?.sheetName || 'Export');

  if (cols.length) {
    sheet.columns = cols.map((c) => ({
      header: c,
      key: c,
      width: Math.min(40, Math.max(12, c.length + 4)),
    }));
    // Bold header row.
    sheet.getRow(1).font = { bold: true };
    rows.forEach((row) => sheet.addRow(row));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerDownload(blob, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}
