/**
 * Client-side export utilities for tables and lists.
 * Use for CSV download; Excel/PDF can be added via libraries later.
 */

/**
 * Escape a cell for CSV (wrap in quotes if contains comma, quote, or newline).
 * Exported for unit tests.
 */
export function escapeCsvCell(value) {
  if (value == null) return '';
  const s = String(value);
  if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Convert array of objects to CSV string.
 * @param {Array<Record<string, unknown>>} data - Rows (objects with same keys)
 * @param {string[]} [columns] - Column keys in order; if omitted, uses keys from first row
 * @returns {string} CSV content
 */
export function toCSV(data, columns) {
  if (!Array.isArray(data) || data.length === 0) {
    const cols = columns && columns.length ? columns : [];
    return cols.map(escapeCsvCell).join(',') + '\n';
  }
  const keys = columns || Object.keys(data[0] || {});
  const header = keys.map(escapeCsvCell).join(',');
  const rows = data.map((row) => keys.map((k) => escapeCsvCell(row[k])).join(','));
  return [header, ...rows].join('\n');
}

/**
 * Trigger download of a string as a file.
 * @param {string} content - File content
 * @param {string} filename - Suggested filename (e.g. report.csv)
 * @param {string} [mimeType] - Default 'text/csv;charset=utf-8'
 */
export function downloadFile(content, filename, mimeType = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'export.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export array of objects to CSV and download.
 * @param {Array<Record<string, unknown>>} data
 * @param {string} filename - e.g. 'students.csv'
 * @param {string[]} [columns] - Column keys in order
 */
export function exportToCSV(data, filename = 'export.csv', columns) {
  const csv = toCSV(data, columns);
  downloadFile(csv, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}
