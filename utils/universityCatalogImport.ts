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
  if (
    (h === 'university' ||
      h.includes('university') ||
      h.includes('institution') ||
      h.includes('college') ||
      h === 'uni' ||
      h === 'name' ||
      h === 'universityname' ||
      h === 'institutionname') &&
    !h.includes('fee')
  ) {
    return 'university';
  }
  if (
    (h === 'country' ||
      h.includes('country') ||
      h === 'nation' ||
      h.includes('nation') ||
      h === 'location' ||
      h === 'destination') &&
    !h.includes('fee')
  ) {
    return 'country';
  }
  if (
    h.includes('commission') ||
    h.includes('comission')
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
    for (const cell of row) {
      const key = mapCatalogColumn(String(cell));
      if (key === 'university') {
        hasUni = true;
        break;
      }
    }
    if (hasUni) {
      return i;
    }
  }
  return 0;
}

export async function readCatalogSpreadsheetToMatrix(filePath: string): Promise<string[][]> {
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
  if (ext === '.pdf') {
    const pdfParse = require('pdf-parse');
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    const text = data.text || '';
    const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean);

    const entryStrings: string[] = [];
    let currentEntryStr = '';

    for (const line of lines) {
      const isNewEntry = /^\s*\d+\b/.test(line);
      if (isNewEntry) {
        if (currentEntryStr) {
          entryStrings.push(currentEntryStr);
        }
        currentEntryStr = line;
      } else {
        if (currentEntryStr) {
          currentEntryStr += ' ' + line;
        } else {
          if (line.toLowerCase().includes('university')) {
            entryStrings.push(line);
          }
        }
      }
    }
    if (currentEntryStr) {
      entryStrings.push(currentEntryStr);
    }

    const matrix: string[][] = [
      ['University', 'Country', 'Commission']
    ];

    const commissionStartRegex = /(commission|1\s*-\s*\d+|1\s+(?:to|tp)\s+\d+|\d+(?:\.\d+)?%\s*(?:-|for|plus|–|—|onwards)?|\d+(?:\.\d+)?\s*%\s*-\s*one student)/i;

    const campusKeywords = [
      'london', 'birmingham', 'bristol', 'guildford', 'leeds', 'manchester',
      'nottingham', 'canterbury', 'canary', 'poole', 'dorset', 'england',
      'bath', 'liverpool', 'ealing', 'brentford', 'scotland', 'wales',
      'swansea', 'carmarthen', 'cardiff', 'edinburgh', 'sunderland',
      'all campus', 'main campus', 'campus'
    ];

    for (const entry of entryStrings) {
      if (/^\s*\d+/.test(entry)) {
        const cleanStr = entry.replace(/^\s*\d+\s+/, '');
        const match = cleanStr.match(commissionStartRegex);
        if (match && match.index !== undefined) {
          const uniAndCampus = cleanStr.substring(0, match.index).trim();
          const commission = cleanStr.substring(match.index).trim();

          let uniName = uniAndCampus;
          let lowerUniAndCampus = uniAndCampus.toLowerCase();
          let splitIdx = -1;
          for (const kw of campusKeywords) {
            const idx = lowerUniAndCampus.indexOf(kw);
            if (idx !== -1 && (splitIdx === -1 || idx < splitIdx)) {
              const prevChar = idx > 0 ? lowerUniAndCampus[idx - 1] : '';
              if (!prevChar || /[^a-z0-9]/.test(prevChar)) {
                splitIdx = idx;
              }
            }
          }
          if (splitIdx > 2) {
            uniName = uniAndCampus.substring(0, splitIdx).replace(/[,/-\s]+$/, '').trim();
          }

          matrix.push([uniName, 'United Kingdom', commission]);
        } else {
          matrix.push([cleanStr, 'United Kingdom', '']);
        }
      }
    }
    return matrix;
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
  let country = cell('country');
  if (!name) {
    return null;
  }
  if (!country) {
    country = 'United Kingdom';
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

  // 1. Try to find all percentage patterns like "17%", "12.5%"
  const percentMatches = [...str.matchAll(/(\d+(?:\.\d+)?)\s*%/g)];
  if (percentMatches.length > 0) {
    const percentages = percentMatches
      .map(m => parseFloat(m[1]))
      .filter(p => !Number.isNaN(p) && p > 0);
    if (percentages.length > 0) {
      // Return the first valid percentage found
      return percentages[0];
    }
  }
  // 2. Try to look for flat fee patterns like "2000 USD", "$800", "USD 1500", "3000 euros"
  const hasFlatFee =
    /\b\d+\s*(?:usd|gbp|eur|euros?|cad|aud|inr|usd|per|\$)\b/i.test(str) ||
    /(?:usd|gbp|eur|euros?|cad|aud|inr|\$|£|€)\s*\d+/i.test(str) ||
    /flat\b/i.test(str) ||
    /fee\b/i.test(str) ||
    /enrolement\b/i.test(str) ||
    /enrollment\b/i.test(str) ||
    /per\b/i.test(str);

  if (hasFlatFee) {
    // Return 0 so a database row gets created, keeping the raw format text.
    return 0;
  }

  // 3. Fallback to original parseFloat-based logic
  const clean = str.replace(/%/g, '').trim();
  const num = parseFloat(clean);
  if (Number.isNaN(num) || num <= 0) return null;

  // If the number is 100 or greater and it has no percentage pattern, it must be a flat fee (e.g. 3000 euros, 2000)
  if (num >= 100) {
    return 0;
  }

  if (num < 1 && !str.includes('%')) {
    return num * 100;
  }
  return num;
}

