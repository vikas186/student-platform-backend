import type { EntityCleaningStatus, RawUniversityRow } from '../extractors/types';
import { scoreFromFields } from '../scoring/entity-quality.service';
import { normalizeCountry, normalizeText, normalizeUrl } from './normalizers.util';

export type CleanedUniversity = RawUniversityRow & {
  qualityScore: number;
  cleaningStatus: EntityCleaningStatus;
};

export const cleanUniversityData = (raw: RawUniversityRow): CleanedUniversity => {
  const row: RawUniversityRow = {
    universityName: normalizeText(raw.universityName) || raw.universityName.trim(),
    country: normalizeCountry(raw.country || '') || raw.country?.trim() || undefined,
    city: normalizeText(raw.city) || raw.city?.trim() || undefined,
    ranking: raw.ranking?.trim() || undefined,
    overview: raw.overview?.trim() || undefined,
    websiteUrl: normalizeUrl(raw.websiteUrl || '') || raw.websiteUrl?.trim() || undefined,
    sourceUrl: normalizeUrl(raw.sourceUrl || '') || raw.sourceUrl?.trim() || undefined,
    faculties: (raw.faculties || []).map(f => normalizeText(f)).filter(Boolean) as string[],
    departments: (raw.departments || []).map(d => normalizeText(d)).filter(Boolean) as string[],
    popularCourses: (raw.popularCourses || []).map(c => normalizeText(c)).filter(Boolean) as string[],
    intakes: raw.intakes?.trim() || undefined,
    courses: raw.courses?.trim() || undefined,
    costOfStudy: raw.costOfStudy?.trim() || undefined,
    scholarships: raw.scholarships?.trim() || undefined,
    admissionRequirements: raw.admissionRequirements?.trim() || undefined,
    acceptanceCriteria: raw.acceptanceCriteria?.trim() || undefined,
  };

  const { score, status } = scoreFromFields([
    { present: !!row.universityName, weight: 30 },
    { present: !!row.country, weight: 15 },
    { present: !!row.overview, weight: 15 },
    { present: !!row.ranking, weight: 10 },
    { present: (row.faculties?.length ?? 0) > 0, weight: 10 },
    { present: (row.departments?.length ?? 0) > 0, weight: 10 },
    { present: (row.popularCourses?.length ?? 0) > 0, weight: 10 },
  ]);

  return { ...row, qualityScore: score, cleaningStatus: status };
};
