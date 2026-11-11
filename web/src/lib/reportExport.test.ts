import { describe, expect, it } from 'vitest';
import { safeSpreadsheetValue, toCsv } from './reportExport';

describe('report export safety', () => {
  it('neutralizes formula-like strings without changing numeric values', () => {
    expect(safeSpreadsheetValue('=1+1')).toBe("'=1+1");
    expect(safeSpreadsheetValue('  @SUM(A1)')).toBe("'  @SUM(A1)");
    expect(safeSpreadsheetValue('-1.25')).toBe('-1.25');
    expect(safeSpreadsheetValue(-1.25)).toBe(-1.25);
  });

  it('quotes CSV fields and emits a stable header for empty reports', () => {
    expect(toCsv([{ name: 'A,"B"', notes: '=1+1' }])).toBe(
      '"name","notes"\r\n"A,""B""","\'=1+1"',
    );
    expect(toCsv([])).toBe('');
  });
});
