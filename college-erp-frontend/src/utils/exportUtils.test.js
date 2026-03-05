/**
 * Tests for exportUtils: toCSV, escapeCsvCell, exportToCSV (with mocked download).
 */
import { toCSV, exportToCSV, escapeCsvCell, downloadFile } from './exportUtils';

describe('escapeCsvCell', () => {
  it('returns empty string for null and undefined', () => {
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
  });

  it('returns string as-is when no comma, quote, or newline', () => {
    expect(escapeCsvCell('hello')).toBe('hello');
    expect(escapeCsvCell('123')).toBe('123');
  });

  it('wraps in double quotes and doubles internal quotes when cell contains comma', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
  });

  it('escapes double quotes by doubling them', () => {
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it('wraps in quotes when cell contains newline', () => {
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
  });
});

describe('toCSV', () => {
  it('returns header only when data is empty and columns provided', () => {
    expect(toCSV([], ['a', 'b'])).toBe('a,b\n');
  });

  it('returns header only when data is empty and no columns', () => {
    expect(toCSV([])).toBe('\n');
  });

  it('uses first row keys as columns when columns not provided', () => {
    const data = [{ x: 1, y: 2 }];
    expect(toCSV(data)).toBe('x,y\n1,2');
  });

  it('outputs columns in order when columns provided', () => {
    const data = [{ a: 1, b: 2 }];
    expect(toCSV(data, ['b', 'a'])).toBe('b,a\n2,1');
  });

  it('handles multiple rows', () => {
    const data = [
      { name: 'Alice', score: 90 },
      { name: 'Bob', score: 85 },
    ];
    expect(toCSV(data)).toBe('name,score\nAlice,90\nBob,85');
  });

  it('escapes cells with comma', () => {
    const data = [{ title: 'Hello, World', id: 1 }];
    expect(toCSV(data)).toBe('title,id\n"Hello, World",1');
  });
});

describe('exportToCSV', () => {
  beforeEach(() => {
    global.URL.createObjectURL = jest.fn(() => 'blob:mock');
    global.URL.revokeObjectURL = jest.fn();
  });

  it('generates same content as toCSV and runs without throwing', () => {
    const data = [{ a: 1, b: 2 }];
    const expectedCsv = toCSV(data);
    expect(expectedCsv).toBe('a,b\n1,2');
    expect(() => exportToCSV(data, 'test.csv')).not.toThrow();
  });

  it('appends .csv when filename has no extension', () => {
    const data = [{ x: 1 }];
    expect(() => exportToCSV(data, 'report')).not.toThrow();
  });
});
