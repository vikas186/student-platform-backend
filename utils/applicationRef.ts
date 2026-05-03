/** Human-readable application reference, e.g. APP-10241 */
const APP_REF = /^APP-(\d+)$/i;

export const formatApplicationNumber = (seq: number | string): string => `APP-${String(seq)}`;

export const isApplicationReference = (value: string): boolean => APP_REF.test(value.trim());

/** Normalize to canonical `APP-{digits}` */
export const normalizeApplicationReference = (value: string): string => {
  const m = APP_REF.exec(value.trim());
  if (!m) return '';
  return `APP-${m[1]}`;
};
