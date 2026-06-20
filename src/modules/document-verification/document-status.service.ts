import { db } from '../../../config/database';
import { mapDiditStatusToInternal } from '../didit/didit.service';
import { REQUIRED_ACADEMIC_TYPES } from './document-types';

export type DocumentStatusSummary = {
  identityVerification: string;
  passport: string;
  academicDocuments: string;
  financialDocuments: string;
  overallStatus: string;
};

const labelFromPassport = (status: string | null | undefined): string => {
  if (!status) return 'Not Started';
  if (status === 'verified') return 'Verified';
  if (status === 'pre_verified') return 'Pre-Verified';
  if (status === 'needs_review') return 'Needs Review';
  if (status === 'rejected') return 'Rejected';
  if (status === 'financial_verified') return 'Verified';
  if (status === 'pending') return 'Pending';
  if (status === 'approved') return 'Approved';
  return status;
};

const worstAcademic = (statuses: string[]): string => {
  if (statuses.length === 0) return 'Not Started';
  if (statuses.some(s => s === 'rejected')) return 'Rejected';
  if (statuses.some(s => s === 'needs_review' || s === 'pending')) return 'Needs Review';
  if (statuses.every(s => s === 'pre_verified' || s === 'approved')) return 'Pre-Verified';
  return 'Pending';
};

const aggregateFinancial = (statuses: string[]): string => {
  if (statuses.length === 0) return 'Not Started';
  if (statuses.some(s => s === 'rejected')) return 'Rejected';
  if (statuses.some(s => s === 'needs_review' || s === 'pending')) return 'Needs Review';
  if (statuses.every(s => s === 'financial_verified' || s === 'approved')) return 'Verified';
  return 'Pending';
};

export const getDocumentStatusSummaryForUser = async (userId: string): Promise<DocumentStatusSummary> => {
  const [passport, diditSession, academicRows, bankRows, itrRows] = await Promise.all([
    db.PassportVerification.findOne({ where: { userId }, order: [['updatedAt', 'DESC']] }),
    db.VerificationSession.findOne({ where: { userId }, order: [['updatedAt', 'DESC']] }),
    db.AcademicDocument.findAll({ where: { userId } }),
    db.BankStatement.findAll({ where: { userId } }),
    db.ItrDocument.findAll({ where: { userId } }),
  ]);

  const diditStatus = diditSession ? mapDiditStatusToInternal(diditSession.status) : 'not_started';
  const identityVerification =
    diditStatus === 'verified' || passport?.status === 'verified'
      ? 'Verified'
      : diditStatus === 'rejected' || passport?.status === 'rejected'
        ? 'Rejected'
        : diditStatus === 'pending' || passport?.status === 'pending'
          ? 'Pending'
          : passport?.status === 'needs_review'
            ? 'Needs Review'
            : 'Not Started';

  const passportLabel = labelFromPassport(passport?.status ?? null);

  const academicStatuses = REQUIRED_ACADEMIC_TYPES.map(type => {
    const row = academicRows.find(r => r.documentType === type);
    return row?.verificationStatus ?? 'missing';
  }).filter(s => s !== 'missing') as string[];
  const academicDocuments = worstAcademic(academicStatuses);

  const financialStatuses = [
    ...bankRows.map(r => r.verificationStatus),
    ...itrRows.map(r => r.verificationStatus),
  ];
  const financialDocuments = aggregateFinancial(financialStatuses);

  const academicComplete =
    academicStatuses.length >= REQUIRED_ACADEMIC_TYPES.length &&
    academicStatuses.every(s => s === 'pre_verified' || s === 'approved');
  const financialComplete =
    financialStatuses.length >= 2 &&
    financialStatuses.every(s => s === 'financial_verified' || s === 'approved');

  const overallStatus =
    passport?.status === 'verified' && academicComplete && financialComplete ? 'Completed' : 'In Progress';

  return {
    identityVerification,
    passport: passportLabel,
    academicDocuments,
    financialDocuments,
    overallStatus,
  };
};

export const listStudentVerifications = async (userId: string) => {
  const [passport, academic, bank, itr] = await Promise.all([
    db.PassportVerification.findAll({ where: { userId }, order: [['updatedAt', 'DESC']] }),
    db.AcademicDocument.findAll({ where: { userId }, order: [['updatedAt', 'DESC']] }),
    db.BankStatement.findAll({ where: { userId }, order: [['updatedAt', 'DESC']] }),
    db.ItrDocument.findAll({ where: { userId }, order: [['updatedAt', 'DESC']] }),
  ]);

  return {
    passport: passport.map(r => ({ ...r.get({ plain: true }), registryId: `passport:${r.id}` })),
    academic: academic.map(r => ({ ...r.get({ plain: true }), registryId: `academic:${r.id}` })),
    bank: bank.map(r => ({ ...r.get({ plain: true }), registryId: `bank:${r.id}` })),
    itr: itr.map(r => ({ ...r.get({ plain: true }), registryId: `itr:${r.id}` })),
  };
};
