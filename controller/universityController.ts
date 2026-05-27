import { Request, Response } from 'express';
import constant from '../constant';
import { catchAsyncError } from '../middleware/catchAsyncError';
import AppError from '../utils/errorHandler';
import { getQueryString } from '../utils/getQueryString';
import * as universityPortal from '../services/universityPortal.service';

export const getPartnership = catchAsyncError(async (req: Request, res: Response) => {
  const user: any = req.user;
  const data = await universityPortal.getUniversityPartnershipSummary(user.id);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Partnership',
    data,
  });
});

export const getDashboard = catchAsyncError(async (req: Request, res: Response) => {
  const user: any = req.user;
  const data = await universityPortal.getUniversityDashboard(user.id);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Dashboard',
    data,
  });
});

export const getCommission = catchAsyncError(async (req: Request, res: Response) => {
  const user: any = req.user;
  const data = await universityPortal.getUniversityCommission(user.id);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Commission structure',
    data,
  });
});

export const postCountersignedContract = catchAsyncError(async (req: Request, res: Response) => {
  const user: any = req.user;
  const file = req.file as Express.Multer.File | undefined;
  if (!file) {
    throw new AppError('PDF file is required (field name: file)', 400);
  }
  const data = await universityPortal.uploadCountersignedContract(user.id, file);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Countersigned contract uploaded',
    data,
  });
});

export const listApplications = catchAsyncError(async (req: Request, res: Response) => {
  const user: any = req.user;
  const data = await universityPortal.listUniversityApplications(user.id, req.query as any);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Applications fetched',
    data,
  });
});

export const getApplication = catchAsyncError(async (req: Request, res: Response) => {
  const user: any = req.user;
  const { applicationId } = req.params;
  const data = await universityPortal.getApplicationForUniversity(user.id, getQueryString(applicationId));
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Application fetched',
    data,
  });
});

export const getApplicationChecklist = catchAsyncError(async (req: Request, res: Response) => {
  const user: any = req.user;
  const { applicationId } = req.params;
  const data = await universityPortal.getApplicationChecklistForUniversity(user.id, getQueryString(applicationId));
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Checklist',
    data,
  });
});

export const patchApplicationStatus = catchAsyncError(async (req: Request, res: Response) => {
  const user: any = req.user;
  const { applicationId } = req.params;
  const status = String((req.body as any)?.status ?? '').trim();
  const data = await universityPortal.patchUniversityApplicationStatus(
    user.id,
    getQueryString(applicationId),
    status,
  );
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Application updated',
    data,
  });
});

export const patchDocument = catchAsyncError(async (req: Request, res: Response) => {
  const user: any = req.user;
  const { documentId } = req.params;
  const data = await universityPortal.patchUniversityDocument(user.id, getQueryString(documentId), req.body);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Document updated',
    data,
  });
});

export const getApplicationStatusOptions = catchAsyncError(async (_req: Request, res: Response) => {
  const data = universityPortal.listApplicationStatusOptionsForUniversity();
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Application status options',
    data,
  });
});
