import fs from 'fs';
import path from 'path';
import AppError from '../utils/errorHandler';
import { db } from '../config/database';
import { dispatchEmail, sendAgentPartnershipAgreementEmail } from './email.service';

const AGREEMENT_DIR = path.join(process.cwd(), 'assets', 'agreements');
const AGREEMENT_CANDIDATE_FILES = [
  'b2b-agent-partner-agreement.pdf',
  'To be signed- B2B Agent Partner Agreement.pdf',
  'B2B Agent Partner Agreement.pdf',
];

export const resolveAgentAgreementPdfPath = (): string => {
  for (const name of AGREEMENT_CANDIDATE_FILES) {
    const candidate = path.join(AGREEMENT_DIR, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new AppError(
    'Partnership agreement PDF is not configured on the server. Contact support.',
    503,
  );
};

export const readAgentAgreementPdf = (): Buffer => {
  const filePath = resolveAgentAgreementPdfPath();
  return fs.readFileSync(filePath);
};

/** Send the B2B partnership agreement PDF once after email verification. */
export const sendPartnershipAgreementIfNeeded = async (userId: string): Promise<void> => {
  const profile = await db.AgentProfile.findOne({ where: { userId } });
  if (!profile) return;
  if (profile.agreementEmailSentAt) return;

  const user = await db.User.findByPk(userId);
  if (!user?.email) return;

  const pdf = readAgentAgreementPdf();
  const fileName = path.basename(resolveAgentAgreementPdfPath());

  await sendAgentPartnershipAgreementEmail({
    to: user.email,
    name: user.name,
    agencyName: profile.agencyName,
    pdfBuffer: pdf,
    fileName,
  });

  profile.agreementEmailSentAt = new Date();
  if (!profile.agreementSentAt) {
    profile.agreementSentAt = new Date();
  }
  await profile.save();
};

export const dispatchPartnershipAgreementIfNeeded = (userId: string): void => {
  dispatchEmail(() => sendPartnershipAgreementIfNeeded(userId), 'agent partnership agreement');
};
