import { Request, Response } from 'express';
import constant from '../constant';
import { catchAsyncError } from '../middleware/catchAsyncError';
import * as agentPortal from '../services/agentPortal.service';
import { pickOptionalPositiveInt, pickOptionalTrimmedString } from '../utils/requestFields';

const agentProfileIdFromReq = async (req: Request): Promise<number> => {
  const user: any = req.user;
  const profile = await agentPortal.requireAgentProfile(user.id);
  return profile.id;
};

export const getAgentProfile = catchAsyncError(async (req: Request, res: Response) => {
  const user: any = req.user;
  const data = await agentPortal.getAgentPortalProfile(user.id);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Profile fetched',
    data,
  });
});

export const patchAgentProfile = catchAsyncError(async (req: Request, res: Response) => {
  const user: any = req.user;
  const data = await agentPortal.patchAgentPortalProfile(user.id, req.body);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Profile updated',
    data,
  });
});

export const getDashboard = catchAsyncError(async (req: Request, res: Response) => {
  const aid = await agentProfileIdFromReq(req);
  const data = await agentPortal.getAgentDashboard(aid);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Dashboard',
    data,
  });
});

export const listApplications = catchAsyncError(async (req: Request, res: Response) => {
  const aid = await agentProfileIdFromReq(req);
  const data = await agentPortal.listAgentApplications(aid, req.query as any);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Applications fetched',
    data,
  });
});

export const exportApplicationsCsv = catchAsyncError(async (req: Request, res: Response) => {
  const aid = await agentProfileIdFromReq(req);
  const csv = await agentPortal.buildApplicationsCsv(aid, req.query as any);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="applications.csv"');
  res.status(200).send(csv);
});

export const createApplication = catchAsyncError(async (req: Request, res: Response) => {
  const aid = await agentProfileIdFromReq(req);
  const result = await agentPortal.createAgentApplication(aid, req.body);
  const appJson = result.application.get({ plain: true }) as Record<string, unknown>;
  res.status(201).json({
    success: true,
    message: 'Application created',
    data: {
      ...appJson,
      ...(result.temporaryPassword ? { temporaryPassword: result.temporaryPassword } : {}),
    },
  });
});

export const getApplication = catchAsyncError(async (req: Request, res: Response) => {
  const applicationId = req.params.applicationId as string;
  const aid = await agentProfileIdFromReq(req);
  const app = await agentPortal.getApplicationForAgent(aid, applicationId);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Application fetched',
    data: app,
  });
});

export const patchApplication = catchAsyncError(async (req: Request, res: Response) => {
  const applicationId = req.params.applicationId as string;
  const aid = await agentProfileIdFromReq(req);
  const app = await agentPortal.updateAgentApplication(aid, applicationId, req.body);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Application updated',
    data: app,
  });
});

export const submitApplication = catchAsyncError(async (req: Request, res: Response) => {
  const applicationId = req.params.applicationId as string;
  const aid = await agentProfileIdFromReq(req);
  const app = await agentPortal.submitAgentApplication(aid, applicationId);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Application submitted',
    data: app,
  });
});

export const deleteApplication = catchAsyncError(async (req: Request, res: Response) => {
  const applicationId = req.params.applicationId as string;
  const aid = await agentProfileIdFromReq(req);
  await agentPortal.deleteAgentApplication(aid, applicationId);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Application deleted',
  });
});

export const createStudent = catchAsyncError(async (req: Request, res: Response) => {
  const aid = await agentProfileIdFromReq(req);
  const result = await agentPortal.createStudentForAgent(aid, req.body);
  res.status(201).json({
    success: true,
    message: 'Student created',
    data: {
      studentProfileId: result.studentProfile.id,
      user: result.user,
      ...(result.temporaryPassword ? { temporaryPassword: result.temporaryPassword } : {}),
    },
  });
});

export const listStudents = catchAsyncError(async (req: Request, res: Response) => {
  const aid = await agentProfileIdFromReq(req);
  const data = await agentPortal.listAgentStudents(aid, req.query as any);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Students fetched',
    data,
  });
});

export const listDocuments = catchAsyncError(async (req: Request, res: Response) => {
  const aid = await agentProfileIdFromReq(req);
  const data = await agentPortal.listAgentDocuments(aid, req.query as any);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Documents fetched',
    data,
  });
});

export const uploadDocument = catchAsyncError(async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ success: false, message: 'File is required (field name: file)' });
    return;
  }
  const aid = await agentProfileIdFromReq(req);
  const body = req.body as Record<string, unknown>;
  const query = req.query as Record<string, unknown>;
  const applicationRef =
    pickOptionalTrimmedString(body, ['applicationId', 'application_id', 'applicationNumber']) ??
    pickOptionalTrimmedString(query, ['applicationId', 'application_id', 'applicationNumber']);
  const studentProfileId =
    pickOptionalPositiveInt(body, ['studentProfileId', 'student_profile_id']) ??
    pickOptionalPositiveInt(query, ['studentProfileId', 'student_profile_id']);
  const documentType =
    pickOptionalTrimmedString(body, ['documentType', 'document_type']) ?? undefined;
  const doc = await agentPortal.createAgentDocument(aid, file, {
    applicationRef,
    studentProfileId: studentProfileId ?? null,
    documentType,
  });
  res.status(201).json({
    success: true,
    message: 'Document uploaded',
    data: doc,
  });
});

