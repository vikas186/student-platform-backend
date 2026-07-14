import { Request, Response } from 'express';
import constant from '../constant';
import { catchAsyncError } from '../middleware/catchAsyncError';
import { db } from '../config/database';
import * as studentPortal from '../services/studentPortal.service';
import AppError from '../utils/errorHandler';
import { isUuid } from '../utils/isUuid';
import { pickOptionalTrimmedString } from '../utils/requestFields';

const getStudentProfileIdFromReq = async (req: Request): Promise<number> => {
  const user: any = req.user;
  const profile = await db.StudentProfile.findOne({ where: { userId: user.id } });
  if (!profile) throw new AppError('Student profile not found', 404);
  const id = profile.getDataValue('id') as number;
  if (!Number.isFinite(id)) throw new AppError('Student profile not found', 404);
  return id;
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
  // Always tie the row to the authenticated student's profile (never trust body.studentProfileId).
  const pid = await getStudentProfileIdFromReq(req);
  const body = req.body as Record<string, unknown>;
  const query = req.query as Record<string, unknown>;
  const applicationRef =
    pickOptionalTrimmedString(body, ['applicationId', 'application_id', 'applicationNumber']) ??
    pickOptionalTrimmedString(query, ['applicationId', 'application_id', 'applicationNumber']);
  const documentType =
    pickOptionalTrimmedString(body, ['documentType', 'document_type']) ?? undefined;
  const standaloneRaw =
    pickOptionalTrimmedString(body, ['standalone']) ??
    pickOptionalTrimmedString(query, ['standalone']);
  const standalone = standaloneRaw === 'true' || standaloneRaw === '1';
  const user = req.user as { id?: string; email?: string };
  const { doc, verification } = await studentPortal.createStudentDocument(pid, file, {
    applicationRef,
    documentType,
    standalone,
    userId: user.id,
    userEmail: user.email ?? null,
  });
  res.status(201).json({
    success: true,
    message: 'Document uploaded',
    data: doc,
    verification: verification ?? null,
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

export const listOfferLetters = catchAsyncError(async (req: Request, res: Response) => {
  const pid = await getStudentProfileIdFromReq(req);
  const rows = await studentPortal.listStudentOfferLetters(pid);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Offer letters fetched',
    data: rows,
  });
});

export const getOfferLetterForApplication = catchAsyncError(async (req: Request, res: Response) => {
  const { applicationId } = req.params;
  const pid = await getStudentProfileIdFromReq(req);
  const letter = await studentPortal.getStudentOfferLetterForApplication(pid, applicationId);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Offer letter fetched',
    data: letter,
  });
});

export const getOfferLetterByIdOrRef = catchAsyncError(async (req: Request, res: Response) => {
  const { offerLetterId } = req.params;
  const pid = await getStudentProfileIdFromReq(req);
  const letter = await studentPortal.getStudentOfferLetterByIdOrRef(pid, offerLetterId);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Offer letter fetched',
    data: letter,
  });
});

export const uploadSignedOfferLetterForApplication = catchAsyncError(async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) throw new AppError('File is required (field name: file)', 400);
  const { applicationId } = req.params;
  const pid = await getStudentProfileIdFromReq(req);
  const letter = await studentPortal.uploadStudentSignedOfferLetterForApplication(pid, applicationId, file);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Signed offer letter uploaded',
    data: letter,
  });
});

export const listUniversities = catchAsyncError(async (req: Request, res: Response) => {
  const { search, country, page, limit } = req.query as Record<string, string | undefined>;
  const data = await studentPortal.listStudentUniversities({ search, country, page, limit });
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Universities fetched',
    data,
  });
});

export const getUniversity = catchAsyncError(async (req: Request, res: Response) => {
  const { universityId } = req.params;
  const id = parseInt(universityId, 10);
  if (Number.isNaN(id)) throw new AppError('Invalid university id', 400);
  const data = await studentPortal.getStudentUniversityById(id);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'University fetched',
    data,
  });
});

export const uploadSignedOfferLetterByIdOrRef = catchAsyncError(async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) throw new AppError('File is required (field name: file)', 400);
  const { offerLetterId } = req.params;
  const pid = await getStudentProfileIdFromReq(req);
  const letter = await studentPortal.uploadStudentSignedOfferLetterByIdOrRef(pid, offerLetterId, file);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Signed offer letter uploaded',
    data: letter,
  });
});

export const createTuitionPayLink = catchAsyncError(async (req: Request, res: Response) => {
  const user: any = req.user;
  const pid = await getStudentProfileIdFromReq(req);
  const data = await studentPortal.createTuitionPayLink(pid, user.id, req.body);
  res.status(201).json({
    success: true,
    message: 'Tuition pay link created',
    data,
  });
});
