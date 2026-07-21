import { APPLICATION_STATUSES } from '../models/Application.model';

/** Uniwizer admin UI labels (see student-platform-frontend `LIFECYCLE` + Rejected). */
export const ADMIN_UI_APPLICATION_STATUSES = [
  'Draft',
  'Submitted',
  'Review',
  'Approved',
  'Offer',
  'Deposit',
  'Visa Applied',
  'Visa Approved',
  'Visa Rejected',
  'Withdrawn',
  'Enrolled',
  'Agent Invoice Received',
  'Commission Paid',
  'Rejected',
] as const;

const UI_TO_BACKEND: Record<string, (typeof APPLICATION_STATUSES)[number]> = {
  Draft: 'draft',
  Submitted: 'submitted',
  Review: 'under_review',
  Approved: 'approved',
  Offer: 'offer_generated',
  Deposit: 'deposit_paid',
  'Visa Applied': 'visa_applied',
  /** Legacy short label used before visa_applied existed */
  Visa: 'visa_approved',
  'Visa Approved': 'visa_approved',
  'Visa Rejected': 'visa_rejected',
  Withdrawn: 'withdrawn',
  Enrolled: 'enrolled',
  'Agent Invoice Received': 'agent_invoice_received',
  'Commission Paid': 'commission_paid',
  Rejected: 'rejected',
};

const BACKEND_TO_UI: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Review',
  approved: 'Approved',
  rejected: 'Rejected',
  offer_generated: 'Offer',
  deposit_paid: 'Deposit',
  visa_applied: 'Visa Applied',
  visa_approved: 'Visa Approved',
  visa_rejected: 'Visa Rejected',
  withdrawn: 'Withdrawn',
  enrolled: 'Enrolled',
  agent_invoice_received: 'Agent Invoice Received',
  commission_paid: 'Commission Paid',
};

export function backendApplicationStatusToUi(status: string): string {
  return BACKEND_TO_UI[status] ?? status;
}

export function uiApplicationStatusToBackend(label: string): (typeof APPLICATION_STATUSES)[number] | null {
  const t = label.trim();
  if ((APPLICATION_STATUSES as readonly string[]).includes(t)) {
    return t as (typeof APPLICATION_STATUSES)[number];
  }
  return UI_TO_BACKEND[t] ?? null;
}

/** Accepts backend enum or UI label; returns backend enum or null. */
export function normalizeApplicationStatusInput(input: string): (typeof APPLICATION_STATUSES)[number] | null {
  return uiApplicationStatusToBackend(input);
}
