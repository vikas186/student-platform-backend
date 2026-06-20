import { APPLICATION_STATUSES } from '../models/Application.model';

/** Uniwizer admin UI labels (see student-platform-frontend `LIFECYCLE` + Rejected). */
export const ADMIN_UI_APPLICATION_STATUSES = [
  'Draft',
  'Submitted',
  'Review',
  'Approved',
  'Offer',
  'Deposit',
  'Visa',
  'Enrolled',
  'Rejected',
] as const;

const UI_TO_BACKEND: Record<string, (typeof APPLICATION_STATUSES)[number]> = {
  Draft: 'draft',
  Submitted: 'submitted',
  Review: 'under_review',
  Approved: 'approved',
  Offer: 'offer_generated',
  Deposit: 'deposit_paid',
  Visa: 'visa_approved',
  Enrolled: 'enrolled',
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
  visa_approved: 'Visa',
  enrolled: 'Enrolled',
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
