import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { parseSimpleCsvLines } from './spreadsheetParse';

/** Stored on `University.programFeeRanges` — matches Uniwizer USA fee matrix spreadsheet. */
export type ProgramFeeRangesPayload = {
  ugBusinessUsdYear: string | null;
  ugStemUsdYear: string | null;
  ugComputerScienceUsdYear: string | null;
  pgBusinessUsdYear: string | null;
  pgStemUsdYear: string | null;
  pgComputerScienceUsdYear: string | null;
};

const emptyRanges = (): ProgramFeeRangesPayload => ({
  ugBusinessUsdYear: null,
  ugStemUsdYear: null,
  ugComputerScienceUsdYear: null,
  pgBusinessUsdYear: null,
  pgStemUsdYear: null,
  pgComputerScienceUsdYear: null,
});

export function normalizeCatalogHeader(header: string): string {
  return header.replace(/^\ufeff/, '').trim();
}

/**
 * Maps Excel/CSV column titles (e.g. "UG – Business Fees (USD/year)") to payload keys.
 */
export function mapCatalogColumn(header: string): keyof ProgramFeeRangesPayload | 'university' | 'country' | 'commission' | null {
  const h = normalizeCatalogHeader(header)
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ');
  if ((h === 'university' || h.startsWith('university ') || h.startsWith('institution')) && !h.includes('fee')) {
    return 'university';
  }
  if (h === 'country' || h === 'nation' || h.startsWith('country ')) {
    return 'country';
  }
  if (
    h === 'commission' ||
    h === 'comission' ||
    h === 'commission %' ||
    h === 'comission %' ||
    h === 'commission percentage' ||
    h === 'comission percentage' ||
    h.startsWith('commission') ||
    h.startsWith('comission') ||
    h.includes('partner commission') ||
    h.includes('partner comission')
  ) {
    return 'commission';
  }
  const hasUg = /\bug\b/.test(h) || h.includes('undergraduate');
  const hasPg = /\bpg\b/.test(h) || h.includes('postgraduate') || h.includes('post grad');
  const hasBusiness = h.includes('business');
  const hasStemOnly = h.includes('stem') && !h.includes('computer');
  const hasCs = h.includes('computer') || /\bcs\b/.test(h);

  if (hasUg && hasBusiness) {
    return 'ugBusinessUsdYear';
  }
  if (hasUg && hasCs) {
    return 'ugComputerScienceUsdYear';
  }
  if (hasUg && hasStemOnly) {
    return 'ugStemUsdYear';
  }
  if (hasPg && hasBusiness) {
    return 'pgBusinessUsdYear';
  }
  if (hasPg && hasCs) {
    return 'pgComputerScienceUsdYear';
  }
  if (hasPg && hasStemOnly) {
    return 'pgStemUsdYear';
  }
  return null;
}

export function findCatalogHeaderRowIndex(matrix: string[][]): number {
  for (let i = 0; i < Math.min(matrix.length, 45); i++) {
    const row = matrix[i] ?? [];
    let hasUni = false;
    let hasCountry = false;
    for (const cell of row) {
      const key = mapCatalogColumn(String(cell));
      if (key === 'university') {
        hasUni = true;
      }
      if (key === 'country') {
        hasCountry = true;
      }
    }
    if (hasUni && hasCountry) {
      return i;
    }
  }
  return 0;
}

export function readCatalogSpreadsheetToMatrix(filePath: string): string[][] {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.csv') {
    let raw = fs.readFileSync(filePath, 'utf8');
    if (raw.charCodeAt(0) === 0xfeff) {
      raw = raw.slice(1);
    }
    return parseSimpleCsvLines(raw);
  }
  if (ext === '.xlsx' || ext === '.xls') {
    const wb = XLSX.readFile(filePath, { type: 'file', cellDates: false });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null | undefined)[]>(sheet, {
      header: 1,
      defval: '',
      raw: false,
    }) as unknown[][];
    return rows.map(row =>
      (Array.isArray(row) ? row : []).map(cell =>
        cell === null || cell === undefined ? '' : String(cell).trim(),
      ),
    );
  }
  throw new Error(`Unsupported catalog file format: ${ext}`);
}

export function buildColumnIndexMap(headerRow: string[]): Partial<
  Record<'university' | 'country' | 'commission' | keyof ProgramFeeRangesPayload, number>
> {
  const colIndex: Partial<Record<'university' | 'country' | 'commission' | keyof ProgramFeeRangesPayload, number>> = {};
  headerRow.forEach((cell, idx) => {
    const key = mapCatalogColumn(String(cell));
    if (key && colIndex[key] === undefined) {
      colIndex[key] = idx;
    }
  });
  return colIndex;
}

export function rowToFeeRanges(
  row: string[],
  colIndex: Partial<Record<'university' | 'country' | 'commission' | keyof ProgramFeeRangesPayload, number>>,
): { name: string; country: string; commission: string | null; ranges: ProgramFeeRangesPayload } | null {
  const cell = (key: keyof typeof colIndex): string => {
    const i = colIndex[key];
    if (i === undefined) {
      return '';
    }
    return String(row[i] ?? '').trim();
  };

  const name = cell('university');
  const country = cell('country');
  if (!name || !country) {
    return null;
  }

  const commission = cell('commission');

  const ranges = emptyRanges();
  (Object.keys(ranges) as (keyof ProgramFeeRangesPayload)[]).forEach(k => {
    const idx = colIndex[k];
    const v = idx === undefined ? '' : String(row[idx] ?? '').trim();
    ranges[k] = v || null;
  });

  return { name, country, commission: commission || null, ranges };
}

export function parseCommissionValue(val: string | null | undefined): number | null {
  if (!val) return null;
  const str = String(val).trim();
  if (!str) return null;
  const clean = str.replace(/%/g, '').trim();
  const num = parseFloat(clean);
  if (Number.isNaN(num) || num <= 0) return null;
  if (num < 1 && !str.includes('%')) {
    return num * 100;
  }
  return num;
}

