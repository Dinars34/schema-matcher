export type ReportFormat = 'csv' | 'xlsx';
export type ReportRow = Record<string, unknown>;

export function getReportColumns(rows: ReportRow[]): string[] {
  const columns = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) columns.add(key);
  }
  return [...columns];
}

export function safeSpreadsheetValue(value: unknown): string | number | boolean {
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value == null) return '';

  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  const text = serialized ?? String(value);
  const firstNonWhitespace = text.trimStart()[0];
  const numericNegative = /^-\d+(?:\.\d+)?$/.test(text);
  if (
    firstNonWhitespace === '=' ||
    firstNonWhitespace === '+' ||
    firstNonWhitespace === '@' ||
    firstNonWhitespace === '\t' ||
    firstNonWhitespace === '\r' ||
    (firstNonWhitespace === '-' && !numericNegative)
  ) {
    return `'${text}`;
  }
  return text;
}

export function toCsv(rows: ReportRow[]): string {
  const columns = getReportColumns(rows);
  const lines = [
    columns,
    ...rows.map((row) => columns.map((column) => safeSpreadsheetValue(row[column]))),
  ];

  return lines
    .map((line) =>
      line
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(','),
    )
    .join('\r\n');
}

export async function downloadReport(rows: ReportRow[], format: ReportFormat): Promise<void> {
  const content =
    format === 'csv'
      ? new Blob(['\uFEFF', toCsv(rows)], { type: 'text/csv;charset=utf-8' })
      : await createWorkbookBlob(rows);
  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = `schema-matcher-report.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function createWorkbookBlob(rows: ReportRow[]): Promise<Blob> {
  const XLSX = await import('@e965/xlsx');
  const columns = getReportColumns(rows);
  const safeRows = rows.map((row) =>
    Object.fromEntries(columns.map((column) => [column, safeSpreadsheetValue(row[column])])),
  );
  const worksheet = XLSX.utils.json_to_sheet(safeRows, { header: columns });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Submissions');
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
