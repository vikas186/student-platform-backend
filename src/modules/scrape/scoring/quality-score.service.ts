import type { CourseCleaningStatus } from '../../../../models/ScrapedCourse.model';
import type { RawCourseRow } from '../scrapers/types';

export type QualityResult = {
  score: number;
  status: CourseCleaningStatus;
};

/**
 * courseName = +30, universityName = +30, country = +10,
 * duration = +10, tuitionFee = +10, intake = +10 (max 100)
 *
 * >= 70 → high_quality (valid)
 * 40–69 → needs_review
 * < 40  → rejected
 */
export const calculateCourseQuality = (course: RawCourseRow): QualityResult => {
  let score = 0;
  if (course.courseName?.trim()) score += 25;
  if (course.universityName?.trim()) score += 25;
  if (course.country?.trim()) score += 10;
  if (course.duration?.trim()) score += 10;
  if (course.tuitionFee?.trim()) score += 10;
  if (course.intake?.trim()) score += 10;
  if (course.studyLevel?.trim()) score += 5;
  if (course.academicRequirement?.trim()) score += 5;

  score = Math.min(100, score);

  let status: CourseCleaningStatus;
  if (score >= 70) status = 'high_quality';
  else if (score >= 40) status = 'needs_review';
  else status = 'rejected';

  return { score, status };
};

/** @deprecated use calculateCourseQuality */
export const scoreCourse = (c: RawCourseRow): number => calculateCourseQuality(c).score;

/** @deprecated use calculateCourseQuality */
export const scoreToCleaningStatus = (score: number): CourseCleaningStatus => {
  if (score >= 70) return 'high_quality';
  if (score >= 40) return 'needs_review';
  return 'rejected';
};
