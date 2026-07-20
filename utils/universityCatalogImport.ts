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

const sheetRowsToMatrix = (sheet: XLSX.WorkSheet): string[][] => {
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
};

/** Prefer "Programmes & Fees" style tabs over fee-matrix or admissions summary. */
const pickPreferredSheetName = (names: string[]): string => {
  const scored = names.map((name, idx) => {
    const n = name.toLowerCase();
    let score = 0;
    if (/programme|program/.test(n) && /fee/.test(n)) score += 50;
    else if (/programme|program/.test(n)) score += 40;
    else if (/fee/.test(n) && !/admission/.test(n)) score += 20;
    if (/admission/.test(n)) score -= 30;
    return { name, score: score - idx * 0.01 };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.name ?? names[0];
};

export type ProgrammeCatalogField =
  | 'university'
  | 'country'
  | 'degree'
  | 'courseName'
  | 'fee'
  | 'feeNote'
  | 'ieltsRequirement'
  | 'academicRequirement'
  | 'applicationFee'
  | 'duration'
  | 'intake';

/**
 * Maps NZ / programme-row workbook headers, e.g.
 * University | Level | Programme Name | Indicative Annual Tuition Fee (NZD, International) | Fee Basis / Note
 */
export function mapProgrammeCatalogColumn(header: string): ProgrammeCatalogField | null {
  const h = normalizeCatalogHeader(header)
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  const k = h.replace(/[^a-z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

  if (
    k === 'university' ||
    k === 'university_name' ||
    k === 'universityname' ||
    k === 'institution' ||
    k === 'institution_name' ||
    k === 'college'
  ) {
    return 'university';
  }
  if (k === 'country' || k === 'nation' || k === 'destination') {
    return 'country';
  }
  if (
    k === 'level' ||
    k === 'study_level' ||
    k === 'studylevel' ||
    k === 'degree' ||
    k === 'qualification'
  ) {
    return 'degree';
  }
  if (
    k === 'programme_name' ||
    k === 'program_name' ||
    k === 'programmename' ||
    k === 'programname' ||
    k === 'course_name' ||
    k === 'coursename' ||
    k === 'programme' ||
    k === 'program' ||
    k === 'course' ||
    h.includes('programme name') ||
    h.includes('program name')
  ) {
    return 'courseName';
  }
  if (
    (h.includes('tuition') || h.includes('fee')) &&
    !h.includes('basis') &&
    !h.includes('application') &&
    !h.includes('note')
  ) {
    return 'fee';
  }
  if (h.includes('fee basis') || k === 'note' || k === 'fee_note' || k === 'feenote' || h.endsWith('/ note')) {
    return 'feeNote';
  }
  if (k.includes('ielts') || k.includes('english')) {
    return 'ieltsRequirement';
  }
  if (k.includes('academic') || k.includes('entry_requirement')) {
    return 'academicRequirement';
  }
  if (k.includes('application_fee') || k.includes('app_fee')) {
    return 'applicationFee';
  }
  if (k === 'duration' || k === 'length') {
    return 'duration';
  }
  if (k === 'intake' || k === 'intakes') {
    return 'intake';
  }
  return null;
}

export function isProgrammeRowHeader(headerRow: string[]): boolean {
  const fields = new Set(
    headerRow.map(cell => mapProgrammeCatalogColumn(String(cell))).filter(Boolean),
  );
  return fields.has('university') && fields.has('courseName');
}

export function findProgrammeHeaderRowIndex(matrix: string[][]): number {
  for (let i = 0; i < Math.min(matrix.length, 45); i++) {
    if (isProgrammeRowHeader(matrix[i] ?? [])) return i;
  }
  return -1;
}

export function buildProgrammeColumnIndex(
  headerRow: string[],
): Partial<Record<ProgrammeCatalogField, number>> {
  const colIndex: Partial<Record<ProgrammeCatalogField, number>> = {};
  headerRow.forEach((cell, idx) => {
    const key = mapProgrammeCatalogColumn(String(cell));
    if (key && colIndex[key] === undefined) colIndex[key] = idx;
  });
  return colIndex;
}

export function normalizeDegreeLabel(raw: string): string {
  const d = raw.trim();
  if (!d) return 'Program';
  if (/^ug$/i.test(d) || /^under-?grad/i.test(d)) return 'Undergraduate';
  if (/^pg$/i.test(d) || /^post-?grad/i.test(d) || /^graduate$/i.test(d)) return 'Postgraduate';
  return d;
}

/** ISO-ish currency code for catalog fee display by destination country. */
export function currencyCodeForCountry(country: string | null | undefined): string {
  const c = (country || '').trim().toLowerCase();
  if (!c || c === 'general' || c === 'international' || c.startsWith('mixed')) return 'USD';
  if (/new\s*zealand|\bnz\b|\bnzl\b/.test(c)) return 'NZD';
  if (/united\s*kingdom|\buk\b|\bgbr\b|england|scotland|wales|britain/.test(c)) return 'GBP';
  // Match Australia / AU / AUS before any loose "us" patterns.
  if (/australia|\bau\b|\baus\b/.test(c)) return 'AUD';
  if (/canada|\bca\b|\bcan\b/.test(c)) return 'CAD';
  if (/united\s*states|\busa\b|\bus\b|\bamerica\b/.test(c)) return 'USD';
  if (/ireland|\bie\b|\birl\b/.test(c)) return 'EUR';
  if (/germany|france|italy|spain|netherlands|europe|euro|berlin|munich/.test(c)) return 'EUR';
  if (/switzerland|\bch\b|\bche\b/.test(c)) return 'CHF';
  if (/singapore|\bsg\b|\bsgp\b/.test(c)) return 'SGD';
  if (/india|\bin\b|\bind\b/.test(c)) return 'INR';
  if (/uae|dubai|emirates|\bae\b/.test(c)) return 'AED';
  return 'USD';
}

/** Detect currency from a fee column header, e.g. "Indicative Annual Tuition Fee (NZD, International)". */
export function currencyFromFeeHeader(header: string | null | undefined): string | null {
  const h = String(header || '');
  const m = h.match(/\b(NZD|AUD|USD|GBP|CAD|EUR|CHF|SGD|INR|AED|HKD|JPY)\b/i);
  if (m) return m[1].toUpperCase();
  if (/£|pound/i.test(h)) return 'GBP';
  if (/€|euro/i.test(h)) return 'EUR';
  if (/a\$|aud/i.test(h)) return 'AUD';
  if (/c\$|cad/i.test(h)) return 'CAD';
  if (/nz\$|nzd/i.test(h)) return 'NZD';
  if (/\$|usd|dollar/i.test(h) && !/nzd|aud|cad|hkd|sgd/i.test(h)) return 'USD';
  return null;
}

const CURRENCY_IN_TEXT = /\b(NZD|AUD|USD|GBP|CAD|EUR|CHF|SGD|INR|AED|HKD|JPY)\b|£|€|NZ\$|A\$|C\$|US\$/i;

/**
 * Parse "38,310 – 45,000" into a display range + numeric midpoint.
 * Currency comes from header / country — never hardcode NZD.
 */
export function parseFeeRangeText(
  raw: string,
  currencyCode: string = 'USD',
): { fee: number; feeRange: string | null } {
  const text = String(raw ?? '').trim();
  if (!text) return { fee: 0, feeRange: null };
  const cleaned = text.replace(/,/g, '');
  const nums = [...cleaned.matchAll(/(\d+(?:\.\d+)?)/g)].map(m => Number(m[1])).filter(n => Number.isFinite(n));
  if (!nums.length) return { fee: 0, feeRange: text };

  const fee = nums.length >= 2 ? Math.round((nums[0] + nums[1]) / 2) : Math.round(nums[0]);
  const code = (currencyCode || 'USD').toUpperCase();

  // If the cell already names a currency, keep the original text (normalized lightly).
  if (CURRENCY_IN_TEXT.test(text)) {
    const withYear = /\/\s*year|per\s*year|p\.?a\.?/i.test(text) ? text : `${text}/year`;
    return { fee, feeRange: withYear };
  }

  const lo = Math.round(nums[0]).toLocaleString('en-US');
  const feeRange =
    nums.length >= 2
      ? `${code} ${lo} – ${Math.round(nums[1]).toLocaleString('en-US')}/year`
      : `${code} ${lo}/year`;
  return { fee, feeRange };
}

/** Rewrite a stored feeRange that was wrongly prefixed (e.g. NZD on a UK course). */
export function alignFeeRangeCurrency(
  feeRange: string | null | undefined,
  country: string | null | undefined,
): string | null {
  const text = (feeRange || '').trim();
  if (!text) return null;
  const countryNorm = (country || '').trim().toLowerCase();
  // Placeholder destinations must not rewrite real currencies (EUR/GBP/etc.) to USD.
  if (
    !countryNorm ||
    countryNorm === 'general' ||
    countryNorm === 'mixed' ||
    countryNorm.startsWith('mixed/') ||
    countryNorm === 'international'
  ) {
    return text;
  }
  const wanted = currencyCodeForCountry(country);
  const replaced = text.replace(/\b(NZD|AUD|USD|GBP|CAD|EUR|CHF|SGD|INR|AED|HKD|JPY)\b/gi, wanted);
  if (replaced !== text) return replaced;
  // Bare "$15,200/year" → "EUR 15,200/year" when destination is not USD.
  if (wanted !== 'USD' && /^\$\s*\d/.test(text)) {
    return text.replace(/^\$\s*/, `${wanted} `);
  }
  if (!CURRENCY_IN_TEXT.test(text) && /\d/.test(text)) {
    return `${wanted} ${text.replace(/\/year$/i, '').trim()}/year`.replace(/\/year\/year$/i, '/year');
  }
  return text;
}

export function inferCountryFromCatalogContext(
  matrix: string[][],
  fileName: string,
): string | null {
  const name = fileName || '';
  if (/new\s*zealand|\bnz[_-\s]/i.test(name)) return 'New Zealand';
  if (/\buk[_-\s.]|united[_\s-]?kingdom|uk\s*universit/i.test(name)) return 'United Kingdom';
  if (/\bau[_-\s.]|australia/i.test(name)) return 'Australia';
  if (/\bca[_-\s.]|canada/i.test(name)) return 'Canada';
  if (/\bus[_-\s.]|usa|united[_\s-]?states/i.test(name)) return 'USA';
  for (const row of matrix.slice(0, 8)) {
    const text = (row ?? []).join(' ');
    if (/new\s*zealand/i.test(text)) return 'New Zealand';
    if (/united\s*kingdom|\buk\b/i.test(text) && /universit/i.test(text)) return 'United Kingdom';
    if (/australia/i.test(text) && /universit/i.test(text)) return 'Australia';
  }
  return null;
}

/** Skip disclaimer / due-diligence blobs that are not real programme titles. */
export function looksLikeNonProgrammeRow(courseName: string): boolean {
  const t = courseName.trim();
  if (!t) return true;
  if (
    /^(important|note|disclaimer|warning|due[-\s]?diligence|recommend|please note)\b/i.test(t)
  ) {
    return true;
  }
  if (t.length > 180 && !/\b(bachelor|master|diploma|certificate|mba|phd|honours|hons|bsc|ba|msc|ma)\b/i.test(t)) {
    return true;
  }
  return false;
}

export async function readCatalogSpreadsheetSheets(
  filePath: string,
): Promise<{ name: string; rows: string[][] }[]> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.csv') {
    return [{ name: 'Sheet1', rows: await readCatalogSpreadsheetToMatrix(filePath) }];
  }
  if (ext === '.xlsx' || ext === '.xls') {
    const wb = XLSX.readFile(filePath, { type: 'file', cellDates: false });
    return wb.SheetNames.map(name => ({
      name,
      rows: sheetRowsToMatrix(wb.Sheets[name]),
    }));
  }
  return [{ name: 'Sheet1', rows: await readCatalogSpreadsheetToMatrix(filePath) }];
}

/** Best-effort map of university name → admissions text from an "Admissions Summary" tab. */
export function extractAdmissionsByUniversity(
  sheets: { name: string; rows: string[][] }[],
): Map<string, { ieltsRequirement: string; academicRequirement: string; applicationFee: string }> {
  const out = new Map<
    string,
    { ieltsRequirement: string; academicRequirement: string; applicationFee: string }
  >();

  for (const sheet of sheets) {
    if (!/admission/i.test(sheet.name) && sheets.length > 1) {
      // Still try if this sheet looks like admissions and programmes sheet was preferred elsewhere.
    }
    const headerIdx = findProgrammeHeaderRowIndex(sheet.rows);
    // Also scan for university + ielts without programme name
    let hIdx = headerIdx;
    if (hIdx < 0) {
      for (let i = 0; i < Math.min(sheet.rows.length, 45); i++) {
        const mapped = (sheet.rows[i] ?? []).map(c => mapProgrammeCatalogColumn(String(c)));
        if (mapped.includes('university') && (mapped.includes('ieltsRequirement') || mapped.includes('academicRequirement'))) {
          hIdx = i;
          break;
        }
      }
    }
    if (hIdx < 0) continue;
    const colIndex = buildProgrammeColumnIndex(sheet.rows[hIdx] ?? []);
    if (colIndex.university == null) continue;
    if (colIndex.ieltsRequirement == null && colIndex.academicRequirement == null) continue;

    for (let r = hIdx + 1; r < sheet.rows.length; r++) {
      const row = sheet.rows[r] ?? [];
      const name = String(row[colIndex.university!] ?? '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const prev = out.get(key) ?? {
        ieltsRequirement: '',
        academicRequirement: '',
        applicationFee: '',
      };
      const ielts =
        colIndex.ieltsRequirement != null ? String(row[colIndex.ieltsRequirement] ?? '').trim() : '';
      const academic =
        colIndex.academicRequirement != null
          ? String(row[colIndex.academicRequirement] ?? '').trim()
          : '';
      const appFee =
        colIndex.applicationFee != null ? String(row[colIndex.applicationFee] ?? '').trim() : '';
      out.set(key, {
        ieltsRequirement: ielts || prev.ieltsRequirement,
        academicRequirement: academic || prev.academicRequirement,
        applicationFee: appFee || prev.applicationFee,
      });
    }
  }

  return out;
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
    const sheetName = pickPreferredSheetName(wb.SheetNames);
    const sheet = wb.Sheets[sheetName];
    return sheetRowsToMatrix(sheet);
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

