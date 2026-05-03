import { Request, Response } from 'express';
import constant from '../constant';
import { catchAsyncError } from '../middleware/catchAsyncError';
import { db } from '../config/database';
import * as studentPortal from '../services/studentPortal.service';
import AppError from '../utils/errorHandler';
import { isUuid } from '../utils/isUuid';

const getStudentProfileIdFromReq = async (req: Request): Promise<number> => {
  const user: any = req.user;
  const profile = await db.StudentProfile.findOne({ where: { userId: user.id } });
  if (!profile) throw new AppError('Student profile not found', 404);
  return profile.id;
};

export const getStudentProfile = catchAsyncError(async (req: Request, res: Response) => {
  const user: any = req.user;
  const profile = await studentPortal.getStudentPortalProfile(user.id);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: constant.msg.profileFetch,
    data: profile,
  });
});

export const patchStudentProfile = catchAsyncError(async (req: Request, res: Response) => {
  const user: any = req.user;
  const updated = await studentPortal.updateStudentPortalProfile(user.id, req.body);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: constant.msg.profileUpdate,
    data: updated,
  });
});

export const listApplications = catchAsyncError(async (req: Request, res: Response) => {
  const pid = await getStudentProfileIdFromReq(req);
  const apps = await studentPortal.listStudentApplications(pid, req.query as any);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Applications fetched',
    data: apps,
  });
});

export const createApplication = catchAsyncError(async (req: Request, res: Response) => {
  const pid = await getStudentProfileIdFromReq(req);
  const app = await studentPortal.createStudentApplication(pid, req.body);
  res.status(201).json({
    success: true,
    message: 'Application created',
    data: app,
  });
});

export const getApplication = catchAsyncError(async (req: Request, res: Response) => {
  const { applicationId } = req.params;
  const pid = await getStudentProfileIdFromReq(req);
  const app = await studentPortal.getStudentApplication(pid, applicationId);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Application fetched',
    data: app,
  });
});

export const patchApplication = catchAsyncError(async (req: Request, res: Response) => {
  const { applicationId } = req.params;
  const pid = await getStudentProfileIdFromReq(req);
  const app = await studentPortal.updateStudentApplication(pid, applicationId, req.body);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Application updated',
    data: app,
  });
});

export const submitApplication = catchAsyncError(async (req: Request, res: Response) => {
  const { applicationId } = req.params;
  const pid = await getStudentProfileIdFromReq(req);
  const app = await studentPortal.submitStudentApplication(pid, applicationId);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Application submitted',
    data: app,
  });
});

export const deleteApplication = catchAsyncError(async (req: Request, res: Response) => {
  const { applicationId } = req.params;
  const pid = await getStudentProfileIdFromReq(req);
  await studentPortal.deleteStudentApplication(pid, applicationId);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Application deleted',
  });
});

export const listDocuments = catchAsyncError(async (req: Request, res: Response) => {
  const pid = await getStudentProfileIdFromReq(req);
  const docs = await studentPortal.listStudentDocuments(pid);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Documents fetched',
    data: docs,
  });
});

export const uploadDocument = catchAsyncError(async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) throw new AppError('File is required (field name: file)', 400);
  const pid = await getStudentProfileIdFromReq(req);
  const applicationId = typeof req.body.applicationId === 'string' ? req.body.applicationId : undefined;
  const documentType = typeof req.body.documentType === 'string' ? req.body.documentType : undefined;
  const doc = await studentPortal.createStudentDocument(pid, file, { applicationId, documentType });
  res.status(201).json({
    success: true,
    message: 'Document uploaded',
    data: doc,
  });
});

export const deleteDocument = catchAsyncError(async (req: Request, res: Response) => {
  const { documentId } = req.params;
  if (!isUuid(documentId)) throw new AppError('Invalid document id', 400);
  const pid = await getStudentProfileIdFromReq(req);
  await studentPortal.deleteStudentDocument(pid, documentId);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Document deleted',
  });
});
