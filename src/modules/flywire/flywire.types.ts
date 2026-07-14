export type FlywirePaymentType = 'deposit' | 'tuition';

export interface CreateFlywirePayLinkInput {
  userId: string;
  applicationId: string;
  agentProfileId?: number | null;
  amount: number;
  currency: string;
  type: FlywirePaymentType;
  studentEmail?: string | null;
  payerFirstName?: string | null;
  payerLastName?: string | null;
  /** ISO 3166-1 alpha-2; defaults to IN when missing. */
  payerCountry?: string | null;
  paymentDestination: string;
  returnUrl?: string | null;
}

export interface FlywireJsonLinkRequest {
  provider: 'PayByJSON';
  payment_destination: string;
  amount: number;
  max_amount?: number;
  country?: string;
  sender_email?: string;
  sender_first_name?: string;
  sender_last_name?: string;
  allow_to_edit_payer_information?: boolean;
  callback_url: string;
  callback_id: string;
  callback_version: '2';
  return_cta?: string;
  return_cta_name?: string;
  days_to_expire?: string;
}

export interface FlywireWebhookPayload {
  event_type?: string;
  event_date?: string;
  event_resource?: string;
  data?: {
    payment_id?: string;
    status?: string;
    external_reference?: string;
    amount_to?: string | number;
    currency_to?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
