import type { EntityCleaningStatus, RawScholarshipRow } from '../extractors/types';
import { scoreFromFields } from '../scoring/entity-quality.service';
import { normalizeCountry, normalizeText } from './normalizers.util';

export type CleanedScholarship = RawScholarshipRow & {
  qualityScore: number;
  cleaningStatus: EntityCleaningStatus;
};

export const cleanScholarshipData = (raw: RawScholarshipRow): CleanedScholarship => {
  const row: RawScholarshipRow = {
    scholarshipName: normalizeText(raw.scholarshipName) || raw.scholarshipName.trim(),
    universityName: normalizeText(raw.universityName || '') || raw.universityName?.trim() || undefined,
    country: normalizeCountry(raw.country || '') || raw.country?.trim() || undefined,
    amount: normalizeText(raw.amount) || raw.amount?.trim() || undefined,
    eligibility: raw.eligibility?.trim() || undefined,
    deadline: raw.deadline?.trim() || undefined,
    description: raw.description?.trim() || undefined,
    sourceUrl: raw.sourceUrl?.trim() || undefined,
  };

  const { score, status } = scoreFromFields([
    { present: !!row.scholarshipName, weight: 30 },
    { present: !!row.universityName, weight: 15 },
    { present: !!row.country, weight: 10 },
    { present: !!row.amount, weight: 20 },
    { present: !!row.eligibility, weight: 15 },
    { present: !!row.deadline, weight: 10 },
  ]);

  return { ...row, qualityScore: score, cleaningStatus: status };
};
