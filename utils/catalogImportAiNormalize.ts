import { getOpenAiClient, scrapeAiModel } from '../src/modules/scrape/enrichment/openai.client';
import {
  currencyCodeForCountry,
  currencyFromFeeHeader,
  looksLikeNonProgrammeRow,
  normalizeDegreeLabel,
  parseFeeRangeText,
} from './universityCatalogImport';

export type RawProgrammeNormInput = {
  line: number;
  universityName: string;
  country: string;
  degree: string;
  courseName: string;
  feeRaw: string;
  feeNote: string;
  duration: string;
  intake: string;
  ieltsRequirement: string;
  academicRequirement: string;
  applicationFee: string;
};

export type NormalizedProgrammeRow = {
  line: number;
  skip: boolean;
  skipReason?: string;
  universityName: string;
  country: string;
  degree: string;
  courseName: string;
  currency: string;
  fee: number;
  feeRange: string | null;
  feeNote: string | null;
  duration: string;
  intake: string;
  ieltsRequirement: string;
  academicRequirement: string;
  applicationFee: string;
};

export type RawFeeMatrixNormInput = {
  line: number;
  universityName: string;
  country: string;
};

export type NormalizedFeeMatrixRow = {
  line: number;
  skip: boolean;
  skipReason?: string;
  universityName: string;
  country: string;
};

export const catalogImportAiEnabled = (): boolean => {
  if (process.env.CATALOG_IMPORT_AI === 'false') return false;
  return Boolean(process.env.OPENAI_API_KEY?.trim());
};

const stripJsonFence = (text: string): string =>
  text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

const canonicalCountry = (value: string, fallback: string): string => {
  const v = (value || '').trim();
  if (!v || /^general$/i.test(v)) return fallback || 'General';
  const lower = v.toLowerCase();
  if (/new\s*zealand|^nz$/.test(lower)) return 'New Zealand';
  if (/united\s*kingdom|^uk$|britain|england|scotland|wales/.test(lower)) return 'United Kingdom';
  if (/united\s*states|^usa$|^us$/.test(lower)) return 'USA';
  if (/australia|^au$/.test(lower)) return 'Australia';
  if (/canada|^ca$/.test(lower)) return 'Canada';
  if (/germany/.test(lower)) return 'Germany';
  if (/france/.test(lower)) return 'France';
  if (/italy/.test(lower)) return 'Italy';
  if (/ireland/.test(lower)) return 'Ireland';
  if (/switzerland/.test(lower)) return 'Switzerland';
  if (/singapore/.test(lower)) return 'Singapore';
  if (/india/.test(lower)) return 'India';
  if (/uae|dubai|emirates/.test(lower)) return 'UAE';
  return v
    .split(/\s+/)
    .map(w => (w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
};

/** Rule-based normalization used as fallback and to fill AI gaps. */
export const normalizeProgrammeRowRules = (
  row: RawProgrammeNormInput,
  ctx: { headerCurrency?: string | null; inferredCountry?: string | null; fileName?: string },
): NormalizedProgrammeRow => {
  if (looksLikeNonProgrammeRow(row.courseName)) {
    return {
      ...emptyNorm(row),
      skip: true,
      skipReason: 'Non-programme / disclaimer row',
    };
  }

  const country = canonicalCountry(
    row.country || ctx.inferredCountry || '',
    ctx.inferredCountry || 'General',
  );
  const currency =
    ctx.headerCurrency ||
    currencyFromFeeHeader(row.feeRaw) ||
    currencyCodeForCountry(country);
  const { fee, feeRange } = parseFeeRangeText(row.feeRaw, currency);

  return {
    line: row.line,
    skip: false,
    universityName: cleanUniversityName(row.universityName),
    country,
    degree: normalizeDegreeLabel(row.degree),
    courseName: cleanProgrammeName(row.courseName),
    currency,
    fee,
    feeRange,
    feeNote: row.feeNote?.trim() || null,
    duration: (row.duration || '—').slice(0, 255),
    intake: row.intake || '',
    ieltsRequirement: row.ieltsRequirement || '',
    academicRequirement: row.academicRequirement || '',
    applicationFee: row.applicationFee || '',
  };
};

const emptyNorm = (row: RawProgrammeNormInput): NormalizedProgrammeRow => ({
  line: row.line,
  skip: true,
  universityName: row.universityName,
  country: 'General',
  degree: 'Program',
  courseName: row.courseName,
  currency: 'USD',
  fee: 0,
  feeRange: null,
  feeNote: null,
  duration: '—',
  intake: '',
  ieltsRequirement: '',
  academicRequirement: '',
  applicationFee: '',
});

const cleanUniversityName = (name: string): string =>
  name
    .replace(/\s+/g, ' ')
    .replace(/\s*[–—]\s*Russell Group\s*$/i, '')
    .replace(/\s*\(private\)\s*$/i, '')
    .trim();

const cleanProgrammeName = (name: string): string =>
  name.replace(/\s+/g, ' ').replace(/^[\-\u2022*]+\s*/, '').trim();

const SYSTEM_UNIVERSITY = `You normalize university names and countries for a student recruitment catalogue.
Return ONLY JSON: {"rows":[{"id":number,"universityName":string,"country":string}]}
- universityName: clean official institution name (drop serial numbers and heavy marketing fluff; keep useful campus hints in parentheses)
- country: canonical English country (New Zealand, United Kingdom, Australia, Canada, USA, Germany, France, Italy, Ireland, Switzerland, Singapore, India, UAE, …)
Infer country from the institution name when country is missing/General.
Never assign New Zealand to clearly UK/Canada/Australia/USA/EU institutions.
Never assign United Kingdom to clearly NZ/AU/CA institutions.`;

type AiUniversityOut = {
  id: number;
  universityName?: string;
  country?: string;
};

async function aiNormalizeUniqueUniversities(
  unis: Array<{ id: number; universityName: string; country: string }>,
  ctx: { fileName?: string; inferredCountry?: string | null },
): Promise<Map<number, AiUniversityOut>> {
  const client = getOpenAiClient();
  const response = await client.chat.completions.create({
    model: scrapeAiModel(),
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_UNIVERSITY },
      {
        role: 'user',
        content: `File: ${ctx.fileName || 'unknown'}\nCountry hint: ${ctx.inferredCountry || 'none'}\n${JSON.stringify(unis)}`,
      },
    ],
  });
  const text = stripJsonFence(response.choices[0]?.message?.content || '');
  const parsed = JSON.parse(text) as { rows?: AiUniversityOut[] };
  const map = new Map<number, AiUniversityOut>();
  for (const row of parsed.rows || []) {
    if (row && typeof row.id === 'number') map.set(row.id, row);
  }
  return map;
}

