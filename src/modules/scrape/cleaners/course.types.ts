import type { CourseCleaningStatus } from '../../../../models/ScrapedCourse.model';
import type { RawCourseRow } from '../scrapers/types';

export type { CourseCleaningStatus };

export type NormalizedTuition = {
  amount: number | null;
  minAmount?: number | null;
  maxAmount?: number | null;
  currency: string | null;
  period: 'yearly' | 'semester' | 'total' | 'monthly' | 'unknown';
  raw: string;
};

export type NormalizedDuration = {
  value: number | null;
  unit: 'months' | 'years' | 'weeks' | 'semesters' | 'unknown';
  mode: 'full-time' | 'part-time' | 'online' | 'unknown';
  raw: string;
};

export type NormalizedRequirements = {
  ieltsOverall?: number;
  ieltsMinBand?: number;
  toeflOverall?: number;
  pteOverall?: number;
  duolingoOverall?: number;
  academicMinPercent?: number;
  workExperienceYears?: number;
  workExperienceRequired?: boolean;
  raw: string;
};

export type CleanedCourse = RawCourseRow & {
  qualityScore: number;
  cleaningStatus: CourseCleaningStatus;
  isDuplicate: boolean;
  duplicateOf: string | null;
  cleaningNotes: string | null;
  normalizedTuition: NormalizedTuition | null;
  normalizedDuration: NormalizedDuration | null;
  normalizedIntakes: string[];
  normalizedRequirements: NormalizedRequirements | null;
};

export type CleaningStats = {
  raw: number;
  junkRemoved: number;
  validationRejected: number;
  duplicates: number;
  highQuality: number;
  needsReview: number;
  rejected: number;
  persisted: number;
  totalScraped: number;
  valid: number;
};

export const finalizeCleaningStats = (stats: Omit<CleaningStats, 'totalScraped' | 'valid'>): CleaningStats => ({
  ...stats,
  totalScraped: stats.raw,
  valid: stats.highQuality,
});
