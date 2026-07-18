import fs from 'fs/promises';
import path from 'path';
import { scrapeLogger } from '../logger';
import type {
  RawCourseRow,
  RawFeeRow,
  RawScholarshipRow,
  RawUniversityRow,
  RejectedPageRow,
  ScrapePipelineResult,
} from '../extractors/types';

export type ScrapeCheckpoint = {
  jobId: string;
  source: string;
  updatedAt: string;
  completedUrls: string[];
  pagesVisited: number;
  apiResponseCount: number;
  courses: RawCourseRow[];
  universities: RawUniversityRow[];
  fees: RawFeeRow[];
  scholarships: RawScholarshipRow[];
  rejectedPages: RejectedPageRow[];
};

const checkpointDir = (): string => path.resolve(process.cwd(), 'raw', 'checkpoints');

export const checkpointPath = (jobId: string): string =>
  path.join(checkpointDir(), `${jobId}.json`);

export const loadScrapeCheckpoint = async (jobId: string): Promise<ScrapeCheckpoint | null> => {
  try {
    const raw = await fs.readFile(checkpointPath(jobId), 'utf8');
    const data = JSON.parse(raw) as ScrapeCheckpoint;
    if (!data || data.jobId !== jobId) return null;
    scrapeLogger.info('Loaded scrape checkpoint', {
      jobId,
      universities: data.universities?.length ?? 0,
      courses: data.courses?.length ?? 0,
      completedUrls: data.completedUrls?.length ?? 0,
    });
    return data;
  } catch {
    return null;
  }
};

export const saveScrapeCheckpoint = async (
  jobId: string,
  source: string,
  payload: Omit<ScrapeCheckpoint, 'jobId' | 'source' | 'updatedAt'>,
): Promise<void> => {
  await fs.mkdir(checkpointDir(), { recursive: true });
  const data: ScrapeCheckpoint = {
    jobId,
    source,
    updatedAt: new Date().toISOString(),
    ...payload,
  };
  const tmp = `${checkpointPath(jobId)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data), 'utf8');
  await fs.rename(tmp, checkpointPath(jobId));
};

export const clearScrapeCheckpoint = async (jobId: string): Promise<void> => {
  try {
    await fs.unlink(checkpointPath(jobId));
  } catch {
    /* ignore */
  }
};

export const checkpointToResult = (cp: ScrapeCheckpoint): ScrapePipelineResult => ({
  courses: cp.courses || [],
  universities: cp.universities || [],
  fees: cp.fees || [],
  scholarships: cp.scholarships || [],
  rejectedPages: cp.rejectedPages || [],
  pagesVisited: cp.pagesVisited || 0,
  apiResponseCount: cp.apiResponseCount || 0,
});