/**
 * Fast path: rule-normalize every programme row, then AI-normalize unique universities only
 * (name + country). Avoids one OpenAI call per ~40 programme rows (was causing 504 timeouts).
 */
export async function normalizeProgrammeImportRows(
  rows: RawProgrammeNormInput[],
  ctx: { headerCurrency?: string | null; inferredCountry?: string | null; fileName?: string } = {},
): Promise<{ rows: NormalizedProgrammeRow[]; aiUsed: boolean; aiBatches: number; aiFailures: number }> {
  if (!rows.length) {
    return { rows: [], aiUsed: false, aiBatches: 0, aiFailures: 0 };
  }

  const ruled = rows.map(r => normalizeProgrammeRowRules(r, ctx));

  if (!catalogImportAiEnabled()) {
    return { rows: ruled, aiUsed: false, aiBatches: 0, aiFailures: 0 };
  }

  // Unique universities from raw rows (stable id by order of first appearance).
  const uniKeyToId = new Map<string, number>();
  const uniqueUnis: Array<{ id: number; universityName: string; country: string }> = [];
  for (const raw of rows) {
    const key = raw.universityName.trim().toLowerCase();
    if (!key || uniKeyToId.has(key)) continue;
    const id = uniqueUnis.length + 1;
    uniKeyToId.set(key, id);
    uniqueUnis.push({
      id,
      universityName: raw.universityName,
      country: raw.country || ctx.inferredCountry || '',
    });
  }

  let aiBatches = 0;
  let aiFailures = 0;
  const uniFixes = new Map<string, { universityName: string; country: string }>();

  const UNI_BATCH = Math.max(20, Math.min(80, Number(process.env.CATALOG_IMPORT_AI_UNI_BATCH || 50)));
  for (let i = 0; i < uniqueUnis.length; i += UNI_BATCH) {
    const batch = uniqueUnis.slice(i, i + UNI_BATCH);
    aiBatches += 1;
    try {
      const aiMap = await aiNormalizeUniqueUniversities(batch, ctx);
      for (const u of batch) {
        const ai = aiMap.get(u.id);
        const country = canonicalCountry(
          ai?.country || u.country || ctx.inferredCountry || '',
          ctx.inferredCountry || 'General',
        );
        uniFixes.set(u.universityName.trim().toLowerCase(), {
          universityName: cleanUniversityName(ai?.universityName || u.universityName),
          country,
        });
      }
    } catch {
      aiFailures += 1;
      for (const u of batch) {
        uniFixes.set(u.universityName.trim().toLowerCase(), {
          universityName: cleanUniversityName(u.universityName),
          country: canonicalCountry(u.country || ctx.inferredCountry || '', ctx.inferredCountry || 'General'),
        });
      }
    }
  }

  const out = ruled.map((row, idx) => {
    if (row.skip) return row;
    const raw = rows[idx];
    const fix = uniFixes.get(raw.universityName.trim().toLowerCase());
    if (!fix) return row;

    const country = fix.country || row.country;
    const currency =
      ctx.headerCurrency ||
      currencyFromFeeHeader(raw.feeRaw) ||
      currencyCodeForCountry(country);
    const { fee, feeRange } = parseFeeRangeText(raw.feeRaw, currency);

    return {
      ...row,
      universityName: fix.universityName || row.universityName,
      country,
      currency,
      fee,
      feeRange,
    };
  });

  return {
    rows: out,
    aiUsed: true,
    aiBatches,
    aiFailures,
  };
}

