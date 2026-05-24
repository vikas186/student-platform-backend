import { Request, Response } from 'express';
import { catchAsyncError } from '../../../middleware/catchAsyncError';
import constant from '../../../constant';
import * as scrape from './scrape.service';
import type { StartScrapeBody } from './config/scrape-target.util';

export const startScrape = catchAsyncError(async (req: Request, res: Response) => {
  const data = await scrape.createScrapeJob(req.body as StartScrapeBody, 'manual');
  res.status(202).json({ success: true, message: 'Scrape job started', data });
});

export const listPresets = catchAsyncError(async (_req: Request, res: Response) => {
  const data = scrape.listScrapePresets();
  res.status(constant.msgCode.successCode).json({ success: true, message: 'Scrape presets fetched', data });
});

export const listJobs = catchAsyncError(async (req: Request, res: Response) => {
  const result = await scrape.listScrapeJobs(req.query as Parameters<typeof scrape.listScrapeJobs>[0]);
  res.status(constant.msgCode.successCode).json({ success: true, message: 'Scrape jobs fetched', ...result });
});

export const getJob = catchAsyncError(async (req: Request, res: Response) => {
  const data = await scrape.getScrapeJobById(req.params.id);
  res.status(constant.msgCode.successCode).json({ success: true, message: 'Scrape job fetched', data });
});

export const listCourses = catchAsyncError(async (req: Request, res: Response) => {
  const result = await scrape.listCourses(req.query as Parameters<typeof scrape.listCourses>[0]);
  res.status(constant.msgCode.successCode).json({ success: true, message: 'Courses fetched', ...result });
});

export const listUniversities = catchAsyncError(async (req: Request, res: Response) => {
  const result = await scrape.listUniversities(req.query as Parameters<typeof scrape.listUniversities>[0]);
  res.status(constant.msgCode.successCode).json({ success: true, message: 'Universities fetched', ...result });
});

export const listFees = catchAsyncError(async (req: Request, res: Response) => {
  const result = await scrape.listFees(req.query as Parameters<typeof scrape.listFees>[0]);
  res.status(constant.msgCode.successCode).json({ success: true, message: 'Fees fetched', ...result });
});

export const listScholarships = catchAsyncError(async (req: Request, res: Response) => {
  const result = await scrape.listScholarships(req.query as Parameters<typeof scrape.listScholarships>[0]);
  res.status(constant.msgCode.successCode).json({ success: true, message: 'Scholarships fetched', ...result });
});

const exportHandler =
  (fn: (q: Record<string, unknown>, f: 'csv' | 'xlsx') => Promise<{ contentType: string; filename: string; body: unknown }>) =>
  catchAsyncError(async (req: Request, res: Response) => {
    const format = (req.query.format as string) === 'csv' ? 'csv' : 'xlsx';
    const file = await fn(req.query as Record<string, unknown>, format);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.body);
  });

export const exportCourses = exportHandler(scrape.exportCourses);
export const exportUniversities = exportHandler(scrape.exportUniversities);
export const exportFees = exportHandler(scrape.exportFees);
export const exportScholarships = exportHandler(scrape.exportScholarships);

export const deleteJob = catchAsyncError(async (req: Request, res: Response) => {
  const force = req.query.force === 'true' || req.query.force === '1';
  await scrape.deleteScrapeJob(req.params.id, force);
  res.status(constant.msgCode.successCode).json({ success: true, message: 'Scrape job deleted' });
});

export const deleteCourse = catchAsyncError(async (req: Request, res: Response) => {
  await scrape.deleteCourse(req.params.id);
  res.status(constant.msgCode.successCode).json({ success: true, message: 'Course deleted' });
});

export const deleteCoursesBulk = catchAsyncError(async (req: Request, res: Response) => {
  const data = await scrape.deleteCoursesBulk(req.body.ids);
  res.status(constant.msgCode.successCode).json({ success: true, message: 'Courses deleted', data });
});

export const deleteUniversity = catchAsyncError(async (req: Request, res: Response) => {
  await scrape.deleteUniversity(req.params.id);
  res.status(constant.msgCode.successCode).json({ success: true, message: 'University deleted' });
});

export const deleteFee = catchAsyncError(async (req: Request, res: Response) => {
  await scrape.deleteFee(req.params.id);
  res.status(constant.msgCode.successCode).json({ success: true, message: 'Fee record deleted' });
});

export const deleteScholarship = catchAsyncError(async (req: Request, res: Response) => {
  await scrape.deleteScholarship(req.params.id);
  res.status(constant.msgCode.successCode).json({ success: true, message: 'Scholarship deleted' });
});
