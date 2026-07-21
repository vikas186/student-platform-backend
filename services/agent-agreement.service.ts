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

/** Admin replaces the canonical B2B partnership agreement PDF used for new agent emails / downloads. */
export const saveAgentAgreementTemplatePdf = async (file: Express.Multer.File): Promise<{
  fileName: string;
  path: string;
}> => {
  if (!file?.path) {
    throw new AppError('PDF file is required', 400);
  }
  if (!/\.pdf$/i.test(file.originalname || file.path)) {
    throw new AppError('Only PDF files are allowed for the agreement template', 400);
  }
  if (!fs.existsSync(AGREEMENT_DIR)) {
    fs.mkdirSync(AGREEMENT_DIR, { recursive: true });
  }
  const destName = 'b2b-agent-partner-agreement.pdf';
  const destPath = path.join(AGREEMENT_DIR, destName);
  fs.copyFileSync(file.path, destPath);
  try {
    fs.unlinkSync(file.path);
  } catch {
    /* ignore temp cleanup */
  }
  return { fileName: destName, path: destPath.replace(/\\/g, '/') };
};

export const getAgentAgreementTemplateMeta = (): {
  fileName: string | null;
  exists: boolean;
  updatedAt: string | null;
} => {
  try {
    const filePath = resolveAgentAgreementPdfPath();
    const st = fs.statSync(filePath);
    return {
      fileName: path.basename(filePath),
      exists: true,
      updatedAt: st.mtime.toISOString(),
    };
  } catch {
    return { fileName: null, exists: false, updatedAt: null };
  }
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