export const patchDocument = catchAsyncError(async (req: Request, res: Response) => {
  const documentId = req.params.documentId as string;
  const aid = await agentProfileIdFromReq(req);
  const doc = await agentPortal.patchAgentDocument(aid, documentId, req.body);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Document updated',
    data: doc,
  });
});

export const deleteDocument = catchAsyncError(async (req: Request, res: Response) => {
  const documentId = req.params.documentId as string;
  const aid = await agentProfileIdFromReq(req);
  await agentPortal.deleteAgentDocument(aid, documentId);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Document deleted',
  });
});

export const verifyDocumentsDemo = catchAsyncError(async (req: Request, res: Response) => {
  const aid = await agentProfileIdFromReq(req);
  const applicationId = String(req.body.applicationId || '').trim();
  const data = await agentPortal.runDocumentVerificationDemo(aid, applicationId);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Verification checklist',
    data,
  });
});

export const listOfferLetters = catchAsyncError(async (req: Request, res: Response) => {
  const aid = await agentProfileIdFromReq(req);
  const data = await agentPortal.listOfferLetters(aid);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Offer letters fetched',
    data,
  });
});

export const createOfferLetter = catchAsyncError(async (req: Request, res: Response) => {
  const aid = await agentProfileIdFromReq(req);
  const data = await agentPortal.createOfferLetter(aid, req.body);
  res.status(201).json({
    success: true,
    message: 'Offer letter created',
    data,
  });
});

export const getOfferLetter = catchAsyncError(async (req: Request, res: Response) => {
  const offerLetterId = req.params.offerLetterId as string;
  const aid = await agentProfileIdFromReq(req);
  const data = await agentPortal.getOfferLetterForAgent(aid, offerLetterId);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Offer letter fetched',
    data,
  });
});

export const patchOfferLetter = catchAsyncError(async (req: Request, res: Response) => {
  const offerLetterId = req.params.offerLetterId as string;
  const aid = await agentProfileIdFromReq(req);
  const data = await agentPortal.patchOfferLetter(aid, offerLetterId, req.body);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Offer letter updated',
    data,
  });
});

export const uploadOfferLetterFile = catchAsyncError(async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ success: false, message: 'File is required (field name: file)' });
    return;
  }
  const offerLetterId = req.params.offerLetterId as string;
  const aid = await agentProfileIdFromReq(req);
  const data = await agentPortal.uploadOfferLetterFile(aid, offerLetterId, file);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Offer file uploaded',
    data,
  });
});

export const uploadSignedOffer = catchAsyncError(async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ success: false, message: 'File is required (field name: file)' });
    return;
  }
  const offerLetterId = req.params.offerLetterId as string;
  const aid = await agentProfileIdFromReq(req);
  const data = await agentPortal.uploadSignedOfferFile(aid, offerLetterId, file);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Signed offer uploaded',
    data,
  });
});

export const sendOfferLetter = catchAsyncError(async (req: Request, res: Response) => {
  const offerLetterId = req.params.offerLetterId as string;
  const aid = await agentProfileIdFromReq(req);
  const data = await agentPortal.sendOfferLetter(aid, offerLetterId);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Offer letter marked as sent',
    data,
  });
});

export const getCommission = catchAsyncError(async (req: Request, res: Response) => {
  const aid = await agentProfileIdFromReq(req);
  const data = await agentPortal.getAgentCommission(aid);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Commission',
    data,
  });
});

export const createDepositPayLink = catchAsyncError(async (req: Request, res: Response) => {
  const aid = await agentProfileIdFromReq(req);
  const data = await agentPortal.createDepositPayLink(aid, req.body);
  res.status(201).json({
    success: true,
    message: 'Deposit pay link created',
    data,
  });
});

export const listDeadlines = catchAsyncError(async (req: Request, res: Response) => {
  const data = await agentPortal.listDeadlines(req.query as any);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Deadlines fetched',
    data,
  });
});

export const discoveryUniversities = catchAsyncError(async (req: Request, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  const data = await agentPortal.discoveryUniversities(q);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Universities',
    data,
  });
});

export const discoveryCourses = catchAsyncError(async (req: Request, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  const data = await agentPortal.discoveryCourses(q);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Courses',
    data,
  });
});

export const globalSearch = catchAsyncError(async (req: Request, res: Response) => {
  const aid = await agentProfileIdFromReq(req);
  const q = String(req.query.q || '');
  const data = await agentPortal.agentGlobalSearch(aid, q);
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: 'Search results',
    data,
  });
});
