export const PASSPORT_DOCUMENT_TYPE = 'passport';

export const ACADEMIC_DOCUMENT_TYPES = [
  '10th_marksheet',
  '12th_marksheet',
  'diploma',
  'degree_certificate',
  'transcript',
] as const;

export const BANK_DOCUMENT_TYPES = ['bank_statement', 'bank_statements'] as const;
export const ITR_DOCUMENT_TYPES = ['itr', 'income_tax_return'] as const;

export const VERIFICATION_DOCUMENT_TYPES = [
  PASSPORT_DOCUMENT_TYPE,
  ...ACADEMIC_DOCUMENT_TYPES,
  ...BANK_DOCUMENT_TYPES,
  ...ITR_DOCUMENT_TYPES,
] as const;

export type VerificationDocumentType = (typeof VERIFICATION_DOCUMENT_TYPES)[number];

export type VerificationPipeline = 'passport' | 'academic' | 'bank' | 'itr' | 'none';

const ALIASES: Record<string, string> = {
  bank_statements: 'bank_statement',
  income_tax_return: 'itr',
  passport_id: 'passport',
  academic_transcripts: 'transcript',
};

export const normalizeDocumentType = (raw: string | undefined | null): string => {
  const t = (raw ?? 'general').trim().toLowerCase();
  return ALIASES[t] ?? t;
};

export const resolveVerificationPipeline = (documentType: string): VerificationPipeline => {
  const t = normalizeDocumentType(documentType);
  if (t === PASSPORT_DOCUMENT_TYPE) return 'passport';
  if ((ACADEMIC_DOCUMENT_TYPES as readonly string[]).includes(t)) return 'academic';
  if (t === 'bank_statement') return 'bank';
  if (t === 'itr') return 'itr';
  return 'none';
};

export const isVerificationDocumentType = (documentType: string): boolean =>
  resolveVerificationPipeline(documentType) !== 'none';

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  passport: 'Passport',
  '10th_marksheet': '10th Marksheet',
  '12th_marksheet': '12th Marksheet',
  diploma: 'Diploma',
  degree_certificate: 'Degree Certificate',
  transcript: 'Transcript',
  bank_statement: 'Bank Statement',
  itr: 'Income Tax Return (ITR)',
  general: 'General document',
};

export const REQUIRED_ACADEMIC_TYPES = ['10th_marksheet', '12th_marksheet', 'degree_certificate'] as const;

/** Academic certificates issued via DigiLocker — must not be manually uploaded when DigiLocker is enabled. */
export const DIGILOCKER_IMPORTABLE_TYPES = [...ACADEMIC_DOCUMENT_TYPES] as const;

export const isDigilockerImportableType = (documentType: string): boolean => {
  const t = normalizeDocumentType(documentType);
  return (DIGILOCKER_IMPORTABLE_TYPES as readonly string[]).includes(t);
};

export const OCR_CONFIDENCE_THRESHOLD = 80;
export const PASSPORT_CONFIDENCE_THRESHOLD = 85;
export const NAME_MATCH_THRESHOLD = 0.85;
export const BANK_STATEMENT_MAX_AGE_DAYS = 90;

export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export const encodeRegistryId = (entityType: string, entityId: string): string => `${entityType}:${entityId}`;

export const decodeRegistryId = (registryId: string): { entityType: string; entityId: string } => {
  const idx = registryId.indexOf(':');
  if (idx <= 0) throw new Error('Invalid registry id');
  return { entityType: registryId.slice(0, idx), entityId: registryId.slice(idx + 1) };
};
