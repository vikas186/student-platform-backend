export const diditConfig = () => ({
  apiKey: process.env.DIDIT_API_KEY?.trim() || '',
  baseUrl: (process.env.DIDIT_BASE_URL?.trim() || 'https://verification.didit.me').replace(/\/$/, ''),
  workflowId: process.env.DIDIT_WORKFLOW_ID?.trim() || '',
  webhookSecret: process.env.DIDIT_WEBHOOK_SECRET?.trim() || '',
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, ''),
});

export const assertDiditConfigured = (): void => {
  const c = diditConfig();
  if (!c.apiKey) {
    throw new Error('DIDIT_API_KEY is not set');
  }
  if (!c.workflowId) {
    throw new Error('DIDIT_WORKFLOW_ID is not set — copy from Didit Console → Workflows');
  }
};
