/** Human-readable agent partner / membership ID, e.g. AGT-00042 */
const MEMBERSHIP_RE = /^AGT-(\d+)$/i;

export const formatAgentMembershipId = (profileId: number | string): string => {
  const n = typeof profileId === 'string' ? parseInt(profileId, 10) : Number(profileId);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error('Invalid agent profile id for membership ID');
  }
  return `AGT-${String(Math.trunc(n)).padStart(5, '0')}`;
};

export const isAgentMembershipId = (value: string): boolean => MEMBERSHIP_RE.test(value.trim());
