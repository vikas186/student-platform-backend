export type {
  RawCourseRow,
  RawUniversityRow,
  RawFeeRow,
  RawScholarshipRow,
  RejectedPageRow,
  ScrapePipelineResult,
  ScrapeJobMessage,
  CleaningJobMessage,
  PageType,
  PageCapture,
  ClassificationResult,
} from '../extractors/types';

/** @deprecated use ScrapePipelineResult */
export type ScrapeResult = import('../extractors/types').ScrapePipelineResult;