const SYSTEM_FEE_MATRIX = `You normalize university fee-matrix catalogue rows.
Return ONLY JSON: {"rows":[{"id":number,"skip":boolean,"skipReason":string,"universityName":string,"country":string}]}
- universityName: clean official name (no serial numbers)
- country: canonical country (United Kingdom, USA, Australia, Canada, New Zealand, Germany, France, …). Infer from name when missing.
- skip: true for blank/invalid institution names
Never assign New Zealand to clearly UK/EU/US/Canada/Australia institutions.`;

export async function normalizeFeeMatrixImportRows(
  rows: RawFeeMatrixNormInput[],
  ctx: { fileName?: string; inferredCountry?: string | null } = {},
): Promise<{ rows: NormalizedFeeMatrixRow[]; aiUsed: boolean }> {
  if (!rows.length) return { rows: [], aiUsed: false };

  const rule = (r: RawFeeMatrixNormInput): NormalizedFeeMatrixRow => {
    const name = cleanUniversityName(r.universityName);
    if (!name || /^\d+$/.test(name)) {
      return { line: r.line, skip: true, skipReason: 'Invalid university name', universityName: name, country: 'General' };
    }
    return {
      line: r.line,
      skip: false,
      universityName: name,
      country: canonicalCountry(r.country || ctx.inferredCountry || '', ctx.inferredCountry || 'General'),
    };
  };

  if (!catalogImportAiEnabled()) {
    return { rows: rows.map(rule), aiUsed: false };
  }

  // Deduplicate by university name — fee matrix can still be large.
  const keyToLines = new Map<string, number[]>();
  const unique: Array<{ id: number; universityName: string; country: string; key: string }> = [];
  for (const r of rows) {
    const key = r.universityName.trim().toLowerCase();
    if (!key) continue;
    if (!keyToLines.has(key)) {
      keyToLines.set(key, []);
      unique.push({
        id: unique.length + 1,
        universityName: r.universityName,
        country: r.country,
        key,
      });
    }
    keyToLines.get(key)!.push(r.line);
  }

  const fixByKey = new Map<string, NormalizedFeeMatrixRow>();
  const UNI_BATCH = Math.max(20, Math.min(80, Number(process.env.CATALOG_IMPORT_AI_UNI_BATCH || 50)));

  try {
    for (let i = 0; i < unique.length; i += UNI_BATCH) {
      const batch = unique.slice(i, i + UNI_BATCH);
      const client = getOpenAiClient();
      const response = await client.chat.completions.create({
        model: scrapeAiModel(),
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_FEE_MATRIX },
          {
            role: 'user',
            content: `File: ${ctx.fileName || 'unknown'}\nHint country: ${ctx.inferredCountry || 'none'}\n${JSON.stringify(
              batch.map(u => ({ id: u.id, universityName: u.universityName, country: u.country })),
            )}`,
          },
        ],
      });
      const text = stripJsonFence(response.choices[0]?.message?.content || '');
      const parsed = JSON.parse(text) as {
        rows?: Array<{ id: number; skip?: boolean; skipReason?: string; universityName?: string; country?: string }>;
      };
      const map = new Map((parsed.rows || []).map(r => [r.id, r]));
      for (const u of batch) {
        const ai = map.get(u.id);
        const base = rule({ line: u.id, universityName: u.universityName, country: u.country });
        if (!ai || ai.skip) {
          fixByKey.set(u.key, { ...base, skip: Boolean(ai?.skip), skipReason: ai?.skipReason });
          continue;
        }
        fixByKey.set(u.key, {
          line: u.id,
          skip: false,
          universityName: cleanUniversityName(ai.universityName || base.universityName),
          country: canonicalCountry(ai.country || base.country, base.country),
        });
      }
    }

    const out = rows.map(r => {
      const key = r.universityName.trim().toLowerCase();
      const fix = fixByKey.get(key);
      if (!fix) return rule(r);
      return { ...fix, line: r.line };
    });
    return { rows: out, aiUsed: true };
  } catch {
    return { rows: rows.map(rule), aiUsed: false };
  }
}
