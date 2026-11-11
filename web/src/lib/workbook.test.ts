import { describe, expect, it } from 'vitest';
import * as XLSX from '@e965/xlsx';
import { getSheetPreview, readWorkbook } from './workbook';

function makeWorkbook(bookType: 'xlsx' | 'xls' = 'xlsx'): ArrayBuffer {
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['Wilayah', 'Tahun', 'Jumlah'],
    ['Aceh', 2024, 12],
    ['Riau', 2023, 9],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Catatan']]), 'Metadata');
  return XLSX.write(workbook, { bookType, type: 'array' });
}

describe('workbook preview', () => {
  it('reads actual sheet names and selected-sheet rows', async () => {
    const workbook = await readWorkbook(makeWorkbook());

    expect(workbook.SheetNames).toEqual(['Data', 'Metadata']);
    await expect(getSheetPreview(workbook, 'Data')).resolves.toEqual({
      headers: ['Wilayah', 'Tahun', 'Jumlah'],
      rows: [
        ['Aceh', '2024', '12'],
        ['Riau', '2023', '9'],
      ],
    });
  });

  it('reads legacy Excel workbooks', async () => {
    const workbook = await readWorkbook(makeWorkbook('xls'));

    expect(workbook.SheetNames).toEqual(['Data', 'Metadata']);
    await expect(getSheetPreview(workbook, 'Data')).resolves.toMatchObject({
      rows: [['Aceh', '2024', '12'], ['Riau', '2023', '9']],
    });
  });

  it('reports an invalid selected sheet instead of returning fabricated rows', async () => {
    const workbook = await readWorkbook(makeWorkbook());

    await expect(getSheetPreview(workbook, 'Missing')).rejects.toThrow(
      'Sheet yang dipilih tidak ditemukan di dalam file.',
    );
  });

  it('rejects invalid workbook bytes', async () => {
    await expect(readWorkbook(new Uint8Array([1, 2, 3]).buffer)).rejects.toThrow();
  });
});
