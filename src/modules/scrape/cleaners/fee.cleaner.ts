import type { EntityCleaningStatus, RawFeeRow } from '../extractors/types';
import { scoreFromFields } from '../scoring/entity-quality.service';
import { normalizeCountry, normalizeDegreeLevel, normalizeText } from './normalizers.util';

export type CleanedFee = RawFeeRow & {
  qualityScore: number;
  cleaningStatus: EntityCleaningStatus;
};

export const cleanFeeData = (raw: RawFeeRow): CleanedFee => {
  const row: RawFeeRow = {
    country: normalizeCountry(raw.country || '') || raw.country?.trim() || undefined,
    studyLevel: normalizeDegreeLevel(raw.studyLevel || '') || raw.studyLevel?.trim() || undefined,
    tuitionFee: normalizeText(raw.tuitionFee) || raw.tuitionFee?.trim() || undefined,
    livingCost: normalizeText(raw.livingCost) || raw.livingCost?.trim() || undefined,
    accommodationCost: normalizeText(raw.accommodationCost) || raw.accommodationCost?.trim() || undefined,
    currency: raw.currency?.trim()?.toUpperCase() || undefined,
    description: raw.description?.trim() || undefined,
    sourceUrl: raw.sourceUrl?.trim() || undefined,
  };

  const { score, status } = scoreFromFields([
    { present: !!row.country, weight: 20 },
    { present: !!row.studyLevel, weight: 15 },
    { present: !!row.tuitionFee, weight: 25 },
    { present: !!row.livingCost, weight: 15 },
    { present: !!row.accommodationCost, weight: 10 },
    { present: !!row.currency, weight: 15 },
  ]);

  return { ...row, qualityScore: score, cleaningStatus: status };
};
