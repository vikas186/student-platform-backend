import type { RawCourseRow } from '../scrapers/types';
import {
  normalizeAcademicRequirements,
  normalizeCountry,
  normalizeDegreeLevel,
  normalizeDuration,
  normalizeEnglishRequirements,
  normalizeIntakes,
  mergeNormalizedRequirements,
  normalizeText,
  normalizeTuition,
  normalizeUrl,
} from './normalizers.util';
import { calculateCourseQuality } from '../scoring/quality-score.service';
import type { CleanedCourse } from './course.types';

/** Trim, normalize, and score a single course row. */
export const cleanCourseData = (raw: RawCourseRow): CleanedCourse => {
  const row: RawCourseRow = {
    ...raw,
    universityName: normalizeText(raw.universityName) || raw.universityName?.trim() || '',
    courseName: normalizeText(raw.courseName) || raw.courseName?.trim() || '',
    country: normalizeCountry(raw.country || '') || raw.country?.trim() || undefined,
    city: normalizeText(raw.city) || raw.city?.trim() || undefined,
    studyLevel: normalizeDegreeLevel(raw.studyLevel || '') || raw.studyLevel?.trim() || undefined,
    duration: normalizeText(raw.duration) || raw.duration?.trim() || undefined,
    tuitionFee: normalizeText(raw.tuitionFee) || raw.tuitionFee?.trim() || undefined,
    intake: normalizeText(raw.intake) || raw.intake?.trim() || undefined,
    ieltsRequirement: raw.ieltsRequirement?.trim() || undefined,
    academicRequirement: raw.academicRequirement?.trim() || undefined,
    applicationFee: raw.applicationFee?.trim() || undefined,
    scholarship: raw.scholarship?.trim() || undefined,
    courseUrl: normalizeUrl(raw.courseUrl || '') || raw.courseUrl?.trim() || undefined,
  };

  const englishRaw = [row.ieltsRequirement, row.academicRequirement].filter(Boolean).join(' ');
  const { score, status } = calculateCourseQuality(row);

  return {
    ...row,
    qualityScore: score,
    cleaningStatus: status,
    isDuplicate: false,
    duplicateOf: null,
    cleaningNotes: null,
    normalizedTuition: row.tuitionFee ? normalizeTuition(row.tuitionFee) : null,
    normalizedDuration: row.duration ? normalizeDuration(row.duration) : null,
    normalizedIntakes: row.intake ? normalizeIntakes(row.intake) : [],
    normalizedRequirements: mergeNormalizedRequirements(
      englishRaw ? normalizeEnglishRequirements(englishRaw) : null,
      row.academicRequirement ? normalizeAcademicRequirements(row.academicRequirement) : null,
    ),
  };
};
