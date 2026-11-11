import type * as XLSX from '@e965/xlsx';

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const PREVIEW_ROWS = 5;
const PREVIEW_COLUMNS = 12;

export interface WorkbookPreview {
  headers: string[];
  rows: string[][];
}

export async function readWorkbook(buffer: ArrayBuffer): Promise<XLSX.WorkBook> {
  const XLSX = await import('@e965/xlsx');
  const signature = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 8));
  const isZipWorkbook =
    signature[0] === 0x50 &&
    signature[1] === 0x4b &&
    [0x03, 0x05, 0x07].includes(signature[2]) &&
    [0x04, 0x06, 0x08].includes(signature[3]);
  const isLegacyWorkbook =
    signature[0] === 0xd0 &&
    signature[1] === 0xcf &&
    signature[2] === 0x11 &&
    signature[3] === 0xe0 &&
    signature[4] === 0xa1 &&
    signature[5] === 0xb1 &&
    signature[6] === 0x1a &&
    signature[7] === 0xe1;

  if (!isZipWorkbook && !isLegacyWorkbook) {
    throw new Error('Isi file bukan workbook Excel yang valid.');
  }

  const workbook = XLSX.read(buffer, {
    type: 'array',
    WTF: true,
    sheetRows: PREVIEW_ROWS + 1,
  });

  if (workbook.SheetNames.length === 0) {
    throw new Error('Workbook tidak memiliki sheet yang dapat dibaca.');
  }

  return workbook;
}

export async function getSheetPreview(
  workbook: XLSX.WorkBook,
  sheetName: string,
): Promise<WorkbookPreview> {
  const XLSX = await import('@e965/xlsx');
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error('Sheet yang dipilih tidak ditemukan di dalam file.');
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  });
  const visibleRows = rows.slice(0, PREVIEW_ROWS + 1);
  const width = Math.min(
    PREVIEW_COLUMNS,
    visibleRows.reduce((max, row) => Math.max(max, row.length), 0),
  );
  const headers = Array.from({ length: width }, (_, index) => {
    const value = visibleRows[0]?.[index];
    return value == null || value === '' ? `Kolom ${index + 1}` : String(value);
  });

  return {
    headers,
    rows: visibleRows.slice(1).map((row) =>
      headers.map((_, index) => {
        const value = row[index];
        return value == null ? '' : String(value);
      }),
    ),
  };
}
