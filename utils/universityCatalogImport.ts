import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import OpenAI from 'openai';
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
export function mapCatalogColumn(header: string): keyof ProgramFeeRangesPayload | 'university' | 'country' | 'commission' | 'offerRate' | 'depositRate' | 'visaRate' | 'enrolledRate' | null {
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
    !h.includes('fee') &&
    !h.includes('no') &&
    !h.includes('serial') &&
    !h.includes('index') &&
    !h.includes('id') &&
    !h.includes('number')
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
  if (h.includes('offer')) {
    return 'offerRate';
  }
  if (h.includes('deposit')) {
    return 'depositRate';
  }
  if (h.includes('visa')) {
    return 'visaRate';
  }
  if (h.includes('enrolled') || h.includes('enrollment')) {
    return 'enrolledRate';
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

async function convertPdfToCsvUsingOpenAi(pdfText: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error('OPENAI_API_KEY is not configured on the server. Cannot parse PDF without OpenAI API key.');
  }

  const openai = new OpenAI({ apiKey });
  
  const systemPrompt = `You are an expert data parsing assistant.
Convert the following unstructured text extracted from a university catalog PDF into a clean CSV format.
The columns of the CSV must be exactly:
"University","Country","Commission","Offer Rate","Deposit Rate","Visa Rate","Enrolled Rate","UG - Business Fees","UG - Stem Fees","UG - Computer Science Fees","PG - Business Fees","PG - Stem Fees","PG - Computer Science Fees"

Instructions:
1. Extract every university/college/institution mentioned.
2. For each university:
   - "University": Extract the clean, full name of the university (e.g. "Canterbury Christ Church University"). Do NOT extract the serial number, row index, or number (like "1", "2", "3") as the university name.
   - "Country": Identify the country (e.g. "United Kingdom", "United States", "Malta", "Germany", etc.). If not mentioned, default to "United Kingdom" if it appears to be a UK institution, or leave empty.
   - "Commission": Extract the general agent commission value or text (e.g. "15%", "2000 USD", "3000 euros ( NO SOP/ NO LOR )", "8% first year").
   - "Offer Rate": Extract any milestone payout specifically for the Offer letter stage if mentioned (e.g. "500 USD", "$800", or leave empty if not specified).
   - "Deposit Rate": Extract any milestone payout for the Deposit paid stage (e.g. "1000 USD", "$1000", or leave empty).
   - "Visa Rate": Extract any milestone payout for the Visa received stage (e.g. "500 USD", "$500", or leave empty).
   - "Enrolled Rate": Extract any milestone payout for the Enrollment stage (e.g. "1000 USD", "$1500", or leave empty).
   - Extract any tuition fee details for undergraduate (UG) and postgraduate (PG) categories if present in the text, otherwise leave empty.
3. Format as a valid CSV, enclosing values in double quotes if they contain commas or special characters.
4. Return ONLY the valid CSV data. Do not include markdown code block formatting (such as \`\`\`csv ... \`\`\`), explanation, or other text.

IMPORTANT:
- Every row in the CSV must have a real university name under the "University" column.
- Under NO circumstances should the "University" column contain a single number, index, or serial number (e.g., "1", "2", "3", "S.No."). If the source text has a serial number next to the university, discard the serial number and extract ONLY the name of the university.`;

  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: pdfText }
    ],
    temperature: 0.1,
  });

  let csvContent = response.choices[0]?.message?.content || '';
  csvContent = csvContent.replace(/^```[a-z]*\n/, '').replace(/\n```$/, '').trim();
  return csvContent;
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
    
    // Convert PDF text to clean CSV content using OpenAI
    const csvContent = await convertPdfToCsvUsingOpenAi(text);
    
    // Parse the generated CSV text into a matrix
    return parseSimpleCsvLines(csvContent);
  }
  throw new Error(`Unsupported catalog file format: ${ext}`);
}

export function buildColumnIndexMap(headerRow: string[]): Partial<
  Record<'university' | 'country' | 'commission' | 'offerRate' | 'depositRate' | 'visaRate' | 'enrolledRate' | keyof ProgramFeeRangesPayload, number>
> {
  const colIndex: Partial<Record<'university' | 'country' | 'commission' | 'offerRate' | 'depositRate' | 'visaRate' | 'enrolledRate' | keyof ProgramFeeRangesPayload, number>> = {};
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
  colIndex: Partial<
    Record<
      'university' | 'country' | 'commission' | 'offerRate' | 'depositRate' | 'visaRate' | 'enrolledRate' | keyof ProgramFeeRangesPayload,
      number
    >
  >,
): {
  name: string;
  country: string;
  commission: string | null;
  rates: Record<string, number>;
  ranges: ProgramFeeRangesPayload;
} | null {
  const cell = (key: string): string => {
    const i = (colIndex as any)[key];
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

  // Parse structured milestone rates
  const rates: Record<string, number> = {};
  const milestoneKeys: { key: 'offerRate' | 'depositRate' | 'visaRate' | 'enrolledRate'; label: string }[] = [
    { key: 'offerRate', label: 'Offer' },
    { key: 'depositRate', label: 'Deposit' },
    { key: 'visaRate', label: 'Visa' },
    { key: 'enrolledRate', label: 'Enrolled' },
  ];

  for (const item of milestoneKeys) {
    const val = cell(item.key);
    if (val) {
      const num = parseFloat(val.replace(/[^\d.]/g, ''));
      if (!Number.isNaN(num)) {
        rates[item.label] = num;
      }
    }
  }

  const ranges = emptyRanges();
  (Object.keys(ranges) as (keyof ProgramFeeRangesPayload)[]).forEach(k => {
    const idx = (colIndex as any)[k];
    const v = idx === undefined ? '' : String(row[idx] ?? '').trim();
    ranges[k] = v || null;
  });

  return { name, country, commission: commission || null, rates, ranges };
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

