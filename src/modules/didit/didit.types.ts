export type DiditInternalStatus = 'not_started' | 'pending' | 'verified' | 'rejected' | 'failed';

export type DiditCreateSessionResponse = {
  session_id: string;
  session_number?: number;
  session_token?: string;
  url: string;
  vendor_data?: string;
  status?: string;
  workflow_id?: string;
};

export type DiditWebhookPayload = {
  event_id?: string;
  webhook_type?: string;
  timestamp?: number;
  session_id?: string;
  status?: string;
  vendor_data?: string;
  decision?: {
    id_verifications?: Array<{ document_type?: string }>;
  };
  [key: string]: unknown;
};

export type VerificationStatusDto = {
  status: DiditInternalStatus;
  sessionId: string | null;
  verificationUrl: string | null;
  documentType: string | null;
  updatedAt: string | null;
};
