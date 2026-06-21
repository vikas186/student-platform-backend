export type DigiLockerOAuthState = {
  userId: string;
  applicationId: string;
  purpose: 'digilocker';
  codeVerifier: string;
};

export type DigiLockerIssuedDocument = {
  name: string;
  type: string;
  size: string;
  date: string;
  mime: string | string[];
  uri: string;
  doctype: string;
  description: string;
  issuerid: string;
  issuer: string;
};

export type DigiLockerConnectionStatus = {
  configured: boolean;
  connected: boolean;
  digilockerName: string | null;
  connectedAt: string | null;
};

export type DigiLockerAuthUrlResponse = {
  authUrl: string;
};

export type DigiLockerImportResult = {
  document: Record<string, unknown>;
};
