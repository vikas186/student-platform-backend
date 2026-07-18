export const ENTITY_CLEANING_STATUSES = ['high_quality', 'needs_review', 'rejected', 'duplicate'] as const;
export type EntityCleaningStatus = (typeof ENTITY_CLEANING_STATUSES)[number];

export type PageType = 'course' | 'course_listing' | 'university' | 'fee' | 'scholarship' | 'reject';

export type RawCourseRow = {
  universityName: string;
  courseName: string;
  country?: string;
  city?: string;
  studyLevel?: string;
  duration?: string;
  tuitionFee?: string;
  intake?: string;
  ieltsRequirement?: string;
  academicRequirement?: string;
  applicationFee?: string;
  scholarship?: string;
  courseUrl?: string;
  pageText?: string;
};

export type RawUniversityRow = {
  universityName: string;
  country?: string;
  city?: string;
  ranking?: string;
  overview?: string;
  websiteUrl?: string;
  sourceUrl?: string;
  faculties?: string[];
  departments?: string[];
  popularCourses?: string[];
  pageText?: string;
  intakes?: string;
  courses?: string;
  costOfStudy?: string;
  scholarships?: string;
  admissionRequirements?: string;
  acceptanceCriteria?: string;
};

export type RawFeeRow = {
  country?: string;
  studyLevel?: string;
  tuitionFee?: string;
  livingCost?: string;
  accommodationCost?: string;
  currency?: string;
  description?: string;
  sourceUrl?: string;
};

export type RawScholarshipRow = {
  scholarshipName: string;
  universityName?: string;
  country?: string;
  amount?: string;
  eligibility?: string;
  deadline?: string;
  description?: string;
  sourceUrl?: string;
  pageText?: string;
};

export type RejectedPageRow = {
  url: string;
  pageTitle?: string;
  classification: PageType;
  reason: string;
};

export type ScrapePipelineResult = {
  courses: RawCourseRow[];
  universities: RawUniversityRow[];
  fees: RawFeeRow[];
  scholarships: RawScholarshipRow[];
  rejectedPages: RejectedPageRow[];
  pagesVisited: number;
  apiResponseCount: number;
};

/** @deprecated use ScrapePipelineResult */
export type ScrapeResult = ScrapePipelineResult & { courses: RawCourseRow[] };

export type ScrapeJobMessage = { jobId: string; retryCount?: number };
export type CleaningJobMessage = { jobId: string; rawBatchId: string; retryCount?: number };

export type ScrapeProgress = {
  totalPages?: number;
  coursesFound?: number;
  universitiesFound?: number;
  feesFound?: number;
  scholarshipsFound?: number;
  rejectedPages?: number;
  currentPage?: number;
  currentUrl?: string;
};

export type ScrapeRunOptions = {
  onProgress?: (progress: ScrapeProgress) => void | Promise<void>;
  /** When true, scrapers should finish in-flight work and return partial results. */
  shouldStop?: () => boolean | Promise<boolean>;
};

export type PageCapture = {
  url: string;
  title: string;
  mainText: string;
  links: Array<{ href: string; name: string }>;
  apiResponses: Array<{ url: string; body: string }>;
};

export type ClassificationResult = {
  type: PageType;
  scores: Record<PageType, number>;
  reason?: string;
};
